import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: "BORROWER" | "BROKER" | "ADMIN";
    };
  }

  interface User {
    role?: "BORROWER" | "BROKER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "BORROWER" | "BROKER" | "ADMIN";
  }
}
