import type { NextAuthOptions, User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { z } from "zod";
import { ContactIdentifierError, parseContactIdentifier } from "./contact-identifiers";
import type { ContactIdentifier } from "./contact-identifiers";

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(8)
});

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/signin"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or US phone", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        let contact: ContactIdentifier;
        try {
          contact = parseContactIdentifier(parsed.data.identifier);
        } catch (error) {
          if (error instanceof ContactIdentifierError) {
            return null;
          }
          console.error("Credential parse error", error);
          return null;
        }

        const user = await prisma.user.findFirst({
          where: contact.type === "email" ? { email: contact.value } : { phoneNumber: contact.value }
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const passwordMatches = await compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        const authUser: NextAuthUser = {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined
        };

        (authUser as NextAuthUser & { phoneNumber?: string | null }).phoneNumber = user.phoneNumber;

        return authUser;
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (token.role && session.user) {
        session.user.role = token.role as "BORROWER" | "BROKER";
      }
      if (session.user) {
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        session.user.phoneNumber = (token as typeof token & { phoneNumber?: string | null }).phoneNumber ?? null;
      }
      return session;
    },
    async jwt({ token }) {
      if (!token.sub) {
        return token;
      }

      const user = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { role: true, phoneNumber: true, email: true }
      });

      if (user) {
        token.role = user.role;
        token.email = user.email ?? undefined;
        (token as typeof token & { phoneNumber?: string | null }).phoneNumber = user.phoneNumber;
      }

      return token;
    }
  }
};
