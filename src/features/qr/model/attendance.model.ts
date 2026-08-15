import mongoose, { Document, Schema } from 'mongoose';

export interface IAttendance extends Document {
  ticketId: string;
  session: string;
  scannedAt: Date;
  scannedBy: string; //  ID of the volunteer/admin who scanned it
  validationStatus: "SUCCESS" | "FAILED_DUPLICATE" | "FAILED_REVOKED" | "FAILED_INVALID" | "FAILED_WRONG_SESSION";
}

const attendanceSchema = new Schema<IAttendance>({
  ticketId: { type: String, required: true },
  session: { type: String, required: true },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: { type: String, required: true },
  validationStatus: { 
    type: String, 
    enum: ["SUCCESS", "FAILED_DUPLICATE", "FAILED_REVOKED", "FAILED_INVALID", "FAILED_WRONG_SESSION"], 
    required: true 
  }
});

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);