import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
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

  @Prop({ type: Types.ObjectId, ref: 'Store', required: true })
  storeId?: Types.ObjectId; 

  @Prop({ type: Number, default: 0 }) // <-- TAMBAHIN FIELD INI CU!
  weight!: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);