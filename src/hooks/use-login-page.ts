"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/auth-provider";
import { getErrorMessage } from "@/lib/error";

export type AuthMode = "login" | "signup";

export function useLoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/feed");
    }
  }, [loading, router, user]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError("Please provide email and password");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "login") {
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (loginError) {
            throw loginError;
          }
          router.replace("/feed");
        } else {
          const { error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/login`,
            },
          });
          if (signupError) {
            throw signupError;
          }
          setMessage(
            "Check your inbox to confirm your email before signing in."
          );
        }
      } catch (authError: unknown) {
        setError(getErrorMessage(authError, "Authentication failed"));
      }
    });
  }

  async function handlePasswordReset() {
    if (!email) {
      setError("Enter your email first to receive reset instructions.");
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/login`,
          }
        );
        if (resetError) {
          throw resetError;
        }
        setMessage("Password reset email sent. Check your inbox.");
      } catch (resetErr: unknown) {
        setError(getErrorMessage(resetErr, "Failed to send reset email"));
      }
    });
  }

  return {
    confirmPassword,
    email,
    error,
    handlePasswordReset,
    handleSubmit,
    isPending,
    loading,
    message,
    mode,
    password,
    setConfirmPassword,
    setEmail,
    setMessage,
    setMode,
    setPassword,
    setError,
    user,
  };
}
