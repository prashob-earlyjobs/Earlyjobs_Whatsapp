import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
  contactId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  department?: string;
  status: 'open' | 'closed' | 'pending';
  lastMessageAt?: Date;
  lastInboundMessageAt?: Date; // Track last incoming message for 24-hour rule
  unreadCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  department: { type: String },
  status: { type: String, enum: ['open', 'closed', 'pending'], default: 'open' },
  lastMessageAt: { type: Date },
  lastInboundMessageAt: { type: Date }, // Track last incoming message for 24-hour rule
  unreadCount: { type: Number, default: 0 },
  tags: [{ type: String }],
}, { timestamps: true });

export default model<IConversation>('Conversation', ConversationSchema); 