import mongoose, { Document, Schema } from 'mongoose';

export interface RegionResult {
  region: 'forehead' | 'left_cheek' | 'right_cheek' | 'nose' | 'chin';
  condition: 'acne' | 'pigmentation' | 'tanning' | 'normal';
  confidence: number;
  probabilities: Record<string, number>;
  bbox: [number, number, number, number];
}

export interface ISkinAnalysis extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  condition: 'acne' | 'pigmentation' | 'tanning' | 'normal';
  confidence: number;
  probabilities: Record<string, number>;
  imageUrl: string;
  imagePath: string;
  heatmapUrl?: string;
  region: string;
  season: string;
  skinType?: 'oily' | 'dry' | 'combination' | 'normal' | 'unknown';
  regionAnalysis: RegionResult[];
  modelType: string;
  isFallback: boolean;
  recommendations: {
    remedies: any[];
    dietPlan: any;
    exercises: any[];
    homemadePacks: any[];
    lifestyleTips: string[];
    avoidPractices: string[];
    explainedLogic: string;
    routine?: { morning: string[]; night: string[] };
    severityScore?: number;
  };
  createdAt: Date;
}

const RegionResultSchema = new Schema({
  region:        { type: String, required: true },
  condition:     { type: String, required: true },
  confidence:    { type: Number, required: true },
  probabilities: { type: Map, of: Number, default: {} },
  bbox:          { type: [Number], default: [] },
}, { _id: false });

const SkinAnalysisSchema = new Schema<ISkinAnalysis>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    condition:  { type: String, required: true, enum: ['acne','pigmentation','tanning','normal'] },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    probabilities: { type: Map, of: Number, default: {} },
    imageUrl:   { type: String },
    imagePath:  { type: String },
    heatmapUrl: { type: String },
    region:     { type: String, required: true },
    season:     { type: String, required: true },
    skinType:   { type: String, enum: ['oily','dry','combination','normal','unknown'], default: 'unknown' },
    regionAnalysis: { type: [RegionResultSchema], default: [] },
    modelType:  { type: String, default: 'unknown' },
    isFallback: { type: Boolean, default: false },
    recommendations: {
      remedies:       [Schema.Types.Mixed],
      dietPlan:        Schema.Types.Mixed,
      exercises:      [Schema.Types.Mixed],
      homemadePacks:  [Schema.Types.Mixed],
      lifestyleTips:  [String],
      avoidPractices: [String],
      explainedLogic:  String,
      routine:         Schema.Types.Mixed,
      severityScore:   Number,
    }
  },
  { timestamps: true }
);

export const SkinAnalysis = mongoose.model<ISkinAnalysis>('SkinAnalysis', SkinAnalysisSchema);
