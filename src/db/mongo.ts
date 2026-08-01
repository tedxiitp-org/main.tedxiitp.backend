import { MongoClient } from "mongodb";

class MongoManager {
    constructor(private mongoClient: MongoClient | null){ };
    
    async connect(mongoUri: string){
        if(!mongoUri){
            throw new Error("Mongo URI is not defined");
        }
        this.mongoClient = new MongoClient(mongoUri);
        await this.mongoClient.connect();
        console.log("Connected to MongoDB");
    };

    async disconnect(){
        if(this.mongoClient){
            await this.mongoClient.close();
            console.log("Disconnected from MongoDB");
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
