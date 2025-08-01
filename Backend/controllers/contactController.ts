import { Request, Response } from 'express';
import { ContactService, CreateContactData, ContactFilters } from '../services/contactService';
import { AuthRequest } from '../middleware/auth';

export class ContactController {
  // GET /api/contacts - Get all contacts with optional filters
  static async getAllContacts(req: AuthRequest, res: Response) {
    try {
      const { search, tags, assignedTo, isBlocked } = req.query;
      
      const filters: ContactFilters = {};
      
      if (search && typeof search === 'string') {
        filters.search = search.trim();
      }
      
      if (tags) {
        filters.tags = Array.isArray(tags) ? tags as string[] : [tags as string];
      }
      
      if (assignedTo && typeof assignedTo === 'string') {
        filters.assignedTo = assignedTo.trim();
      }
      
      if (isBlocked !== undefined) {
        filters.isBlocked = isBlocked === 'true';
      }

      const contacts = await ContactService.getAllContacts(filters);

      res.json({
        success: true,
        message: 'Contacts retrieved successfully',
        data: {
          contacts,
          count: contacts.length
        }
      });

    } catch (error: any) {
      console.error('Get contacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving contacts'
      });
    }
  }

  // GET /api/contacts/search - Search contacts with query
  static async searchContacts(req: AuthRequest, res: Response) {
    try {
      const { q, limit = '10' } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const filters: ContactFilters = {
        search: q.trim()
      };

      const contacts = await ContactService.getAllContacts(filters);
      
      // Limit results for quick search
      const limitNum = parseInt(limit as string, 10);
      const limitedContacts = contacts.slice(0, limitNum);

      res.json({
        success: true,
        message: 'Contact search completed',
        data: {
          contacts: limitedContacts,
          count: limitedContacts.length,
          totalFound: contacts.length
        }
      });

    } catch (error: any) {
      console.error('Search contacts error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while searching contacts'
      });
    }
  }

  // GET /api/contacts/:id - Get contact by ID
  static async getContactById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Contact ID is required'
        });
      }

      const contact = await ContactService.getContactById(id);

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        message: 'Contact retrieved successfully',
        data: {
          contact
        }
      });

    } catch (error: any) {
      console.error('Get contact error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving contact'
      });
    }
  }

  // POST /api/contacts
  static async createContact(req: AuthRequest, res: Response) {
    try {
      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { phoneNumber, name, email, tags, customFields, assignedTo }: CreateContactData = req.body;

      // Validation
      if (!phoneNumber || !name) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and name are required'
        });
      }

      // Type validation
      if (typeof phoneNumber !== 'string' || typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Phone number and name must be strings'
        });
      }

      // Email validation if provided
      if (email) {
        if (typeof email !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Email must be a string'
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
          });
        }
      }

      const contactData: CreateContactData = {
        phoneNumber: phoneNumber.trim(),
        name: name.trim(),
        email: email?.toLowerCase().trim(),
        tags: tags || [],
        customFields: customFields || {},
        assignedTo: assignedTo?.trim()
      };

      const contact = await ContactService.createContact(contactData);

      res.status(201).json({
        success: true,
        message: 'Contact created successfully',
        data: {
          contact
        }
      });

    } catch (error: any) {
      console.error('Create contact error:', error);
      
      // Handle duplicate phone number error
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Contact with this phone number already exists'
        });
      }

      if (error.message === 'Contact with this phone number already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err: any) => err.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while creating contact'
      });
    }
  }
} 