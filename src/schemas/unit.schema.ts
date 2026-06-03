import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UnitDocument = Unit & Document;

@Schema({ timestamps: true, versionKey: false })
export class Unit {
  @Prop({ required: true, unique: true })
  name?: string; // Contoh: "Pcs", "Box", "Kg"

  @Prop()
  description!: string;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);