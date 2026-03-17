import { NextFunction, Request, Response } from "express";
import { ContactMessage } from "../models/contact.model";
import nodemailer from "nodemailer";
import { CreateContactMessageDto } from "@dto/contact.dto";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "@utils/api-response";

export class ContactController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const contacts = await ContactMessage.findAll();
      return sendSuccess(res, {
        message: "Contact messages fetched successfully",
        data: contacts,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const contact = await ContactMessage.findByPk(id);

      if (!contact) {
        return next(new AppError("Contact message not found", 404));
      }

      return sendSuccess(res, {
        message: "Contact message fetched successfully",
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  }
  // Create / Submit contact message
  async submitContactMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.body as CreateContactMessageDto;

      // Save contact message to DB
      const contactMessage = new ContactMessage();
      contactMessage.name = request.name;
      contactMessage.email = request.email;
      contactMessage.phone = request.phone;
      contactMessage.investmentRange = request.investmentRange;
      contactMessage.propertyType = request.propertyType;
      contactMessage.message = request.message;

      await contactMessage.save();

      // Create nodemailer transporter using SMTP config from .env
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Prepare email content
      const mailOptions = {
        from: `"BWIC" <${process.env.FROM_EMAIL}>`,
        to: process.env.NOTIFY_EMAIL,
        subject: `New Contact Message from ${contactMessage.name}`,
        text: `
      You have a new contact message:

      Name: ${contactMessage.name}
      Email: ${contactMessage.email}
      Phone: ${contactMessage.phone ?? "N/A"}
      Investment Range: ${contactMessage.investmentRange}
      Property Type: ${contactMessage.propertyType}
      Message: ${contactMessage.message ?? "N/A"}
              `,
      };

      // Send notification email
      await transporter.sendMail(mailOptions);

      return sendSuccess(res, {
        statusCode: 201,
        message: "Contact message received and notification email sent",
        data: contactMessage,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ContactController();
