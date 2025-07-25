import { Request, Response } from 'express';
import { UserService, CreateUserData, LoginData } from '../services/userService';
import { AuthRequest } from '../middleware/auth';
import { validatePassword } from '../utils/password';
import { generateRefreshToken, verifyRefreshToken, generateToken } from '../utils/jwt';

export class AuthController {
  // POST /api/auth/register
  static async register(req: Request, res: Response) {
    try {
      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { name, email, password, role, department, permissions }: CreateUserData = req.body;

      // Validation
      if (!name || !email || !password || !role) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, password, and role are required'
        });
      }

      // Type validation
      if (typeof name !== 'string' || typeof email !== 'string' || 
          typeof password !== 'string' || typeof role !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Name, email, password, and role must be strings'
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      // Password validation
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password validation failed',
          errors: passwordValidation.errors
        });
      }

      // Role validation
      const validRoles = ['admin', 'bde', 'hr','franchise','tech'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin, bde,hr,tech, or franchise'
        });
      }

      const user = await UserService.createUser({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role,
        department: department?.trim(),
        permissions: permissions || []
      });

      // Remove password from response
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        permissions: user.permissions,
        createdAt: user.createdAt
      };

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userResponse
        }
      });

    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      if (error.message === 'User with this email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err: any) => err.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // POST /api/auth/login
  static async login(req: Request, res: Response) {
    try {
      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { email, password }: LoginData = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Type validation
      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Email and password must be strings'
        });
      }

      const { user, token } = await UserService.loginUser({ 
        email: email.toLowerCase().trim(), 
        password 
      });

      const refreshToken = generateRefreshToken({
        id: (user._id as any).toString(),
        email: user.email,
        role: user.role,
        permissions: user.permissions
      });

      // Remove password from response
      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        permissions: user.permissions
      };

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          token,
          refreshToken
        }
      });

    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message === 'Invalid email or password' || error.message === 'Account is disabled') {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  // POST /api/auth/logout
  static async logout(req: AuthRequest, res: Response) {
    try {
      // Since we're using JWT (stateless), we can't invalidate tokens on the server
      // In a production app, you might want to implement a token blacklist
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout'
      });
    }
  }

  // GET /api/auth/profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await UserService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userResponse = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: userResponse
        }
      });

    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving profile'
      });
    }
  }

  // PUT /api/auth/profile
  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { name, email, department, password, currentPassword } = req.body;

      // If updating password, require current password
      if (password) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is required to update password'
          });
        }

        // Type validation for passwords
        if (typeof password !== 'string' || typeof currentPassword !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Passwords must be strings'
          });
        }

        // Validate new password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
          return res.status(400).json({
            success: false,
            message: 'New password validation failed',
            errors: passwordValidation.errors
          });
        }

        // Verify current password
        const User = (await import('../models/User')).default;
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        const { comparePassword } = await import('../utils/password');
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
      }

      // Email validation if updating email
      if (email) {
        if (typeof email !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Email must be a string'
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
          });
        }
      }

      // Name validation if updating name
      if (name && typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Name must be a string'
        });
      }

      // Department validation if updating department
      if (department && typeof department !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Department must be a string'
        });
      }

      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (email) updateData.email = email.toLowerCase().trim();
      if (department) updateData.department = department.trim();
      if (password) updateData.password = password;

      const updatedUser = await UserService.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userResponse = {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        isActive: updatedUser.isActive,
        permissions: updatedUser.permissions,
        updatedAt: updatedUser.updatedAt
      };

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: userResponse
        }
      });

    } catch (error: any) {
      console.error('Update profile error:', error);
      
      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }

      if (error.message === 'User with this email already exists') {
        return res.status(409).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err: any) => err.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error while updating profile'
      });
    }
  }

  // POST /api/auth/refresh
  static async refreshToken(req: Request, res: Response) {
    try {
      // Check if request body exists
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Request body is required and must be valid JSON'
        });
      }

      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      if (typeof refreshToken !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Refresh token must be a string'
        });
      }

      const decoded = verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await UserService.getUserById(decoded.id);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or account is disabled'
        });
      }

      // Generate new access token
      const newToken = generateToken({
        id: decoded.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken
        }
      });

    } catch (error: any) {
      console.error('Token refresh error:', error);
      
      // Handle JWT specific errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Refresh token has expired'
        });
      }

      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  }
} 