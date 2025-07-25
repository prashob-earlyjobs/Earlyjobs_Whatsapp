import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';

const router = Router();

// Gupshup incoming message webhook
router.post('/incoming', WebhookController.handleIncomingMessage);

// Gupshup message status webhook
router.post('/status', WebhookController.handleStatusUpdate);

// Test webhook endpoint
router.get('/test', WebhookController.testWebhook);

export default router; 