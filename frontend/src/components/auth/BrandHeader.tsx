const BrandHeader = () => {
  return (
    <div className="mb-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-green-400 via-green-500 to-green-700 text-sm font-bold text-white shadow-lg">
          SSH
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            SSH CONNECT
          </h1>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
            CRM
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Sign in
        </h2>
        <p className="mt-1 text-base text-slate-600">to access CRM</p>
      </div>
    </div>
  );
};

export default BrandHeader;
