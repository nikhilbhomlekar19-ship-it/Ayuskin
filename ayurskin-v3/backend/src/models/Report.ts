import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  analysisId: mongoose.Types.ObjectId;
  pdfUrl: string;
  pdfPath: string;
  generatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    analysisId:  { type: Schema.Types.ObjectId, ref: 'SkinAnalysis', required: true },
    pdfUrl:      { type: String, required: true },
    pdfPath:     { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Report = mongoose.model<IReport>('Report', ReportSchema);
