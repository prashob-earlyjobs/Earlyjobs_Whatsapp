import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer;

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log('Socket connected:', socket.id);

    // Join conversation room
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation-${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation-${conversationId}`);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Join user room for notifications
    socket.on('join-user', (userId: string) => {
      socket.join(`user-${userId}`);
      console.log(`Socket ${socket.id} joined user ${userId}`);
    });

    // Handle typing indicators
    socket.on('typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
        userId: data.userId,
        isTyping: data.isTyping,
      });
    });

    // Handle message read status
    socket.on('message-read', (data: { conversationId: string; messageId: string }) => {
      socket.to(`conversation-${data.conversationId}`).emit('message-status-updated', {
        messageId: data.messageId,
        status: 'read',
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};

// Helper functions to emit events
export const emitToConversation = (conversationId: string, event: string, data: any) => {
  if (io) {
    io.to(`conversation-${conversationId}`).emit(event, data);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user-${userId}`).emit(event, data);
  }
};

export const emitNewMessage = (conversationId: string, message: any) => {
  emitToConversation(conversationId, 'new-message', message);
};

export const emitMessageStatusUpdate = (conversationId: string, messageId: string, status: string) => {
  emitToConversation(conversationId, 'message-status-updated', { messageId, status });
};

export const emitConversationUpdate = (conversationId: string, conversation: any) => {
  emitToConversation(conversationId, 'conversation-updated', conversation);
};

export const emitBulkMessageProgress = (userId: string, bulkMessageId: string, progress: number) => {
  emitToUser(userId, 'bulk-message-progress', { bulkMessageId, progress });
};

export const getIO = () => io; 