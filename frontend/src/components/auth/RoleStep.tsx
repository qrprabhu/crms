import BrandHeader from "./BrandHeader";
import AuthButton from "./AuthButton";

export type UserRole = "admin" | "manager" | "employee";

type RoleConfig = {
  label: string;
  description: string;
  access: string[];
  gradient: string;
  border: string;
  bg: string;
  badge: string;
  icon: React.ReactNode;
};

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  admin: {
    label: "Admin",
    description: "Full organization access",
    access: ["All users & records", "Assign any task", "Manage roles & settings"],
    gradient: "from-green-600 to-green-700",
    border: "border-blue-200",
    bg: "bg-green-50",
    badge: "bg-green-100 text-green-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  manager: {
    label: "Manager",
    description: "Team & leads access",
    access: ["Your team's leads & tasks", "Assign tasks to team", "View team performance"],
    gradient: "from-violet-600 to-purple-700",
    border: "border-violet-200",
    bg: "bg-violet-50",
    badge: "bg-violet-100 text-violet-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  employee: {
    label: "Employee",
    description: "Personal records access",
    access: ["Your own leads & contacts", "Assigned tasks only", "Personal activity log"],
    gradient: "from-emerald-500 to-teal-600",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
};

type RoleStepProps = {
  email: string;
  role: UserRole;
  onContinue: () => void;
  onBack: () => void;
};

const RoleStep = ({ email, role, onContinue, onBack }: RoleStepProps) => {
  const config = ROLE_CONFIG[role];

  return (
    <div>
      <BrandHeader />

      {/* Email chip */}
      <div className="mb-5 flex items-center gap-3">
        <div className="max-w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[14px] text-slate-700 truncate">
          {email}
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-[14px] font-semibold text-green-600 hover:text-green-700"
        >
          Change
        </button>
      </div>

      {/* Role card */}
      <div className={`mb-5 rounded-2xl border-2 ${config.border} ${config.bg} p-5`}>
        {/* Icon + label row */}
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradient} text-white shadow-sm`}>
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">{config.label}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.badge}`}>
                Your Role
              </span>
            </div>
            <p className="text-sm text-slate-500">{config.description}</p>
          </div>
        </div>

        {/* Access list */}
        <ul className="space-y-1.5">
          {config.access.map((item) => (
            <li key={item} className="flex items-center gap-2 text-[13px] text-slate-600">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br ${config.gradient}`} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mb-5 text-[13px] text-slate-500">
        You are signing in with <span className="font-semibold text-slate-700">{config.label}</span> access.
        Your data will be scoped accordingly.
      </p>

      <AuthButton onClick={onContinue}>
        Continue as {config.label}
      </AuthButton>
    </div>
  );
};

export default RoleStep;
