import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAllowedCallbackPath } from "@/lib/auth-callback";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET || undefined;

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/acceso",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      try {
        const parsed = new URL(url, baseUrl);
        if (parsed.origin !== new URL(baseUrl).origin) return baseUrl;
        const targetPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (isAllowedCallbackPath(targetPath)) {
          return targetPath;
        }
        return baseUrl;
      } catch {
        return baseUrl;
      }
    },
  },
};
