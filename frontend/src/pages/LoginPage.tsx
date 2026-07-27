import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { login, storeAuthSession } from "../lib/api/authApi";
import { getResolvedApiBaseUrl } from "../api/config";

type Step = "login" | "forgot-email" | "forgot-otp" | "forgot-reset";
type LoginFieldErrors = { email?: string; password?: string };

const EMAIL_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 16;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractErrorMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractErrorMessage(item);
      if (nested) return nested;
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const nested = extractErrorMessage(nestedValue);
      if (nested) return nested;
    }
  }

  return null;
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getResolvedApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg =
      extractErrorMessage((data as { message?: unknown })?.message) ||
      extractErrorMessage((data as { detail?: unknown })?.detail) ||
      extractErrorMessage(data) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}



export default function LoginPage() {
  const navigate = useNavigate();

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loginErrors, setLoginErrors] = useState<LoginFieldErrors>({});
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [step, setStep] = useState<Step>("login");
  const [fpEmail, setFpEmail] = useState("");
  const [fpOtp, setFpOtp] = useState("");
  const [fpNewPwd, setFpNewPwd] = useState("");
  const [fpConfirmPwd, setFpConfirmPwd] = useState("");
  const [fpShowPwd, setFpShowPwd] = useState(false);
  const [fpError, setFpError] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSuccess, setFpSuccess] = useState("");

  const rawRedirect =
    typeof window.history.state === "object" &&
    window.history.state !== null &&
    typeof (window.history.state as { usr?: { from?: unknown } }).usr?.from === "string"
      ? ((window.history.state as { usr: { from: string } }).usr.from || "/home")
      : "/home";

  const MODULE_PATHS: Array<{ module: string; prefixes: string[]; landing: string }> = [
    { module: "sales", prefixes: ["/leads", "/contacts", "/accounts", "/deals", "/documents", "/campaigns"], landing: "/leads" },
    { module: "activities", prefixes: ["/tasks", "/meetings", "/calls"], landing: "/tasks" },
    {
      module: "inventory",
      prefixes: ["/products", "/price-books", "/quotes", "/sales-orders", "/purchase-orders", "/invoices", "/vendors", "/configurator"],
      landing: "/products",
    },
    { module: "support", prefixes: ["/support/cases", "/support/solutions"], landing: "/support/cases" },
    { module: "integrations", prefixes: ["/integrations"], landing: "/integrations" },
    { module: "services", prefixes: ["/services/business-hours", "/services/catalog", "/services/appointments", "/services/job-sheets", "/services/settings"], landing: "/services/catalog" },
    { module: "projects", prefixes: ["/projects"], landing: "/projects" },
  ];

  const getRedirectForModules = (path: string, allowedModules: string[]) => {
    const rootMatch = MODULE_PATHS.find((entry) => path === `/${entry.module}`);
    if (rootMatch) {
      return allowedModules.includes(rootMatch.module) ? rootMatch.landing : "/home";
    }

    const match = MODULE_PATHS.find((entry) => entry.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)));
    return match && !allowedModules.includes(match.module) ? "/home" : path;
  };

  const validateLoginFields = (nextEmail: string, nextPassword: string): LoginFieldErrors => {
    const nextErrors: LoginFieldErrors = {};
    const trimmedEmail = nextEmail.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      nextErrors.email = `Email must be at most ${EMAIL_MAX_LENGTH} characters.`;
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!nextPassword) {
      nextErrors.password = "Password is required.";
    } else if (nextPassword.length < PASSWORD_MIN_LENGTH || nextPassword.length > PASSWORD_MAX_LENGTH) {
      nextErrors.password = `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`;
    }

    return nextErrors;
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError("");
    const nextErrors = validateLoginFields(email, password);
    setLoginErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.success || !res.data) { setError(res.message || "Login failed."); return; }
      storeAuthSession(res.data);
      window.dispatchEvent(new Event("auth:login"));
      if (res.data.user.must_change_password) {
        navigate("/change-password", { replace: true });
      } else {
        const allowedModules: string[] = res.data.user.allowed_modules ?? [];
        const finalRedirect = getRedirectForModules(rawRedirect, allowedModules);
        navigate(finalRedirect, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot: send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setFpError("");
    if (!fpEmail.trim()) { setFpError("Email is required."); return; }
    setFpLoading(true);
    try {
      await authPost("/auth/forgot-password/", { email: fpEmail.trim() });
      setStep("forgot-otp");
    } catch (err) {
      setFpError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setFpLoading(false);
    }
  };

  // ── Forgot: verify OTP ─────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setFpError("");
    if (!fpOtp.trim()) { setFpError("Enter the OTP sent to your email."); return; }
    setStep("forgot-reset");
  };

  // ── Forgot: reset password ─────────────────────────────────────────────────
  const handleResetPassword = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setFpError("");
    if (!fpNewPwd || !fpConfirmPwd) { setFpError("Both password fields are required."); return; }
    if (fpNewPwd !== fpConfirmPwd) { setFpError("Passwords do not match."); return; }
    if (fpNewPwd.length < 6) { setFpError("Password must be at least 6 characters."); return; }
    setFpLoading(true);
    try {
      await authPost("/auth/reset-password/", {
        email: fpEmail.trim(),
        otp: fpOtp.trim(),
        new_password: fpNewPwd,
      });
      setFpSuccess("Password reset successfully. You can now sign in.");
      setStep("login");
      setFpEmail(""); setFpOtp(""); setFpNewPwd(""); setFpConfirmPwd("");
    } catch (err) {
      setFpError(err instanceof Error ? err.message : "Reset failed. Check your OTP and try again.");
    } finally {
      setFpLoading(false);
    }
  };

  const resetForgot = () => {
    setStep("login");
    setFpEmail(""); setFpOtp(""); setFpNewPwd(""); setFpConfirmPwd("");
    setFpError(""); setFpLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-[1000px] bg-white rounded-[24px] shadow-[0_20px_50px_rgba(31,41,55,0.08)] border border-slate-100 overflow-hidden grid lg:grid-cols-2">
        
        {/* Left Panel: Welcome Splash */}
        <div className="relative hidden lg:flex flex-col justify-center bg-gradient-to-br from-[#0642C2] to-[#0D2C74] p-12 text-white overflow-hidden">
          {/* Subtle background graph overlay and animated glowing orbs */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50"></div>
          <div className="absolute top-[-20px] left-[-20px] w-48 h-48 rounded-full bg-blue-400/20 blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
          <div className="absolute bottom-[-30px] right-[-30px] w-64 h-64 rounded-full bg-amber-400/10 blur-3xl animate-pulse" style={{ animationDuration: '12s' }}></div>
          
          <div className="relative z-10 grid grid-cols-12 gap-6 items-center w-full">
            
            {/* Left side of Splash: Logo + Text */}
            <div className="col-span-7 flex flex-col items-start text-left space-y-5">
              {/* Custom SVG Logo based on logo.jpeg */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-xl p-3 hover:scale-105 transition-transform duration-300">
                <svg className="h-full w-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Outer blue crescent ring */}
                  <path d="M 78 35 A 36 36 0 1 0 35 83" stroke="#2563EB" strokeWidth="6.5" strokeLinecap="round" fill="none" />
                  
                  {/* Dark navy swoosh at the bottom-right */}
                  <path d="M 30 75 C 45 88, 70 85, 84 62 C 86 58, 85 45, 84 43 C 81 48, 75 60, 50 72 Z" fill="#1E3A8A" />
                  
                  {/* Left Person (Blue) */}
                  <circle cx="37" cy="52" r="5" fill="#2563EB" />
                  <rect x="33" y="60" width="8" height="16" rx="4" fill="#2563EB" />
                  
                  {/* Middle Person (Navy) */}
                  <circle cx="50" cy="43" r="5" fill="#1E3A8A" />
                  <rect x="46" y="51" width="8" height="24" rx="4" fill="#1E3A8A" />
                  
                  {/* Right Person (Gold/Amber) */}
                  <circle cx="63" cy="35" r="5" fill="#D97706" />
                  <rect x="59" y="43" width="8" height="31" rx="4" fill="#D97706" />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white/95 leading-none">Welcome to</h2>
                <h1 className="text-3.5xl font-extrabold tracking-tight text-white leading-none mt-1.5">SSH Connect</h1>
              </div>
              
              <p className="text-blue-100/90 text-xs leading-5 max-w-[260px]">
                Your all-in-one CRM solution. Manage leads, engage customers, and grow your business.
              </p>
            </div>

            {/* Right side of Splash: Curved line & bar graph visual */}
            <div className="col-span-5 flex justify-end items-center h-full pt-10">
              <div className="w-full max-w-[170px] relative opacity-85 hover:opacity-100 transition duration-300">
                <svg className="w-full h-auto" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Vertical bar graphs */}
                  <rect x="18" y="60" width="8" height="40" rx="3" fill="#3B82F6" fillOpacity="0.25" />
                  <rect x="38" y="45" width="8" height="55" rx="3" fill="#3B82F6" fillOpacity="0.35" />
                  <rect x="58" y="30" width="8" height="70" rx="3" fill="#3B82F6" fillOpacity="0.5" />
                  <rect x="78" y="15" width="8" height="85" rx="3" fill="#3B82F6" fillOpacity="0.65" />
                  
                  {/* Curve line path with arrow at the end */}
                  <path d="M 5 80 C 35 75, 60 50, 92 10" stroke="#3B82F6" strokeWidth="4.5" strokeLinecap="round" fill="none" />
                  <path d="M 83 11 L 93 9 L 91 19" stroke="#3B82F6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
            </div>

          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="p-8 lg:p-12 flex flex-col justify-between min-h-[520px]">
          <div>
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
              <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to access your dashboard</p>
            </div>

            {fpSuccess && (
              <div className="mb-4 rounded-[6px] border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                {fpSuccess}
              </div>
            )}

            {/* ── STEP: login ── */}
            {step === "login" && (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Mail size={16} />
                    </div>
                    <input
                      id="email" type="email" autoComplete="email" autoFocus
                      maxLength={EMAIL_MAX_LENGTH}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value.replace(/\s/g, "").slice(0, EMAIL_MAX_LENGTH));
                        setLoginErrors((current) => ({ ...current, email: undefined }));
                        if (error) setError("");
                      }}
                      placeholder="Email address"
                      className="w-full rounded-[8px] border border-slate-200 pl-10 pr-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 focus:shadow-sm"
                    />
                  </div>
                  {loginErrors.email && (
                    <p className="mt-1.5 text-xs text-red-600">{loginErrors.email}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      id="password" type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      maxLength={PASSWORD_MAX_LENGTH}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value.replace(/\s/g, "").slice(0, PASSWORD_MAX_LENGTH));
                        setLoginErrors((current) => ({ ...current, password: undefined }));
                        if (error) setError("");
                      }}
                      placeholder="Password"
                      className="w-full rounded-[8px] border border-slate-200 pl-10 pr-10 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/10 focus:shadow-sm"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 text-xs" tabIndex={-1}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {loginErrors.password && (
                    <p className="mt-1.5 text-xs text-red-600">{loginErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center text-slate-600 font-medium cursor-pointer">
                    <input type="checkbox" className="mr-2 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setFpEmail(email); setFpError(""); setFpSuccess(""); setStep("forgot-email"); }}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="mt-2 w-full rounded-[8px] bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition duration-200 disabled:opacity-60 hover:scale-[1.01] active:scale-[0.99] transform">
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>
            )}

            {/* ── STEP: forgot-email ── */}
            {step === "forgot-email" && (
              <form onSubmit={(e) => void handleSendOtp(e)} className="space-y-5" noValidate>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-800 mb-2">Reset Password</h3>
                  <p className="text-xs text-slate-500 mb-4">Enter your email and we'll send you a one-time code.</p>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input type="email" autoFocus value={fpEmail}
                    onChange={(e) => setFpEmail(e.target.value)}
                    placeholder="you@example.com" className="w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-[#2563EB]" />
                </div>
                {fpError && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{fpError}</div>
                )}
                <button type="submit" disabled={fpLoading}
                  className="w-full rounded-[8px] bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60">
                  {fpLoading ? "Sending…" : "Send OTP"}
                </button>
                <button type="button" onClick={resetForgot}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-1">
                  Back to Sign in
                </button>
              </form>
            )}

            {/* ── STEP: forgot-otp ── */}
            {step === "forgot-otp" && (
              <form onSubmit={(e) => void handleVerifyOtp(e)} className="space-y-5" noValidate>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-800 mb-2">Enter OTP</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    A 6-digit code was sent to <span className="font-semibold text-slate-700">{fpEmail}</span>.
                  </p>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">One-time code</label>
                  <input type="text" autoFocus maxLength={6} value={fpOtp}
                    onChange={(e) => setFpOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full rounded-[8px] border border-slate-200 tracking-[0.3em] text-center text-lg font-bold py-2.5 text-slate-800 outline-none focus:border-[#2563EB]" />
                </div>
                {fpError && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{fpError}</div>
                )}
                <button type="submit" disabled={fpOtp.length < 6}
                  className="w-full rounded-[8px] bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60">
                  Verify OTP
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setFpError(""); void handleSendOtp({ preventDefault: () => {} }); }}
                    className="text-blue-600 font-semibold hover:underline">
                    Resend OTP
                  </button>
                  <button type="button" onClick={resetForgot} className="text-slate-500 hover:text-slate-700">
                    Back to Sign in
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP: forgot-reset ── */}
            {step === "forgot-reset" && (
              <form onSubmit={(e) => void handleResetPassword(e)} className="space-y-5" noValidate>
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-800 mb-2">New Password</h3>
                  <p className="text-xs text-slate-500 mb-4">Choose a strong new password for your account.</p>
                  
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">New password</label>
                  <div className="relative">
                    <input type={fpShowPwd ? "text" : "password"} autoFocus value={fpNewPwd}
                      onChange={(e) => setFpNewPwd(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-[8px] border border-slate-200 pr-10 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2563EB]" />
                    <button type="button" onClick={() => setFpShowPwd((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 text-xs" tabIndex={-1}>
                      {fpShowPwd ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm password</label>
                  <input type={fpShowPwd ? "text" : "password"} value={fpConfirmPwd}
                    onChange={(e) => setFpConfirmPwd(e.target.value)}
                    placeholder="Re-enter new password" className="w-full rounded-[8px] border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#2563EB]" />
                </div>

                {fpError && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{fpError}</div>
                )}

                <button type="submit" disabled={fpLoading}
                  className="w-full rounded-[8px] bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 font-semibold shadow-md hover:shadow-lg">
                  {fpLoading ? "Resetting…" : "Reset Password"}
                </button>
                <button type="button" onClick={resetForgot}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-1">
                  Back to Sign in
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-slate-400">
            © 2025 SSH Connect. All rights reserved.
          </div>
        </div>

      </div>
    </div>
  );
}
