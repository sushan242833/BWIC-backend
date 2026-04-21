import { QueryInterface, QueryTypes, Sequelize } from "sequelize";
import { USER_ROLE, UserRole } from "@models/user.model";
import env from "@config/env";
import { hashPassword } from "@utils/password";

type AdminSeedContext = {
  queryInterface: QueryInterface;
  sequelize: Sequelize;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const resolveAdminSeedConfig = () => {
  const fullName = env.auth.initialAdmin.fullName?.trim();
  const email = env.auth.initialAdmin.email?.trim();
  const password = env.auth.initialAdmin.password;

  if (!fullName || !email || !password) {
    return null;
  }

  return {
    fullName,
    email: normalizeEmail(email),
    password,
  };
};

export const seedInitialAdminUser = async ({
  queryInterface,
  sequelize,
}: AdminSeedContext): Promise<boolean> => {
  const adminSeed = resolveAdminSeedConfig();

  if (!adminSeed) {
    return false;
  }

  const existingUser = await sequelize.query<{ id: number }>(
    'SELECT id FROM "users" WHERE email = :email LIMIT 1',
    {
      replacements: { email: adminSeed.email },
      type: QueryTypes.SELECT,
    },
  );

  if (existingUser.length > 0) {
    return false;
  }

  const now = new Date();
  const passwordHash = await hashPassword(adminSeed.password);

  await queryInterface.bulkInsert("users", [
    {
      fullName: adminSeed.fullName,
      email: adminSeed.email,
      passwordHash,
      role: USER_ROLE.ADMIN satisfies UserRole,
      isActive: true,
      isEmailVerified: true,
      emailVerificationOtpAttempts: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return true;
};
