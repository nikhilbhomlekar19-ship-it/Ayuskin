import mongoose, { Document, Schema } from 'mongoose';

export interface IGamificationState extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  streakDays: number;
  longestStreak: number;
  lastActivityDate: Date | null;
  totalAnalyses: number;
  totalHabitLogs: number;
  habitLogStreak: number;
  longestHabitStreak: number;
  lastHabitLogDate: Date | null;
  skinScore: number;
  baselineSeverity: number | null;
  remediesUsed: string[];
  earnedBadges: Array<{ badgeId: string; earnedAt: Date }>;
  weeklyGoalProgress: number;
  createdAt: Date;
  updatedAt: Date;
}

const GamificationStateSchema = new Schema<IGamificationState>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    streakDays: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityDate: { type: Date, default: null },
    totalAnalyses: { type: Number, default: 0 },
    totalHabitLogs: { type: Number, default: 0 },
    habitLogStreak: { type: Number, default: 0 },
    longestHabitStreak: { type: Number, default: 0 },
    lastHabitLogDate: { type: Date, default: null },
    skinScore: { type: Number, default: 0, min: 0, max: 100 },
    baselineSeverity: { type: Number, default: null },
    remediesUsed: { type: [String], default: [] },
    earnedBadges: [{ badgeId: { type: String, required: true }, earnedAt: { type: Date, default: Date.now } }],
    weeklyGoalProgress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export const GamificationState = mongoose.model<IGamificationState>('GamificationState', GamificationStateSchema);
