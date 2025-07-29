import { Schema, model, Document, Types } from 'mongoose';

interface IButton {
  type: 'quick_reply' | 'url' | 'phone';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface ITemplate extends Document {
  name: string;
  category: string;
  language: string;
  status: 'approved' | 'pending' | 'rejected';
  templateId: string;
  header?: {
    type: 'text' | 'image' | 'document';
    content: string;
  };
  body: {
    text: string;
    variables: string[];
  };
  footer?: string;
  buttons: IButton[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ButtonSchema = new Schema<IButton>({
  type: { type: String, enum: ['quick_reply', 'url', 'phone'], required: true },
  text: { type: String, required: true },
  url: { type: String },
  phoneNumber: { type: String },
}, { _id: false });

const TemplateSchema = new Schema<ITemplate>({
  name: { type: String, required: true },
  category: { type: String, required: true },
  language: { type: String, required: true },
  status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
  templateId: { type: String, required: true },
  header: {
    type: { type: String, enum: ['text', 'image', 'document'] },
    content: { type: String },
  },
  body: {
    text: { type: String, required: true },
    variables: [{ type: String }],
  },
  footer: { type: String },
  buttons: [ButtonSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default model<ITemplate>('Template', TemplateSchema); 