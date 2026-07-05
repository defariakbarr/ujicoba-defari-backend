import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios'; 
import { firstValueFrom } from 'rxjs'; 
import { Product, ProductDocument } from './schemas/product.schema';
import { Unit, UnitDocument } from './schemas/unit.schema';
import { Order, OrderDocument } from './schemas/order.schema';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Stock, StockDocument } from './schemas/stock.schema';
import { Variant, VariantDocument } from './schemas/variant.schema';
import { Store, StoreDocument } from './schemas/store.schema';
import { Voucher, VoucherDocument } from './schemas/voucher.schema';

@Injectable()
export class AppService {
  constructor(
    private readonly httpService: HttpService, 
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Unit.name) private unitModel: Model<UnitDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @InjectModel(Variant.name) private readonly variantModel: Model<VariantDocument>,
    @InjectModel(Store.name) private readonly storeModel: Model<StoreDocument>,
    @InjectModel(Voucher.name) private readonly voucherModel: Model<VoucherDocument>,
  ) {}

  getHello(): string {
    return 'Hello World! API 3-Tabel TRIPLE JOIN Siap Tempur.';
  }

  // --- 4. FUNGSI GAIB UNTUK HIT API RAJAONGKIR (STARTER) ---
  async calculateOngkir(origin: string, destination: string, weight: number): Promise<number> {
    const apiKey = 'YOUR_RAJAONGKIR_API_KEY'; 
    const url = 'https://api.rajaongkir.com/starter/cost';

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            origin: origin, 
            destination: destination, 
            weight: weight, 
            courier: 'jne', 
          },
          {
            headers: { key: apiKey },
          }
        )
      );

      const results = response.data?.rajaongkir?.results[0]?.costs;
      if (!results || results.length === 0) return 9000; 

      return results[0].cost[0].value;
    } catch (error) {
      console.log('=== LOG ONGKIR: API Key Belum Valid, Menggunakan Tarif Statis Rp 9.000 ===');
      return 9000; 
    }
  }

  // --- UNIT MASTER ---
  async createUnit(data: any) {
    return new this.unitModel(data).save();
  }

  async getAllUnits() {
    return this.unitModel.find().exec();
  }

  // --- PRODUCT CRUD (TRIPLE JOIN ARSITEKTUR) ---
  async createProduct(data: any, userId: string): Promise<any> {
    const safeUserId = userId || null; // Fix 500 Error

    const isId = Types.ObjectId.isValid(data.unit);
    const foundUnit = await this.unitModel.findOne(
      isId ? { _id: new Types.ObjectId(data.unit) } : { name: data.unit }
    ).exec();

    if (!foundUnit) {
      throw new BadRequestException(`Unit '${data.unit}' tidak ditemukan di database!`);
    }

    if (!data.storeId) {
      throw new BadRequestException(`Field 'storeId' wajib diisi agar produk terhubung dengan Toko Anda!`);
    }
    if (!Types.ObjectId.isValid(data.storeId)) {
      throw new BadRequestException(`Format 'storeId' tidak valid!`);
    }

    const hasVariants = data.hasVariants ?? false;
    const variantsData = data.variants || [];
    const inputStock = Number(data.stock || 0);

    const { stock, variants, ...restOfData } = data;

    const newProduct = new this.productModel({
      ...restOfData,
      hasVariants,
      unit: foundUnit._id,
      storeId: new Types.ObjectId(data.storeId),
      createdBy: safeUserId,
      updatedBy: safeUserId,
    });
    const savedProduct = await newProduct.save();

    let totalCalculatedStock = 0;
    const finalVariantsResponse: any[] = [];

    if (hasVariants && variantsData.length > 0) {
      for (const v of variantsData) {
        const vQty = Number(v.qty !== undefined ? v.qty : (v.stock || 0));
        totalCalculatedStock += vQty;

        const newVariant = new this.variantModel({
          productId: savedProduct._id,
          variantName: v.variantName
        });
        const savedVariant = await newVariant.save();

        const newStock = new this.stockModel({
          variantId: savedVariant._id,
          qty: vQty
        });
        await newStock.save();

        finalVariantsResponse.push({ variantName: v.variantName, stock: vQty });
      }
    } else {
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
      storeId: data.storeId,
      stock: totalCalculatedStock,
      variants: finalVariantsResponse.length > 0 ? finalVariantsResponse : undefined,
      unit: obj.unit?.['name'] || null,
      createdBy: obj.createdBy?.['username'] || null,
      updatedBy: obj.updatedBy?.['username'] || null,
    };
  }

  async getAllProducts(
    name?: string, 
    category?: string,
    variant?: string, 
    storeId?: string,
    sortBy: string = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    page: number = 1,
    limit: number = 10,
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    const matchStage: any = {};
    if (name) matchStage.name = { $regex: name, $options: 'i' };
    if (category) matchStage.category = { $regex: category, $options: 'i' };
    
    if (storeId && Types.ObjectId.isValid(storeId)) {
      matchStage.storeId = new Types.ObjectId(storeId);
    } else {
      matchStage.storeId = { $exists: true }; 
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'variants',
          localField: '_id',
          foreignField: 'productId',
          as: 'dbVariants',
        },
      },
      {
        $lookup: {
          from: 'stocks',
          localField: 'dbVariants._id',
          foreignField: 'variantId',
          as: 'dbStocks',
        },
      },
      {
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creatorData',
        },
      },
    ];

    if (variant) {
      pipeline.push({
        $match: {
          'dbVariants.variantName': { $regex: variant, $options: 'i' },
        },
      });
    }

    pipeline.push({
      $project: {
        _id: 0,
        productId: '$_id',
        name: 1,
        price: 1,
        category: 1,
        storeId: 1,
        createdAt: 1,
        updatedAt: 1,
        unit: { $arrayElemAt: ['$unitData.name', 0] },
        createdBy: { $arrayElemAt: ['$creatorData.username', 0] },
        updatedBy: { $arrayElemAt: ['$creatorData.username', 0] },
        stock: { $sum: '$dbStocks.qty' },
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

    pipeline.push(
      { $sort: { [sortBy]: sortOrder } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: Number(limit) }],
        },
      }
    );

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

  async updateProduct(id: string, data: any, userId: string): Promise<any> {
    const { stock, ...productFields } = data;
    const updateData: any = { ...productFields, updatedBy: userId };

    if (data.unit) {
      const foundUnit = await this.unitModel.findOne({ name: data.unit }).exec();
      if (!foundUnit) throw new BadRequestException(`Unit '${data.unit}' tidak ditemukan!`);
      updateData.unit = foundUnit._id;
    }

    const updated = await this.productModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('createdBy', 'username -_id')
      .populate('updatedBy', 'username -_id')
      .populate('unit', 'name -_id')
      .lean()
      .exec();

    if (!updated) return null;

    if (stock !== undefined) {
      const firstVariant = await this.variantModel.findOne({ productId: updated._id }).exec();
      if (firstVariant) {
        await this.stockModel.findOneAndUpdate(
          { variantId: firstVariant._id },
          { qty: Number(stock) }
        ).exec();
      }
    }

    const dbVariants = await this.variantModel.find({ productId: updated._id }).lean().exec();
    let totalStock = 0;
    for (const v of dbVariants) {
      const stockRecord = await this.stockModel.findOne({ variantId: v._id }).lean().exec();
      totalStock += stockRecord ? stockRecord.qty : 0;
    }

    const { _id, __v, ...rest } = updated;

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

  async addMoreVariantToProduct(id: string, data: any): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Format ID Produk tidak valid!`);
    }
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException(`Produk dengan ID tersebut tidak ditemukan!`);

    const variantsData = data.variants || [];
    if (variantsData.length === 0) throw new BadRequestException(`Array variants tidak boleh kosong`);

    const addedVariantsResponse: any[] = [];
    for (const v of variantsData) {
      const isExist = await this.variantModel.findOne({ productId: product._id, variantName: v.variantName }).exec();
      if (isExist) continue;

      const vQty = Number(v.stock || 0);
      const newVariant = new this.variantModel({ productId: product._id, variantName: v.variantName });
      const savedVariant = await newVariant.save();

      const newStock = new this.stockModel({ variantId: savedVariant._id, qty: vQty });
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


  // --- MODUL CART ---
  async addToCart(userId: string, productId: string, quantity: number, variantName: string, storeID: string): Promise<any> {
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
      item && item.product && item.product.toString() === productId && 
      (item as any).variantName === targetVariantName &&
      (item as any).storeId?.toString() === storeID.toString()
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ 
        product: productId, 
        quantity, 
        variantName: targetVariantName,
        storeId: new Types.ObjectId(storeID) 
      } as any);
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
          storeId: product.storeId || null,
          variantName: (item as any).variantName || 'Polosan',
          price: product.price,
          quantity: item.quantity,
          subTotal: subTotal,
        });
      }
    }

    return { items: cleanItems, totalCartPrice };
  }

  // --- REFACTORING: MULTI-STORE CHECKOUT + INTEGRASI ONGKIR OTOMATIS ---
  async createOrder(data: any, userId: string): Promise<any> {
    const cart = await this.cartModel.findOne({ user: userId }).exec();
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Keranjang belanja kosong! Silahkan belanja dulu men.');
    }

   let appliedVoucher: any = null;
    if (data.voucherCode) {
      appliedVoucher = await this.voucherModel.findOne({ code: data.voucherCode.toUpperCase() }).exec();
      if (!appliedVoucher) {
        throw new BadRequestException(`Kode kupon '${data.voucherCode}' tidak valid!`);
      }
      if (appliedVoucher.currentUses >= appliedVoucher.maxUses) {
        throw new BadRequestException(`Kupon '${data.voucherCode}' sudah habis kuotanya!`);
      }
      if (new Date() > appliedVoucher.validUntil) {
        throw new BadRequestException(`Kupon '${data.voucherCode}' sudah expired!`);
      }
    }

    const itemsByStore: { [storeId: string]: any[] } = {};

    for (const item of cart.items) {
      if (!item || !item.product) continue;
      
      const product = await this.productModel.findById(item.product).exec();
      if (!product) throw new NotFoundException(`Produk dengan ID ${item.product} tidak ditemukan!`);

      const targetVariantName = (item as any).variantName || 'Polosan';
      
      const foundVariant = await this.variantModel.findOne({ productId: product._id, variantName: targetVariantName }).exec();
      if (!foundVariant) throw new NotFoundException(`Varian '${targetVariantName}' untuk produk ${product.name} tidak ditemukan!`);

      const stockData = await this.stockModel.findOne({ variantId: foundVariant._id }).exec();
      if (!stockData) throw new NotFoundException(`Data stok untuk varian ${targetVariantName} tidak ditemukan!`);

      if (stockData.qty < item.quantity) {
        throw new BadRequestException(`Stok produk [${product.name}] varian '${targetVariantName}' kurang! Sisa: ${stockData.qty}`);
      }

      const storeIdStr = product.storeId ? product.storeId.toString() : 'TANPA_TOKO';

      if (!itemsByStore[storeIdStr]) {
        itemsByStore[storeIdStr] = [];
      }

      itemsByStore[storeIdStr].push({
        product: product._id,
        productName: product.name,
        variantName: targetVariantName,
        quantity: item.quantity,
        priceAtPurchase: product.price,
        weight: (product as any).weight || 100, 
        stockModelInstance: stockData
      });
    }

    const createdOrdersResponse: any[] = [];

    for (const storeIdKey of Object.keys(itemsByStore)) {
      const storeItems = itemsByStore[storeIdKey];
      let totalProductPrice = 0;
      let totalStoreWeight = 0;
      const finalItemsWithDetails: any[] = [];

      for (const item of storeItems) {
        totalProductPrice += item.priceAtPurchase * item.quantity;
        totalStoreWeight += item.weight * item.quantity; 
        
        finalItemsWithDetails.push({
          product: item.product,
          variantName: item.variantName,
          quantity: item.quantity,
          priceAtPurchase: item.priceAtPurchase,
          storeId: new Types.ObjectId(storeIdKey),
        });

        item.stockModelInstance.qty -= item.quantity;
        await item.stockModelInstance.save();
      }

      let originCity = '152'; 
      let destinationCity = '457'; 

      if (storeIdKey !== 'TANPA_TOKO') {
        const store = await this.storeModel.findById(storeIdKey).exec();
        if (store && (store as any).cityId) originCity = (store as any).cityId;
      }

      const shippingCost = await this.calculateOngkir(originCity, destinationCity, totalStoreWeight);
      
      // --- LOGIKA PEMOTONGAN HARGA DISKON ---
      let grandTotalPrice = totalProductPrice + shippingCost;
      let totalDiscount = 0;
      
      if (appliedVoucher) {
        if (appliedVoucher.discountType === 'PERCENTAGE') {
          totalDiscount = (grandTotalPrice * appliedVoucher.discountValue) / 100;
        } else if (appliedVoucher.discountType === 'NOMINAL') {
          totalDiscount = appliedVoucher.discountValue;
        }
        grandTotalPrice -= totalDiscount;
        if (grandTotalPrice < 0) grandTotalPrice = 0; // Biar harga gak minus
      }

      const invoiceNumber = `INV-${Date.now()}-${storeIdKey.slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const newOrder = new this.orderModel({
        invoiceNumber,
        buyer: userId,
        items: finalItemsWithDetails,
        shippingCost: shippingCost, 
        totalPrice: grandTotalPrice, 
        status: 'PENDING'
      });

      if (storeIdKey !== 'TANPA_TOKO') {
        (newOrder as any).storeId = new Types.ObjectId(storeIdKey);
      }
      
      // Simpan riwayat diskon ke invoice biar pembeli tau potongannya berapa
      if (appliedVoucher) {
        (newOrder as any).discountApplied = totalDiscount;
        (newOrder as any).voucherCode = appliedVoucher.code;
      }

      const savedOrder = await newOrder.save();
      
      createdOrdersResponse.push({
        invoiceNumber: savedOrder.invoiceNumber,
        storeId: storeIdKey,
        totalProductPrice: totalProductPrice,
        shippingCost: shippingCost,
        discountApplied: totalDiscount || 0,
        totalPrice: grandTotalPrice,
        status: (savedOrder as any).status
      });
    }

    // --- UPDATE KUOTA VOUCHER KALAU BERHASIL DIPAKE ---
    if (appliedVoucher) {
      appliedVoucher.currentUses += createdOrdersResponse.length;
      await appliedVoucher.save();
    }

    cart.items = [];
    await cart.save();

    return {
      message: `Checkout Berhasil! ${appliedVoucher ? 'Kupon diskon [' + appliedVoucher.code + '] sukses diterapkan! 🎉' : ''}`,
      orders: createdOrdersResponse
    };
  }
  async getAllOrders(): Promise<any[]> {
    const orders = await this.orderModel.find().populate('buyer', 'username -_id').populate('items.product', 'name -_id').lean().exec();
    return orders.map(order => {
      const { _id, __v, ...rest } = order;
      return {
        ...rest,
        buyer: order.buyer?.['username'] || null,
        items: (order.items || []).map((i: any) => ({ 
          product: i.product?.['name'] || null, 
          variantName: i.variantName, 
          quantity: i.quantity, 
          priceAtPurchase: i.priceAtPurchase,
          storeId: i.storeId
        })),
      };
    });
  }

  async getBuyerOrders(userId: string, status?: string): Promise<any[]> {
    const filterQuery: any = { buyer: new Types.ObjectId(userId) };
    if (status) filterQuery.status = status.toUpperCase(); 

    const orders = await this.orderModel
      .find(filterQuery)
      .populate('buyer', 'username -_id')
      .populate('items.product', 'name -_id')
      .sort({ createdAt: -1 }) 
      .lean()
      .exec();

    return orders.map(order => {
      const { _id, __v, ...rest } = order;
      return {
        ...rest,
        buyer: order.buyer?.['username'] || null,
        items: (order.items || []).map((i: any) => ({
          product: i.product?.['name'] || null,
          variantName: i.variantName,
          quantity: i.quantity,
          priceAtPurchase: i.priceAtPurchase,
          storeId: i.storeId
        })),
      };
    });
  }

  async getStoreOrders(storeId: string, status?: string): Promise<any[]> {
    const filterQuery: any = {
      $or: [
        { 'items.storeId': storeId },
        { 'items.storeId': new Types.ObjectId(storeId) }
      ]
    };
    if (status) filterQuery.status = status.toUpperCase();

    const orders = await this.orderModel
      .find(filterQuery)
      .populate('buyer', 'username -_id')
      .populate('items.product', 'name -_id')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return orders.map(order => {
      const { _id, __v, ...rest } = order;
      const myItems = (order.items || []).filter(
        (i: any) => i.storeId && i.storeId.toString() === storeId.toString()
      );

      return {
        ...rest,
        buyer: order.buyer?.['username'] || null,
        items: myItems.map((i: any) => ({
          product: i.product?.['name'] || null,
          variantName: i.variantName,
          quantity: i.quantity,
          priceAtPurchase: i.priceAtPurchase,
          storeId: i.storeId 
        })),
      };
    });
  }

  async cancelOrder(invoiceNumber: string, userId: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);

    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PENDING' && currentStatus !== 'PAID') {
      throw new BadRequestException(`Order tidak bisa dicancel karena sudah berkategori ${currentStatus}`);
    }

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.product) {
          const prodId = (item.product as any)._id || item.product;
          const foundVariant = await this.variantModel.findOne({ productId: prodId }).exec();

          if (foundVariant) {
            const quantityToRestore = Number(item.quantity || 0);
            await this.stockModel.updateOne(
              { variantId: foundVariant._id },
              { $inc: { qty: quantityToRestore } }
            ).exec();
          }
        }
      }
    }

    order.status = 'CANCELLED';
    const savedOrder = await order.save();
    const rawOrderObj = savedOrder.toObject(); 

    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any, index: number) => ({ 
        product: i.product?.['name'] || null, 
        variantName: i.variantName, 
        quantity: i.quantity, 
        priceAtPurchase: i.priceAtPurchase,
        storeId: (rawOrderObj.items[index] as any)?.storeId || i.storeId 
      })),
    };
  }

  async payOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);
    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PENDING') throw new BadRequestException(`Order sudah ${currentStatus}`);

    order.status = 'PAID';
    const savedOrder = await order.save();
    const rawOrderObj = savedOrder.toObject(); 

    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any, index: number) => ({ 
        product: i.product?.['name'] || null, 
        variantName: i.variantName, 
        quantity: i.quantity, 
        priceAtPurchase: i.priceAtPurchase,
        storeId: (rawOrderObj.items[index] as any)?.storeId || i.storeId 
      })),
    };
  }

  async processOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);
    
    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PAID') throw new BadRequestException(`Order belum dibayar! Status sekarang: ${currentStatus}`);

    order.status = 'PROCESSED';
    const savedOrder = await order.save();
    const rawOrderObj = savedOrder.toObject(); 

    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any, index: number) => ({ 
        product: i.product?.['name'] || null, 
        variantName: i.variantName, 
        quantity: i.quantity, 
        priceAtPurchase: i.priceAtPurchase,
        storeId: (rawOrderObj.items[index] as any)?.storeId || i.storeId 
      })),
    };
  }

  async shipOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);

    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'PROCESSED') throw new BadRequestException(`Order belum diproses toko! Status sekarang: ${currentStatus}`);

    const randomResi = `JNE-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    order.status = 'SHIPPED';
    (order as any).resiNumber = randomResi; 
    
    const savedOrder = await order.save();
    const rawOrderObj = savedOrder.toObject(); 

    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any, index: number) => ({ 
        product: i.product?.['name'] || null, 
        variantName: i.variantName, 
        quantity: i.quantity, 
        priceAtPurchase: i.priceAtPurchase,
        storeId: (rawOrderObj.items[index] as any)?.storeId || i.storeId 
      })),
    };
  }

  async deliverOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);

    const currentStatus = order.get ? order.get('status') : (order as any).status;
    if (currentStatus !== 'SHIPPED') throw new BadRequestException(`Order belum dikirim kurir! Status sekarang: ${currentStatus}`);

    order.status = 'DELIVERED';
    const savedOrder = await order.save();
    const rawOrderObj = savedOrder.toObject(); 

    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any, index: number) => ({ 
        product: i.product?.['name'] || null, 
        variantName: i.variantName, 
        quantity: i.quantity, 
        priceAtPurchase: i.priceAtPurchase,
        storeId: (rawOrderObj.items[index] as any)?.storeId || i.storeId 
      })),
    };
  }

  async successOrder(invoiceNumber: string): Promise<any> {
    const order = await this.orderModel.findOne({ invoiceNumber }).exec();
    if (!order) throw new NotFoundException(`Order tidak ditemukan!`);
    const currentStatus = order.get ? order.get('status') : (order as any).status;
    
    if (currentStatus !== 'DELIVERED') throw new BadRequestException(`Harus DELIVERED (sampai di tujuan) terlebih dahulu!`);

    order.status = 'SUCCESS';
    const savedOrder = await order.save();
    const rawOrderObj = savedOrder.toObject(); 

    const populated = await savedOrder.populate([{ path: 'buyer', select: 'username -_id' }, { path: 'items.product', select: 'name -_id' }]);
    const obj = populated.toObject();
    const { _id, __v, ...rest } = obj;

    return {
      ...rest,
      buyer: obj.buyer?.['username'] || null,
      items: obj.items.map((i: any, index: number) => ({ 
        product: i.product?.['name'] || null, 
        variantName: i.variantName, 
        quantity: i.quantity, 
        priceAtPurchase: i.priceAtPurchase,
        storeId: (rawOrderObj.items[index] as any)?.storeId || i.storeId 
      })),
    };
  }

  // --- MODUL TOKO / MERCHANT ---
  async createStore(data: any, userId: string): Promise<any> {
    const existingStore = await this.storeModel.findOne({ ownerId: new Types.ObjectId(userId) }).exec();
    if (existingStore) {
      throw new BadRequestException('User ini sudah memiliki toko! Satu user hanya boleh membuat satu toko.');
    }

    const nameDuplicate = await this.storeModel.findOne({ name: data.name }).exec();
    if (nameDuplicate) {
      throw new BadRequestException(`Nama toko '${data.name}' sudah digunakan! Silahkan cari nama lain.`);
    }

    const newStore = new this.storeModel({
      name: data.name,
      description: data.description,
      ownerId: new Types.ObjectId(userId),
    });

    const savedStore = await newStore.save();
    return savedStore;
  }

  async updateStore(id: string, data: any): Promise<any> {
    const updated = await this.storeModel.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!updated) throw new NotFoundException(`Toko dengan ID ${id} tidak ditemukan!`);
    
    const obj = updated.toObject();
    const { __v, ...rest } = obj; 
    
    return rest;
  }

  async getAllStores(): Promise<any[]> {
    return this.storeModel.find()
      .populate('ownerId', 'username email -_id') 
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  // DASHBOARD CUAN & OMSET TOKO 
  async getStoreDashboard(storeId: string): Promise<any> {
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException('Format ID Toko (storeId) tidak valid!');
    }

    const store = await this.storeModel.findById(storeId).exec();
    if (!store) {
      throw new NotFoundException('Toko tidak ditemukan!');
    }

    const aggregationResult = await this.orderModel.aggregate([
      {
        $match: {
          'items.storeId': new Types.ObjectId(storeId), // 👈 INI DIA YANG DITAMBAHIN KATA 'items.'
          status: 'SUCCESS',
        },
      },
      {
        $facet: {
          invoiceMetrics: [
            {
              $group: {
                _id: null,
                totalTransactions: { $sum: 1 }, 
                totalOmsetKotor: { $sum: '$totalPrice' }, 
                totalOngkir: { $sum: '$shippingCost' }, 
              },
            },
          ],
          itemMetrics: [
            { $unwind: '$items' }, 
            {
              $group: {
                _id: null,
                totalProductsSold: { $sum: '$items.quantity' }, 
                totalPureProductRevenue: { 
                  $sum: { $multiply: ['$items.priceAtPurchase', '$items.quantity'] } 
                }, 
              },
            },
          ],
        },
      },
    ]).exec();

    const facetResult = aggregationResult[0];
    const invoiceData = facetResult.invoiceMetrics[0] || { totalTransactions: 0, totalOmsetKotor: 0, totalOngkir: 0 };
    const itemData = facetResult.itemMetrics[0] || { totalProductsSold: 0, totalPureProductRevenue: 0 };

    const keuntunganBersihEstimasi = Math.round(itemData.totalPureProductRevenue * 0.85);

    return {
      storeId: store._id,
      storeName: store.name,
      metrics: {
        totalSuccessTransactions: invoiceData.totalTransactions,
        totalProductsSold: itemData.totalProductsSold,
        totalOmsetKotor: invoiceData.totalOmsetKotor, 
        totalPureProductRevenue: itemData.totalPureProductRevenue, 
        totalShippingRevenue: invoiceData.totalOngkir, 
        estimatedNetProfit: keuntunganBersihEstimasi 
      }
    };
  }

  // SISTEM KUPON DISKON 
  async createVoucher(data: any): Promise<any> {
    const newVoucher = new this.voucherModel({
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUses: data.maxUses,
      validUntil: new Date(data.validUntil)
    });
    return newVoucher.save();
  }
}