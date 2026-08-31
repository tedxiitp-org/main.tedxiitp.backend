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
    
    // Find arrowEscape game
    const game = await db.collection('games').findOne({ name: 'arrowEscape' });
    
    if (!game) {
        await db.collection('games').insertOne({
            name: 'arrowEscape',
            type: 'A',
            description: 'Arrow Escape Puzzle Game',
            maxRawScore: 10000,
            createdAt: new Date(),
            __v: 0
        });
        console.log("Created arrowEscape game as type A");
    } else {
        await db.collection('games').updateOne({ _id: game._id }, { $set: { type: 'A', maxRawScore: 10000 } });
        console.log("Updated arrowEscape game to type A and set maxRawScore to 10000");
    }
    
    process.exit(0);
}).catch(console.error);
