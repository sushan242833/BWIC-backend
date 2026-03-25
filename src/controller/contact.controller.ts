import { NextFunction, Request, Response } from "express";
import { ContactMessage } from "../models/contact.model";
import env from "@config/env";
import { CONTACT_NOTIFICATION_EMPTY_VALUE } from "@constants/contact";
import { CreateContactMessageDto } from "@dto/contact.dto";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "@utils/api-response";
import { sendEmail } from "@utils/email";

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

      if (!env.mail.notifyEmail) {
        return next(new AppError("Notification email is not configured", 500));
      }

      const text = `
You have a new contact message:

Name: ${contactMessage.name}
Email: ${contactMessage.email}
Phone: ${contactMessage.phone ?? CONTACT_NOTIFICATION_EMPTY_VALUE}
Investment Range: ${contactMessage.investmentRange}
Property Type: ${contactMessage.propertyType}
Message: ${contactMessage.message ?? CONTACT_NOTIFICATION_EMPTY_VALUE}
      `.trim();

      await sendEmail({
        to: env.mail.notifyEmail,
        subject: `New Contact Message from ${contactMessage.name}`,
        text,
        html: `
          <div style="font-family: Arial, sans-serif; color: #131b2e; line-height: 1.6;">
            <h2 style="margin-bottom: 16px;">New contact message received</h2>
            <p><strong>Name:</strong> ${contactMessage.name}</p>
            <p><strong>Email:</strong> ${contactMessage.email}</p>
            <p><strong>Phone:</strong> ${contactMessage.phone ?? CONTACT_NOTIFICATION_EMPTY_VALUE}</p>
            <p><strong>Investment Range:</strong> ${contactMessage.investmentRange}</p>
            <p><strong>Property Type:</strong> ${contactMessage.propertyType}</p>
            <p><strong>Message:</strong><br/>${contactMessage.message ?? CONTACT_NOTIFICATION_EMPTY_VALUE}</p>
          </div>
        `,
      });

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
