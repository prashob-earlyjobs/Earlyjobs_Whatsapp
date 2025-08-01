import { Router } from 'express';
import { ConversationController } from '../controllers/conversationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/conversations/start - Start new conversation with phone number
router.post('/start', authenticateToken, ConversationController.startConversationWithPhone);

// POST /api/conversations
router.post('/', authenticateToken, ConversationController.createConversation);

// GET /api/conversations
router.get('/', authenticateToken, ConversationController.getConversations);

// GET /api/conversations/:id
router.get('/:id', authenticateToken, ConversationController.getConversationById);

// PUT /api/conversations/:id/status
router.put('/:id/status', authenticateToken, ConversationController.updateConversationStatus);

// PUT /api/conversations/:id/assign
router.put('/:id/assign', authenticateToken, ConversationController.assignConversation);

// GET /api/conversations/:id/messages
router.get('/:id/messages', authenticateToken, ConversationController.getConversationMessages);

// POST /api/conversations/:id/messages
router.post('/:id/messages', authenticateToken, ConversationController.sendMessage);

// GET /api/conversations/:id/24-hour-status
router.get('/:id/24-hour-status', authenticateToken, ConversationController.check24HourStatus);

// PUT /api/conversations/:id/read
router.put('/:id/read', authenticateToken, ConversationController.markAsRead);

export default router; 