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
import { resolveCategoryCandidate } from "@utils/nlp/category-parser";
import { parsePropertySearchQuery } from "@utils/nlp/property-search-parser";
import {
  resolveCreatePropertyImages,
  resolveUpdatePropertyImages,
} from "@utils/property-images";
import { normalizePropertyStatus } from "@constants/property";
import {
  serializePropertyDetail,
  serializePropertySummary,
} from "@utils/property-serializers";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "@utils/api-response";

export class PropertyController {
  private async assertCategoryExists(categoryId: number): Promise<void> {
    const category = await Category.findByPk(categoryId, {
      attributes: ["id"],
    });

    if (!category) {
      throw new AppError("Validation failed", 400, [
        {
          path: "categoryId",
          message: "Selected category does not exist",
        },
      ]);
    }
  }

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

  private parseDistanceFromHighway(
    raw: number | string | undefined,
  ): number | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "string" && raw.trim() === "") return undefined;

    const parsed =
      typeof raw === "number"
        ? raw
        : Number.parseFloat(raw.replace(/,/g, "").trim());

    if (!Number.isFinite(parsed)) {
      throw new AppError("Validation failed", 400, [
        {
          path: "distanceFromHighway",
          message: "distanceFromHighway must be a number",
        },
      ]);
    }

    if (parsed < 0) {
      throw new AppError("Validation failed", 400, [
        {
          path: "distanceFromHighway",
          message: "distanceFromHighway cannot be negative",
        },
      ]);
    }

    return parsed;
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = req.query as unknown as PropertyListQueryDto;
      const parsedSearch = parsePropertySearchQuery(filters.search);

      let inferredCategoryId = filters.categoryId;
      if (inferredCategoryId === undefined && parsedSearch.category) {
        const categories = await Category.findAll({
          attributes: ["id", "name"],
        });
        inferredCategoryId =
          resolveCategoryCandidate(
            parsedSearch.category,
            categories.map((category) => ({
              id: category.id,
              name: category.name,
            })),
          )?.id ?? undefined;
      }

      const resolvedFilters: PropertyListQueryDto = {
        ...filters,
        search: parsedSearch.textSearch,
        location: filters.location || parsedSearch.location,
        categoryId: inferredCategoryId,
        maxPrice: filters.maxPrice ?? parsedSearch.maxPrice,
        minRoi: filters.minRoi ?? parsedSearch.minRoi,
        minArea: filters.minArea ?? parsedSearch.minArea,
        maxDistanceFromHighway:
          filters.maxDistanceFromHighway ?? parsedSearch.maxDistanceFromHighway,
        status: filters.status ?? parsedSearch.status,
      };

      const where = buildPropertyWhere(resolvedFilters);
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
      await this.assertCategoryExists(Number(request.categoryId));
      const imagePaths = resolveCreatePropertyImages(imageFiles);
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
        price: Number(request.price),
        roi: Number(request.roi),
        status: normalizePropertyStatus(request.status) ?? request.status,
        area: Number(request.area),
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

      await this.assertCategoryExists(Number(request.categoryId));
      const finalImages = resolveUpdatePropertyImages({
        uploadedFiles: imageFiles,
        existingImagesInput: request.existingImages,
        fallbackImages: property.images,
      });
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
        price: Number(request.price),
        roi: Number(request.roi),
        status: normalizePropertyStatus(request.status) ?? request.status,
        area: Number(request.area),
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
