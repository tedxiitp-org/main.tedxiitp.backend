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
import communityWallRoutes from "./features/community-wall/communityWall.routes.js";
import { usersRoutes } from "./features/users/users.routes.js";
import { gamesRoutes } from "./features/games/games.routes.js";
import { leaderboardRoutes } from "./features/leaderboard/leaderboard.routes.js";

const app = express();

// Middleware
const allowedOrigins = [
    "https://tedxiitpatna.iitp.ac.in",
    "http://localhost:3000",
    "http://localhost:3001"
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || env.NODE_ENV === "development") {
            return callback(null, true);
        }
        return callback(new Error("CORS policy violation: Access denied for this origin."));
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", message: "Server is healthy" });
});

// Middleware to ensure DB is connected on serverless requests (must be registered BEFORE routes)
app.use(async (req, res, next) => {
    try {
        if (env.MONGO_URI) {
            await mongoManager.connect(env.MONGO_URI);
        }
        next();
    } catch (err) {
        next(err);
    }
});

// Routes
app.use("/api/v1/example", exampleRoutes);
app.use("/api/memories", memoryRoutes);
app.use("/api/community-wall", communityWallRoutes);
app.use("/api/v1/community-wall", communityWallRoutes);
app.use("/api/wall", communityWallRoutes);
app.use("/api/v1/wall", communityWallRoutes);
app.use("/api/admin/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/games", gamesRoutes);
app.use("/api/v1/leaderboard", leaderboardRoutes);

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

export default app;
