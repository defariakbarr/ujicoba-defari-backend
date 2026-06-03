import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Unit, UnitDocument } from './schemas/unit.schema';
import { Order, OrderDocument } from './schemas/order.schema';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Stock, StockDocument } from './schemas/stock.schema';
import { Variant, VariantDocument } from './schemas/variant.schema';

@Injectable()
export class AppService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Unit.name) private unitModel: Model<UnitDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @InjectModel(Variant.name) private readonly variantModel: Model<VariantDocument>,
  ) {}

  getHello(): string {
    return 'Hello World! API 3-Tabel TRIPLE JOIN Siap Tempur.';
  }

  // --- UNIT MASTER ---
  async createUnit(data: any) {
    return new this.unitModel(data).save();
  }

  async getAllUnits() {
    return this.unitModel.find().exec();
  }

  // --- PRODUCT CRUD (3-WAY SPLIT: PRODUCTS -> VARIANTS -> STOCKS) ---
  async createProduct(data: any, userId: string): Promise<any> {
    const foundUnit = await this.unitModel.findOne({ name: data.unit }).exec();
    if (!foundUnit) {
      throw new BadRequestException(`Unit '${data.unit}' tidak ditemukan!`);
    }

    const hasVariants = data.hasVariants ?? false;
    const variantsData = data.variants || [];
    const inputStock = Number(data.stock || 0);

    const { stock, variants, ...restOfData } = data;

    // 1. RUMAH 1: Simpan Spek Umum Produk
    const newProduct = new this.productModel({
      ...restOfData,
      hasVariants,
      unit: foundUnit._id,
      createdBy: userId,
      updatedBy: userId,
    });
    const savedProduct = await newProduct.save();

    let totalCalculatedStock = 0;
    const finalVariantsResponse: any[] = [];

    if (hasVariants && variantsData.length > 0) {
      for (const v of variantsData) {
        const vQty = Number(v.stock || 0);
        totalCalculatedStock += vQty;

        // 2. RUMAH 2: Simpan nama varian rasa ke tabel 'variants'
        const newVariant = new this.variantModel({
          productId: savedProduct._id,
          variantName: v.variantName
        });
        const savedVariant = await newVariant.save();

        // 3. RUMAH 3: Simpan qty stoknya ke tabel 'stocks' pakai variantId
        const newStock = new this.stockModel({
          variantId: savedVariant._id,
          qty: vQty
        });
        await newStock.save();

        finalVariantsResponse.push({ variantName: v.variantName, stock: vQty });
      }
    } else {
      // Produk polosan: Tetap buat 1 varian default "Polosan" biar arsitektur konsisten
      totalCalculatedStock = inputStock;

      const newVariant = new this.variantModel({
        productId: savedProduct._id,
        variantName: 'Polosan'
      });
      const savedVariant = await newVariant.save();

      const newStock = new this.stockModel({
        variantId: savedVariant._id,
        qty: inputStock
      });
      await newStock.save();
    }

    const populated = await savedProduct.populate([
      { path: 'createdBy', select: 'username -_id' },
      { path: 'updatedBy', select: 'username -_id' },
      { path: 'unit', select: 'name -_id' }
    ]);

    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      productId: savedProduct._id,
      ...rest,
      stock: totalCalculatedStock,
      variants: finalVariantsResponse.length > 0 ? finalVariantsResponse : undefined,
      unit: obj.unit?.['name'] || null,
      createdBy: obj.createdBy?.['username'] || null,
      updatedBy: obj.updatedBy?.['username'] || null,
    };
  }

  // --- TASK AGGREGATION LOOKUP REFACTORING (SINKRON AGGREGATE DB) ---
  async getAllProducts(
    name?: string, 
    category?: string,
    variant?: string, 
    sortBy: string = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    // 1. Tahap Match Awal untuk Filter Produk
    const matchStage: any = {};
    if (name) matchStage.name = { $regex: name, $options: 'i' };
    if (category) matchStage.category = { $regex: category, $options: 'i' };

    // 2. Bangun Pipeline Aggregation Sesuai Spek "Lookup" Mas Kusnur
    const pipeline: any[] = [
      { $match: matchStage },

      // LOOKUP 1: Relasikan Product ke collection 'variants'
      {
        $lookup: {
          from: 'variants',
          localField: '_id',
          foreignField: 'productId',
          as: 'dbVariants',
        },
      },

      // LOOKUP 2: Relasikan hasil 'dbVariants' ke collection 'stocks'
      {
        $lookup: {
          from: 'stocks',
          localField: 'dbVariants._id',
          foreignField: 'variantId',
          as: 'dbStocks',
        },
      },

      // LOOKUP 3: Join master Unit
      {
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      },

      // LOOKUP 4: Join User Creator
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creatorData',
        },
      },
    ];

    // 3. Filter Varian Rasa di Tingkat Pipeline Database MongoDB
    if (variant) {
      pipeline.push({
        $match: {
          'dbVariants.variantName': { $regex: variant, $options: 'i' },
        },
      });
    }

    // 4. Project Stage untuk Formatting Response Biar Tetap Flat Key
    pipeline.push({
      $project: {
        _id: 0,
        productId: '$_id',
        name: 1,
        price: 1,
        category: 1,
        createdAt: 1,
        updatedAt: 1,
        unit: { $arrayElemAt: ['$unitData.name', 0] },
        createdBy: { $arrayElemAt: ['$creatorData.username', 0] },
        updatedBy: { $arrayElemAt: ['$creatorData.username', 0] },
        
        // Aggregasi Total Stock Langsung di Tingkat DB MongoDB Engine
        stock: { $sum: '$dbStocks.qty' },

        // Ekstrak Array Varian Menjadi Array String Flat Dinamis
        variantName: {
          $map: {
            input: {
              $filter: {
                input: '$dbVariants',
                as: 'v',
                cond: variant 
                  ? { $regexMatch: { input: '$$v.variantName', regex: variant, options: 'i' } }
                  : true
              }
            },
            as: 'filteredV',
            in: '$$filteredV.variantName'
          }
        }
      }
    });

    // 5. Facet Stage untuk Pagination & Sorting Cepat
    pipeline.push(
      { $sort: { [sortBy]: sortOrder } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: Number(limit) }],
        },
      }
    );

    // Eksekusi Tunggal ke Engine MongoDB
    const aggregationResult = await this.productModel.aggregate(pipeline).exec();
    const result = aggregationResult[0];

    const totalData = result.metadata[0]?.total || 0;
    const finalData = result.data.map((product: any) => ({
      ...product,
      variantName: product.variantName.length > 0 ? product.variantName : undefined,
    }));

    return {
      meta: {
        totalData,
        page: Number(page),
        limit: Number(limit),
        totalPage: Math.ceil(totalData / limit),
      },
      data: finalData,
    };
  }

  // --- SEKARANG AMAN SUDAH DIKEMBALIKAN KE PERADABAN ---
  async updateProduct(id: string, data: any, userId: string): Promise<any> {
    const updateData: any = { ...data, updatedBy: userId };

    if (data.unit) {
      const foundUnit = await this.unitModel.findOne({ name: data.unit }).exec();
      if (!foundUnit) throw new BadRequestException(`Unit '${data.unit}' tidak ditemukan!`);
      updateData.unit = foundUnit._id;
    }

    const updated = await this.productModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('createdBy', 'username -_id').populate('updatedBy', 'username -_id').populate('unit', 'name -_id').lean().exec();

    if (!updated) return null;
    const { _id, __v, ...rest } = updated;

    const dbVariants = await this.variantModel.find({ productId: updated._id }).lean().exec();
    let totalStock = 0;
    for (const v of dbVariants) {
      const stockRecord = await this.stockModel.findOne({ variantId: v._id }).lean().exec();
      totalStock += stockRecord ? stockRecord.qty : 0;
    }

    return {
      ...rest,
      stock: totalStock,
      unit: updated.unit?.['name'] || null, 
      createdBy: updated.createdBy?.['username'] || null,
      updatedBy: updated.updatedBy?.['username'] || null,
    };
  }

  async deleteProduct(id: string): Promise<any> {
    const dbVariants = await this.variantModel.find({ productId: id }).exec();
    for (const v of dbVariants) {
      await this.stockModel.deleteMany({ variantId: v._id }).exec();
    }
    await this.variantModel.deleteMany({ productId: id }).exec();
    return this.productModel.findByIdAndDelete(id).exec();
  }

  // --- MODUL CART ---
  async addToCart(userId: string, productId: string, quantity: number, variantName?: string): Promise<any> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException(`Format ID Produk tidak valid!`);
    }

    const product = await this.productModel.findById(productId).exec();
    if (!product) throw new NotFoundException('Produk tidak ditemukan!');

    const targetVariantName = variantName || 'Polosan';
    
    const foundVariant = await this.variantModel.findOne({ productId: product._id, variantName: targetVariantName }).exec();
    if (!foundVariant) {
      throw new BadRequestException(`Varian rasa '${targetVariantName}' tidak valid untuk produk ini!`);
    }

    const stockData = await this.stockModel.findOne({ variantId: foundVariant._id }).exec();
    if (!stockData) throw new NotFoundException(`Data stok varian ini tidak ditemukan!`);

    if (stockData.qty < quantity) {
      throw new BadRequestException(`Stok rasa '${targetVariantName}' tidak mencukupi! Sisa: ${stockData.qty}`);
    }

    let cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart) cart = new this.cartModel({ user: userId, items: [] });

    const itemsList = cart.items || [];
    const itemIndex = itemsList.findIndex(item => 
      item && item.product && item.product.toString() === productId && (item as any).variantName === targetVariantName
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity, variantName: targetVariantName } as any);
    }

    await cart.save();
    return this.getCart(userId);
  }

  async getCart(userId: string): Promise<any> {
    const cart = await this.cartModel.findOne({ user: userId }).lean().exec();
    if (!cart || !cart.items || cart.items.length === 0) {
      return { user: userId, items: [], totalCartPrice: 0 };
    }

    let totalCartPrice = 0;
    const cleanItems: any[] = [];

    for (const item of cart.items) {
      if (!item || !item.product) continue;
      const product = await this.productModel.findById(item.product).lean().exec();
      if (product) {
        const subTotal = (product.price ?? 0) * item.quantity;
        totalCartPrice += subTotal;

        cleanItems.push({
          productId: product._id,
          productName: product.name,
          variantName: (item as any).variantName || 'Polosan',
          price: product.price,
          quantity: item.quantity,
          subTotal: subTotal,
        });
      }
    }

    return { items: cleanItems, totalCartPrice };
  }

  // --- MODUL TRANSAKSI / ORDER ---
  async createOrder(data: any, userId: string): Promise<any> {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Keranjang belanja kosong!');
    }

    let totalOrderPrice = 0;
    const itemsWithDetails: any[] = [];

    for (const item of cart.items) {
      const product = await this.productModel.findById(item.product).exec();
      if (!product) throw new NotFoundException(`Produk tidak ditemukan!`);

      const targetVariantName = (item as any).variantName || 'Polosan';
      
      const foundVariant = await this.variantModel.findOne({ productId: product._id, variantName: targetVariantName }).exec();
      if (!foundVariant) throw new NotFoundException(`Varian '${targetVariantName}' lenyap!`);

      const stockData = await this.stockModel.findOne({ variantId: foundVariant._id }).exec();
      if (!stockData) throw new NotFoundException(`Stok varian ini tidak ditemukan!`);

      if (stockData.qty < item.quantity) {
        throw new BadRequestException(`Stok varian '${targetVariantName}' habis atau tidak cukup!`);
      }

      totalOrderPrice += product.price * item.quantity;

      itemsWithDetails.push({
        product: product._id,
        variantName: targetVariantName,
        quantity: item.quantity,
        priceAtPurchase: product.price,
      });

      stockData.qty = stockData.qty - item.quantity;
      await stockData.save();
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = new this.orderModel({ invoiceNumber, buyer: userId, items: itemsWithDetails, totalPrice: totalOrderPrice, status: 'PENDING' });
    const savedOrder = await newOrder.save();

    cart.items = [];
    await cart.save();
    
    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any) => ({ product: i.product?.['name'] || null, variantName: i.variantName, quantity: i.quantity, priceAtPurchase: i.priceAtPurchase })),
    };
  }

  async getAllOrders(): Promise<any[]> {
    const orders = await this.orderModel.find().populate('buyer', 'username -_id').populate('items.product', 'name -_id').lean().exec();
    return orders.map(order => {
      const { _id, __v, ...rest } = order;
      return {
        ...rest,
        buyer: order.buyer?.['username'] || null,
        items: (order.items || []).map((i: any) => ({ product: i.product?.['name'] || null, variantName: i.variantName, quantity: i.quantity, priceAtPurchase: i.priceAtPurchase })),
      };
    });
  }

  async cancelOrder(invoiceNumber: string, userId: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);

    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PENDING') throw new BadRequestException(`Sudah berkategori ${currentStatus}`);

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.product) {
          const targetVariantName = (item as any).variantName || 'Polosan';
          const foundVariant = await this.variantModel.findOne({ productId: item.product, variantName: targetVariantName }).exec();
          if (foundVariant) {
            const stockData = await this.stockModel.findOne({ variantId: foundVariant._id }).exec();
            if (stockData) {
              stockData.qty = stockData.qty + item.quantity;
              await stockData.save();
            }
          }
        }
      }
    }

    order.status = 'CANCELLED';
    const savedOrder = await order.save();
    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any) => ({ product: i.product?.['name'] || null, variantName: i.variantName, quantity: i.quantity, priceAtPurchase: i.priceAtPurchase })),
    };
  }

  async payOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);
    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PENDING') throw new BadRequestException(`Order sudah ${currentStatus}`);

    order.status = 'PAID';
    const savedOrder = await order.save();
    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any) => ({ product: i.product?.['name'] || null, variantName: i.variantName, quantity: i.quantity, priceAtPurchase: i.priceAtPurchase })),
    };
  }

  async successOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);
    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PAID') throw new BadRequestException(`Harus PAID terlebih dahulu!`);

    order.status = 'SUCCESS';
    const savedOrder = await order.save();
    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any) => ({ product: i.product?.['name'] || null, variantName: i.variantName, quantity: i.quantity, priceAtPurchase: i.priceAtPurchase })),
    };
  }

  async addMoreVariantToProduct(id: string, data: any): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Format ID Produk tidak valid!`);
    }

    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Produk dengan ID tersebut tidak ditemukan!`);
    }

    const variantsData = data.variants || [];
    if (variantsData.length === 0) {
      throw new BadRequestException(`Array variants tidak boleh kosong`);
    }

    const addedVariantsResponse: any[] = [];

    for (const v of variantsData) {
      const isExist = await this.variantModel.findOne({ productId: product._id, variantName: v.variantName }).exec();
      if (isExist) continue;

      const vQty = Number(v.stock || 0);

      const newVariant = new this.variantModel({
        productId: product._id,
        variantName: v.variantName
      });
      const savedVariant = await newVariant.save();

      const newStock = new this.stockModel({
        variantId: savedVariant._id,
        qty: vQty
      });
      await newStock.save();

      addedVariantsResponse.push({ variantName: v.variantName, stock: vQty });
    }

    const allDbVariants = await this.variantModel.find({ productId: product._id }).lean().exec();
    let totalStock = 0;
    const allVariantsList: any[] = [];

    for (const v of allDbVariants) {
      const stockRecord = await this.stockModel.findOne({ variantId: v._id }).lean().exec();
      const q = stockRecord ? stockRecord.qty : 0;
      totalStock += q;
      allVariantsList.push({ variantName: v.variantName, stock: q });
    }

    return {
      message: 'Varian rasa baru berhasil ditambahkan',
      productId: product._id,
      productName: product.name,
      totalStockSekarang: totalStock,
      allVariants: allVariantsList
    };
  }
}