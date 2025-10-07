# Golden Bridge Loan Platform

Golden Bridge Loan is an AI-assisted lending concierge crafted for U.S. borrowers (B-side) and brokers (C-side). This monorepo hosts the full-stack application built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma, and NextAuth.

## Features
- Conversational borrower discovery hub with voice capture and ChatGPT-backed follow-ups
- Role-based onboarding (borrower vs. broker) with credential auth, hashed passwords, and Prisma persistence
- Curated loan recommendation engine with dynamic filters and refresh
- Broker studio CTA flows and referral link generator
- Serverless APIs for authentication, registration, and AI chat proxy (OpenAI)

## Project Structure
```
app/                # Next.js app router routes and layouts
components/         # Client components and shared providers
lib/                # Prisma client, loan datasets, auth helpers
prisma/             # Prisma schema
app/api/            # Serverless API routes (NextAuth, register, chat)
types/              # NextAuth type augmentation
```

## Getting Started
1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**
   Copy `.env.example` to `.env` and populate:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL`: Postgres connection string (e.g., Neon, Supabase, RDS)
   - `NEXTAUTH_SECRET`: 32+ char random string (use `openssl rand -base64 32`)
   - `NEXTAUTH_URL`: Typically `http://localhost:3000` in dev
   - `OPENAI_API_KEY`: API key for ChatGPT access

3. **Prisma setup**  
   Generate the Prisma client and create a local dev database schema:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```
   App will be available at `http://localhost:3000`.

## Deploying to Vercel
1. Push the repository to GitHub (already configured).
2. Create a new Vercel project connected to the repo.
3. Set the following environment variables in Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (e.g., `https://your-vercel-domain.vercel.app`)
   - `OPENAI_API_KEY`
4. Assign a managed Postgres instance (Neon, PlanetScale + Prisma Data Proxy, Supabase, etc.).
5. Trigger a production build (`npm run build`) during Vercel deploy.

## Next Steps / TODOs
- Add authenticated dashboards for borrowers and brokers with server-side route protection (middleware)
- Persist borrower conversations and recommendation snapshots per user
- Integrate real lender/broker data sources and admin ingestion tooling
- Implement broker alerting (email/webhook) when borrowers express interest
- Extend analytics (React Query, data visualizations) once APIs are live

## Tooling Notes
- `npm run prisma:migrate` keeps Prisma schema in sync
- `npm run lint` leverages Next.js ESLint config
- ChatGPT requests flow through `app/api/chat/route.ts` for secure key usage

Happy building! 🚀
