import type { Request, Response } from 'express';
import CommunityWallNote from '../communityWall.model.js';

// @desc    Decrement likes for a community wall note (unlike)
// @route   PATCH /api/community-wall/:id/unlike
// @access  Public
export const unlikeNote = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const note = await CommunityWallNote.findById(id);

        if (!note) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        if (note.likes > 0) {
            note.likes -= 1;
            await note.save();
        }

        res.json({
            message: 'Note unliked successfully',
            data: note
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
