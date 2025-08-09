import { Schema, model, Document, Types } from 'mongoose';

export interface IParticipant {
  userId: Types.ObjectId;
  name: string;
  role: string;
  department?: string;
  firstMessageAt: Date;
  lastMessageAt: Date;
}

export interface IConversation extends Document {
  contactId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  department?: string;
  status: 'open' | 'closed' | 'pending';
  lastMessageAt?: Date;
  lastInboundMessageAt?: Date; // Track last incoming message for 24-hour rule
  unreadCount: number;
  tags: string[];
  participants: IParticipant[]; // Track all users who have sent messages
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  department: { type: String },
  firstMessageAt: { type: Date, required: true },
  lastMessageAt: { type: Date, required: true }
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
  contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  department: { type: String },
  status: { type: String, enum: ['open', 'closed', 'pending'], default: 'open' },
  lastMessageAt: { type: Date },
  lastInboundMessageAt: { type: Date }, // Track last incoming message for 24-hour rule
  unreadCount: { type: Number, default: 0 },
  tags: [{ type: String }],
  participants: [ParticipantSchema], // Track all users who have sent messages
}, { timestamps: true });

export default model<IConversation>('Conversation', ConversationSchema); 