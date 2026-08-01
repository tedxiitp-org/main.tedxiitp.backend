import type { Request, Response } from 'express';
import Memory, { type IMemory } from '../memory.model.js';

// @desc    Get all memories
// @route   GET /api/memories
// @access  Public
export const getMemories = async (req: Request, res: Response): Promise<void> => {
    try {
        const memories: IMemory[] = await Memory.find().sort({ createdAt: -1 }); // Newest first
        res.json({
            message: 'success',
            data: memories
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
