import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { AuthRequest } from '../middleware/auth';

export class UserController {
  static async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const users = await UserService.getAllUsers();
      
      // Transform users to include additional fields for frontend
      const transformedUsers = users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        department: user.department,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Add avatar from name initials
        avatar: user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      }));

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users: transformedUsers,
          count: transformedUsers.length
        }
      });
    } catch (error: any) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: error.message
      });
    }
  }

  static async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await UserService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const transformedUser = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        department: user.department,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatar: user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      };

      res.json({
        success: true,
        message: 'User retrieved successfully',
        data: { user: transformedUser }
      });
    } catch (error: any) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        error: error.message
      });
    }
  }

  static async createUser(req: AuthRequest, res: Response) {
    try {
      const { name, email, role, department, password, permissions } = req.body;

      // Validate required fields
      if (!name || !email || !role || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, role, and password are required'
        });
      }

      const userData = {
        name,
        email,
        role,
        department: department || '',
        password,
        permissions: permissions || [],
        isActive: true
      };

      const user = await UserService.createUser(userData);
      
      const transformedUser = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        department: user.department,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatar: user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      };

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: transformedUser }
      });
    } catch (error: any) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: error.message
      });
    }
  }

  static async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData.password;
      delete updateData.email; // Email updates should be handled separately

      const user = await UserService.updateUser(id, updateData);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const transformedUser = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        department: user.department,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        avatar: user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      };

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user: transformedUser }
      });
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user',
        error: error.message
      });
    }
  }

  static async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      
      // Prevent deleting the current user
      if (id === req.user?.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      const deleted = await UserService.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      });
    }
  }

  static async getUserStats(req: AuthRequest, res: Response) {
    try {
      const users = await UserService.getAllUsers();
      
      const stats = {
        total: users.length,
        active: users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length,
        byRole: {
          admin: users.filter(u => u.role === 'admin').length,
          bde: users.filter(u => u.role === 'bde').length,
          hr: users.filter(u => u.role === 'hr').length,
          franchise: users.filter(u => u.role === 'franchise').length,
          tech: users.filter(u => u.role === 'tech').length
        }
      };

      res.json({
        success: true,
        message: 'User stats retrieved successfully',
        data: { stats }
      });
    } catch (error: any) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user stats',
        error: error.message
      });
    }
  }
} 