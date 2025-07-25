import { Schema, model, Document, Types } from 'mongoose';

export interface IBulkMessage extends Document {
  name: string;
  templateId: Types.ObjectId;
  contacts: Types.ObjectId[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt?: Date;
  sentCount: number;
  failedCount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BulkMessageSchema = new Schema<IBulkMessage>({
  name: { type: String, required: true },
  templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
  contacts: [{ type: Schema.Types.ObjectId, ref: 'Contact', required: true }],
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  scheduledAt: { type: Date },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default model<IBulkMessage>('BulkMessage', BulkMessageSchema); 