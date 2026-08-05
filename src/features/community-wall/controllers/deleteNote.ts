import type { Request, Response } from 'express';
import CommunityWallNote from '../communityWall.model.js';

// @desc    Delete a community wall note (Admin)
// @route   DELETE /api/community-wall/:id
// @access  Protected
export const deleteNote = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const deletedNote = await CommunityWallNote.findByIdAndDelete(id);

        if (!deletedNote) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        res.json({
            message: 'Note deleted successfully',
            data: deletedNote
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
