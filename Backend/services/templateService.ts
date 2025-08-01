import Template, { ITemplate } from '../models/Template';

export interface CreateTemplateData {
  name: string;
  category: string;
  language: string;
  department?: string;
  templateId: string;
  header?: {
    type: 'text' | 'image' | 'document';
    content: string;
  };
  body: {
    text: string;
    variables: string[];
  };
  footer?: string;
  buttons?: Array<{
    type: 'quick_reply' | 'url' | 'phone';
    text: string;
    url?: string;
    phoneNumber?: string;
  }>;
  createdBy: string;
}

export interface TemplateFilters {
  status?: 'approved' | 'pending' | 'rejected';
  category?: string;
  language?: string;
  department?: string;
  createdBy?: string;
}

export class TemplateService {
  static async createTemplate(templateData: CreateTemplateData): Promise<ITemplate> {
    const existingTemplate = await Template.findOne({ 
      templateId: templateData.templateId 
    });
    
    if (existingTemplate) {
      throw new Error('Template with this ID already exists');
    }

    const template = new Template(templateData);
    return await template.save();
  }

  static async getTemplateById(templateId: string): Promise<ITemplate | null> {
    return await Template.findById(templateId).populate('createdBy', 'name email');
  }

  static async getTemplateByTemplateId(templateId: string): Promise<ITemplate | null> {
    return await Template.findOne({ templateId }).populate('createdBy', 'name email');
  }

  static async getAllTemplates(filters: TemplateFilters = {}): Promise<ITemplate[]> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.language) {
      query.language = filters.language;
    }

    if (filters.department) {
      query.department = filters.department;
    }

    if (filters.createdBy) {
      query.createdBy = filters.createdBy;
    }

    return await Template.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
  }

  static async updateTemplate(
    templateId: string, 
    updateData: Partial<ITemplate>
  ): Promise<ITemplate | null> {
    return await Template.findByIdAndUpdate(templateId, updateData, { new: true })
      .populate('createdBy', 'name email');
  }

  static async updateTemplateStatus(
    templateId: string,
    status: 'approved' | 'pending' | 'rejected'
  ): Promise<ITemplate | null> {
    return await Template.findByIdAndUpdate(
      templateId,
      { status },
      { new: true }
    ).populate('createdBy', 'name email');
  }

  static async deleteTemplate(templateId: string): Promise<boolean> {
    const result = await Template.findByIdAndDelete(templateId);
    return !!result;
  }

  static async getTemplateCategories(): Promise<string[]> {
    const categories = await Template.distinct('category');
    return categories.filter(cat => cat); // Remove null/undefined values
  }

  static async validateTemplateVariables(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const template = await Template.findOne({ templateId });
    
    if (!template) {
      return { isValid: false, errors: ['Template not found'] };
    }

    const errors: string[] = [];
    const requiredVars = template.body.variables;

    // Check if all required variables are provided
    for (const varName of requiredVars) {
      if (!variables[varName]) {
        errors.push(`Missing required variable: ${varName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 