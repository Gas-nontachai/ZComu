"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLoginPage } from "@/hooks/use-login-page";

export default function LoginPage() {
  const {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    setError,
    message,
    setMessage,
    isPending,
    handleSubmit,
    handlePasswordReset,
  } = useLoginPage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-300">
            Zcomu Social
          </p>
          <h1 className="text-2xl font-semibold">
            {mode === "login" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="text-sm text-slate-300">
            {mode === "login"
              ? "Log in to continue sharing moments with the community."
              : "Sign up to start posting, commenting, and collaborating."}
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-slate-300">
          <span>{mode === "login" ? "New here?" : "Already registered?"}</span>
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === "login" ? "signup" : "login"));
              setError(null);
              setMessage(null);
            }}
            className="font-medium text-white underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Email</label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Password
            </label>
            <Input
              type="password"
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder="••••••••"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Confirm password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isPending}
          >
            {isPending
              ? "Please wait..."
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={handlePasswordReset}
          className="mt-4 w-full text-center text-sm text-slate-200 underline-offset-4 hover:underline"
          disabled={isPending}
        >
          Forgot your password?
        </button>

        <div className="mt-8 text-center text-xs text-slate-400">
          <p>
            By continuing you agree to the{" "}
            <Link
              href="#"
              className="font-medium text-slate-200 underline-offset-4 hover:underline"
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="font-medium text-slate-200 underline-offset-4 hover:underline"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
