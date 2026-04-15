import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import { Optional } from "sequelize";
import { User } from "@models/user.model";

export interface UserRecommendationSettingsAttributes {
  userId: number;
  locationWeight: number;
  priceWeight: number;
  areaWeight: number;
  roiWeight: number;
  highwayAccessWeight: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRecommendationSettingsCreationAttributes = Optional<
  UserRecommendationSettingsAttributes,
  "createdAt" | "updatedAt"
>;

@Table({
  tableName: "user_recommendation_settings",
  timestamps: true,
})
export class UserRecommendationSettings extends Model<
  UserRecommendationSettingsAttributes,
  UserRecommendationSettingsCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId!: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  locationWeight!: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  priceWeight!: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  areaWeight!: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  roiWeight!: number;

  @AllowNull(false)
  @Column(DataType.DOUBLE)
  highwayAccessWeight!: number;

  @BelongsTo(() => User)
  user!: User;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
