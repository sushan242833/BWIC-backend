import sequelize from "config/config";
import express from "express";
import cors from "cors";
import path from "path";
import { contactRouter } from "@routes/contact.route";
import { categoriesRouter } from "@routes/category.route";
import { locationRouter } from "@routes/location.route";
import { propertiesRouter } from "@routes/properties.route";
import { recommendationRouter } from "@routes/recommendation.route";
import { statsRouter } from "@routes/stats.routes";
import env from "@config/env";

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin === "*" ? true : env.frontendOrigin,
  }),
);

app.use(express.json());

app.use("/api/properties", propertiesRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/locations", locationRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/stats", statsRouter);
app.use(express.static(path.join(__dirname, "public")));

sequelize
  .authenticate()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Server running at ${env.appBaseUrl}`);
    });
  })
  .catch((error: unknown) => {
    console.error("Failed to connect to the database", error);
    process.exit(1);
  });
