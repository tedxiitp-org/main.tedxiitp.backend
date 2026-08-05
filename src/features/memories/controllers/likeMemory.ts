import type { Request, Response } from 'express';
import Memory from '../memory.model.js';

// @desc    Increment likes for a memory
// @route   PATCH /api/memories/:id/like
// @access  Public
export const likeMemory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const updatedMemory = await Memory.findByIdAndUpdate(
            id,
            { $inc: { likes: 1 } },
            { new: true }
        );

        if (!updatedMemory) {
            res.status(404).json({ error: 'Memory not found' });
            return;
        }

        res.json({
            message: 'Memory liked successfully',
            data: updatedMemory
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
