import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type StockDocument = Stock & Document;

@Schema({ timestamps: true, versionKey: false })
export class Stock {
  // SEPARASI TOTAL: Sekarang stock cuma tau ID Varian, ga perlu tau ID Produk langsung
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Variant', required: true })
  variantId!: mongoose.Types.ObjectId;

  @Prop({ required: true, default: 0 })
  qty!: number;
}

export const StockSchema = SchemaFactory.createForClass(Stock);