import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside of Next.js, so load env files manually.
// .env.local takes precedence over .env.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Map camelCase TS fields → snake_case columns automatically.
  casing: "snake_case",
  verbose: true,
  strict: true,
});
