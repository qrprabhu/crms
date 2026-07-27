type AuthInputProps = {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
};

const AuthInput = ({
  type = "text",
  value,
  onChange,
  placeholder,
  error,
}: AuthInputProps) => {
  return (
    <div className="w-full">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-[44px] w-full rounded-[12px] border bg-white px-4 text-[15px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-300 focus:border-green-500 focus:ring-blue-100"
        }`}
      />
      {error ? (
        <p className="mt-2 text-[14px] font-medium text-red-500">{error}</p>
      ) : null}
    </div>
  );
};

export default AuthInput;