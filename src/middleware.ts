import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Use the edge-safe config (no DB/bcrypt) so middleware can run on the Edge.
export default NextAuth(authConfig).auth;

export const config = {
  // Protect the admin area. Everything else (public forms, login, auth API,
  // static assets) is left untouched.
  matcher: ["/admin/:path*"],
};
