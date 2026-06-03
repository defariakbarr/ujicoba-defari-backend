import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose'; // Gaya lu yang wajib ada

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, versionKey: false })
export class Product {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  price!: number;

  @Prop({ required: true })
  category!: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' }) 
  createdBy?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  updatedBy?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Unit' }) 
  unit?: string;

  // Catatan: Field stock bawaan produk di sini bisa lu hapus atau biarin aja.
  // Tapi saran gua mending dihapus total biar datanya bener-bener murni ngambil dari collection Stock nanti via populate/aggregate.
}

export const ProductSchema = SchemaFactory.createForClass(Product);