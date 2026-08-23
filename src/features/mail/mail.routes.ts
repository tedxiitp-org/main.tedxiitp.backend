import express from 'express';
import { sendEmailHandler } from './mail.controller.js';
import {
  deleteEmailTemplateHandler,
  updateEmailTemplateHandler,
  uploadEmailTemplateHandler,
} from './email_template.controller.js';

const router = express.Router();

router.post("/", sendEmailHandler);
router.post("/template", uploadEmailTemplateHandler);
router.delete("/template", deleteEmailTemplateHandler);
router.post("/template/:id", updateEmailTemplateHandler);

export default router;
