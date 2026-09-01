import nodemailer from "nodemailer";
import transport from "./transport.js";
import type { SendEmailJob } from "../mail.model.js";
import { EmailTemplateModel } from "../email_template.model.js";

export async function sendEmail(job: SendEmailJob) {
    try {
        await transport.verify();
        console.log("SMTP verified");
        
        const data = await emailJob(job);
        if (!data) {
            throw new Error("No email data generated");
        }
        const info = await transport.sendMail(data as any) as any;

        if (info.rejected?.length) {
            throw new Error(info.rejected.join(", ") || "Email rejected by SMTP server");
        }
        return {
            status: 200,
            message: "Message Sent Successfully!",
            messageId: info.messageId,
        };
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error("Error in Sending Mail:", err.message);
            return {
                status: 400,
                message: err.message,
            };
        }
        return {
            status: 500,
            message: "Unknown error sending email",
        };
    }
}

async function emailJob(job: SendEmailJob) {
    try {
        const attachments = job.attachments?.map((value) => {
            return {
                filename: value.filename,
                href: value.url,
                contentType: value.mimeType,
            };
        });
    
        const template = await EmailTemplateModel.findOne({ name: job.templateName });

        if (!template) {
            throw new Error(`Email template not found: ${job.templateName}`);
        }
    
        let htmlBody = template.htmlBody;
        if (job.variables) {
            for (const [key, value] of Object.entries(job.variables)) {
                htmlBody = htmlBody.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            }
        }

        const data = {
            from: process.env.MAIL_FROM,
            to: job.recipientEmail,
            subject: job.subject,
            html: htmlBody,
            attachments,
        };
        return data;
    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error("Error in fetching data for mail:", err.message);
            throw err;
        }
        throw new Error("Unknown error preparing email data");
    }
}
