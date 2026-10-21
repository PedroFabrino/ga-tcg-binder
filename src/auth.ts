import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import {
  findUserById,
  findUserByEmail,
  createUser,
  updateUserProfile,
  migrateDefaultUserDataToUser,
} from "./db/repositories/auth-repository";
import { upsertCollectorIdentity } from "./db/repositories/assistant-repository";

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
        const existing = await findUserById(id);
        if (!existing) {
          const friendCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await createUser({
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
    async signIn({ user, account }) {
      if (!user.email) return true;
      try {
        const normalizedEmail = user.email.toLowerCase().trim();

        // 1. Look up existing user by email to ensure multi-device and re-login consistency
        const existingByEmail = await findUserByEmail(normalizedEmail);

        if (existingByEmail) {
          // Canonical user exists! Set user.id so jwt receives the canonical DB id
          user.id = existingByEmail.id;
          if (
            (user.name && user.name !== existingByEmail.name) ||
            (user.image && user.image !== existingByEmail.image)
          ) {
            await updateUserProfile(existingByEmail.id, {
              name: user.name || existingByEmail.name,
              image: user.image || existingByEmail.image,
            });
          }
          await migrateDefaultUserDataToUser(existingByEmail.id);
          if (account?.provider === "discord" && account?.providerAccountId) {
            try {
              await upsertCollectorIdentity({
                collectorId: existingByEmail.id,
                provider: "discord",
                providerUserId: String(account.providerAccountId),
                providerUsername: user.name || null,
              });
            } catch (linkErr) {
              console.error("Error auto-linking Discord identity:", linkErr);
            }
          }
          return true;
        }

        // 2. New user: resolve or assign ID
        const id = user.id || `user_${normalizedEmail.replace(/[^a-z0-9]/gi, "_")}`;
        user.id = id;

        const existingById = await findUserById(id);

        if (!existingById) {
          const friendCode = `GA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await createUser({
            id,
            name: user.name || "Collector",
            email: normalizedEmail,
            image: user.image || null,
            friendCode,
            lowPopThreshold: 1000,
          });
        }
        await migrateDefaultUserDataToUser(id);
        if (account?.provider === "discord" && account?.providerAccountId) {
          try {
            await upsertCollectorIdentity({
              collectorId: id,
              provider: "discord",
              providerUserId: String(account.providerAccountId),
              providerUsername: user.name || null,
            });
          } catch (linkErr) {
            console.error("Error auto-linking Discord identity:", linkErr);
          }
        }
      } catch (err) {
        console.error("Error in signIn callback:", err);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      // Guarantee canonical user ID in token, auto-repairing any stale or mismatched device sessions
      if (token?.email) {
        try {
          const normalizedEmail = (token.email as string).toLowerCase().trim();
          const dbUser = await findUserByEmail(normalizedEmail);
          if (dbUser?.id) {
            token.id = dbUser.id;
          }
        } catch (e) {
          console.error("Error in jwt callback resolving user id:", e);
        }
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
