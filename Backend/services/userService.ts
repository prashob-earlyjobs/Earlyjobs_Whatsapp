import User, { IUser } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, TokenPayload } from '../utils/jwt';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'agent' | 'manager';
  department?: string;
  permissions?: string[];
}

export interface LoginData {
  email: string;
  password: string;
}

export class UserService {
  static async createUser(userData: CreateUserData): Promise<IUser> {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await hashPassword(userData.password);
    
    const user = new User({
      ...userData,
      password: hashedPassword,
    });

    return await user.save();
  }

  static async loginUser(loginData: LoginData): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: loginData.email });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    const isPasswordValid = await comparePassword(loginData.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const tokenPayload: TokenPayload = {
      id: (user._id as any).toString(),
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    const token = generateToken(tokenPayload);

    return { user, token };
  }

  static async getUserById(userId: string): Promise<IUser | null> {
    return await User.findById(userId).select('-password');
  }

  static async updateUser(userId: string, updateData: Partial<IUser>): Promise<IUser | null> {
    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
    }

    return await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
  }

  static async getAllUsers(filters: any = {}): Promise<IUser[]> {
    return await User.find(filters).select('-password');
  }

  static async deleteUser(userId: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(userId);
    return !!result;
  }
} 