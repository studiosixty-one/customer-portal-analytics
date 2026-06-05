import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "./schema";

// Neon's HTTP driver: ideal for serverless/edge one-shot queries. Note that
// interactive transactions aren't supported over HTTP — use db.batch([...])
// for atomic multi-statement writes (e.g. saving a response + its answers).
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema, casing: "snake_case" });

export * from "./schema";
