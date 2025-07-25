import Bull from 'bull';
import { BulkMessageService } from '../services/bulkMessageService';

// Create queue instances
export const bulkMessageQueue = new Bull('bulk messages', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export const notificationQueue = new Bull('notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Bulk message processing
bulkMessageQueue.process('send-bulk', async (job) => {
  const { bulkMessageId } = job.data;
  console.log(`Processing bulk message: ${bulkMessageId}`);
  
  try {
    await BulkMessageService.processBulkMessage(bulkMessageId, (progress) => {
      job.progress(progress);
    });
    
    return { success: true, bulkMessageId };
  } catch (error) {
    console.error('Bulk message processing failed:', error);
    throw error;
  }
});

// Notification processing
notificationQueue.process('send-notification', async (job) => {
  const { type, data } = job.data;
  console.log(`Processing notification: ${type}`);
  
  // Handle different notification types
  switch (type) {
    case 'message-status-update':
      // Handle message status updates
      break;
    case 'conversation-assigned':
      // Handle conversation assignment notifications
      break;
    default:
      console.log(`Unknown notification type: ${type}`);
  }
  
  return { success: true, type };
});

// Queue event handlers
bulkMessageQueue.on('completed', (job) => {
  console.log(`Bulk message job ${job.id} completed`);
});

bulkMessageQueue.on('failed', (job, err) => {
  console.error(`Bulk message job ${job.id} failed:`, err);
});

notificationQueue.on('completed', (job) => {
  console.log(`Notification job ${job.id} completed`);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`Notification job ${job.id} failed:`, err);
});

// Helper functions
export const addBulkMessageJob = async (bulkMessageId: string, scheduledAt?: Date) => {
  const jobOptions: any = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  };

  if (scheduledAt) {
    jobOptions.delay = scheduledAt.getTime() - Date.now();
  }

  return await bulkMessageQueue.add('send-bulk', { bulkMessageId }, jobOptions);
};

export const addNotificationJob = async (type: string, data: any) => {
  return await notificationQueue.add('send-notification', { type, data }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}; 