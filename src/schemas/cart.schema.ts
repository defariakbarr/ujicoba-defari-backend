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
    },
  ])
  items!: Array<{
    product: string;
    quantity: number;
  }>;
}

export const CartSchema = SchemaFactory.createForClass(Cart); 