import { Worker } from "bullmq";
import { mongoManager } from "../../../db/mongo.js";
import { connection } from "./queue.js";
import { MailLogModel } from "../mail.model.js";
import { sendEmail } from "./sendMail.js";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error("MONGO_URI environment variable is missing.");
    process.exit(1);
}

// Connect to MongoDB
mongoManager.connect(mongoUri)
    .then(() => console.log("Worker connected to MongoDB successfully."))
    .catch((err) => {
        console.error("Worker failed to connect to MongoDB:", err);
        process.exit(1);
    });

const worker = new Worker(
    "mail_queue",
    async (job) => {
        // Send the Email Job
        await job.updateProgress("processing");
        const data = await sendEmail(job.data);

        if (data?.status === 200) {
            return data;
        }

        if (data?.status === 400) {
            throw new Error(data?.message || "Error in sending mail");
        }
    },
    { connection },
);

worker.on("completed", async (job, data) => {
    try {
        await MailLogModel.updateOne(
            { _id: job?.data?.logId },
            { status: "sent", sentAt: new Date(), providerMessageId: data.messageId },
        );
        console.log(`Job ${job.id} completed successfully.`);
    } catch (err: any) {
        console.error(`Failed to update mail log status for job ${job.id} (completed):`, err.message);
    }
});

worker.on("failed", async (job, err) => {
    try {
        const attempts = job?.opts?.attempts ?? 1;
        const attemptsMade = (job?.attemptsMade ?? 0) + 1;
        const message = err instanceof Error ? err.message : "Error in processing job";

        await MailLogModel.updateOne(
            { _id: job?.data?.logId },
            { status: "failed", errorMessage: message, retryCount: attemptsMade >= attempts ? attemptsMade : attemptsMade - 1 },
        );
        console.warn(`Job ${job?.id} failed:`, message);
    } catch (dbErr: any) {
        console.error(`Failed to update mail log status for job ${job?.id} (failed):`, dbErr.message);
    }
});

worker.on("error", async (err) => {
    console.error(`Worker encountered an error: ${err.message}`);
});

worker.on("progress", async (job, progress) => {
    try {
        await MailLogModel.updateOne(
            { _id: job.data.logId },
            { status: progress as any },
        );
    } catch (dbErr: any) {
        console.error(`Failed to update progress for job ${job.id}:`, dbErr.message);
    }
});

console.log("BullMQ Worker is running and listening for mail jobs...");
