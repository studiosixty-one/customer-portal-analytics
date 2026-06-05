import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { db, users } from "@/lib/db";
import { provisionFromHandoffToken } from "@/lib/sso";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
    Credentials({
      // SSO handoff from the CRM: the credential is a signed handoff token.
      id: "crm-sso",
      name: "CRM SSO",
      credentials: { token: {} },
      async authorize(raw) {
        const token = raw && typeof raw.token === "string" ? raw.token : null;
        if (!token) return null;
        try {
          const r = await provisionFromHandoffToken(token);
          return { id: r.userId, email: r.email, name: r.name ?? undefined };
        } catch {
          return null;
        }
      },
    }),
  ],
});
