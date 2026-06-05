import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This holds everything middleware needs (session strategy, the `authorized`
 * route guard, token/session shaping) and deliberately contains NO database or
 * bcrypt access. The Credentials provider with its DB-backed `authorize` lives
 * in `src/auth.ts`, which runs only in the Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // Runs in middleware on protected routes (see src/middleware.ts matcher).
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      // token extends Record<string, unknown>; narrow before assigning.
      if (typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
  // Providers are added in src/auth.ts; kept empty here to stay edge-safe.
  providers: [],
} satisfies NextAuthConfig;
