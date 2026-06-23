import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not';
  skinType?: 'oily' | 'dry' | 'combination' | 'normal';
  city?: string;
  profileComplete: boolean;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name:            { type: String, required: true, trim: true, maxlength: 100 },
    email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:        { type: String, required: true, minlength: 6 },
    age:             { type: Number, min: 10, max: 120 },
    gender:          { type: String, enum: ['male','female','other','prefer_not'] },
    skinType:        { type: String, enum: ['oily','dry','combination','normal'] },
    city:            { type: String, trim: true, maxlength: 100 },
    profileComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.set('toJSON', {
  transform: (_doc, ret) => { delete (ret as any).password; return ret; }
});

export const User = mongoose.model<IUser>('User', UserSchema);
