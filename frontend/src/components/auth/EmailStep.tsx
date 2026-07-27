import BrandHeader from "./BrandHeader";
import AuthInput from "./AuthInput";
import AuthButton from "./AuthButton";

type EmailStepProps = {
  email: string;
  setEmail: (value: string) => void;
  onNext: () => void;
  error?: string;
  buttonText?: string;
  disabled?: boolean;
};

const EmailStep = ({
  email,
  setEmail,
  onNext,
  error,
  buttonText = "Next",
  disabled = false,
}: EmailStepProps) => {
  return (
    <div>
      <BrandHeader />

      <div className="space-y-5">
        <AuthInput
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="Enter your work email"
          error={error}
        />

        <AuthButton onClick={onNext} disabled={disabled}>
          {buttonText}
        </AuthButton>
      </div>

      <div className="mt-5">
        <p className="text-[14px] leading-6 text-slate-500">
          Use your organization email to continue securely into SSH Connect.
        </p>
      </div>

      <div className="mt-5 text-[14px] text-slate-500">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          className="font-semibold text-green-600 hover:text-green-700"
        >
          Sign up
        </button>
      </div>
    </div>
  );
};

export default EmailStep;