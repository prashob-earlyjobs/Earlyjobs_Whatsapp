import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';

const router = Router();

// Gupshup incoming message webhook
router.post('/incoming', WebhookController.handleIncomingMessage);

// Gupshup message status webhook
router.post('/status', WebhookController.handleStatusUpdate);

// Gupshup delivery report webhook (GET and POST)
router.all('/delivery-report', WebhookController.handleDeliveryReport);
router.all('/gupshup/delivery-report', WebhookController.handleDeliveryReport);

// Test webhook endpoint
router.get('/test', WebhookController.testWebhook);

// Debug webhook endpoint
router.post('/debug', WebhookController.debugWebhook);

export default router; 