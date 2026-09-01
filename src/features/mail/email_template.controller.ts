import express from 'express';
import { EmailTemplateModel } from './email_template.model.js';
import { sendError, sendSuccess } from '../../scripts/controllerHelpers.js';

export async function uploadEmailTemplateHandler(
  req: express.Request,
  res: express.Response,
) {
  const body = req.body;

  if (!body?.name || !body?.subject || !body?.htmlBody) {
    return sendError(res, 400, 'Missing required template data');
  }

  try {
    const template = await EmailTemplateModel.create({
      name: body.name,
      subject: body.subject,
      htmlBody: body.htmlBody,
      isActive: body.isActive ?? false,
    });

    return sendSuccess(res, 201, 'Email template created successfully', template);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, 'Unknown Error');
  }
}

export async function updateEmailTemplateHandler(
  req: express.Request,
  res: express.Response,
) {
  const templateName = req.params.id;
  const body = req.body;

  if (!templateName) {
    return sendError(res, 400, 'No template name provided');
  }

  if (!body || Object.keys(body).length === 0) {
    return sendError(res, 400, 'No update data provided');
  }

  try {
    const template = await EmailTemplateModel.findOneAndUpdate(
      { name: templateName },
      body,
      { new: true, runValidators: true },
    );

    if (!template) {
      return sendError(res, 404, 'Email template not found');
    }

    return sendSuccess(res, 200, 'Email template updated successfully', template);
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, 'Unknown Error');
  }
}

export async function deleteEmailTemplateHandler(
  req: express.Request,
  res: express.Response,
) {
  const templateName = req.body?.name;

  if (!templateName) {
    return sendError(res, 400, 'No template name provided');
  }

  try {
    const result = await EmailTemplateModel.deleteOne({ name: templateName });

    if (result.deletedCount === 0) {
      return sendError(res, 404, 'Email template not found');
    }

    return sendSuccess(res, 200, 'Email template deleted successfully', {
      deletedCount: result.deletedCount,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      return sendError(res, 500, err.message);
    }
    return sendError(res, 500, 'Unknown Error');
  }
}
