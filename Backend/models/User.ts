import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'bde' | 'hr'|'franchise'|'tech';
  department: string;
  isActive: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'bde', 'hr','franchise','tech'], required: true },
  department: { type: String },
  isActive: { type: Boolean, default: true },
  permissions: [{ type: String }],
}, { timestamps: true });

export default model<IUser>('User', UserSchema); 