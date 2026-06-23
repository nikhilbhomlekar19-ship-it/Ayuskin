import mongoose, { Document, Schema } from 'mongoose';

export interface IHabitLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  waterIntakeLitres: number;
  sleepHours: number;
  stressLevel: number;
  dietType: 'clean' | 'moderate' | 'junk';
  sugarConsumed: boolean;
  dairyConsumed: boolean;
  exerciseDone: boolean;
  sunExposureMinutes: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HabitLogSchema = new Schema<IHabitLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    waterIntakeLitres: { type: Number, required: true, min: 0, max: 10 },
    sleepHours: { type: Number, required: true, min: 0, max: 24 },
    stressLevel: { type: Number, required: true, min: 1, max: 5 },
    dietType: { type: String, required: true, enum: ['clean', 'moderate', 'junk'] },
    sugarConsumed: { type: Boolean, required: true, default: false },
    dairyConsumed: { type: Boolean, required: true, default: false },
    exerciseDone: { type: Boolean, required: true, default: false },
    sunExposureMinutes: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

HabitLogSchema.index({ userId: 1, date: 1 }, { unique: true });

export const HabitLog = mongoose.model<IHabitLog>('HabitLog', HabitLogSchema);
