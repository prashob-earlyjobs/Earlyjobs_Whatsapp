import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateUserData } from '@/lib/api';

interface AddUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (userData: CreateUserData) => Promise<void>;
}

export const AddUserDialog: React.FC<AddUserDialogProps> = ({ isOpen, onOpenChange, onSubmit }) => {
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    email: '',
    role: 'bde',
    department: '',
    password: ''
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      return;
    }

    await onSubmit(formData);
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      role: 'bde',
      department: '',
      password: ''
    });
  }, [formData, onSubmit]);

  const handleInputChange = useCallback((field: keyof CreateUserData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset form when closing
    setFormData({
      name: '',
      email: '',
      role: 'bde',
      department: '',
      password: ''
    });
  }, [onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with appropriate role and permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input 
              id="name" 
              placeholder="Enter full name" 
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="Enter email address" 
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="bde">BDE</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="franchise">Franchise</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input 
              id="department" 
              placeholder="Enter department" 
              value={formData.department}
              onChange={(e) => handleInputChange('department', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Temporary Password *</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="Enter temporary password" 
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">Add User</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 