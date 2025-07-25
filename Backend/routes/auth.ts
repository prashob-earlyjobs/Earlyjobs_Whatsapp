import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', AuthController.register);

// POST /api/auth/login
router.post('/login', AuthController.login);

// POST /api/auth/logout
router.post('/logout', authenticateToken, AuthController.logout);

// GET /api/auth/profile
router.get('/profile', authenticateToken, AuthController.getProfile);

// PUT /api/auth/profile
router.put('/profile', authenticateToken, AuthController.updateProfile);

// POST /api/auth/refresh
router.post('/refresh', AuthController.refreshToken);

export default router; 