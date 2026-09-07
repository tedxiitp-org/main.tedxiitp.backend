import type { Request, Response } from 'express';
import CommunityWallNote from '../communityWall.model.js';

// @desc    Increment likes for a community wall note
// @route   PATCH /api/community-wall/:id/like
// @access  Public
export const likeNote = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const updatedNote = await CommunityWallNote.findByIdAndUpdate(
            id,
            { $inc: { likes: 1 } },
            { returnDocument: 'after' }
        );

        if (!updatedNote) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        res.json({
            message: 'Note liked successfully',
            data: updatedNote
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
