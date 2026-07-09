import Link from "next/link";
import { signUpWithEmail } from "./actions";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { error, message } = await searchParams;
  const signupEnabled = process.env.ALLOW_ADMIN_SIGNUP === "true";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-500">Under The Hood</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Create admin account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Admin sign-up is available only when explicitly enabled.
        </p>

        {error ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "not-allowed"
              ? "This email is not allowed to create an admin account."
              : message ||
                "Could not create the account. Try another email or password."}
          </div>
        ) : null}

        {!signupEnabled ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Sign-up is currently disabled. Use sign-in if your account already
            exists.
          </div>
        ) : null}

        <form action={signUpWithEmail} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Name
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-slate-950"
              name="name"
              required
            />
          </label>
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
            disabled={!signupEnabled}
            type="submit"
          >
            Create account
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-semibold text-slate-950" href="/auth/sign-in">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
