import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { Request, Response } from "express";
import { Category } from "@models/category.model";
import { Favorite } from "@models/favorite.model";
import { Property } from "@models/properties.model";
import { FavoriteService } from "@services/favorite.service";
import { requireAuth } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";

const restorers: Array<() => void> = [];

const patchStaticMethod = (
  target: object,
  methodName: string,
  replacement: unknown,
) => {
  const mutableTarget = target as Record<string, unknown>;
  const original = mutableTarget[methodName];
  mutableTarget[methodName] = replacement;
  restorers.push(() => {
    mutableTarget[methodName] = original;
  });
};

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
});

const stubPropertyExists = (expectedPropertyId: number) => {
  patchStaticMethod(Property, "findByPk", async (propertyId: number) => {
    assert.equal(propertyId, expectedPropertyId);
    return { id: expectedPropertyId };
  });
};

test("authenticated user can add favorite", async () => {
  const service = new FavoriteService();
  let findOrCreateOptions: unknown;

  stubPropertyExists(123);
  patchStaticMethod(Favorite, "findOrCreate", async (options: unknown) => {
    findOrCreateOptions = options;
    return [{ id: 1 }, true];
  });

  const result = await service.addFavorite(7, 123);

  assert.deepEqual(result, {
    propertyId: 123,
    isFavorited: true,
  });
  assert.deepEqual(
    (findOrCreateOptions as { where: Record<string, number> }).where,
    {
      userId: 7,
      propertyId: 123,
    },
  );
});

test("authenticated user can remove favorite", async () => {
  const service = new FavoriteService();
  let destroyOptions: unknown;

  stubPropertyExists(123);
  patchStaticMethod(Favorite, "destroy", async (options: unknown) => {
    destroyOptions = options;
    return 1;
  });

  const result = await service.removeFavorite(7, 123);

  assert.deepEqual(result, {
    propertyId: 123,
    isFavorited: false,
  });
  assert.deepEqual((destroyOptions as { where: Record<string, number> }).where, {
    userId: 7,
    propertyId: 123,
  });
});

test("duplicate favorite is prevented by idempotent find-or-create", async () => {
  const service = new FavoriteService();
  let findOrCreateCount = 0;

  stubPropertyExists(123);
  patchStaticMethod(Favorite, "findOrCreate", async (options: unknown) => {
    findOrCreateCount += 1;
    assert.deepEqual((options as { where: Record<string, number> }).where, {
      userId: 7,
      propertyId: 123,
    });
    return [{ id: 99 }, false];
  });

  const result = await service.addFavorite(7, 123);

  assert.equal(findOrCreateCount, 1);
  assert.deepEqual(result, {
    propertyId: 123,
    isFavorited: true,
  });
});

test("favorites list returns only current user's favorites", async () => {
  const service = new FavoriteService();
  const createdAt = new Date("2026-04-18T00:00:00.000Z");
  let findAllOptions: unknown;

  patchStaticMethod(Favorite, "findAll", async (options: unknown) => {
    findAllOptions = options;
    return [
      {
        id: 55,
        createdAt,
        property: {
          id: 123,
          title: "Bafal Residency",
          categoryId: 2,
          category: { id: 2, name: "Home" } as unknown as Category,
          location: "Bafal, Kathmandu",
          price: 12000000,
          roi: 12,
          status: "Available",
          area: 1400,
          images: ["/uploads/properties/bafal.jpg"],
          description: "A residential investment property.",
        } as unknown as Property,
      },
    ] as unknown as Favorite[];
  });

  const result = await service.listFavorites(7);

  assert.deepEqual((findAllOptions as { where: Record<string, number> }).where, {
    userId: 7,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.id, 55);
  assert.equal(result.items[0]?.property.id, 123);
  assert.equal(
    result.items[0]?.property.primaryImage,
    "/uploads/properties/bafal.jpg",
  );
  assert.equal(result.items[0]?.createdAt, createdAt);
});

test("unauthenticated request is rejected", async () => {
  let nextError: unknown;

  await requireAuth(
    { cookies: {} } as Request,
    {} as Response,
    (error?: unknown) => {
      nextError = error;
    },
  );

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 401);
  assert.equal((nextError as AppError).message, "Authentication required");
});
