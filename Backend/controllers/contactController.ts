import { Request, Response } from 'express';
import { ContactService, CreateContactData } from '../services/contactService';
import { AuthRequest } from '../middleware/auth';

export class ContactController {
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