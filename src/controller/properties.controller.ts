import { Request, Response } from "express";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";

interface IPropertyRequest {
  title: string;
  categoryId: number | string;
  location: string;
  price: string;
  roi: string;
  status: string;
  area: string;
  areaNepali?: string;
  distanceFromHighway?: number | string;
  images?: string[];
  description: string;
}

export class PropertyController {
  private parseNumericValue(raw: string | number): number {
    if (typeof raw === "number") return raw;
    const normalized = raw.replace(/,/g, "").trim();
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid numeric value: ${raw}`);
    }
    return parsed;
  }

  private buildNumericFields(request: IPropertyRequest) {
    const priceNpr = Math.round(this.parseNumericValue(request.price));
    const roiPercent = this.parseNumericValue(request.roi);
    const areaSqft = this.parseNumericValue(request.area);

    if (priceNpr < 0 || roiPercent < 0 || areaSqft < 0) {
      throw new Error("Numeric fields must be non-negative");
    }

    return { priceNpr, roiPercent, areaSqft };
  }

  async getAll(req: Request, res: Response) {
    try {
      const properties = await Property.findAll({
        attributes: { exclude: ["created_at", "updated_at"] },
        include: [
          {
            model: Category,
            attributes: ["name"],
          },
        ],
      });
      res.status(200).json(properties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch properties", error });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const request = req.body as IPropertyRequest;
      const imageFiles = req.files as Express.Multer.File[];

      if (!imageFiles || imageFiles.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one image is required" });
      }

      const imagePaths = imageFiles.map((file) => `/uploads/${file.filename}`);
      const { priceNpr, roiPercent, areaSqft } =
        this.buildNumericFields(request);

      const newProperty = await Property.create({
        title: request.title,
        categoryId: Number(request.categoryId),
        location: request.location,
        price: request.price,
        priceNpr,
        roi: request.roi,
        roiPercent,
        status: request.status,
        area: request.area,
        areaSqft,
        areaNepali: request.areaNepali,
        distanceFromHighway:
          request.distanceFromHighway !== undefined
            ? Number(request.distanceFromHighway)
            : undefined,
        images: imagePaths,
        description: request.description,
      });

      res.status(201).json(newProperty);
    } catch (error) {
      res.status(400).json({ message: "Failed to create property", error });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const id = req.params.id;

      const property = await Property.findByPk(id, {
        attributes: { exclude: ["created_at", "updated_at"] },
        include: [
          {
            model: Category,
            attributes: ["name"], // only include category name
          },
        ],
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.status(200).json(property);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch property", error });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const request = req.body as IPropertyRequest;
      const imageFiles = req.files as Express.Multer.File[];

      const property = await Property.findByPk(id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const newImages = imageFiles?.map((file) => `/uploads/${file.filename}`);
      const finalImages = newImages?.length ? newImages : property.images;
      const { priceNpr, roiPercent, areaSqft } =
        this.buildNumericFields(request);

      await property.update({
        title: request.title,
        categoryId: Number(request.categoryId),
        location: request.location,
        price: request.price,
        priceNpr,
        roi: request.roi,
        roiPercent,
        status: request.status,
        area: request.area,
        areaSqft,
        areaNepali: request.areaNepali,
        distanceFromHighway:
          request.distanceFromHighway !== undefined
            ? Number(request.distanceFromHighway)
            : undefined,
        images: finalImages,
        description: request.description,
      });

      res.status(200).json(property);
    } catch (error) {
      res.status(400).json({ message: "Failed to update property", error });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const property = await Property.findByPk(id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      await property.destroy();
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Failed to delete property", error });
    }
  }
}

export default new PropertyController();
