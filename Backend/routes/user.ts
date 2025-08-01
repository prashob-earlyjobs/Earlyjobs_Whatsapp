import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/users - Get all users
router.get('/', authenticateToken, UserController.getAllUsers);

// Test route without authentication
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User API is working',
    timestamp: new Date().toISOString()
  });
});

// GET /api/users/stats - Get user statistics
router.get('/stats', authenticateToken, UserController.getUserStats);

// POST /api/users - Create new user
router.post('/', authenticateToken, UserController.createUser);

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticateToken, UserController.getUserById);

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, UserController.updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticateToken, UserController.deleteUser);

export default router; 