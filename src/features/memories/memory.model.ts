import mongoose, { Schema, Document } from 'mongoose';
import { env } from '../../config/env.js';

export interface IMemory extends Document {
    name: string;
    roleCategory: 'Organizer' | 'Coordinator' | 'Subcoordinator';
    memoryText: string;
    likes: number;
    createdAt: Date;
    updatedAt: Date;
}

const memorySchema: Schema = new Schema({
    name: {
        type: String,
        required: true,
    },
    roleCategory: {
        type: String,
        required: true,
        enum: ['Organizer', 'Coordinator', 'Subcoordinator'],
    },
    memoryText: {
        type: String,
        required: true,
    },
    likes: {
        type: Number,
        default: 0,
    },
}, { 
    timestamps: true,
    collection: env.NODE_ENV === 'production' ? 'memories' : 'memories_dev'
});

const Memory = mongoose.model<IMemory>('Memory', memorySchema);

export default Memory;
