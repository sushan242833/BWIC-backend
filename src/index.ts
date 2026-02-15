import sequelize from "config/config";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { contactRouter } from "@routes/contact.route";
import { categoriesRouter } from "@routes/category.route";
import { locationRouter } from "@routes/location.route";
import { propertiesRouter } from "@routes/properties.route";
import { recommendationRouter } from "@routes/recommendation.route";
import { statsRouter } from "@routes/stats.routes";

const app = express();

dotenv.config();

app.use(cors());

app.use(express.json());

app.use("/api/properties", propertiesRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/locations", locationRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/stats", statsRouter);
app.use(express.static(path.join(__dirname, "public")));

sequelize.sync({ alter: true }).then(() => {
  app.listen(3000, () => {
    console.log("htttp://localhost:3000");
  });
});
