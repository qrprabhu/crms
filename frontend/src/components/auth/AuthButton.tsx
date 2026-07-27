import type { ButtonHTMLAttributes, ReactNode } from "react";

type AuthButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

const AuthButton = ({
  children,
  className = "",
  ...props
}: AuthButtonProps) => {
  return (
    <button
      {...props}
      className={`flex h-[44px] w-full items-center justify-center rounded-[12px] bg-gradient-to-r from-green-500 to-green-600 text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(34,197,94,0.22)] transition hover:from-green-600 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {children}
    </button>
  );
};

export default AuthButton;