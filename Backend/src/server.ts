import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import app from './app';  // Import the configured app

dotenv.config();

const PORT = process.env.PORT || 5000;

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
