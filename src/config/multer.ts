import multer from "multer";
import path from "path";
import * as fs from "fs";
import { Request } from "express";
import env from "./env";
import { PROPERTY_IMAGE_UPLOAD_LIMIT } from "@utils/property-images";

const uploadDirectory = path.isAbsolute(env.uploads.dir)
  ? env.uploads.dir
  : path.resolve(process.cwd(), env.uploads.dir);

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    if (!fs.existsSync(uploadDirectory)) {
      fs.mkdirSync(uploadDirectory, { recursive: true });
    }
    callback(null, uploadDirectory);
  },
  filename: function (req, file, callback) {
    const filename = new Date().getTime();
    const extension = file.originalname.split(".");
    callback(null, `${filename}.${extension[extension.length - 1]}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, callback: any) => {
  const validMimeType = ["image/jpg", "image/png", "image/jpeg"];
  if (validMimeType.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error("file format not supported"));
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: env.uploads.maxFileSizeBytes,
    files: PROPERTY_IMAGE_UPLOAD_LIMIT,
  },
});
