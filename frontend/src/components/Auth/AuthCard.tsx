// src/components/Auth/AuthCard.tsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import { apiRegister, apiLogin } from "../../api/authApi";
import type { AuthResult } from "../../api/authApi";
import SplitText from "../SplitText";

type Props = {
  onAuthSuccess?: (res: AuthResult) => void;
  initialEmail?: string;
};

function ButtonSpinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function AuthCard({ onAuthSuccess, initialEmail }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");

  // common states
  const [email, setEmail] = useState(initialEmail || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnimationComplete = () => {
    console.log("All letters have animated!");
  };

  // helper: client optimistic id
  const generateClientTempId = () => {
    try {
      return (
        (crypto as any).randomUUID?.() ||
        `fe_${Math.random().toString(36).slice(2, 10)}`
      );
    } catch {
      return `fe_${Math.random().toString(36).slice(2, 10)}`;
    }
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Name, email, and password are required");
      return;
    }

    if (password !== passwordConfirm) {
      toast.error("Password do not match!");
      return;
    }

    setLoading(true);
    const clientTempId = generateClientTempId();
    try {
      const result = await apiRegister({ clientTempId, email, name, password });
      toast.success("Register berhasil");
      try {
        // keep consistent key with the rest of your app
        localStorage.setItem("session_token", result.token);
      } catch {
        console.log("error session_token");
      }
      onAuthSuccess?.(result);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Register gagal");
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email & Password needed!");
      return;
    }
    setLoading(true);
    try {
      const result = await apiLogin({ email, password });
      toast.success("Login berhasil");
      try {
        localStorage.setItem("session_token", result.token);
      } catch (err: any) {
        console.log("error session_token");
        toast.error(err?.message || "Login gagal");
        return;
      }
      onAuthSuccess?.(result);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-black/50 p-4 rounded-lg border border-white/10">
      <div className="flex gap-2 items-center mb-5">
        <img
          src="logo.png"
          className="text-white"
          width={37}
          height={30}
          alt="logo"
        />
        <SplitText
          text="CommitFlow"
          className="text-2xl font-semibold text-center"
          delay={100}
          duration={0.6}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 40 }}
          to={{ opacity: 1, y: 0 }}
          threshold={0.1}
          rootMargin="-100px"
          textAlign="center"
          onLetterAnimationComplete={handleAnimationComplete}
        />
      </div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Account</h3>
        <div className="flex gap-1 bg-white/5 rounded-md p-1">
          <button
            onClick={() => setTab("login")}
            className={`px-3 py-1 rounded ${
              tab === "login" ? "bg-sky-600 text-white" : "text-white/60"
            }`}
            type="button"
            aria-pressed={tab === "login"}
          >
            Login
          </button>
          <button
            onClick={() => setTab("register")}
            className={`px-3 py-1 rounded ${
              tab === "register" ? "bg-emerald-600 text-white" : "text-white/60"
            }`}
            type="button"
            aria-pressed={tab === "register"}
          >
            Register
          </button>
        </div>
      </div>

      {tab === "register" ? (
        <form onSubmit={onRegister} className="space-y-3" aria-busy={loading}>
          <label className="block text-xs text-gray-300">Name</label>
          <input
            className="w-full p-2 rounded bg-black/60 text-white"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            disabled={loading}
          />

          <label className="block text-xs text-gray-300">Email</label>
          <input
            type="email"
            className="w-full p-2 rounded bg-black/60 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />

          <label className="block text-xs text-gray-300">Password</label>
          <input
            type="password"
            className="w-full p-2 rounded bg-black/60 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />

          <label className="block text-xs text-gray-300">
            Confirm Password
          </label>
          <input
            type="password"
            className="w-full p-2 rounded bg-black/60 text-white"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <ButtonSpinner />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create account</span>
              )}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onLogin} className="space-y-3" aria-busy={loading}>
          <label className="block text-xs text-gray-300">Email</label>
          <input
            type="email"
            className="w-full p-2 rounded bg-black/20 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
          />

          <label className="block text-xs text-gray-300">Password</label>
          <input
            type="password"
            className="w-full p-2 rounded bg-black/20 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={loading}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded bg-sky-500 hover:bg-sky-600 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <ButtonSpinner />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
