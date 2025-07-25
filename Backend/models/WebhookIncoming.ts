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
  // Basic null/undefined check
  if (!data || typeof data !== 'object') {
    console.log('❌ Validation failed: data is not an object', data);
    return false;
  }

  // Check for phone number (either waNumber or mobile should be present)
  const hasPhoneNumber = (typeof data.waNumber === 'string' && data.waNumber.length > 0) || 
                         (typeof data.mobile === 'string' && data.mobile.length > 0);
  
  if (!hasPhoneNumber) {
    console.log('❌ Validation failed: no valid phone number', { waNumber: data.waNumber, mobile: data.mobile });
    return false;
  }

  // Check for name (can be empty string)
  if (typeof data.name !== 'string') {
    console.log('❌ Validation failed: name is not a string', { name: data.name, type: typeof data.name });
    return false;
  }

  // Check for text (can be empty string for media messages)
  if (typeof data.text !== 'string') {
    console.log('❌ Validation failed: text is not a string', { text: data.text, type: typeof data.text });
    return false;
  }

  // Check for type
  if (typeof data.type !== 'string' || !['text', 'image', 'document', 'audio', 'video'].includes(data.type.toLowerCase())) {
    console.log('❌ Validation failed: invalid type', { type: data.type });
    return false;
  }

  // Check for timestamp (can be string or number)
  if (data.timestamp === undefined || data.timestamp === null) {
    console.log('❌ Validation failed: timestamp is missing', { timestamp: data.timestamp });
    return false;
  }

  // Try to parse timestamp
  let timestampValue;
  if (typeof data.timestamp === 'string') {
    timestampValue = parseInt(data.timestamp);
  } else if (typeof data.timestamp === 'number') {
    timestampValue = data.timestamp;
  } else {
    console.log('❌ Validation failed: timestamp is not a string or number', { timestamp: data.timestamp, type: typeof data.timestamp });
    return false;
  }

  if (isNaN(timestampValue) || timestampValue <= 0) {
    console.log('❌ Validation failed: timestamp is not a valid number', { timestamp: data.timestamp, parsed: timestampValue });
    return false;
  }

  // Check for image (optional)
  if (data.image !== undefined && typeof data.image !== 'string') {
    console.log('❌ Validation failed: image is not a string', { image: data.image, type: typeof data.image });
    return false;
  }

  console.log('✅ Validation passed for webhook data');
  return true;
}; 