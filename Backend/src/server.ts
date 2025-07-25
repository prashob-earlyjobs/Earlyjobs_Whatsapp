import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';

// Import route files
import authRoutes from '../routes/auth';
import contactRoutes from '../routes/contact';
import conversationRoutes from '../routes/conversation';
import bulkMessageRoutes from '../routes/bulkMessage';
import templateRoutes from '../routes/template';
import userRoutes from '../routes/user';
import webhookRoutes from '../routes/webhook';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Mount all routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/bulk-messages', bulkMessageRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes);

// Start server function
const startServer = async () => {
  try {
    // Connect to database first
    await connectDatabase();
    
    // Start server after database connection
    app.listen(PORT, () => {
      console.log('🎉 ================================');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('🎉 ================================');
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`Contact endpoints: http://localhost:${PORT}/api/contacts`);
      console.log(`Conversation endpoints: http://localhost:${PORT}/api/conversations`);
      console.log(`Bulk message endpoints: http://localhost:${PORT}/api/bulk-messages`);
      console.log(`Template endpoints: http://localhost:${PORT}/api/templates`);
      console.log(`User endpoints: http://localhost:${PORT}/api/users`);
      console.log(`Webhook endpoints: http://localhost:${PORT}/api/webhooks`);
      console.log('🎉 ================================');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
