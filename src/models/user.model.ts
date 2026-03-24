import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Default,
  IsEmail,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from "sequelize-typescript";
import { Optional } from "sequelize";

export const USER_ROLES = ["ADMIN", "USER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserAttributes {
  id: number;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  "id" | "role" | "isActive" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "users",
  timestamps: true,
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  fullName!: string;

  @AllowNull(false)
  @Unique
  @IsEmail
  @Column(DataType.STRING)
  email!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  passwordHash!: string;

  @AllowNull(false)
  @Default("USER")
  @Column(DataType.ENUM(...USER_ROLES))
  role!: UserRole;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive!: boolean;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
