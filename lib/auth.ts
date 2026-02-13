import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const nextAuthSecret = process.env.NEXTAUTH_SECRET || undefined;

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  trustHost: true,
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
};
