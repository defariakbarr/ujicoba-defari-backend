import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type VariantDocument = Variant & Document;

@Schema({ timestamps: true, versionKey: false })
export class Variant {
  // Hubungan ke katalog utama
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true })
  productId!: mongoose.Types.ObjectId;

  // Nama varian (contoh: "Ayam Bawang", "Soto", atau "Polosan" kalau gapake rasa)
  @Prop({ required: true })
  variantName!: string;
}

export const VariantSchema = SchemaFactory.createForClass(Variant);