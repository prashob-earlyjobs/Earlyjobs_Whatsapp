import { Schema } from 'mongoose';

export interface IWebhookIncoming {
  waNumber: string;     // WhatsApp number (mandatory)
  mobile: string;       // Mobile number (mandatory)
  name: string;         // Contact name (mandatory)
  text: string;         // Message text (can be empty for button messages)
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'button'; // Message type (mandatory)
  timestamp: Date;      // Message timestamp (mandatory)
  image?: string;       // Image URL (optional)
}

export const WebhookIncomingSchema = new Schema<IWebhookIncoming>({
  waNumber: { type: String, required: true },
  mobile: { type: String, required: true },
  name: { type: String, required: true },
  text: { type: String, required: false }, // Allow empty text for button messages
  type: { 
    type: String, 
    enum: ['text', 'image', 'document', 'audio', 'video', 'button'], 
    required: true 
  },
  timestamp: { type: Date, required: true },
  image: { type: String, required: false }
}, { _id: false });

// Validation function for incoming webhook data
export const validateWebhookIncoming = (data: any): data is IWebhookIncoming => {
  // Allow empty text for button messages
  const isTextValid = typeof data.text === 'string' || (data.type === 'button' && data.text === '');
  
  return (
    typeof data.waNumber === 'string' &&
    typeof data.mobile === 'string' &&
    typeof data.name === 'string' &&
    isTextValid &&
    typeof data.type === 'string' &&
    ['text', 'image', 'document', 'audio', 'video', 'button'].includes(data.type) &&
    data.timestamp !== undefined &&
    (data.image === undefined || typeof data.image === 'string')
  );
}; 