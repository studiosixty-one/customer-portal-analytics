import { config } from "dotenv";

// Promote (or demote) a user to platform super-admin.
// Usage: pnpm exec tsx scripts/make-super.ts <email> [true|false]
config({ path: [".env.local", ".env"] });

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const value = process.argv[3] !== "false";
  if (!email) {
    console.error("Usage: tsx scripts/make-super.ts <email> [true|false]");
    process.exit(1);
  }

  const { eq } = await import("drizzle-orm");
  const { db, users } = await import("@/lib/db");

  const [updated] = await db
    .update(users)
    .set({ isSuperAdmin: value })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (!updated) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  console.log(`✓ ${updated.email} isSuperAdmin = ${value}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
