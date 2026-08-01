import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { mongoManager } from "./db/mongo.js";
import { env } from "./config/env.js";
import { exampleRoutes } from "./features/example/example.routes.js";
import { sessionMiddleware } from "./config/session.js";
import passport from "./config/passport.js";
import authRoutes from "./features/auth/auth.routes.js";
import memoryRoutes from "./features/memories/memory.routes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Server is healthy" });
});

// Routes
app.use("/api/v1/example", exampleRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/admin/auth", authRoutes);

export async function startServer() {
    try {
        const mongoUri = env.MONGO_URI;
        const port = env.PORT;
        
        console.log("Starting server...");
        await mongoManager.connect(mongoUri);
        
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    }
    catch (err: any) {
        console.error("Failed to start server:");
        console.error(err);
        process.exit(1);
    }
}
