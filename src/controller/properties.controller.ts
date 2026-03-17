import { NextFunction, Request, Response } from "express";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";
import { geocodeLocation } from "@utils/geocoding";
import {
  CreatePropertyDto,
  PropertyListQueryDto,
  UpdatePropertyRequestDto,
  UpdatePropertyDto,
} from "@dto/property.dto";
import {
  buildPropertyWhere,
  normalizePropertyPagination,
  resolvePropertyOrder,
} from "@utils/property-filters";
import {
  resolveCreatePropertyImages,
  resolveUpdatePropertyImages,
} from "@utils/property-images";
import {
  serializePropertyDetail,
  serializePropertySummary,
} from "@utils/property-serializers";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "@utils/api-response";

export class PropertyController {
  private async findPropertyWithCategory(id: number | string) {
    return Property.findByPk(id, {
      attributes: { exclude: ["created_at", "updated_at"] },
      include: [
        {
          model: Category,
          attributes: ["id", "name"],
        },
      ],
    });
  }

  private async resolveCoordinates(
    location: string,
    fallback?: { latitude?: number | null; longitude?: number | null },
  ): Promise<{ latitude?: number; longitude?: number }> {
    const coordinates = await geocodeLocation(location);
    if (coordinates) {
      return {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
    }

    return {
      latitude: fallback?.latitude ?? undefined,
      longitude: fallback?.longitude ?? undefined,
    };
  }

  private parseNumericValue(raw: string | number): number {
    if (typeof raw === "number") return raw;
    const normalized = raw.replace(/,/g, "").trim();
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid numeric value: ${raw}`);
    }
    return parsed;
  }

  private buildNumericFields(request: CreatePropertyDto | UpdatePropertyDto) {
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

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = req.query as unknown as PropertyListQueryDto;
      const where = buildPropertyWhere(filters);
      const order = resolvePropertyOrder(filters.sort);
      const pagination = normalizePropertyPagination(filters);

      const { rows, count } = await Property.findAndCountAll({
        where,
        order,
        limit: pagination.limit,
        offset: pagination.offset,
        distinct: true,
        attributes: { exclude: ["created_at", "updated_at"] },
        include: [
          {
            model: Category,
            attributes: ["id", "name"],
          },
        ],
      });

      const totalPages = Math.max(1, Math.ceil(count / pagination.limit));

      return sendSuccess(res, {
        message: "Properties fetched successfully",
        data: rows.map((row) => serializePropertySummary(row)),
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: count,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const request = req.body as CreatePropertyDto;
      const imageFiles = req.files as Express.Multer.File[];
      const imagePaths = resolveCreatePropertyImages(imageFiles);
      const { priceNpr, roiPercent, areaSqft } =
        this.buildNumericFields(request);
      const distanceFromHighway = this.parseDistanceFromHighway(
        request.distanceFromHighway,
      );
      const { latitude, longitude } = await this.resolveCoordinates(
        request.location,
      );

      const newProperty = await Property.create({
        title: request.title,
        categoryId: Number(request.categoryId),
        location: request.location,
        latitude,
        longitude,
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
      const createdProperty = await this.findPropertyWithCategory(
        Number(newProperty.id),
      );

      if (!createdProperty) {
        throw new AppError("Property not found after creation", 500);
      }

      return sendSuccess(res, {
        statusCode: 201,
        message: "Property created successfully",
        data: serializePropertyDetail(createdProperty),
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;

      const property = await this.findPropertyWithCategory(id);

      if (!property) {
        return next(new AppError("Property not found", 404));
      }

      return sendSuccess(res, {
        message: "Property fetched successfully",
        data: serializePropertyDetail(property),
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const request = req.body as UpdatePropertyRequestDto;
      const imageFiles = req.files as Express.Multer.File[];

      const property = await Property.findByPk(id);
      if (!property) {
        return next(new AppError("Property not found", 404));
      }

      const finalImages = resolveUpdatePropertyImages({
        uploadedFiles: imageFiles,
        existingImagesInput: request.existingImages,
        fallbackImages: property.images,
      });
      const { priceNpr, roiPercent, areaSqft } =
        this.buildNumericFields(request);
      const distanceFromHighway = this.parseDistanceFromHighway(
        request.distanceFromHighway,
      );
      const locationChanged =
        request.location.trim().toLowerCase() !==
        property.location.trim().toLowerCase();

      const coordinates = locationChanged
        ? await this.resolveCoordinates(request.location, {
            latitude: property.latitude,
            longitude: property.longitude,
          })
        : {
            latitude: property.latitude ?? undefined,
            longitude: property.longitude ?? undefined,
          };

      await property.update({
        title: request.title,
        categoryId: Number(request.categoryId),
        location: request.location,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
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
      const updatedProperty = await this.findPropertyWithCategory(id);

      if (!updatedProperty) {
        throw new AppError("Property not found after update", 500);
      }

      return sendSuccess(res, {
        message: "Property updated successfully",
        data: serializePropertyDetail(updatedProperty),
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const property = await Property.findByPk(id);
      if (!property) {
        return next(new AppError("Property not found", 404));
      }

      await property.destroy();
      return sendSuccess(res, {
        message: "Property deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PropertyController();
