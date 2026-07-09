import Link from "next/link";
import { signInWithEmail } from "./actions";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-500">Under The Hood</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Sign in to pipeline
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Access is restricted to the publishing admin account.
        </p>

        {error ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Could not sign in. Check your email and password.
          </div>
        ) : null}

        <form action={signInWithEmail} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Password
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white"
            type="submit"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          No account yet?{" "}
          <Link className="font-semibold text-slate-950" href="/auth/sign-up">
            Create the admin account
          </Link>
        </p>
      </section>
    </main>
  );
}
