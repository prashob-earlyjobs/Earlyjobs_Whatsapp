import Template, { ITemplate } from '../models/Template';
import { Types } from 'mongoose';

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
  users?: string[]; // Array of user IDs who can access this template
}

export interface TemplateFilters {
  status?: 'approved' | 'pending' | 'rejected';
  category?: string;
  language?: string;
  department?: string;
  createdBy?: string;
  userId?: string; // Filter templates accessible to a specific user
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
    const baseFilters: any = {};

    // Build base filters (status, category, language, department, createdBy)
    if (filters.status) {
      baseFilters.status = filters.status;
    }

    if (filters.category) {
      baseFilters.category = filters.category;
    }

    if (filters.language) {
      baseFilters.language = filters.language;
    }

    if (filters.department) {
      baseFilters.department = filters.department;
    }

    if (filters.createdBy) {
      baseFilters.createdBy = filters.createdBy;
    }

    // Filter by user access: if userId is provided, show templates where:
    // - users array contains the userId, OR
    // - createdBy matches the userId
    // Note: Templates with empty/null users array are NOT shown to non-admin users
    // Only explicitly assigned users or the creator can see the template
    if (filters.userId) {
      // Convert userId string to ObjectId for proper comparison
      const userIdObjectId = new Types.ObjectId(filters.userId);
      
      // Build user access conditions - templates accessible to this user
      const userAccessConditions = {
        $or: [
          { users: { $in: [userIdObjectId] } },
          { createdBy: userIdObjectId }
        ]
      };

      // Combine base filters with user access filter using $and
      // This ensures both conditions must be met
      const andConditions: any[] = [];
      
      // Add base filters if any exist
      if (Object.keys(baseFilters).length > 0) {
        andConditions.push(baseFilters);
      }
      
      // Always add user access conditions
      andConditions.push(userAccessConditions);
      
      query.$and = andConditions;
    } else {
      // No user filter, just use base filters directly
      Object.assign(query, baseFilters);
    }

    console.log('🔍 Template query:', JSON.stringify(query, null, 2));
    
    return await Template.find(query)
      .populate('createdBy', 'name email')
      .populate('users', 'name email')
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