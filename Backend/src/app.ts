import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import authRouter from '../routes/auth';
import webhookRouter from '../routes/webhook';
import contactRouter from '../routes/contact';
import conversationRouter from '../routes/conversation';
import bulkMessageRouter from '../routes/bulkMessage';
import templateRouter from '../routes/template';
import userRouter from '../routes/user';

dotenv.config();
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.raw({ type: 'application/x-www-form-urlencoded', limit: '50mb' }));
app.use(express.text({ type: 'text/plain', limit: '50mb' }));
app.use(cors());
app.use(morgan('dev'));

// Health check route
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/contacts', contactRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/bulk-messages', bulkMessageRouter);
app.use('/api/templates', templateRouter);
app.use('/api/users', userRouter);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({ 
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Handle 404 routes
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
