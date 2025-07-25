import axios from 'axios';

export interface GupshupMessage {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export interface TemplateVariable {
  [key: string]: string;
}

export class GupshupService {
  private static baseUrl = process.env.GUPSHUP_API_URL || 'https://api.gupshup.io/sm/api/v1';
  private static apiKey = process.env.GUPSHUP_API_KEY || '';

  private static getHeaders() {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': this.apiKey,
    };
  }

  static async sendTextMessage(phoneNumber: string, message: string): Promise<GupshupMessage> {
    const data = new URLSearchParams({
      channel: 'whatsapp',
      source: process.env.GUPSHUP_SOURCE_NUMBER || '',
      destination: phoneNumber,
      message: JSON.stringify({
        type: 'text',
        text: message,
      }),
    });

    try {
      const response = await axios.post(`${this.baseUrl}/msg`, data, {
        headers: this.getHeaders(),
      });

      return {
        messageId: response.data.messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Gupshup text message error:', error);
      throw new Error('Failed to send text message');
    }
  }

  static async sendTemplateMessage(
    phoneNumber: string,
    templateId: string,
    variables: TemplateVariable = {}
  ): Promise<GupshupMessage> {
    const templateData = {
      id: templateId,
      params: Object.values(variables),
    };

    const data = new URLSearchParams({
      channel: 'whatsapp',
      source: process.env.GUPSHUP_SOURCE_NUMBER || '',
      destination: phoneNumber,
      template: JSON.stringify(templateData),
    });

    try {
      const response = await axios.post(`${this.baseUrl}/msg`, data, {
        headers: this.getHeaders(),
      });

      return {
        messageId: response.data.messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Gupshup template message error:', error);
      throw new Error('Failed to send template message');
    }
  }

  static async sendMediaMessage(
    phoneNumber: string,
    mediaUrl: string,
    mediaType: 'image' | 'document' | 'audio',
    caption?: string
  ): Promise<GupshupMessage> {
    const messageContent: any = {
      type: mediaType,
      [mediaType]: mediaUrl,
    };

    if (caption && (mediaType === 'image' || mediaType === 'document')) {
      messageContent.caption = caption;
    }

    const data = new URLSearchParams({
      channel: 'whatsapp',
      source: process.env.GUPSHUP_SOURCE_NUMBER || '',
      destination: phoneNumber,
      message: JSON.stringify(messageContent),
    });

    try {
      const response = await axios.post(`${this.baseUrl}/msg`, data, {
        headers: this.getHeaders(),
      });

      return {
        messageId: response.data.messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Gupshup media message error:', error);
      throw new Error('Failed to send media message');
    }
  }

  static async getMessageStatus(messageId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/msg/${messageId}`, {
        headers: this.getHeaders(),
      });

      return response.data.status;
    } catch (error) {
      console.error('Gupshup get message status error:', error);
      throw new Error('Failed to get message status');
    }
  }

  static async getTemplates(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/template/list`, {
        headers: this.getHeaders(),
      });

      return response.data.templates || [];
    } catch (error) {
      console.error('Gupshup get templates error:', error);
      throw new Error('Failed to get templates');
    }
  }

  static async createTemplate(templateData: {
    elementName: string;
    languageCode: string;
    category: string;
    templateType: string;
    vertical: string;
    text: string;
  }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/template`, templateData, {
        headers: this.getHeaders(),
      });

      return response.data;
    } catch (error) {
      console.error('Gupshup create template error:', error);
      throw new Error('Failed to create template');
    }
  }

  static validateWebhookSignature(payload: string, signature: string): boolean {
    // Implement webhook signature validation
    const expectedSignature = process.env.GUPSHUP_WEBHOOK_SECRET || '';
    // Add your signature validation logic here
    return signature === expectedSignature;
  }
} 