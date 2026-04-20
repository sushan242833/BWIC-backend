import { UniqueConstraintError } from "sequelize";
import type {
  FavoriteListDto,
  FavoriteStatusDto,
} from "@dto/favorite.dto";
import { Category } from "@models/category.model";
import { Favorite } from "@models/favorite.model";
import { Property } from "@models/properties.model";
import { serializePropertySummary } from "@utils/property-serializers";
import { AppError } from "../middleware/error.middleware";

export class FavoriteService {
  private async ensurePropertyExists(propertyId: number): Promise<void> {
    const property = await Property.findByPk(propertyId, {
      attributes: ["id"],
    });

    if (!property) {
      throw new AppError("Property not found", 404);
    }
  }

  async addFavorite(
    userId: number,
    propertyId: number,
  ): Promise<FavoriteStatusDto> {
    await this.ensurePropertyExists(propertyId);

    try {
      await Favorite.findOrCreate({
        where: { userId, propertyId },
        defaults: { userId, propertyId },
      });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
    }

    return {
      propertyId,
      isFavorited: true,
    };
  }

  async removeFavorite(
    userId: number,
    propertyId: number,
  ): Promise<FavoriteStatusDto> {
    await this.ensurePropertyExists(propertyId);

    await Favorite.destroy({
      where: { userId, propertyId },
    });

    return {
      propertyId,
      isFavorited: false,
    };
  }

  async checkFavorite(
    userId: number,
    propertyId: number,
  ): Promise<FavoriteStatusDto> {
    await this.ensurePropertyExists(propertyId);

    const favorite = await Favorite.findOne({
      attributes: ["id"],
      where: { userId, propertyId },
    });

    return {
      propertyId,
      isFavorited: Boolean(favorite),
    };
  }

  async listFavorites(userId: number): Promise<FavoriteListDto> {
    const favorites = await Favorite.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Property,
          required: true,
          include: [
            {
              model: Category,
              attributes: ["id", "name"],
            },
          ],
        },
      ],
    });

    return {
      items: favorites.map((favorite) => ({
        id: favorite.id,
        property: serializePropertySummary(favorite.property),
        createdAt: favorite.createdAt,
      })),
    };
  }
}

export default new FavoriteService();
