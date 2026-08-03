import type { Request, Response } from 'express';
import CommunityWallNote, { type ICommunityWallNote } from '../communityWall.model.js';

const PASTEL_COLORS = [
    "#FEF08A", // yellow
    "#FECACA", // pink/red
    "#BFDBFE", // blue
    "#BBF7D0", // green
    "#E9D5FF", // purple
    "#FFDEDA", // salmon
    "#E0E7FF", // indigo
];

// @desc    Add a new community wall note
// @route   POST /api/community-wall
// @access  Public
export const createNote = async (req: Request, res: Response): Promise<void> => {
    try {
        const username = req.body.username || req.body.name;
        const message = req.body.message || req.body.description || req.body.note;
        let color = req.body.color;
        let rotation = req.body.rotation;

        if (!username || !message) {
            res.status(400).json({ error: 'Username (or name) and message (or description) are required fields.' });
            return;
        }

        if (!color) {
            color = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
        }

        if (rotation === undefined || rotation === null || isNaN(Number(rotation))) {
            rotation = (Math.random() * 6) - 3; // Random rotation between -3 and +3
        } else {
            rotation = Number(rotation);
        }

        const newNote: ICommunityWallNote = new CommunityWallNote({
            username: username.trim(),
            message: message.trim(),
            color,
            rotation
        });

        const savedNote = await newNote.save();

        res.status(201).json({
            message: 'Note posted successfully',
            data: savedNote
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
