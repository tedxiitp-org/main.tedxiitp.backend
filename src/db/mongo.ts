import { MongoClient } from "mongodb";
import mongoose from "mongoose";
class MongoManager {
    constructor(private mongoClient: MongoClient | null){ };
    
    async connect(mongoUri: string){
        if(!mongoUri){
            throw new Error("Mongo URI is not defined");
        }
        this.mongoClient = new MongoClient(mongoUri);
        await this.mongoClient.connect();
        await mongoose.connect(mongoUri);
        console.log("Connected to MongoDB & Mongoose");
    };

    async disconnect(){
        if(this.mongoClient){
            await mongoose.disconnect();
            await this.mongoClient.close();
            console.log("Disconnected from MongoDB & Mongoose");
        }
    };

    async giveConnection(){
        if(!this.mongoClient){
            throw new Error("Mongo client is not initialized");
        }
        return this.mongoClient;
    };

    async giveDatabase(dbName: string){
        if(!this.mongoClient){
            throw new Error("Mongo client is not initialized");
        }
        return this.mongoClient.db(dbName);
    };

    async giveCollection(dbName: string, collectionName: string){
        if(!this.mongoClient){
            throw new Error("Mongo client is not initialized");
        }
        return this.mongoClient.db(dbName).collection(collectionName);
    };
}

export const mongoManager = new MongoManager(null);
