import mongoose, { Document, Schema } from 'mongoose';

export interface IProgressSnapshot extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  imageUrl: string;
  imagePath: string;
  note?: string;
  analysisResult?: {
    condition: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  comparisonWithPrevious?: {
    previousSnapshotId: mongoose.Types.ObjectId;
    acneReduction: number;
    brightnessImprovement: number;
    uniformityImprovement: number;
    overallImprovement: boolean;
    insights: string[];
  };
  createdAt: Date;
}

const ProgressSnapshotSchema = new Schema<IProgressSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    imageUrl: { type: String, required: true },
    imagePath: { type: String, required: true },
    note: { type: String, maxlength: 500 },
    analysisResult: {
      condition: String,
      confidence: Number,
      probabilities: { type: Map, of: Number }
    },
    comparisonWithPrevious: {
      previousSnapshotId: { type: Schema.Types.ObjectId, ref: 'ProgressSnapshot' },
      acneReduction: Number,
      brightnessImprovement: Number,
      uniformityImprovement: Number,
      overallImprovement: Boolean,
      insights: [String]
    }
  },
  { timestamps: true }
);

export const ProgressSnapshot = mongoose.model<IProgressSnapshot>('ProgressSnapshot', ProgressSnapshotSchema);
