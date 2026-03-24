import { Sequelize } from "sequelize-typescript";
import { Property } from "@models/properties.model";
import { Category } from "@models/category.model";
import { ContactMessage } from "@models/contact.model";
import { User } from "@models/user.model";
import env from "./env";

const sequelize = new Sequelize({
  dialect: env.db.dialect,
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  logging: env.db.logging,
  models: [Property, Category, ContactMessage, User],
});

export default sequelize;
