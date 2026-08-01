import type { Request, Response } from 'express';
import Memory, { type IMemory } from '../memory.model.js';

// @desc    Add a new memory
// @route   POST /api/memories
// @access  Public
export const createMemory = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, roleCategory, customRoleTitle, memoryText } = req.body;

        if (!name || !roleCategory || !memoryText) {
            res.status(400).json({ error: 'Name, Role Category, and Memory Text are required fields.' });
            return;
        }

        const validCategories = ['Organizer', 'Coordinator', 'Subcoordinator'];
        if (!validCategories.includes(roleCategory)) {
            res.status(400).json({ error: 'Invalid Role Category. Must be Organizer, Coordinator, or Subcoordinator.' });
            return;
        }

        const newMemory: IMemory = new Memory({
            name,
            roleCategory,
            customRoleTitle,
            memoryText
        });

        const savedMemory = await newMemory.save();

        res.status(201).json({
            message: 'Memory pinned successfully',
            data: savedMemory
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
