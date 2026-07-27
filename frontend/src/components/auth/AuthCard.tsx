import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
};

const AuthCard = ({ children }: AuthCardProps) => {
  return (
    <div className="flex items-center justify-center px-5 py-6 sm:px-8 sm:py-8">
      <div className="w-full max-w-[340px]">{children}</div>
    </div>
  );
};

export default AuthCard;