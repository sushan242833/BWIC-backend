import {
  Table,
  Column,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  HasMany,
} from "sequelize-typescript";
import { Optional } from "sequelize";
import { Property } from "@models/properties.model";

export interface CategoryAttributes {
  id: number;
  name: string;
}

export type CategoryCreationAttributes = Optional<CategoryAttributes, "id">;

@Table({ tableName: "categories", timestamps: false })
export class Category extends Model<
  CategoryAttributes,
  CategoryCreationAttributes
> {
  static findAll(arg0: { attributes: string[]; order: string[][] }) {
    throw new Error("Method not implemented.");
  }
  @PrimaryKey
  @AutoIncrement
  @Column
  id!: number;

  @AllowNull(false)
  @Unique
  @Column
  name!: string;

  @HasMany(() => Property)
  properties!: Property[];
}
