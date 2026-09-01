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
    
    // Find mario game
    const mario = await db.collection('games').findOne({ name: 'mario' });
    console.log("Found mario:", mario);
    
    if (mario) {
        // Fix the type to A
        await db.collection('games').updateOne({ _id: mario._id }, { $set: { type: 'A' } });
        console.log("Updated mario to type A");
        
        // Fix stats
        const stats = await db.collection('gamestats').find({ gameId: mario._id }).toArray();
        for (const stat of stats) {
            if (stat.finalScore > 9000) {
                const actualScore = (10000 - stat.finalScore) / 10;
                await db.collection('gamestats').updateOne(
                    { _id: stat._id },
                    { $set: { finalScore: actualScore, rawScore: actualScore } }
                );
                console.log(`Fixed stat ${stat._id}: ${stat.finalScore} -> ${actualScore}`);
            }
        }
    }
    
    process.exit(0);
}).catch(console.error);
