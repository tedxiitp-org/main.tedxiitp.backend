import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGO_URI;

if (!uri) {
    console.error("No MONGO_URI found in .env");
    process.exit(1);
}

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection.db;
    if (!db) {
        console.error("DB connection failed");
        process.exit(1);
    }
    
    // Find surf game
    const surf = await db.collection('games').findOne({ name: 'surf' });
    
    if (!surf) {
        await db.collection('games').insertOne({
            name: 'surf',
            type: 'A',
            description: 'Endless Sail Game',
            createdAt: new Date(),
            __v: 0
        });
        console.log("Created surf game as type A");
    } else {
        await db.collection('games').updateOne({ _id: surf._id }, { $set: { type: 'A' } });
        console.log("Updated surf game to type A");
    }
    
    process.exit(0);
}).catch(console.error);
