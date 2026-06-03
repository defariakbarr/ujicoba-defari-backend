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
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number, 
  ) {
    return this.appService.getAllProducts(name, category, variant, sortBy, order, page, limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('edit/:id')
  async editProduk(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.appService.updateProduct(id, body, req.user.userId);
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

  @Put('order/success/:invoiceNumber')
  async selesaiOrder(@Param('invoiceNumber') invoiceNumber: string) {
    return this.appService.successOrder(invoiceNumber);
  }

 // --- CART ENDPOINTS ---
  @UseGuards(AuthGuard('jwt'))
  @Post('cart')
  async addProductToCart(@Req() req: any, @Body() body: { productId: string; quantity: number }) {
    // KITA INTIP DI TERMINAL: Apa isi req.user yang dikirim oleh JwtStrategy
    console.log('--- DEBUG POST CART ---');
    console.log('Isi req.user dari token:', req.user);
    console.log('Isi body dari Postman:', body);

    // Pengaman ekstra: Kalau JwtStrategy lu ngirimnya 'sub', kita pake 'sub'. Kalau 'userId', kita pake 'userId'.
    const idUser = req.user?.sub || req.user?.userId;

    if (!idUser) {
      throw new BadRequestException('ID User tidak terbaca di dalam token! Cek JwtStrategy kamu.');
    }

    return this.appService.addToCart(idUser, body.productId, body.quantity); 
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('cart')
  async showMyCart(@Req() req: any) {
    const idUser = req.user?.sub || req.user?.userId;
    return this.appService.getCart(idUser); 
  }
}