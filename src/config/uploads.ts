import fs from "fs";
import path from "path";
import env from "@config/env";

const DEFAULT_UPLOAD_DIRECTORY = path.join("storage", "uploads");
const DEFAULT_UPLOAD_PUBLIC_BASE_PATH = "/uploads";
const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const normalizePublicBasePath = (value: string): string => {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : DEFAULT_UPLOAD_PUBLIC_BASE_PATH;
};

const uploadDirectoryInput = env.uploads.directory || DEFAULT_UPLOAD_DIRECTORY;

export const uploadsConfig = {
  storageDriver: "disk" as const,
  publicBasePath: normalizePublicBasePath(DEFAULT_UPLOAD_PUBLIC_BASE_PATH),
  maxFileSizeBytes: DEFAULT_MAX_UPLOAD_SIZE_BYTES,
};

export const uploadDirectory = path.isAbsolute(uploadDirectoryInput)
  ? uploadDirectoryInput
  : path.resolve(process.cwd(), uploadDirectoryInput);

export const uploadPublicBasePath = uploadsConfig.publicBasePath;

export const ensureUploadDirectory = (): void => {
  fs.mkdirSync(uploadDirectory, { recursive: true });
};

export const toUploadPublicPath = (fileName: string): string =>
  `${uploadPublicBasePath}/${fileName}`.replace(/\/{2,}/g, "/");
