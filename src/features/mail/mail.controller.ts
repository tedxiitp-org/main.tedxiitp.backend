import express from 'express';
import { sendError, sendSuccess } from '../../scripts/controllerHelpers.js';
import type { SendEmailJob } from './mail.model.js';
import { MailLogModel } from './mail.model.js';
import { myQueue } from './services/queue.js';

export async function sendEmailHandler(req: express.Request, res: express.Response) {
    try {
        const job = req.body as SendEmailJob;

        const logData: Record<string, any> = {
            recipientEmail: job.recipientEmail,
            subject: job.subject,
            templateName: job.templateName,
            status: "queued",
        };
        
        if (job.metadata !== undefined) {
            logData.metadata = job.metadata;
        }
        
        const mailLog = await MailLogModel.create(logData);

        const emailJob = await myQueue.add('SEND_EMAIL', { ...job, logId: mailLog._id }, {
            attempts: 5,
            backoff: {
                type: "exponential",
                delay: 5000,
            }
        });

        return sendSuccess(res, 200, 'Email job enqueued successfully', { jobId: emailJob.id });
    } catch (err: unknown) {
        console.error(err);
        return sendError(res, 500, 'Internal Server Error');
    }
}
