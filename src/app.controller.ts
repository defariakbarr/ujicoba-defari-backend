import { Body, Controller, Get, Post, Delete, Param, Put, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './auth/roles.guard';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // --- UNIT ENDPOINTS ---
  @Post('unit')
  async tambahUnit(@Body() body: any) {
    return this.appService.createUnit(body);
  }

  @Get('unit')
  async ambilSemuaUnit() {
    return this.appService.getAllUnits();
  }

  // --- PRODUCT ENDPOINTS ---
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('tambah')
  async addProduct(@Body() body: any, @Req() req: any) {
    return this.appService.createProduct(body, req.user.userId);
  }

  @Get('produk')
  async ambilProduk(
    @Query('name') name?: string,
    @Query('category') category?: string,
    @Query('variant') variant?: string,
    @Query('storeId') storeId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number, 
  ) {
    return this.appService.getAllProducts(name, category, variant, storeId, sortBy, order, page, limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('produk/edit/:id')
  async editProduk(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const idUser = req.user?.sub || req.user?.userId;
    return this.appService.updateProduct(id, body, idUser);
  }

  @Post('produk/:id/tambah-varian')
  async tambahVarianBaru(@Param('id') id: string, @Body() body: any) {
    return this.appService.addMoreVariantToProduct(id, body);
  }
  
  @UseGuards(AuthGuard('jwt'))
  @Delete('hapus/:id')
  async hapusProduk(@Param('id') id: string) {
    return this.appService.deleteProduct(id);
  }

  // --- ORDER ENDPOINTS ---
  @UseGuards(AuthGuard('jwt'))
  @Post('order')
  async checkout(@Body() body: any, @Req() req: any) {
    return this.appService.createOrder(body, req.user.userId);
  }

  @Get('orders')
  async lihatSemuaOrder() {
    return this.appService.getAllOrders();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('order/cancel/:invoiceNumber')
  async batalOrder(@Param('invoiceNumber') invoiceNumber: string, @Req() req: any) {
    return this.appService.cancelOrder(invoiceNumber, req.user.userId);
  }

  @Put('order/pay/:invoiceNumber')
  async bayarOrder(@Param('invoiceNumber') invoiceNumber: string) {
    return this.appService.payOrder(invoiceNumber);
  }

  // ENDPOINT TRACKING BARU 1: Toko memproses pesanan (PAID -> PROCESSED)
  @Put('order/process/:invoiceNumber')
  async prosesOrderan(@Param('invoiceNumber') invoiceNumber: string) {
    return this.appService.processOrder(invoiceNumber);
  }

  // ENDPOINT TRACKING BARU 2: Toko input nomor resi (PROCESSED -> SHIPPED)
  @Put('order/ship/:invoiceNumber')
  async kirimOrderan(@Param('invoiceNumber') invoiceNumber: string) {
    return this.appService.shipOrder(invoiceNumber);
  }

  // ENDPOINT TRACKING BARU 3: Paket sampai tujuan (SHIPPED -> DELIVERED)
  @Put('order/deliver/:invoiceNumber')
  async sampaiOrderan(@Param('invoiceNumber') invoiceNumber: string) {
    return this.appService.deliverOrder(invoiceNumber);
  }

  @Put('order/success/:invoiceNumber')
  async selesaiOrder(
    @Param('invoiceNumber') invoiceNumber: string
  ) {
    return this.appService.successOrder(invoiceNumber);
  }

  // HISTORI PESANAN PEMBELI   
  @UseGuards(AuthGuard('jwt'))
  @Get('orders/buyer')
  async lihatOrderanSaya(
    @Req() req: any, 
    @Query('status') status?: string
  ) {
    const idUser = req.user?.sub || req.user?.userId;
    if (!idUser) {
      throw new BadRequestException('ID User tidak ditemukan di token, men!');
    }
    return this.appService.getBuyerOrders(idUser, status);
  }

  // DAFTAR PESANAN MASUK KE TOKO (SISI PENJUAL) 
  @UseGuards(AuthGuard('jwt'))
  @Get('orders/store/:storeId')
  async lihatOrderanMasukToko(
    @Param('storeId') storeId: string,
    @Query('status') status?: string
  ) {
    return this.appService.getStoreOrders(storeId, status);
  }

  // --- CART ENDPOINTS ---
  @UseGuards(AuthGuard('jwt'))
  @Post('cart')
  async addProductToCart(
    @Req() req: any, 
    @Body() body: { productId: string; quantity: number; variantName?: string; storeId: string }
  ) {
    console.log('--- DEBUG POST CART ---');
    console.log('Isi body dari Postman:', body);

    const idUser = req.user?.sub || req.user?.userId;
    if (!idUser) {
      throw new BadRequestException('ID User tidak terbaca di dalam token!');
    }

    // Kasih operator || 'Polosan' biar argumen ke-4 DIJAMIN string murni, bukan undefined!
    return this.appService.addToCart(
      idUser, 
      body.productId, 
      body.quantity, 
      body.variantName || 'Polosan', 
      body.storeId
    ); 
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('cart')
  async showMyCart(@Req() req: any) {
    const idUser = req.user?.sub || req.user?.userId;
    return this.appService.getCart(idUser); 
  }

  // --- STORE / MERCHANT ENDPOINTS ---
  @UseGuards(AuthGuard('jwt'))
  @Post('store/tambah')
  async createStore(@Body() body: any, @Req() req: any) {
    const idUser = req.user?.sub || req.user?.userId;
    if (!idUser) {
      throw new BadRequestException('ID User tidak ditemukan di token!');
    }
    return this.appService.createStore(body, idUser);
  }

  @Get('store')
  async lihatSemuaToko() {
    return this.appService.getAllStores();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('store/edit/:id')
  async editStore(@Param('id') id: string, @Body() body: any) {
    return this.appService.updateStore(id, body);
  }

@Post('voucher')
  async buatVoucherBaru(@Body() body: any) {
    return this.appService.createVoucher(body);
  }

  // DASHBOARD TOKO 
  @Get('store/dashboard/:storeId')
  async getDashboard(@Param('storeId') storeId: string) {
    return this.appService.getStoreDashboard(storeId);
  }
} 