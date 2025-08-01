import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock, Mail, Building, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { LoginData, RegisterData } from '@/lib/auth-api';

export const Login: React.FC = () => {
  const { login, register, isLoading, error, clearError } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as 'admin' | 'bde' | 'hr' | 'franchise' | 'tech' | '',
    department: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isLoginMode) {
        const loginData: LoginData = {
          email: formData.email,
          password: formData.password,
        };
        await login(loginData);
      } else {
        const registerData: RegisterData = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role as 'admin' | 'bde' | 'hr' | 'franchise' | 'tech',
          department: formData.department || undefined,
        };
        await register(registerData);
      }
    } catch (error) {
      // Error is handled by the auth context
      console.error('Authentication error:', error);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      department: '',
    });
    if (error) clearError();
  };

  const isFormValid = () => {
    if (isLoginMode) {
      return formData.email && formData.password;
    } else {
      return formData.name && formData.email && formData.password && formData.role;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/EJ Logo.png" 
              alt="EarlyJobs Logo" 
              className="w-12 h-12 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {isLoginMode ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLoginMode 
              ? 'Sign in to your EarlyJobs WhatsApp Portal account'
              : 'Join the EarlyJobs WhatsApp Portal team'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Name Field (Register only) */}
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="pl-10"
                    required={!isLoginMode}
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {/* Role Field (Register only) */}
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                  required={!isLoginMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="bde">Business Development Executive</SelectItem>
                    <SelectItem value="hr">HR Manager</SelectItem>
                    <SelectItem value="franchise">Franchise Manager</SelectItem>
                    <SelectItem value="tech">Technical Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Department Field (Register only) */}
            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="department">Department (Optional)</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="department"
                    type="text"
                    placeholder="Enter your department"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={!isFormValid() || isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{isLoginMode ? 'Signing in...' : 'Creating account...'}</span>
                </div>
              ) : (
                isLoginMode ? 'Sign In' : 'Create Account'
              )}
            </Button>

            {/* Toggle Mode */}
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-muted-foreground hover:text-foreground underline"
                disabled={isLoading}
              >
                {isLoginMode
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'
                }
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login; 