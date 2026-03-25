import sequelize from "@config/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { appConfig } from "@config/app";
import {
  ensureUploadDirectory,
  uploadDirectory,
  uploadPublicBasePath,
} from "@config/uploads";
import { API_ROUTES } from "@constants/api-routes";
import { authRouter } from "@routes/auth.route";
import { contactRouter } from "@routes/contact.route";
import { categoriesRouter } from "@routes/category.route";
import { locationRouter } from "@routes/location.route";
import { propertiesRouter } from "@routes/properties.route";
import { recommendationRouter } from "@routes/recommendation.route";
import { statsRouter } from "@routes/stats.routes";
import env from "@config/env";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

const app = express();

app.disable("x-powered-by");
app.set(
  "trust proxy",
  env.isProduction ? appConfig.server.trustProxyHops : false,
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.cors.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);

ensureUploadDirectory();

app.use(cookieParser());
app.use(express.json());

app.use(API_ROUTES.auth, authRouter);
app.use(API_ROUTES.properties, propertiesRouter);
app.use(API_ROUTES.recommendations, recommendationRouter);
app.use(API_ROUTES.categories, categoriesRouter);
app.use(API_ROUTES.locations, locationRouter);
app.use(API_ROUTES.contacts, contactRouter);
app.use(API_ROUTES.stats, statsRouter);
app.use(uploadPublicBasePath, express.static(uploadDirectory));
app.use(notFoundHandler);
app.use(errorHandler);

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
