import { Request, Response } from 'express';
import { GupshupService, GupshupHSMTemplate, GupshupTemplateResponse } from '../services/gupshupService';
import { TemplateService, TemplateFilters, CreateTemplateData } from '../services/templateService';
import { AuthRequest } from '../middleware/auth';

export class TemplateController {
  // GET /api/templates/gupshup
  static async getGupshupTemplates(req: Request, res: Response) {
    try {
      const { limit, status, category, search } = req.query;

      // Parse limit with validation
      let parsedLimit = 20000; // Default limit
      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 50000) {
          return res.status(400).json({
            success: false,
            message: 'Limit must be a number between 1 and 50000'
          });
        }
        parsedLimit = limitNum;
      }

      let templates: GupshupHSMTemplate[] = [];

      // Handle different filter types
      if (status) {
        if (typeof status !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Status must be a string'
          });
        }
        templates = await GupshupService.getHSMTemplatesByStatus(status, parsedLimit);
      } else if (category) {
        if (typeof category !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Category must be a string'
          });
        }
        templates = await GupshupService.getHSMTemplatesByCategory(category, parsedLimit);
      } else if (search) {
        if (typeof search !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Search term must be a string'
          });
        }
        templates = await GupshupService.searchHSMTemplates(search, parsedLimit);
      } else {
        // Fetch all templates
        const templateResponse: GupshupTemplateResponse = await GupshupService.fetchGupshupHSMTemplates(parsedLimit);
        templates = templateResponse.data;
      }

      return res.status(200).json({
        success: true,
        message: 'Templates fetched successfully',
        data: {
          templates,
          total: templates.length,
          filters: {
            limit: parsedLimit,
            status: status || null,
            category: category || null,
            search: search || null
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching Gupshup templates:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch templates from Gupshup',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates/gupshup/categories
  static async getGupshupTemplateCategories(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const parsedLimit = limit ? parseInt(limit as string, 10) : 20000;

      const templateResponse: GupshupTemplateResponse = await GupshupService.fetchGupshupHSMTemplates(parsedLimit);
      
      // Extract unique categories
      const categories = [...new Set(templateResponse.data.map(template => template.category))];

      return res.status(200).json({
        success: true,
        message: 'Template categories fetched successfully',
        data: {
          categories,
          total: categories.length
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching Gupshup template categories:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch template categories from Gupshup',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates/gupshup/stats
  static async getGupshupTemplateStats(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      const parsedLimit = limit ? parseInt(limit as string, 10) : 20000;

      const templateResponse: GupshupTemplateResponse = await GupshupService.fetchGupshupHSMTemplates(parsedLimit);
      
      // Calculate statistics
      const templates = templateResponse.data;
      const stats = {
        total: templates.length,
        byStatus: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        byLanguage: {} as Record<string, number>,
        byType: {} as Record<string, number>
      };

      // Group by different properties
      templates.forEach(template => {
        // By status
        stats.byStatus[template.status] = (stats.byStatus[template.status] || 0) + 1;
        
        // By category
        stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;
        
        // By language
        stats.byLanguage[template.language] = (stats.byLanguage[template.language] || 0) + 1;
        
        // By type
        stats.byType[template.type] = (stats.byType[template.type] || 0) + 1;
      });

      return res.status(200).json({
        success: true,
        message: 'Template statistics fetched successfully',
        data: stats
      });

    } catch (error: any) {
      console.error('❌ Error fetching Gupshup template stats:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch template statistics from Gupshup',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates/gupshup/test - Test Gupshup connection
  static async testGupshupConnection(req: Request, res: Response) {
    try {
      console.log('🧪 Testing Gupshup HSM connection via API endpoint...');
      
      const testResult = await GupshupService.testHSMConnection();
      
      return res.status(testResult.success ? 200 : 500).json({
        success: testResult.success,
        message: testResult.message,
        data: {
          templatesCount: testResult.templatesCount,
          credentials: {
            userIdConfigured: !!GupshupService['userid'],
            passwordConfigured: !!GupshupService['password'],
            userIdValue: GupshupService['userid'],
            passwordLength: GupshupService['password']?.length || 0
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error testing Gupshup connection:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to test Gupshup connection',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates/gupshup/:templateId
  static async getGupshupTemplateById(req: Request, res: Response) {
    try {
      const { templateId } = req.params;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          message: 'Template ID is required'
        });
      }

      // Parse templateId to number
      const id = parseInt(templateId, 10);
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Template ID must be a valid number'
        });
      }

      const templateResponse: GupshupTemplateResponse = await GupshupService.fetchGupshupHSMTemplates();
      const template = templateResponse.data.find(t => t.id === id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Template fetched successfully',
        data: template
      });

    } catch (error: any) {
      console.error('❌ Error fetching Gupshup template by ID:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch template from Gupshup',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // POST /api/templates/save-from-gupshup
  static async saveGupshupTemplate(req: AuthRequest, res: Response) {
    try {
      const { gupshupTemplateId, customName } = req.body;

      // Validation
      if (!gupshupTemplateId) {
        return res.status(400).json({
          success: false,
          message: 'Gupshup template ID is required'
        });
      }

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      // Parse gupshupTemplateId to number
      const templateId = parseInt(gupshupTemplateId, 10);
      if (isNaN(templateId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID format'
        });
      }

      // Fetch the specific template from Gupshup
      const gupshupResponse: GupshupTemplateResponse = await GupshupService.fetchGupshupHSMTemplates();
      const gupshupTemplate = gupshupResponse.data.find(t => t.id === templateId);

      if (!gupshupTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Template not found in Gupshup'
        });
      }

      // Extract variables from template body (look for {{1}}, {{2}}, etc. or {{name}} patterns)
      const variableMatches = gupshupTemplate.body.match(/\{\{(\w+|\d+)\}\}/g) || [];
      const variables = variableMatches.map((match: string) => match.replace(/[{}]/g, ''));

      // Prepare template data for local storage - AUTO APPROVED
      const templateData: CreateTemplateData = {
        name: customName || gupshupTemplate.name,
        category: gupshupTemplate.category.toLowerCase(),
        language: gupshupTemplate.language,
        templateId: `gupshup_${gupshupTemplate.id}`,
        body: {
          text: gupshupTemplate.body,
          variables: variables
        },
        footer: gupshupTemplate.footer,
        createdBy: req.user.id
      };

      // Add header if present
      if (gupshupTemplate.header) {
        templateData.header = {
          type: 'text',
          content: gupshupTemplate.header
        };
      }

      // Save to local database
      const savedTemplate = await TemplateService.createTemplate(templateData);

      return res.status(201).json({
        success: true,
        message: 'Template saved and approved successfully',
        data: {
          template: savedTemplate,
          gupshupSource: {
            id: gupshupTemplate.id,
            name: gupshupTemplate.name,
            status: gupshupTemplate.status
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Error saving Gupshup template:', error);
      
      // Handle duplicate template error
      if (error.message && error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: 'Template already exists in your database',
          error: error.message
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to save template',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // POST /api/templates/create-custom
  static async createCustomTemplate(req: AuthRequest, res: Response) {
    try {
      const { name, category, language, body, header, footer, buttons } = req.body;

      // Validation
      if (!name || !category || !language || !body) {
        return res.status(400).json({
          success: false,
          message: 'Name, category, language, and body are required'
        });
      }

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      // Extract variables from body text
      const variableMatches = body.match(/\{\{(\w+|\d+)\}\}/g) || [];
      const variables = variableMatches.map((match: string) => match.replace(/[{}]/g, ''));

      // Generate unique template ID
      const templateId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create template data - AUTO APPROVED
      const templateData: CreateTemplateData = {
        name,
        category: category.toLowerCase(),
        language,
        templateId,
        body: {
          text: body,
          variables
        },
        header,
        footer,
        buttons,
        createdBy: req.user.id
      };

      const savedTemplate = await TemplateService.createTemplate(templateData);

      return res.status(201).json({
        success: true,
        message: 'Custom template created and approved successfully',
        data: {
          template: savedTemplate
        }
      });

    } catch (error: any) {
      console.error('❌ Error creating custom template:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create template',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // PUT /api/templates/:id
  static async updateLocalTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      // If body text is being updated, extract new variables
      if (updateData.body && updateData.body.text) {
        const variableMatches = updateData.body.text.match(/\{\{(\w+|\d+)\}\}/g) || [];
        updateData.body.variables = variableMatches.map((match: string) => match.replace(/[{}]/g, ''));
      }

      const updatedTemplate = await TemplateService.updateTemplate(id, updateData);

      if (!updatedTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        data: {
          template: updatedTemplate
        }
      });

    } catch (error: any) {
      console.error('❌ Error updating template:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to update template',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // DELETE /api/templates/:id
  static async deleteLocalTemplate(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const deleted = await TemplateService.deleteTemplate(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Template deleted successfully'
      });

    } catch (error: any) {
      console.error('❌ Error deleting template:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to delete template',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates (local database templates)
  static async getLocalTemplates(req: Request, res: Response) {
    try {
      const { status, category, language, createdBy } = req.query;

      const filters: TemplateFilters = {};
      
      if (status && typeof status === 'string') {
        if (!['approved', 'pending', 'rejected'].includes(status)) {
          return res.status(400).json({
            success: false,
            message: 'Status must be one of: approved, pending, rejected'
          });
        }
        filters.status = status as 'approved' | 'pending' | 'rejected';
      }

      if (category && typeof category === 'string') {
        filters.category = category;
      }

      if (language && typeof language === 'string') {
        filters.language = language;
      }

      if (createdBy && typeof createdBy === 'string') {
        filters.createdBy = createdBy;
      }

      const templates = await TemplateService.getAllTemplates(filters);

      return res.status(200).json({
        success: true,
        message: 'Local templates fetched successfully',
        data: {
          templates,
          total: templates.length,
          filters
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching local templates:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch local templates',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates/:id
  static async getLocalTemplateById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const template = await TemplateService.getTemplateById(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Template fetched successfully',
        data: {
          template
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching template:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch template',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // GET /api/templates/categories/local
  static async getLocalTemplateCategories(req: Request, res: Response) {
    try {
      const categories = await TemplateService.getTemplateCategories();

      return res.status(200).json({
        success: true,
        message: 'Local template categories fetched successfully',
        data: {
          categories,
          total: categories.length
        }
      });

    } catch (error: any) {
      console.error('❌ Error fetching local template categories:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch local template categories',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
} 