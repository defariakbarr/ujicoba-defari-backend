import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StoreDocument = Store & Document;

@Schema({ timestamps: true, versionKey: false})
export class Store {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop()
  description!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId!: Types.ObjectId; // Siapa user pemilik tokonya

  @Prop({ type: String, default: '152' }) 
  cityId!: string;
}

export const StoreSchema = SchemaFactory.createForClass(Store);