import {
  AllowNull,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import { Optional } from "sequelize";

export interface AuthRateLimitAttributes {
  key: string;
  count: number;
  resetAt: Date;
}

export type AuthRateLimitCreationAttributes = Optional<
  AuthRateLimitAttributes,
  "count" | "resetAt"
>;

@Table({
  tableName: "auth_rate_limits",
  timestamps: false,
})
export class AuthRateLimit extends Model<
  AuthRateLimitAttributes,
  AuthRateLimitCreationAttributes
> {
  @PrimaryKey
  @Column(DataType.STRING(191))
  key!: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  count!: number;

  @AllowNull(false)
  @Column(DataType.DATE)
  resetAt!: Date;
}
