
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Users, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { userApi, UserData, UserStats, CreateUserData } from '@/lib/api';
import { toast } from 'sonner';

export const UserManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [users, setUsers] = useState<UserData[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserData>({
    name: '',
    email: '',
    role: 'bde',
    department: '',
    password: ''
  });

  const roles = ['all', 'admin', 'bde', 'hr', 'franchise', 'tech'];

  // Load users and stats on component mount
  useEffect(() => {
    loadUsers();
    loadUserStats();
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading users...');
      const response = await userApi.getAllUsers();
      console.log('📊 Users API response:', response);
      if (response.success) {
        setUsers(response.data.users);
        console.log('✅ Users loaded:', response.data.users);
      } else {
        console.error('❌ Failed to load users:', response.message);
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserStats = useCallback(async () => {
    try {
      console.log('🔄 Loading user stats...');
      const response = await userApi.getUserStats();
      console.log('📊 User stats API response:', response);
      if (response.success) {
        setUserStats(response.data.stats);
        console.log('✅ User stats loaded:', response.data.stats);
      } else {
        console.error('❌ Failed to load user stats:', response.message);
      }
    } catch (error) {
      console.error('❌ Error loading user stats:', error);
    }
  }, []);

  const handleCreateUser = useCallback(async () => {
    // Validate required fields
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await userApi.createUser(newUser);
      if (response.success) {
        toast.success('User created successfully');
        setIsAddDialogOpen(false);
        setNewUser({ name: '', email: '', role: 'bde', department: '', password: '' });
        loadUsers();
        loadUserStats();
      } else {
        toast.error(response.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  }, [newUser, loadUsers, loadUserStats]);

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const response = await userApi.deleteUser(userId);
      if (response.success) {
        toast.success('User deleted successfully');
        loadUsers();
        loadUserStats();
      } else {
        toast.error(response.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'supervisor':
        return <Users className="w-4 h-4" />;
      case 'agent':
        return <User className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'bde':
        return 'default';
      case 'hr':
        return 'secondary';
      case 'franchise':
        return 'outline';
      case 'tech':
        return 'default';
      default:
        return 'outline';
    }
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleCreateUser();
  }, [handleCreateUser]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser(prev => ({ ...prev, name: e.target.value }));
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser(prev => ({ ...prev, email: e.target.value }));
  }, []);

  const handleRoleChange = useCallback((value: string) => {
    setNewUser(prev => ({ ...prev, role: value as any }));
  }, []);

  const handleDepartmentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser(prev => ({ ...prev, department: e.target.value }));
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser(prev => ({ ...prev, password: e.target.value }));
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsAddDialogOpen(false);
  }, []);

  const AddUserDialog = useCallback(() => (
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
              value={newUser.name}
              onChange={handleNameChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="Enter email address" 
              value={newUser.email}
              onChange={handleEmailChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={newUser.role} onValueChange={handleRoleChange}>
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
              value={newUser.department}
              onChange={handleDepartmentChange}
            />
          </div>
          <div>
            <Label htmlFor="password">Temporary Password *</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="Enter temporary password" 
              value={newUser.password}
              onChange={handlePasswordChange}
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit">Add User</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  ), [isAddDialogOpen, newUser, handleSubmit, handleNameChange, handleEmailChange, handleRoleChange, handleDepartmentChange, handlePasswordChange, handleCloseDialog]);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">User Management</h2>
            <p className="text-muted-foreground">Manage team members and their access levels</p>
          </div>
          <AddUserDialog />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-sm text-muted-foreground flex items-center">
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-xl font-bold">{userStats?.byRole.admin || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">BDE</p>
                <p className="text-xl font-bold">{userStats?.byRole.bde || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">HR</p>
                <p className="text-xl font-bold">{userStats?.byRole.hr || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Franchise</p>
                <p className="text-xl font-bold">{userStats?.byRole.franchise || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-xl font-bold">{userStats?.active || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="p-4 font-medium text-muted-foreground">User</th>
                    <th className="p-4 font-medium text-muted-foreground">Role</th>
                    <th className="p-4 font-medium text-muted-foreground">Department</th>
                    <th className="p-4 font-medium text-muted-foreground">Status</th>
                    <th className="p-4 font-medium text-muted-foreground">Created</th>
                    <th className="p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-accent/50">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-primary-foreground text-sm font-medium">
                              {user.avatar}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(user.role)}
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role.toUpperCase()}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {user.department || 'Not specified'}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
};
