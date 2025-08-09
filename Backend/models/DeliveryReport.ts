import { Schema, model, Document, Types } from 'mongoose';

export interface IDeliveryReport extends Document {
  messageId: string; // externalId from Gupshup
  srcAddr: string;
  destAddr: string;
  channel: string;
  eventType: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  cause: string;
  errorCode: string;
  eventTs: Date;
  hsmTemplateId?: string;
  conversation?: {
    expiration_timestamp?: number;
    origin?: {
      type?: string;
    };
    id?: string;
  };
  pricing?: {
    category?: string;
  };
  noOfFrags?: number;
  // Additional tracking fields
  internalStatus: 'sent' | 'delivered' | 'read' | 'failed';
  processedAt: Date;
  createdAt: Date;
}

const DeliveryReportSchema = new Schema<IDeliveryReport>({
  messageId: { type: String, required: true, index: true },
  srcAddr: { type: String, required: true },
  destAddr: { type: String, required: true },
  channel: { type: String, required: true },
  eventType: { 
    type: String, 
    enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'], 
    required: true 
  },
  cause: { type: String, required: true },
  errorCode: { type: String, required: true },
  eventTs: { type: Date, required: true },
  hsmTemplateId: { type: String },
  conversation: {
    expiration_timestamp: { type: Number },
    origin: {
      type: { type: String }
    },
    id: { type: String }
  },
  pricing: {
    category: { type: String }
  },
  noOfFrags: { type: Number },
  internalStatus: { 
    type: String, 
    enum: ['sent', 'delivered', 'read', 'failed'], 
    required: true 
  },
  processedAt: { type: Date, default: Date.now },
}, { 
  timestamps: { createdAt: true, updatedAt: false }
});

// Index for efficient querying
DeliveryReportSchema.index({ messageId: 1, eventTs: -1 });
DeliveryReportSchema.index({ destAddr: 1, eventTs: -1 });

export default model<IDeliveryReport>('DeliveryReport', DeliveryReportSchema);