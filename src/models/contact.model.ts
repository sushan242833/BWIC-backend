import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Optional } from "sequelize";

export interface ContactMessageAttributes {
  id: number;
  name: string;
  email: string;
  phone?: string;
  investmentRange: string;
  propertyType: string;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ContactMessageCreationAttributes = Optional<
  ContactMessageAttributes,
  "id" | "phone" | "message" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "contact_messages",
  timestamps: true,
})
export class ContactMessage extends Model<
  ContactMessageAttributes,
  ContactMessageCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  })
  id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  phone?: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  investmentRange!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  propertyType!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  message?: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
