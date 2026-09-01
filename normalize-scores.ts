import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI is missing");

mongoose.connect(uri).then(async () => {
    const db = mongoose.connection.db;
    if (!db) throw new Error("DB connection failed");
    
    // Set maxRawScores
    const surf = await db.collection('games').findOne({ name: 'surf' });
    if (surf) {
        await db.collection('games').updateOne({ _id: surf._id }, { $set: { maxRawScore: 5000 } });
        console.log("Updated surf maxRawScore to 5000");
    }
    
    const mario = await db.collection('games').findOne({ name: 'mario' });
    if (mario) {
        await db.collection('games').updateOne({ _id: mario._id }, { $set: { maxRawScore: 50 } });
        console.log("Updated mario maxRawScore to 50");
    }
    
    // Get updated games to know their maxRawScores
    const games = await db.collection('games').find({}).toArray();
    const gameMap: Record<string, any> = {};
    for (const game of games) {
        gameMap[game._id.toString()] = game;
    }
    
    // Recalculate game stats
    const stats = await db.collection('gamestats').find({}).toArray();
    for (const stat of stats) {
        const game = gameMap[stat.gameId.toString()];
        if (!game) continue;
        
        let newFinalScore = stat.finalScore;
        
        if (game.type === 'A') {
            const raw = stat.rawScore || 0;
            const max = game.maxRawScore || 1000;
            newFinalScore = Math.round((raw / max) * 1000);
        } else if (game.type === 'B') {
            const time = stat.timeTaken || 0;
            const max = game.maxRawScore || 100;
            newFinalScore = Math.max(0, Math.round((1 - (time / max)) * 1000));
        }
        
        if (newFinalScore !== stat.finalScore) {
            await db.collection('gamestats').updateOne({ _id: stat._id }, { $set: { finalScore: newFinalScore } });
            console.log(`Updated stat ${stat._id}: ${stat.finalScore} -> ${newFinalScore}`);
        }
    }
    
    console.log("Migration complete.");
    process.exit(0);
}).catch(console.error);
