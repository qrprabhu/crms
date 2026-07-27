const PromoPanel = () => {
  return (
    <div className="relative hidden overflow-hidden border-l border-green-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] lg:flex lg:items-center lg:justify-center lg:px-8 lg:py-8">
      <div className="w-full max-w-[360px] rounded-[24px] border border-green-100 bg-white/70 px-6 py-6 shadow-[0_10px_28px_rgba(34,197,94,0.08)] backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-center rounded-[18px] bg-[#f0fdf4] p-4">
          <div className="relative flex h-[120px] w-[200px] items-center justify-center rounded-[18px] border-[4px] border-green-300 bg-white">
            <div className="absolute -left-4 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-lg shadow-md">
              🔐
            </div>

            <div className="absolute -right-4 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-green-400 text-lg shadow-md">
              ✨
            </div>

            <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] text-slate-400">Secure identity</p>
              <p className="mt-1 text-[14px] font-semibold leading-5 text-slate-800">
                Passwordless-
                <br />
                ready access
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-[26px] font-semibold leading-[1.15] tracking-tight text-slate-950">
            Smart and secure sign-in
          </h3>

          <p className="mt-3 text-[14px] leading-6 text-slate-600">
            Access ZORA CRM with a clean enterprise-grade experience designed
            for speed, trust, and productivity.
          </p>

          <button className="mt-6 rounded-full bg-green-50 px-6 py-2 text-[14px] font-semibold text-green-600 transition hover:bg-green-100">
            Learn more
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoPanel;
