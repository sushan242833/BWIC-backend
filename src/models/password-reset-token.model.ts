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
  Unique,
  UpdatedAt,
} from "sequelize-typescript";
import { Optional } from "sequelize";
import { User } from "@models/user.model";

export interface PasswordResetTokenAttributes {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PasswordResetTokenCreationAttributes = Optional<
  PasswordResetTokenAttributes,
  "id" | "usedAt" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "password_reset_tokens",
  timestamps: true,
})
export class PasswordResetToken extends Model<
  PasswordResetTokenAttributes,
  PasswordResetTokenCreationAttributes
> {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  id!: number;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  userId!: number;

  @BelongsTo(() => User)
  user!: User;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(128))
  tokenHash!: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  expiresAt!: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  usedAt?: Date | null;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
