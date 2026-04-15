import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Default,
  HasMany,
  HasOne,
  IsEmail,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from "sequelize-typescript";
import { Optional } from "sequelize";
import { PasswordResetToken } from "@models/password-reset-token.model";
import { UserRecommendationSettings } from "@models/user-recommendation-settings.model";

export const USER_ROLES = ["ADMIN", "USER"] as const;
export const USER_ROLE = {
  ADMIN: USER_ROLES[0],
  USER: USER_ROLES[1],
} as const;

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
  @Default(USER_ROLE.USER)
  @Column(DataType.ENUM(...USER_ROLES))
  role!: UserRole;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive!: boolean;

  @HasMany(() => PasswordResetToken)
  passwordResetTokens!: PasswordResetToken[];

  @HasOne(() => UserRecommendationSettings)
  recommendationSettings?: UserRecommendationSettings;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
