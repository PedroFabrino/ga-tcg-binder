import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || "default_ga_secret_key_change_in_production_32char",
  session: {
    strategy: "jwt",
  },
  providers: [
    ...(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET
      ? [
          Discord({
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
          }),
        ]
      : []),
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      id: "demo-collector",
      name: "Demo Collector",
      credentials: {
        name: { label: "Collector Name", type: "text" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const name = (credentials?.name as string) || "Collector Alex";
        const email = (credentials?.email as string) || "alex@grandarchive.local";
        const id = `user_${email.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;

        // Ensure user exists in db
        const existing = await db.select().from(users).where(eq(users.id, id)).get();
        if (!existing) {
          const friendCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await db.insert(users).values({
            id,
            name,
            email,
            friendCode,
            lowPopThreshold: 1000,
          });
        }

        return {
          id,
          name,
          email,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.id || !user.email) return true;
      try {
        const existing = await db.select().from(users).where(eq(users.id, user.id)).get();
        if (!existing) {
          const friendCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await db.insert(users).values({
            id: user.id,
            name: user.name || "Collector",
            email: user.email,
            image: user.image || null,
            friendCode,
            lowPopThreshold: 1000,
          });
        }
      } catch (err) {
        console.error("Error in signIn callback:", err);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id || token.sub;
      }
      return session;
    },
  },
});
