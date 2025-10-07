import Link from "next/link";

type InvitePageProps = {
  params: { code: string };
};

export default function InvitePage({ params }: InvitePageProps) {
  const { code } = params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-2xl space-y-8 rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-2xl shadow-black/20">
        <div className="space-y-3 text-center">
          <span className="rounded-full border border-brand-primary/40 px-4 py-1 text-xs uppercase tracking-widest text-brand-primary">
            Golden Bridge Invite
          </span>
          <h1 className="text-3xl font-semibold text-white">You&apos;re invited to Golden Bridge Loan</h1>
          <p className="text-sm text-slate-300">
            This invite link unlocks AI-guided borrower discovery and direct broker collaboration inside the Golden Bridge platform.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-6 text-left">
          <p className="text-sm text-slate-400">Invite code</p>
          <code className="block overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-sm text-brand-primary">
            {code}
          </code>
          <p className="text-xs text-slate-500">
            Paste this code into your onboarding conversation or share it with your Golden Bridge advisor for faster account activation.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <p className="font-semibold text-white">Borrowers</p>
            <p className="mt-2 text-xs text-slate-400">
              Create your account to capture loan preferences once, compare curated products, and collaborate with top brokers.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex rounded-full bg-brand-primary px-5 py-2 text-xs font-semibold text-brand-dark transition hover:-translate-y-0.5"
            >
              Create borrower account
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <p className="font-semibold text-white">Brokers</p>
            <p className="mt-2 text-xs text-slate-400">
              Join the broker studio to showcase products, receive curated borrower briefs, and track interest in real time.
            </p>
            <Link
              href="/signup?role=BROKER"
              className="mt-4 inline-flex rounded-full border border-brand-primary/40 px-5 py-2 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
            >
              Join as broker
            </Link>
          </div>
        </div>

        <p className="text-xs text-center text-slate-500">
          Link owner: {code.split("-")[0] || "Golden Bridge Advisor"} &middot; Need help? Email{" "}
          <a className="text-brand-primary" href="mailto:info@goldenbridge.ai">
            info@goldenbridge.ai
          </a>
        </p>
      </div>
    </div>
  );
}
