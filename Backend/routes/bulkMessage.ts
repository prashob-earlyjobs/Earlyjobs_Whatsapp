import { Router } from 'express';
import { BulkMessageController } from '../controllers/bulkMessageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/bulk-messages/validate-contacts - Validate contacts before creating bulk message
router.post('/validate-contacts', authenticateToken, BulkMessageController.validateContacts);

// GET /api/bulk-messages - Get all bulk messages
router.get('/', authenticateToken, BulkMessageController.getAllBulkMessages);

// POST /api/bulk-messages - Create and process bulk message
router.post('/', authenticateToken, BulkMessageController.createBulkMessage);

// GET /api/bulk-messages/:id - Get bulk message by ID
router.get('/:id', authenticateToken, BulkMessageController.getBulkMessageById);

// GET /api/bulk-messages/:id/status - Get bulk message status
router.get('/:id/status', authenticateToken, BulkMessageController.getBulkMessageStatus);

// PUT /api/bulk-messages/:id/cancel - Cancel bulk message
router.put('/:id/cancel', authenticateToken, BulkMessageController.cancelBulkMessage);

export default router; 