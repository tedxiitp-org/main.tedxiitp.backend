import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Admin } from '../model/admin.model.js';

// Create a volunteer account with the email + password chosen by the admin.
export const createVolunteer = async (req: Request, res: Response): Promise<any> => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const volunteer = await Admin.create({
      email,
      password: passwordHash,
      role: "VOLUNTEER",
    });

    return res.status(201).json({
      success: true,
      message: "Volunteer created",
      data: { id: volunteer._id, email: volunteer.email, role: volunteer.role },
    });
  } catch (error) {
    console.error("Create Volunteer Error:", error);
    return res.status(500).json({ error: "Failed to create volunteer" });
  }
};

// List every volunteer account (never returns password hashes).
export const listVolunteers = async (req: Request, res: Response): Promise<any> => {
  try {
    const volunteers = await Admin.find({ role: "VOLUNTEER" })
      .select("email role createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: volunteers });
  } catch (error) {
    console.error("List Volunteers Error:", error);
    return res.status(500).json({ error: "Failed to fetch volunteers" });
  }
};

// Delete a volunteer by id. Guards against deleting admin accounts.
export const deleteVolunteer = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const volunteer = await Admin.findOne({ _id: id, role: "VOLUNTEER" });
    if (!volunteer) {
      return res.status(404).json({ error: "Volunteer not found" });
    }

    await Admin.deleteOne({ _id: id });
    return res.status(200).json({ success: true, message: "Volunteer deleted" });
  } catch (error) {
    console.error("Delete Volunteer Error:", error);
    return res.status(500).json({ error: "Failed to delete volunteer" });
  }
};
