import { Schema } from 'mongoose';

export interface IWebhookIncoming {
  waNumber: string;     // WhatsApp number (mandatory)
  mobile: string;       // Mobile number (mandatory)
  name: string;         // Contact name (mandatory)
  text: string;         // Message text (mandatory)
  type: 'text' | 'image' | 'document' | 'audio' | 'video'; // Message type (mandatory)
  timestamp: Date;      // Message timestamp (mandatory)
  image?: string;       // Image URL (optional)
}

export const WebhookIncomingSchema = new Schema<IWebhookIncoming>({
  waNumber: { type: String, required: true },
  mobile: { type: String, required: true },
  name: { type: String, required: true },
  text: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['text', 'image', 'document', 'audio', 'video'], 
    required: true 
  },
  timestamp: { type: Date, required: true },
  image: { type: String, required: false }
}, { _id: false });

// Validation function for incoming webhook data
export const validateWebhookIncoming = (data: any): data is IWebhookIncoming => {
  return (
    typeof data.waNumber === 'string' &&
    typeof data.mobile === 'string' &&
    typeof data.name === 'string' &&
    typeof data.text === 'string' &&
    typeof data.type === 'string' &&
    ['text', 'image', 'document', 'audio', 'video'].includes(data.type) &&
    data.timestamp !== undefined &&
    (data.image === undefined || typeof data.image === 'string')
  );
}; 