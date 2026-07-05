import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VoucherDocument = Voucher & Document;

@Schema({ timestamps: true })
export class Voucher {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string; // misal: MAUMUDIK, DISKON10

  @Prop({ required: true, enum: ['PERCENTAGE', 'NOMINAL'] })
  discountType: string;

  @Prop({ required: true })
  discountValue: number; // Kalau PERCENTAGE isi 10 (10%), kalau NOMINAL isi 15000 (Rp 15.000)

  @Prop({ required: true, default: 100 })
  maxUses: number; // Kuota pemakaian

  @Prop({ default: 0 })
  currentUses: number; // Udah dipake berapa kali

  @Prop({ required: true })
  validUntil: Date; // Tanggal kadaluarsa
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);