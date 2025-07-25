import { Schema, model, Document, Types } from 'mongoose';

export interface IContact extends Document {
  phoneNumber: string;
  name: string;
  email?: string;
  tags: string[];
  customFields: Record<string, any>;
  lastSeen?: Date;
  isBlocked: boolean;
  assignedTo?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>({
  phoneNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  tags: [{ type: String }],
  customFields: { type: Schema.Types.Mixed, default: {} },
  lastSeen: { type: Date },
  isBlocked: { type: Boolean, default: false },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default model<IContact>('Contact', ContactSchema); 