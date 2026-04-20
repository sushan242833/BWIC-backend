import {
  AllowNull,
  AutoIncrement,
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
import { Property } from "@models/properties.model";
import { User } from "@models/user.model";

export interface FavoriteAttributes {
  id: number;
  userId: number;
  propertyId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type FavoriteCreationAttributes = Optional<
  FavoriteAttributes,
  "id" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "favorites",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["userId", "propertyId"],
      name: "favorites_user_id_property_id_unique",
    },
  ],
})
export class Favorite extends Model<
  FavoriteAttributes,
  FavoriteCreationAttributes
> {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId!: number;

  @AllowNull(false)
  @ForeignKey(() => Property)
  @Column(DataType.INTEGER)
  propertyId!: number;

  @BelongsTo(() => User)
  user!: User;

  @BelongsTo(() => Property)
  property!: Property;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
