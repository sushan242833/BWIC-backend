import { Request, Response } from "express";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";
import { Op, Order, WhereOptions } from "sequelize";

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

  private parseDistanceFromHighway(
    raw: number | string | undefined,
  ): number | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "string" && raw.trim() === "") return undefined;

    const parsed = this.parseNumericValue(raw);
    if (parsed < 0) {
      throw new Error("Distance from highway cannot be negative");
    }

    return parsed;
  }

  private extractQueryString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === "string" ? first : undefined;
    }
    return undefined;
  }

  private parseQueryNumber(value: unknown): number | undefined {
    const raw = this.extractQueryString(value);
    if (!raw) return undefined;
    const parsed = Number.parseFloat(raw.replace(/,/g, "").trim());
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  async getAll(req: Request, res: Response) {
    try {
      const {
        location,
        categoryId,
        minPrice,
        maxPrice,
        minRoi,
        minArea,
        maxDistanceFromHighway,
        status,
        sort,
        page,
        limit,
      } = req.query;

      const where: WhereOptions = {};

      const locationValue = this.extractQueryString(location);
      if (locationValue) {
        where.location = { [Op.iLike]: `%${locationValue.trim()}%` };
      }

      const categoryIdValue = this.parseQueryNumber(categoryId);
      if (categoryIdValue !== undefined) {
        where.categoryId = categoryIdValue;
      }

      const minPriceValue = this.parseQueryNumber(minPrice);
      if (minPriceValue !== undefined) {
        where.priceNpr = {
          ...(where.priceNpr as object),
          [Op.gte]: minPriceValue,
        };
      }

      const maxPriceValue = this.parseQueryNumber(maxPrice);
      if (maxPriceValue !== undefined) {
        where.priceNpr = {
          ...(where.priceNpr as object),
          [Op.lte]: maxPriceValue,
        };
      }

      const minRoiValue = this.parseQueryNumber(minRoi);
      if (minRoiValue !== undefined) {
        where.roiPercent = {
          ...(where.roiPercent as object),
          [Op.gte]: minRoiValue,
        };
      }

      const minAreaValue = this.parseQueryNumber(minArea);
      if (minAreaValue !== undefined) {
        where.areaSqft = {
          ...(where.areaSqft as object),
          [Op.gte]: minAreaValue,
        };
      }

      const maxDistanceValue = this.parseQueryNumber(maxDistanceFromHighway);
      if (maxDistanceValue !== undefined) {
        where.distanceFromHighway = {
          ...(where.distanceFromHighway as object),
          [Op.lte]: maxDistanceValue,
        };
      }

      const statusValue = this.extractQueryString(status);
      if (statusValue) {
        where.status = { [Op.iLike]: statusValue.trim() };
      }

      const sortValue = this.extractQueryString(sort);
      const orderMap: Record<string, Order> = {
        price_asc: [["priceNpr", "ASC"]],
        price_desc: [["priceNpr", "DESC"]],
        roi_desc: [["roiPercent", "DESC"]],
        newest: [["createdAt", "DESC"]],
      };
      const order = orderMap[sortValue || "newest"] || orderMap.newest;

      const pageValue = Math.max(
        1,
        Math.trunc(this.parseQueryNumber(page) || 1),
      );
      const limitValue = Math.min(
        50,
        Math.max(1, Math.trunc(this.parseQueryNumber(limit) || 9)),
      );
      const offsetValue = (pageValue - 1) * limitValue;

      const { rows, count } = await Property.findAndCountAll({
        where,
        order,
        limit: limitValue,
        offset: offsetValue,
        distinct: true,
        attributes: { exclude: ["created_at", "updated_at"] },
        include: [
          {
            model: Category,
            attributes: ["id", "name"],
          },
        ],
      });

      const totalPages = Math.max(1, Math.ceil(count / limitValue));

      res.status(200).json({
        data: rows,
        pagination: {
          page: pageValue,
          limit: limitValue,
          total: count,
          totalPages,
          hasNext: pageValue < totalPages,
          hasPrev: pageValue > 1,
        },
      });
    } catch (error) {
      console.error("Failed to fetch properties:", error);
      res.status(500).json({
        message: "Failed to fetch properties",
        error: error instanceof Error ? error.message : String(error),
      });
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
      const distanceFromHighway = this.parseDistanceFromHighway(
        request.distanceFromHighway,
      );

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
        distanceFromHighway,
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
      const distanceFromHighway = this.parseDistanceFromHighway(
        request.distanceFromHighway,
      );

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
        distanceFromHighway,
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
