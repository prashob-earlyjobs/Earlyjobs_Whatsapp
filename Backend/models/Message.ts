import { Schema, model, Document, Types } from 'mongoose';

export interface IMessageContent {
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  templateId?: Types.ObjectId;
  templateData?: Record<string, any>;
  header?: string;
  footer?: string;
  buttonData?: Record<string, any>; // For button interactions
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  contactId: Types.ObjectId;
  senderId?: Types.ObjectId;
  messageId: string;
  type: 'text' | 'image' | 'document' | 'template' | 'button';
  content: IMessageContent;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  isRead: boolean;
  createdAt: Date;
}

const MessageContentSchema = new Schema<IMessageContent>({
  text: { type: String },
  mediaUrl: { type: String },
  mediaType: { type: String },
  templateId: { type: Schema.Types.ObjectId, ref: 'Template' },
  templateData: { type: Schema.Types.Mixed },
  header: { type: String },
  footer: { type: String },
  buttonData: { type: Schema.Types.Mixed }, // For button interactions
}, { _id: false });

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User' },
  messageId: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'document', 'template', 'button'], required: true },
  content: { type: MessageContentSchema, required: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
  timestamp: { type: Date, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default model<IMessage>('Message', MessageSchema); 