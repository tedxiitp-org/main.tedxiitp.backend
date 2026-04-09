import express from "express";
import { mongoManager } from "./db/mongo.js";
import { env } from "./config/env.js";
import { exampleRoutes } from "./features/example/example.routes.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Server is healthy" });
});

app.use("/api/v1/example", exampleRoutes);

export async function startServer(){
    try{
        const mongoUri = env.MONGO_URI;
        const port = env.PORT;
        
        console.log("Starting server...");
        await mongoManager.connect(mongoUri);
        
        app.listen(port, ()=>{
            console.log(`Server is running on port ${port}`);
        });
    }
    catch(err: any){
        console.error("Failed to start server:");
        console.error(err);
        process.exit(1);
    }
};
