import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true, versionKey: false })
export class Order {
  @Prop({ required: true })
  invoiceNumber!: string; // Contoh: INV-20260516-0001

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  buyer?: string; // Siapa yang beli

  // Array berisi produk-produk yang dibeli beserta jumlahnya
  @Prop([
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      priceAtPurchase: { type: Number, required: true }, // Harga pas dibeli (biar kalau harga produk naik, histori gak berubah)
    },
  ])
  items!: Array<{
    product: string;
    quantity: number;
    priceAtPurchase: number;
  }>;

  @Prop({ required: true })
  totalPrice!: number;

  @Prop({ default: 'PENDING' }) // PENDING, PAID, SHIPPED, SUCCESS, CANCELLED
  status?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);