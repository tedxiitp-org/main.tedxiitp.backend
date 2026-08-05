import mongoose, { Schema, Document } from 'mongoose';
import { env } from '../../config/env.js';

export interface ICommunityWallNote extends Document {
    username: string;
    message: string;
    color: string;
    likes: number;
    rotation: number;
    createdAt: Date;
    updatedAt: Date;
}

const communityWallSchema: Schema = new Schema({
    username: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    color: {
        type: String,
        default: '#FEF08A',
    },
    likes: {
        type: Number,
        default: 0,
    },
    rotation: {
        type: Number,
        default: 0,
    },
}, { 
    timestamps: true,
    collection: env.NODE_ENV === 'production' ? 'community_wall_notes' : 'community_wall_notes_dev',
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for 'name' and 'description' so both name/username and message/description work in frontend/backend responses
communityWallSchema.virtual('name').get(function() {
    return this.username;
});

communityWallSchema.virtual('description').get(function() {
    return this.message;
});

const CommunityWallNote = mongoose.model<ICommunityWallNote>('CommunityWallNote', communityWallSchema);

export default CommunityWallNote;
