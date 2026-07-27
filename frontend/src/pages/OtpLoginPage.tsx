import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import BrandHeader from "../components/auth/BrandHeader";
import RoleStep, { type UserRole } from "../components/auth/RoleStep";
import PromoPanel from "../components/auth/PromoPanel";
import { buildApiUrl } from "../api/config";

const SEND_OTP_URL = buildApiUrl("/auth/send-otp");
const VERIFY_OTP_URL = buildApiUrl("/auth/verify-otp");

type Step = "email" | "role" | "otp";

const OtpLoginPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const redirectTo =
    typeof window.history.state === "object" &&
    window.history.state !== null &&
    typeof (window.history.state as { usr?: { from?: unknown } }).usr?.from === "string"
      ? ((window.history.state as { usr: { from: string } }).usr.from || "/home")
      : "/home";

  const handleSendOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError("Email is required"); return; }
    if (!/\S+@\S+\.\S+/.test(trimmed)) { setEmailError("Please enter a valid email address"); return; }

    try {
      setIsSending(true);
      setEmailError("");
      const response = await fetch(SEND_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setEmailError(data?.message || data?.detail || "Unable to send OTP");
        return;
      }
      // Read role from send-otp response if available
      const userRole = (data?.data?.role ?? data?.role ?? "employee") as UserRole;
      setRole(userRole);
      setStep("role");
    } catch {
      setEmailError("Unable to connect to backend");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = otp.trim();
    if (!trimmed) { setOtpError("OTP is required"); return; }

    try {
      setIsVerifying(true);
      setOtpError("");
      const response = await fetch(VERIFY_OTP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setOtpError(data?.message || data?.detail || "Invalid or expired OTP");
        return;
      }

      const accessToken = data?.data?.access_token || data?.access_token || null;
      const refreshToken = data?.data?.refresh_token || data?.refresh_token || null;
      const user = data?.data?.user || data?.user || null;
      if (accessToken) localStorage.setItem("accessToken", accessToken);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      const userWithRole = user ? { ...user, role } : { email: email.trim(), role };
      localStorage.setItem("loggedInUser", JSON.stringify(userWithRole));

      navigate(redirectTo, { replace: true });
    } catch {
      setOtpError("Unable to connect to backend");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0fdf4] px-4 py-8 sm:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[820px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)] lg:grid-cols-[1fr_0.92fr]">
          <AuthCard>
            {step === "email" && (
              <div>
                <BrandHeader />
                <div className="space-y-4">
                  <div>
                    <p className="mb-4 text-[15px] text-slate-600">
                      Enter your email to receive a one-time password.
                    </p>
                    <AuthInput
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="Enter your email"
                      error={emailError}
                    />
                  </div>
                  <AuthButton onClick={handleSendOtp} disabled={isSending}>
                    {isSending ? "Sending OTP..." : "Send OTP"}
                  </AuthButton>
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="w-full text-center text-[14px] font-medium text-green-600 hover:text-green-700"
                  >
                    Back to Sign in
                  </button>
                </div>
              </div>
            )}

            {step === "role" && (
              <RoleStep
                email={email}
                role={role}
                onContinue={() => {
                  setStep("otp");
                  void handleSendOtp();
                }}
                onBack={() => { setOtp(""); setOtpError(""); setStep("email"); }}
              />
            )}

            {step === "otp" && (
              <div>
                <BrandHeader />
                <div className="space-y-4">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[14px] text-slate-700">
                      {email}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOtp(""); setOtpError(""); setStep("email"); }}
                      className="shrink-0 text-[14px] font-semibold text-green-600 hover:text-green-700"
                    >
                      Change
                    </button>
                  </div>
                  <div>
                    <p className="mb-4 text-[15px] text-slate-600">
                      Enter the OTP sent to your email.
                    </p>
                    <AuthInput
                      type="text"
                      value={otp}
                      onChange={setOtp}
                      placeholder="Enter OTP"
                      error={otpError}
                    />
                  </div>
                  <AuthButton onClick={handleVerifyOtp} disabled={isVerifying}>
                    {isVerifying ? "Verifying..." : "Verify & Sign in"}
                  </AuthButton>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSending}
                    className="w-full text-center text-[14px] font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    {isSending ? "Resending..." : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </AuthCard>

          <PromoPanel />
        </div>
      </div>
    </div>
  );
};

export default OtpLoginPage;
