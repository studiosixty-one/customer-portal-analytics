import { config } from "dotenv";

// Load env BEFORE importing the db client (which validates DATABASE_URL).
config({ path: [".env.local", ".env"] });

import bcrypt from "bcryptjs";

async function main() {
  const [email, password, name, orgNameArg] = process.argv.slice(2);

  if (!email || !password) {
    console.error(
      "Usage: pnpm create-admin <email> <password> [name] [orgName]",
    );
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    console.error(`✗ "${email}" is not a valid email address.`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("✗ Password must be at least 8 characters.");
    process.exit(1);
  }

  const { eq } = await import("drizzle-orm");
  const { db, users, organizations, memberships } = await import("@/lib/db");
  const { slugify } = await import("@/lib/slug");

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, name: name ?? null, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, name: name ?? null },
    })
    .returning();

  // Ensure the user has at least one organization (as owner).
  const existing = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!existing) {
    const orgName =
      orgNameArg || (name ? `${name}'s organization` : "My organization");
    let slug = slugify(orgName);
    const taken = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
      columns: { id: true },
    });
    if (taken) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

    const [org] = await db
      .insert(organizations)
      .values({ name: orgName, slug })
      .returning();
    await db
      .insert(memberships)
      .values({ orgId: org.id, userId: user.id, role: "owner" });
    console.log(`  created organization "${org.name}"`);
  }

  console.log(`✓ Admin user ready: ${normalizedEmail}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create admin user:");
  console.error(err);
  process.exit(1);
});
