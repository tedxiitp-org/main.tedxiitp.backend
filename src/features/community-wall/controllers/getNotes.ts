import type { Request, Response } from 'express';
import CommunityWallNote, { type ICommunityWallNote } from '../communityWall.model.js';

// @desc    Get all community wall notes
// @route   GET /api/community-wall
// @access  Public
export const getNotes = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sort } = req.query;
        const sortOption: Record<string, 1 | -1> = sort === 'top'
            ? { likes: -1, createdAt: -1 }
            : { createdAt: -1 };

        const notes: ICommunityWallNote[] = await CommunityWallNote.find().sort(sortOption);
        res.json({
            message: 'success',
            data: notes
        });
    } catch (err: any) {
        console.error("Error in getNotes controller:", err);
        res.status(500).json({ error: err.message || 'Failed to retrieve notes' });
    }
};
