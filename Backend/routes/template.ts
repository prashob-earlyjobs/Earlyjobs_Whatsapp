import { Router, Request, Response } from 'express';
import { TemplateController } from '../controllers/templateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ========================================
// GUPSHUP HSM TEMPLATE ROUTES (Direct API calls - No database storage)
// ========================================

// GET /api/templates/gupshup - Fetch all Gupshup HSM templates with optional filters
// This returns the exact structure from your sample response
router.get('/gupshup', TemplateController.getGupshupTemplates);

// GET /api/templates/gupshup/categories - Get unique template categories from Gupshup
router.get('/gupshup/categories', TemplateController.getGupshupTemplateCategories);

// GET /api/templates/gupshup/stats - Get template statistics from Gupshup
router.get('/gupshup/stats', TemplateController.getGupshupTemplateStats);

// GET /api/templates/gupshup/test - Test Gupshup connection (for debugging)
router.get('/gupshup/test', TemplateController.testGupshupConnection);

// GET /api/templates/gupshup/:templateId - Get specific Gupshup template by ID
router.get('/gupshup/:templateId', TemplateController.getGupshupTemplateById);

// ========================================
// TEMPLATE SAVING ROUTES (Save from Gupshup to local database)
// ========================================

// POST /api/templates/save-from-gupshup - Save a Gupshup template to local database
router.post('/save-from-gupshup', authenticateToken, TemplateController.saveGupshupTemplate);

// POST /api/templates/create-custom - Create a custom template
router.post('/create-custom', authenticateToken, TemplateController.createCustomTemplate);

// ========================================
// LOCAL DATABASE TEMPLATE ROUTES 
// ========================================

// IMPORTANT: Specific routes must come BEFORE parameterized routes
// GET /api/templates/categories/local - List template categories from local database
router.get('/categories/local', TemplateController.getLocalTemplateCategories);

// GET /api/templates/test-encoding - Test URL encoding
router.get('/test-encoding', TemplateController.testUrlEncoding);

// GET /api/templates - List local templates from database
router.get('/', TemplateController.getLocalTemplates);

// GET /api/templates/:id - Get local template by ID (MUST come after specific routes)
router.get('/:id', TemplateController.getLocalTemplateById);

// PUT /api/templates/:id - Update local template
router.put('/:id', authenticateToken, TemplateController.updateLocalTemplate);

// DELETE /api/templates/:id - Delete local template
router.delete('/:id', authenticateToken, TemplateController.deleteLocalTemplate);

export default router; 