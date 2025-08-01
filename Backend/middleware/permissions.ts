import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        requiredPermission: permission,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

export const requirePermissions = (permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const hasAllPermissions = permissions.every(permission => 
      req.user!.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        message: `Permissions required: ${permissions.join(', ')}` 
      });
    }

    next();
  };
}; 