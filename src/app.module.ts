import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios'; 
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Product, ProductSchema } from './schemas/product.schema';
import { Unit, UnitSchema } from './schemas/unit.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Cart, CartSchema } from './schemas/cart.schema';
import { AuthModule } from './auth/auth.module';
import { Stock, StockSchema } from './schemas/stock.schema';
import { Variant, VariantSchema } from './schemas/variant.schema';
import { Store, StoreSchema } from './schemas/store.schema';
import { Voucher, VoucherSchema } from './schemas/voucher.schema';

@Module({
  imports: [
    HttpModule, 
    MongooseModule.forRoot('mongodb://localhost:27017/db_inventory_baru'),
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Cart.name, schema: CartSchema },
      { name: Stock.name, schema: StockSchema }, 
      { name: Variant.name, schema: VariantSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Voucher.name, schema: VoucherSchema },
    ]),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}