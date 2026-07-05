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

  // 👇 INI BLOK YANG GUA UBAH MEN! SUDAH ADA STORE_ID & VARIANT_NAME 👇
  @Prop([
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      priceAtPurchase: { type: Number, required: true }, // Harga pas dibeli
      variantName: { type: String, required: false }, // Biar varian gak hilang
      storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true } // KUNCI UTAMA HISTORI TOKO
    },
  ])
  items!: Array<{
    product: string;
    quantity: number;
    priceAtPurchase: number;
    variantName?: string;
    storeId: string;
  }>;
  // 👆 SAMPAI SINI 👆

  @Prop({ required: true })
  shippingCost!: number; // Ongkir

  @Prop({ required: true })
  totalPrice!: number; // Total gabungan (Harga Produk + Ongkir)

  // PENDING, PAID, PROCESSED, SHIPPED, DELIVERED, SUCCESS, CANCELLED
  @Prop({ default: 'PENDING' }) 
  status?: string;

  @Prop({ type: String, default: null }) 
  resiNumber!: string | null;
}

export const OrderSchema = SchemaFactory.createForClass(Order);