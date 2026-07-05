import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type CartDocument = Cart & Document;

@Schema({ timestamps: true, versionKey: false })
export class Cart {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true })
  user!: string;

  @Prop([
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
      variantName: { type: String, required: false, default: 'Polosan' },
      storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }, // <-- 1. SUNTIK FIELD TOKO DI SINI BIAR MONGOOSE MAU NYIMPEN, BOI!
    },
  ])
  items!: Array<{
    product: string;
    quantity: number;
    variantName?: string;
    storeId: string; // <-- 2. DAFTARIN JUGA DI LEVEL TYPE TYPESCRIPT-NYA!
  }>;
}

export const CartSchema = SchemaFactory.createForClass(Cart);