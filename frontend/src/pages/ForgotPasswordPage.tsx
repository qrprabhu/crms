import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import BrandHeader from "../components/auth/BrandHeader";
import PromoPanel from "../components/auth/PromoPanel";
import { buildApiUrl } from "../api/config";

const FORGOT_PASSWORD_URL = buildApiUrl("/auth/forgot-password");
const RESET_PASSWORD_URL = buildApiUrl("/auth/reset-password");

type Step = "email" | "reset";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSendOtp = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError("Email is required"); return; }
    const valid = /\S+@\S+\.\S+/;
    if (!valid.test(trimmed)) { setEmailError("Please enter a valid email address"); return; }

    try {
      setIsSending(true);
      setEmailError("");
      const response = await fetch(FORGOT_PASSWORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setEmailError(data?.message || data?.detail || "Unable to send OTP");
        return;
      }
      setStep("reset");
    } catch {
      setEmailError("Unable to connect to backend");
    } finally {
      setIsSending(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim()) { setOtpError("OTP is required"); return; }
    if (!newPassword) { setPasswordError("New password is required"); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match"); return; }

    try {
      setIsResetting(true);
      setOtpError("");
      setPasswordError("");
      const response = await fetch(RESET_PASSWORD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), new_password: newPassword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = data?.message || data?.detail || "Invalid or expired OTP";
        setOtpError(msg);
        return;
      }
      navigate("/");
    } catch {
      setOtpError("Unable to connect to backend");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0fdf4] px-4 py-8 sm:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[820px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)] lg:grid-cols-[1fr_0.92fr]">
          <AuthCard>
            <BrandHeader />

            {step === "email" ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-4 text-[15px] text-slate-600">
                    Enter your email to receive a password reset OTP.
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
            ) : (
              <div className="space-y-4">
                <div className="mb-2 flex items-center gap-3">
                  <div className="max-w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[14px] text-slate-700">
                    {email}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOtp(""); setNewPassword(""); setConfirmPassword(""); setOtpError(""); setPasswordError(""); setStep("email"); }}
                    className="text-[14px] font-semibold text-green-600 hover:text-green-700"
                  >
                    Change
                  </button>
                </div>
                <p className="text-[15px] text-slate-600">
                  Enter the OTP sent to your email and set a new password.
                </p>
                <AuthInput
                  type="text"
                  value={otp}
                  onChange={setOtp}
                  placeholder="Enter OTP"
                  error={otpError}
                />
                <AuthInput
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="New password"
                />
                <AuthInput
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                  error={passwordError}
                />
                <AuthButton onClick={handleResetPassword} disabled={isResetting}>
                  {isResetting ? "Resetting..." : "Reset Password"}
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
            )}
          </AuthCard>

          <PromoPanel />
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
