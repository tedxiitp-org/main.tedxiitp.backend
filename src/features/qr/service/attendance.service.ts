import { Ticket } from '../model/ticket.model.js';
import { Attendance } from '../model/attendance.model.js';

export const getAttendanceStats = async () => {

  const stats = await Ticket.aggregate([
    { $match: { isCheckedIn: true } },
    { $group: { _id: "$session", count: { $sum: 1 } } }
  ]);
  return stats;
};

// Per-volunteer scan counts: how many tickets each volunteer scanned, with a
// breakdown by validation status. scannedBy holds the volunteer's _id as a
// string, so we convert it to an ObjectId to join against the Admin collection.
export const getVolunteerScanStats = async () => {
  return await Attendance.aggregate([
    {
      $group: {
        _id: "$scannedBy",
        total: { $sum: 1 },
        success: {
          $sum: { $cond: [{ $eq: ["$validationStatus", "SUCCESS"] }, 1, 0] }
        },
        duplicate: {
          $sum: { $cond: [{ $eq: ["$validationStatus", "FAILED_DUPLICATE"] }, 1, 0] }
        },
        revoked: {
          $sum: { $cond: [{ $eq: ["$validationStatus", "FAILED_REVOKED"] }, 1, 0] }
        },
        invalid: {
          $sum: { $cond: [{ $eq: ["$validationStatus", "FAILED_INVALID"] }, 1, 0] }
        },
        wrongSession: {
          $sum: { $cond: [{ $eq: ["$validationStatus", "FAILED_WRONG_SESSION"] }, 1, 0] }
        }
      }
    },
    {
      // Safely turn the stored string id into an ObjectId for the join.
      $addFields: {
        scannerObjectId: {
          $convert: { input: "$_id", to: "objectId", onError: null, onNull: null }
        }
      }
    },
    {
      $lookup: {
        from: "admins",
        localField: "scannerObjectId",
        foreignField: "_id",
        as: "scanner"
      }
    },
    {
      $project: {
        _id: 0,
        scannedById: "$_id",
        email: {
          $ifNull: [{ $arrayElemAt: ["$scanner.email", 0] }, "Unknown / removed"]
        },
        role: {
          $ifNull: [{ $arrayElemAt: ["$scanner.role", 0] }, null]
        },
        total: 1,
        success: 1,
        duplicate: 1,
        revoked: 1,
        invalid: 1,
        wrongSession: 1
      }
    },
    { $sort: { success: -1, total: -1 } }
  ]);
};