// src/components/Auth/AuthCard.tsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import { apiRegister, apiLogin } from "../../api/authApi";
import type { AuthResult } from "../../api/authApi";
import SplitText from "../SplitText";
import { motion, AnimatePresence } from "framer-motion";

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

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  disabled,
  icon,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
        {label}
      </label>
      <div
        className={`relative flex items-center rounded-xl border transition-all duration-200 ${
          focused
            ? "border-sky-500/60 shadow-[0_0_0_3px_rgba(14,165,233,0.12)] bg-white/[0.07]"
            : "border-white/10 bg-white/[0.04]"
        }`}
      >
        <span className="pl-3.5 text-gray-500 flex-shrink-0">{icon}</span>
        <input
          type={type}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
    </div>
  );
}

// icons
const IconUser = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconMail = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconLock = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconFolder = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

export default function AuthCard({ onAuthSuccess, initialEmail }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");

  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState(initialEmail || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnimationComplete = () => {};

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
    if (!workspace || !name || !email || !password) {
      toast.error("Workspace, Name, email, and password are required");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Password do not match!");
      return;
    }
    setLoading(true);
    const clientTempId = generateClientTempId();
    try {
      const result = await apiRegister({
        clientTempId,
        workspace,
        email,
        name,
        password,
      });
      toast.success("Register berhasil");
      try {
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
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md"
    >
      {/* gradient border wrapper */}
      <div className="p-px rounded-2xl bg-gradient-to-br from-sky-500/30 via-white/5 to-violet-500/20">
        <div className="rounded-2xl bg-[#0a0f1a]/90 backdrop-blur-2xl p-7">
          {/* Logo + brand */}
          <div className="flex flex-col items-center mb-7">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="relative">
                <div className="absolute inset-0 blur-lg bg-sky-500/40 rounded-full" />
                <img
                  src="logo.png"
                  width={38}
                  height={32}
                  alt="logo"
                  className="relative"
                />
              </div>
              <SplitText
                text="CommitFlow"
                className="text-2xl font-bold tracking-tight"
                delay={80}
                duration={0.55}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 30 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-100px"
                textAlign="center"
                onLetterAnimationComplete={handleAnimationComplete}
              />
            </div>
            <p className="text-xs text-gray-500">
              {tab === "login"
                ? "Welcome back — sign in to continue"
                : "Create your account to get started"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="relative flex rounded-xl bg-white/[0.04] border border-white/[0.07] p-1 mb-6">
            <motion.div
              layoutId="tab-pill"
              className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg ${
                tab === "login"
                  ? "left-1 bg-gradient-to-r from-sky-600 to-sky-500"
                  : "left-[calc(50%+3px)] bg-gradient-to-r from-violet-600 to-violet-500"
              }`}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
            <button
              onClick={() => setTab("login")}
              type="button"
              aria-pressed={tab === "login"}
              className={`relative z-10 flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                tab === "login"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab("register")}
              type="button"
              aria-pressed={tab === "register"}
              className={`relative z-10 flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                tab === "register"
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Register
            </button>
          </div>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {tab === "register" ? (
              <motion.form
                key="register"
                onSubmit={onRegister}
                aria-busy={loading}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22 }}
                className="space-y-3.5"
              >
                <InputField
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={loading}
                  icon={<IconUser />}
                />
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  icon={<IconMail />}
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  icon={<IconLock />}
                />
                <InputField
                  label="Confirm Password"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  icon={<IconLock />}
                />
                <InputField
                  label="Workspace"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  placeholder="My Team"
                  required
                  disabled={loading}
                  icon={<IconFolder />}
                />

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-60 transition-all duration-150 shadow-[0_4px_20px_rgba(139,92,246,0.35)] hover:shadow-[0_4px_28px_rgba(139,92,246,0.5)]"
                >
                  {loading ? (
                    <>
                      <ButtonSpinner />
                      <span>Creating account…</span>
                    </>
                  ) : (
                    <span>Create account</span>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="login"
                onSubmit={onLogin}
                aria-busy={loading}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.22 }}
                className="space-y-3.5"
              >
                <InputField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  icon={<IconMail />}
                />
                <InputField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  icon={<IconLock />}
                />

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:opacity-60 transition-all duration-150 shadow-[0_4px_20px_rgba(14,165,233,0.35)] hover:shadow-[0_4px_28px_rgba(14,165,233,0.5)]"
                >
                  {loading ? (
                    <>
                      <ButtonSpinner />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <span>Sign in</span>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
