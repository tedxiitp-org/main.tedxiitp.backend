import mongoose, { Schema, Document } from 'mongoose';

export interface IMemory extends Document {
    name: string;
    roleCategory: 'Organizer' | 'Coordinator' | 'Subcoordinator';
    customRoleTitle?: string;
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
    customRoleTitle: {
        type: String,
    },
    memoryText: {
        type: String,
        required: true,
    },
    likes: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

const Memory = mongoose.model<IMemory>('Memory', memorySchema);

export default Memory;
