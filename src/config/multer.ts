import multer, { FileFilterCallback } from "multer";
import crypto from "crypto";
import path from "path";
import { Request } from "express";
import {
  ensureUploadDirectory,
  uploadDirectory,
  uploadsConfig,
} from "@config/uploads";
import {
  PROPERTY_IMAGE_MIME_TYPES,
  PROPERTY_IMAGE_UPLOAD_LIMIT,
} from "@constants/property";

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    ensureUploadDirectory();
    callback(null, uploadDirectory);
  },
  filename: function (req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
) => {
  if (
    PROPERTY_IMAGE_MIME_TYPES.includes(
      file.mimetype as (typeof PROPERTY_IMAGE_MIME_TYPES)[number],
    )
  ) {
    callback(null, true);
  } else {
    callback(new Error("file format not supported"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: uploadsConfig.maxFileSizeBytes,
    files: PROPERTY_IMAGE_UPLOAD_LIMIT,
  },
});
