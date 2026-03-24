import sequelize from "@config/config";
import { seedInitialAdminUser } from "@utils/admin-seed";

const run = async (): Promise<void> => {
  await sequelize.authenticate();

  const seeded = await seedInitialAdminUser({
    queryInterface: sequelize.getQueryInterface(),
    sequelize,
  });

  if (seeded) {
    console.log("Initial admin user created successfully.");
    return;
  }

  console.log(
    "No admin user was created. Check auth seed env vars or existing user records.",
  );
};

run()
  .catch((error: unknown) => {
    console.error("Admin seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
