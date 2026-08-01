import type { Request, Response } from 'express';
import Memory from '../memory.model.js';

// @desc    Decrement likes for a memory (unlike)
// @route   PATCH /api/memories/:id/unlike
// @access  Public
export const unlikeMemory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const memory = await Memory.findById(id);

        if (!memory) {
            res.status(404).json({ error: 'Memory not found' });
            return;
        }

        if (memory.likes > 0) {
            memory.likes -= 1;
            await memory.save();
        }

        res.json({
            message: 'Memory unliked successfully',
            data: memory
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
