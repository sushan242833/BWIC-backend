import { uploadPublicBasePath, toUploadPublicPath } from "@config/uploads";
import {
  PROPERTY_IMAGE_FIELD_NAME,
  PROPERTY_IMAGE_UPLOAD_LIMIT,
} from "@constants/property";
import { AppError } from "../middleware/error.middleware";

export { PROPERTY_IMAGE_FIELD_NAME, PROPERTY_IMAGE_UPLOAD_LIMIT };

const ensureLeadingSlash = (value: string) =>
  value.startsWith("/") ? value : `/${value}`;

export const normalizeImagePath = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return ensureLeadingSlash(url.pathname);
    } catch {
      return trimmed;
    }
  }

  if (trimmed.includes(`${uploadPublicBasePath}/`)) {
    return ensureLeadingSlash(
      trimmed.slice(trimmed.indexOf(`${uploadPublicBasePath}/`)),
    );
  }

  return ensureLeadingSlash(trimmed);
};

export const normalizeImagePaths = (values: string[] = []): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeImagePath(value))
        .filter((value) => value.length > 0),
    ),
  );

export const mapUploadedFilesToImagePaths = (
  files: Express.Multer.File[] = [],
): string[] =>
  normalizeImagePaths(files.map((file) => toUploadPublicPath(file.filename)));

export const parseExistingImagesInput = (value: unknown): string[] => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return normalizeImagePaths(
      value.filter((item): item is string => typeof item === "string"),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return normalizeImagePaths(
          parsed.filter((item): item is string => typeof item === "string"),
        );
      }
    } catch {
      return normalizeImagePaths([trimmed]);
    }

    return [];
  }

  return [];
};

export const assertValidPropertyImageCount = (images: string[]) => {
  if (images.length > PROPERTY_IMAGE_UPLOAD_LIMIT) {
    throw new AppError("Validation failed", 400, [
      {
        path: "images",
        message: `You can only upload up to ${PROPERTY_IMAGE_UPLOAD_LIMIT} images`,
      },
    ]);
  }
};

export const requirePropertyImages = (images: string[]) => {
  if (images.length === 0) {
    throw new AppError("Validation failed", 400, [
      {
        path: "images",
        message: "At least one image is required",
      },
    ]);
  }
};

export const resolveCreatePropertyImages = (
  files: Express.Multer.File[] = [],
): string[] => {
  const uploadedImages = mapUploadedFilesToImagePaths(files);
  assertValidPropertyImageCount(uploadedImages);
  requirePropertyImages(uploadedImages);
  return uploadedImages;
};

export const resolveUpdatePropertyImages = (options: {
  uploadedFiles?: Express.Multer.File[];
  existingImagesInput?: unknown;
  fallbackImages?: string[];
}): string[] => {
  const uploadedImages = mapUploadedFilesToImagePaths(options.uploadedFiles);
  const hasExplicitExistingImages = options.existingImagesInput !== undefined;
  const existingImages = hasExplicitExistingImages
    ? parseExistingImagesInput(options.existingImagesInput)
    : normalizeImagePaths(options.fallbackImages ?? []);
  const finalImages = normalizeImagePaths([...existingImages, ...uploadedImages]);

  assertValidPropertyImageCount(finalImages);
  requirePropertyImages(finalImages);

  return finalImages;
};
