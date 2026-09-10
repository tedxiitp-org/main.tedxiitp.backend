import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    
    // Find watertoss game
    const game = await db.collection('games').findOne({ name: 'watertoss' });
    
    if (!game) {
        await db.collection('games').insertOne({
            name: 'watertoss',
            type: 'A',
            maxRawScore: 1000,
            description: 'Ring Toss Game',
            createdAt: new Date(),
            __v: 0
        });
        console.log("Created watertoss game as type A");
    } else {
        await db.collection('games').updateOne({ _id: game._id }, { $set: { type: 'A', maxRawScore: 1000 } });
        console.log("Updated watertoss game to type A and set maxRawScore to 1000");
    }
    
    process.exit(0);
}).catch(console.error);
