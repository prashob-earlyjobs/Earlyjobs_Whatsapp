import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  contactId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  status: 'open' | 'closed' | 'pending';
  lastMessageAt?: Date;
  unreadCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['open', 'closed', 'pending'], default: 'open' },
  lastMessageAt: { type: Date },
  unreadCount: { type: Number, default: 0 },
  tags: [{ type: String }],
}, { timestamps: true });

export default model<IConversation>('Conversation', ConversationSchema); 