import axios from 'axios';

export interface GupshupMessage {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  phone?: string;
  details?: string;
}

export interface TemplateVariable {
  [key: string]: string;
}

// New interfaces for Gupshup HSM Templates
export interface GupshupHSMTemplate {
  id: number;
  name: string;
  category: string;
  language: string;
  type: string;
  body: string;
  footer?: string;
  header?: string;
  button_type: string;
  quality_score: string;
  status: string;
  creation_time: number;
  updation_time: number;
}

export interface GupshupTemplateResponse {
  data: GupshupHSMTemplate[];
  meta: {
    total: number;
  };
}

export class GupshupService {
  // Gateway API configuration
  private static baseUrl = 'https://mediaapi.smsgupshup.com/GatewayAPI/rest';
  private static userid = process.env.GUPSHUP_USER_ID || '2000254195';
  private static password = process.env.GUPSHUP_PASSWORD || 'gEGtMs6B';

  // HSM Template API configuration
  private static hsmBaseUrl = 'https://wamedia.smsgupshup.com/GatewayAPI/rest';

  /**
   * Validate Gupshup credentials
   */
  private static validateCredentials(): void {
    if (!this.userid) {
      throw new Error('Gupshup User ID is required. Set GUPSHUP_USER_ID environment variable.');
    }
    if (!this.password) {
      throw new Error('Gupshup Password is required. Set GUPSHUP_PASSWORD environment variable.');
    }
  }

  /**
   * Test Gupshup HSM API connection and credentials
   */
  static async testHSMConnection(): Promise<{ success: boolean; message: string; templatesCount?: number }> {
    try {
      this.validateCredentials();
      
      console.log('🧪 Testing Gupshup HSM API connection...');
      console.log('👤 Using User ID:', this.userid);
      console.log('🔐 Password configured:', this.password ? 'Yes' : 'No');
      
      // Try to fetch a small number of templates to test connection
      const response = await this.fetchGupshupHSMTemplates(5);
      
      return {
        success: true,
        message: 'Connection successful',
        templatesCount: response.data.length
      };
    } catch (error: any) {
      console.error('❌ HSM Connection test failed:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static buildGatewayUrl(params: Record<string, string>): string {
    const urlParams = new URLSearchParams({
      userid: this.userid,
      password: this.password,
      v: '1.1',
      format: 'json',
      ...params
    });
    
    return `${this.baseUrl}?${urlParams.toString()}`;
  }

  static async sendTextMessage(phoneNumber: string, message: string): Promise<GupshupMessage> {
    const params = {
      method: 'SENDMESSAGE',
      send_to: phoneNumber,
      msg_type: 'TEXT',
      msg: encodeURIComponent(message)
    };

    const url = this.buildGatewayUrl(params);

    try {
      console.log('🔗 Sending Gupshup text message to:', phoneNumber);
      console.log('📡 Gateway API URL:', url.replace(this.password, '***'));
      
      const response = await axios.get(url);
      
      console.log('📬 Gupshup response:', response.data);

      // Handle Gateway API response format
      if (response.data.response) {
        const { response: gupshupResponse } = response.data;
        
        if (gupshupResponse.status === 'success') {
          return {
            messageId: gupshupResponse.id || 'unknown',
            status: 'sent',
            timestamp: new Date().toISOString(),
            phone: gupshupResponse.phone
          };
        } else {
          console.error('❌ Gupshup Gateway API error:', gupshupResponse);
          throw new Error(`Gupshup error: ${gupshupResponse.details || 'Unknown error'}`);
        }
      }

      throw new Error('Invalid response format from Gupshup');
    } catch (error: any) {
      console.error('❌ Gupshup text message error:', error.message);
      if (error.response?.data) {
        console.error('❌ Gupshup error details:', error.response.data);
      }
      throw new Error(`Failed to send text message: ${error.message}`);
    }
  }

  static async sendTemplateMessage(
    phoneNumber: string,
    templateMessage: string,
    header?: string,
    footer?: string
  ): Promise<GupshupMessage> {
    const params: Record<string, string> = {
      method: 'SENDMESSAGE',
      send_to: phoneNumber,
      msg_type: 'TEXT',
      msg: encodeURIComponent(templateMessage),
      isTemplate: 'true'
    };

    if (header) {
      params['header'] = encodeURIComponent(header);
    }

    if (footer) {
      params['footer'] = encodeURIComponent(footer);
    }

    const url = this.buildGatewayUrl(params);

    try {
      console.log('🔗 Sending Gupshup template message to:', phoneNumber);
      console.log('📡 Gateway API URL:', url.replace(this.password, '***'));
      
      const response = await axios.get(url);
      
      console.log('📬 Gupshup template response:', response.data);

      // Handle Gateway API response format
      if (response.data.response) {
        const { response: gupshupResponse } = response.data;
        
        if (gupshupResponse.status === 'success') {
          return {
            messageId: gupshupResponse.id || 'unknown',
            status: 'sent',
            timestamp: new Date().toISOString(),
            phone: gupshupResponse.phone
          };
        } else {
          console.error('❌ Gupshup Gateway API template error:', gupshupResponse);
          throw new Error(`Gupshup template error: ${gupshupResponse.details || 'Unknown error'}`);
        }
      }

      throw new Error('Invalid response format from Gupshup');
    } catch (error: any) {
      console.error('❌ Gupshup template message error:', error.message);
      if (error.response?.data) {
        console.error('❌ Gupshup template error details:', error.response.data);
      }
      throw new Error(`Failed to send template message: ${error.message}`);
    }
  }

  // Legacy method for backward compatibility - now uses template format
  static async sendTemplateMessageLegacy(
    phoneNumber: string,
    templateId: string,
    variables: TemplateVariable = {}
  ): Promise<GupshupMessage> {
    // Convert template variables to message format
    let templateMessage = templateId;
    Object.entries(variables).forEach(([key, value]) => {
      templateMessage = templateMessage.replace(`{{${key}}}`, value);
    });

    return this.sendTemplateMessage(phoneNumber, templateMessage);
  }

  static async sendMediaMessage(
    phoneNumber: string,
    mediaUrl: string,
    mediaType: 'image' | 'document' | 'audio',
    caption?: string
  ): Promise<GupshupMessage> {
    // Gateway API supports media through different msg_type
    let msgType = 'TEXT'; // Default fallback
    let message = mediaUrl;

    switch (mediaType) {
      case 'image':
        msgType = 'IMAGE';
        message = caption ? `${caption}\n${mediaUrl}` : mediaUrl;
        break;
      case 'document':
        msgType = 'DOCUMENT';
        message = caption ? `${caption}\n${mediaUrl}` : mediaUrl;
        break;
      case 'audio':
        msgType = 'AUDIO';
        break;
    }

    const params = {
      method: 'SENDMESSAGE',
      send_to: phoneNumber,
      msg_type: msgType,
      msg: encodeURIComponent(message)
    };

    const url = this.buildGatewayUrl(params);

    try {
      console.log('🔗 Sending Gupshup media message to:', phoneNumber);
      console.log('📡 Gateway API URL:', url.replace(this.password, '***'));
      
      const response = await axios.get(url);
      
      console.log('📬 Gupshup media response:', response.data);

      // Handle Gateway API response format
      if (response.data.response) {
        const { response: gupshupResponse } = response.data;
        
        if (gupshupResponse.status === 'success') {
          return {
            messageId: gupshupResponse.id || 'unknown',
            status: 'sent',
            timestamp: new Date().toISOString(),
            phone: gupshupResponse.phone
          };
        } else {
          console.error('❌ Gupshup Gateway API media error:', gupshupResponse);
          throw new Error(`Gupshup media error: ${gupshupResponse.details || 'Unknown error'}`);
        }
      }

      throw new Error('Invalid response format from Gupshup');
    } catch (error: any) {
      console.error('❌ Gupshup media message error:', error.message);
      if (error.response?.data) {
        console.error('❌ Gupshup media error details:', error.response.data);
      }
      throw new Error(`Failed to send media message: ${error.message}`);
    }
  }

  static async getMessageStatus(messageId: string): Promise<string> {
    // Gateway API doesn't have direct status check, return sent for now
    // You might need to implement webhook handling for status updates
    console.log('ℹ️ Gateway API status check not implemented, returning "sent"');
    return 'sent';
  }

  static async getTemplates(): Promise<any[]> {
    // Gateway API doesn't have template listing, return empty array
    console.log('ℹ️ Gateway API template listing not implemented');
    return [];
  }

  /**
   * Fetch WhatsApp HSM templates from Gupshup API
   * @param limit - Maximum number of templates to fetch (default: 20000)
   * @returns Promise<GupshupTemplateResponse> - The template response from Gupshup
   */
  static async fetchGupshupHSMTemplates(limit: number = 20000): Promise<GupshupTemplateResponse> {
    // Validate credentials first
    this.validateCredentials();
    
    const url = `${this.hsmBaseUrl}?method=get_whatsapp_hsm&userid=${this.userid}&password=${this.password}&limit=${limit}`;

    try {
      console.log('🔗 Fetching HSM templates from Gupshup');
      console.log('📡 HSM API URL:', url.replace(this.password, '***'));
      console.log('🔧 Using credentials - UserID:', this.userid, 'Password length:', this.password.length);
      
      const response = await axios.get(url);
      
      // Debug: Log the full response structure
      console.log('📬 Gupshup HSM full response structure:', {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        dataStructure: response.data ? JSON.stringify(response.data, null, 2).substring(0, 500) + '...' : 'No data'
      });

      // Check if response.data exists
      if (!response.data) {
        throw new Error('No data received from Gupshup HSM API');
      }

      // Handle different possible response structures
      let templatesData: GupshupHSMTemplate[] = [];
      let totalCount = 0;

      // Check if it's the expected format with data.data structure
      if (response.data.data && Array.isArray(response.data.data)) {
        templatesData = response.data.data;
        totalCount = response.data.meta?.total || templatesData.length;
        console.log('✅ Using data.data structure');
      }
      // Check if templates are directly in data array
      else if (Array.isArray(response.data)) {
        templatesData = response.data;
        totalCount = templatesData.length;
        console.log('✅ Using direct data array structure');
      }
      // Check if it's in a different nested structure
      else if (response.data.templates && Array.isArray(response.data.templates)) {
        templatesData = response.data.templates;
        totalCount = response.data.total || templatesData.length;
        console.log('✅ Using data.templates structure');
      }
      // Check if it's the structure from the user's sample
      else if (response.data.data && response.data.meta) {
        templatesData = response.data.data || [];
        totalCount = response.data.meta.total || 0;
        console.log('✅ Using sample structure format');
      }
      else {
        console.error('❌ Unexpected response structure:', Object.keys(response.data));
        throw new Error('Unexpected response structure from Gupshup HSM API');
      }

      console.log('📊 Gupshup HSM templates processed:', {
        total: totalCount,
        templates_count: templatesData.length,
        first_template_sample: templatesData[0] ? {
          id: templatesData[0].id,
          name: templatesData[0].name,
          category: templatesData[0].category
        } : 'No templates found'
      });

      // Return in the expected format
      return {
        data: templatesData,
        meta: {
          total: totalCount
        }
      } as GupshupTemplateResponse;

    } catch (error: any) {
      console.error('❌ Gupshup HSM templates fetch error:', error.message);
      if (error.response?.data) {
        console.error('❌ Gupshup HSM error details:', JSON.stringify(error.response.data, null, 2));
      }
      if (error.response?.status) {
        console.error('❌ Gupshup HSM HTTP status:', error.response.status, error.response.statusText);
      }
      
      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - please check Gupshup credentials');
      } else if (error.response?.status === 403) {
        throw new Error('Access forbidden - please check Gupshup permissions');
      } else if (error.response?.status === 404) {
        throw new Error('Gupshup HSM API endpoint not found');
      } else if (error.response?.status >= 500) {
        throw new Error('Gupshup server error - please try again later');
      }
      
      throw new Error(`Failed to fetch HSM templates: ${error.message}`);
    }
  }

  /**
   * Get HSM templates filtered by status
   * @param status - Template status to filter by ('ENABLED', 'DISABLED', etc.)
   * @param limit - Maximum number of templates to fetch
   * @returns Promise<GupshupHSMTemplate[]> - Filtered templates
   */
  static async getHSMTemplatesByStatus(status: string = 'ENABLED', limit: number = 20000): Promise<GupshupHSMTemplate[]> {
    const templatesResponse = await this.fetchGupshupHSMTemplates(limit);
    return templatesResponse.data.filter(template => template.status === status);
  }

  /**
   * Get HSM templates filtered by category
   * @param category - Template category to filter by ('MARKETING', 'UTILITY', 'AUTHENTICATION')
   * @param limit - Maximum number of templates to fetch
   * @returns Promise<GupshupHSMTemplate[]> - Filtered templates
   */
  static async getHSMTemplatesByCategory(category: string, limit: number = 20000): Promise<GupshupHSMTemplate[]> {
    const templatesResponse = await this.fetchGupshupHSMTemplates(limit);
    return templatesResponse.data.filter(template => template.category === category);
  }

  /**
   * Search HSM templates by name
   * @param searchTerm - Term to search in template names
   * @param limit - Maximum number of templates to fetch
   * @returns Promise<GupshupHSMTemplate[]> - Matching templates
   */
  static async searchHSMTemplates(searchTerm: string, limit: number = 20000): Promise<GupshupHSMTemplate[]> {
    const templatesResponse = await this.fetchGupshupHSMTemplates(limit);
    return templatesResponse.data.filter(template => 
      template.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  static async createTemplate(templateData: {
    elementName: string;
    languageCode: string;
    category: string;
    templateType: string;
    vertical: string;
    text: string;
  }): Promise<any> {
    // Gateway API doesn't support template creation via API
    console.log('ℹ️ Gateway API template creation not supported');
    throw new Error('Template creation not supported in Gateway API');
  }

  static validateWebhookSignature(payload: string, signature: string): boolean {
    // Implement webhook signature validation for Gateway API
    const expectedSignature = process.env.GUPSHUP_WEBHOOK_SECRET || '';
    // Add your signature validation logic here
    return signature === expectedSignature;
  }

  // Utility method to test API credentials
  static async testConnection(): Promise<boolean> {
    try {
      // Send a test message to verify credentials
      const testResponse = await this.sendTextMessage('1234567890', 'Test connection');
      return true;
    } catch (error: any) {
      console.error('❌ Gupshup connection test failed:', error.message);
      return false;
    }
  }
} 