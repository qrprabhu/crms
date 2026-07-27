import BrandHeader from "./BrandHeader";
import AuthInput from "./AuthInput";
import AuthButton from "./AuthButton";

type PasswordStepProps = {
  email: string;
  password: string;
  setPassword: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onOtpLogin?: () => void;
  onForgotPassword?: () => void;
  error?: string;
  buttonText?: string;
  disabled?: boolean;
};

const PasswordStep = ({
  email,
  password,
  setPassword,
  onBack,
  onSubmit,
  onOtpLogin,
  onForgotPassword,
  error,
  buttonText = "Sign in",
  disabled = false,
}: PasswordStepProps) => {
  return (
    <div>
      <BrandHeader />

      <div className="mb-5 flex items-center gap-3">
        <div className="max-w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[14px] text-slate-700">
          {email}
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-[14px] font-semibold text-green-600 hover:text-green-700"
        >
          Change
        </button>
      </div>

      <div className="space-y-4">
        <AuthInput
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Enter password"
          error={error}
        />

        <div className="flex items-center justify-between text-[14px]">
          <button
            type="button"
            onClick={onOtpLogin}
            className="font-medium text-green-600 hover:text-green-700"
          >
            Sign in using email OTP
          </button>

          <button
            type="button"
            onClick={onForgotPassword}
            className="font-medium text-green-600 hover:text-green-700"
          >
            Forgot Password?
          </button>
        </div>

        <AuthButton onClick={onSubmit} disabled={disabled}>
          {buttonText}
        </AuthButton>
      </div>
    </div>
  );
};

export default PasswordStep;