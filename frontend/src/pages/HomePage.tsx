import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Mail as MailIcon,
  Plus,
  ChevronDown,
  User,
  Briefcase,
  Trophy,
  Wallet,
  Calendar,
  CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../hooks/useAuth";
import { getHomeDashboard, type HomeDashboardResponse } from "../lib/api/dashboardApi";
import { readDashboardCache, writeDashboardCache } from "../lib/dashboardCache";

const HOME_CACHE_KEY = "home-customer-command-center-v1";
const HOME_CACHE_TTL_MS = 5 * 60 * 1000;



const lineData = [
  { name: "Mon", value: 35000 },
  { name: "Tue", value: 52000 },
  { name: "Wed", value: 42000 },
  { name: "Thu", value: 68000 },
  { name: "Fri", value: 58000 },
  { name: "Sat", value: 85000 },
  { name: "Sun", value: 72000 },
];

const pieData = [
  { name: "Website", value: 35, color: "#2563EB" },
  { name: "Referral", value: 25, color: "#16A34A" },
  { name: "Social Media", value: 20, color: "#0EA5E9" },
  { name: "Email Campaign", value: 12, color: "#EF4444" },
  { name: "Others", value: 8, color: "#8B5CF6" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [initialCache] = useState(() => readDashboardCache<HomeDashboardResponse>(HOME_CACHE_KEY, HOME_CACHE_TTL_MS));

  // Dynamic interactive state for Tasks checklist
  const [tasks, setTasks] = useState([
    { id: 1, text: "Call back to Alex", time: "Today, 11:00 AM", priority: "High", done: false },
    { id: 2, text: "Send proposal to customer", time: "Today, 02:00 PM", priority: "Medium", done: false },
    { id: 3, text: "Prepare demo for new lead", time: "Tomorrow, 10:00 AM", priority: "Low", done: false },
    { id: 4, text: "Follow up with marketing team", time: "Tomorrow, 03:00 PM", priority: "Low", done: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const nextState = await getHomeDashboard(2 * 60 * 1000);
        if (!active) return;
        writeDashboardCache(HOME_CACHE_KEY, nextState);
      } catch (err) {
        // ignore errors
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [initialCache?.state]);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="mt-0.5 text-sm text-slate-500 font-medium">Welcome back, {user?.name || "Harish"}! 👋</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-full max-w-[200px] lg:max-w-[240px]">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="Search anything..."
                className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 py-1.5 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/10"
              />
            </div>

            {/* Quick Actions & Notifications */}
            <button
              onClick={() => navigate("/leads/create")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-white hover:bg-blue-700 transition shadow-sm"
              title="Add Lead"
            >
              <Plus size={16} />
            </button>

            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition">
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#EF4444]"></span>
            </button>

            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition">
              <MailIcon size={15} />
            </button>

            <div className="h-6 w-[1px] bg-slate-200"></div>

            {/* User Profile */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "HN"}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-semibold text-slate-800">{user?.name || "Harish N"}</div>
                <div className="text-slate-400 capitalize">{user?.role || "Admin"}</div>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-slate-200"></div>

            {/* Date Dropdown */}
            <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <Calendar size={13} className="text-slate-500" />
              <span>Jul 21, 2025 - Jul 27, 2025</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1 */}
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
              <h2 className="mt-1.5 text-2xl font-extrabold text-slate-900 tracking-tight">1,248</h2>
              <span className="mt-1 inline-flex items-center text-xs font-semibold text-[#16A34A]">
                ↑ 18.6% <span className="text-slate-400 font-medium ml-1">vs last week</span>
              </span>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
              <User size={20} />
            </div>
          </article>

          {/* Card 2 */}
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Deals</span>
              <h2 className="mt-1.5 text-2xl font-extrabold text-slate-900 tracking-tight">532</h2>
              <span className="mt-1 inline-flex items-center text-xs font-semibold text-[#16A34A]">
                ↑ 12.4% <span className="text-slate-400 font-medium ml-1">vs last week</span>
              </span>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-[#16A34A]">
              <Briefcase size={20} />
            </div>
          </article>

          {/* Card 3 */}
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Won Deals</span>
              <h2 className="mt-1.5 text-2xl font-extrabold text-slate-900 tracking-tight">189</h2>
              <span className="mt-1 inline-flex items-center text-xs font-semibold text-[#16A34A]">
                ↑ 8.7% <span className="text-slate-400 font-medium ml-1">vs last week</span>
              </span>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-[#F59E0B]">
              <Trophy size={20} />
            </div>
          </article>

          {/* Card 4 */}
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Revenue</span>
              <h2 className="mt-1.5 text-2xl font-extrabold text-slate-900 tracking-tight">₹52,48,900</h2>
              <span className="mt-1 inline-flex items-center text-xs font-semibold text-[#16A34A]">
                ↑ 16.3% <span className="text-slate-400 font-medium ml-1">vs last week</span>
              </span>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-50 text-[#8B5CF6]">
              <Wallet size={20} />
            </div>
          </article>
        </section>

        {/* Charts Row */}
        <section className="grid gap-6 md:grid-cols-3">
          
          {/* Funnel: Sales Pipeline */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.015)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Sales Pipeline</h3>
              <button className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                This Week <ChevronDown size={10} />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-4 h-full py-1">
              <div className="w-1/2 flex justify-center">
                <svg className="w-full max-w-[130px] h-[150px]" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Layer 1: New Lead */}
                  <polygon points="5,5 95,5 85,25 15,25" fill="#2563EB" opacity="0.95" />
                  {/* Layer 2: Qualified */}
                  <polygon points="17,28 83,28 75,48 25,48" fill="#16A34A" opacity="0.95" />
                  {/* Layer 3: Proposal */}
                  <polygon points="27,51 73,51 65,71 35,71" fill="#0EA5E9" opacity="0.95" />
                  {/* Layer 4: Negotiation */}
                  <polygon points="37,74 63,74 55,94 45,94" fill="#EF4444" opacity="0.95" />
                  {/* Layer 5: Won */}
                  <polygon points="47,97 53,97 53,117 47,117" fill="#8B5CF6" opacity="0.95" />
                </svg>
              </div>
              
              <div className="w-1/2 flex flex-col justify-center space-y-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB]"></span>
                    New Lead
                  </div>
                  <span className="font-extrabold text-slate-800">320 (25%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-[#16A34A]"></span>
                    Qualified
                  </div>
                  <span className="font-extrabold text-slate-800">250 (20%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-[#0EA5E9]"></span>
                    Proposal
                  </div>
                  <span className="font-extrabold text-slate-800">180 (15%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-[#EF4444]"></span>
                    Negotiation
                  </div>
                  <span className="font-extrabold text-slate-800">140 (10%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-[#8B5CF6]"></span>
                    Won
                  </div>
                  <span className="font-extrabold text-slate-800">189 (30%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Area Chart: Deals Overview */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.015)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Deals Overview</h3>
              <button className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                This Week <ChevronDown size={10} />
              </button>
            </div>

            <div className="flex-1 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => typeof value === "number" ? `₹${value.toLocaleString()}` : String(value || "")} />
                  <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie: Top Sources */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.015)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Top Sources</h3>
              <button className="h-5 w-5 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded">
                <ChevronDown size={12} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-between gap-4 h-full">
              <div className="w-1/2 min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-1/2 flex flex-col justify-center space-y-2 text-[11px]">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      {item.name}
                    </div>
                    <span className="font-extrabold text-slate-800">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </section>

        {/* Detailed Panels Row */}
        <section className="grid gap-6 md:grid-cols-3">
          
          {/* Panel 1: Recent Activities */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.015)] flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Activities</h3>
              <button onClick={() => navigate("/calendar")} className="text-xs font-semibold text-blue-600 hover:underline">
                View all activities
              </button>
            </div>

            <div className="flex-1 relative pl-5 space-y-5 border-l border-slate-100">
              
              {/* Activity 1 */}
              <div className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#2563EB] ring-4 ring-blue-50"></span>
                <div className="text-xs font-bold text-slate-800">Follow up call with TechNova Solutions</div>
                <div className="mt-1 text-[11px] text-slate-400 font-semibold">
                  Harish N • <span className="text-[#16A34A]">Today, 10:30 AM</span>
                </div>
              </div>

              {/* Activity 2 */}
              <div className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#16A34A] ring-4 ring-green-50"></span>
                <div className="text-xs font-bold text-slate-800">Demo scheduled with BrightEdge</div>
                <div className="mt-1 text-[11px] text-slate-400 font-semibold">
                  Shiva • <span className="text-[#16A34A]">Today, 09:15 AM</span>
                </div>
              </div>

              {/* Activity 3 */}
              <div className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#0EA5E9] ring-4 ring-sky-50"></span>
                <div className="text-xs font-bold text-slate-800">Proposal sent to Wave Enterprises</div>
                <div className="mt-1 text-[11px] text-slate-400 font-semibold">
                  Karthik • Yesterday, 04:45 PM
                </div>
              </div>

              {/* Activity 4 */}
              <div className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#F59E0B] ring-4 ring-amber-50"></span>
                <div className="text-xs font-bold text-slate-800">New lead added - NextGen Tech</div>
                <div className="mt-1 text-[11px] text-slate-400 font-semibold">
                  Priya • Yesterday, 02:30 PM
                </div>
              </div>

            </div>
          </div>

          {/* Panel 2: Tasks Checklist */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.015)] flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tasks</h3>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                  All <ChevronDown size={10} />
                </button>
                <button onClick={() => navigate("/tasks")} className="text-xs font-semibold text-blue-600 hover:underline">
                  View all tasks
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="mt-0.5 text-slate-400 hover:text-blue-600 transition shrink-0"
                    >
                      {task.done ? (
                        <CheckCircle2 size={16} className="text-[#16A34A]" />
                      ) : (
                        <div className="h-4 w-4 rounded border border-slate-300 hover:border-blue-500"></div>
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className={`text-xs font-bold text-slate-800 transition ${task.done ? "line-through text-slate-400" : ""}`}>
                        {task.text}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 font-semibold">{task.time}</div>
                    </div>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase shrink-0 ${
                      task.priority === "High"
                        ? "bg-red-50 text-[#EF4444]"
                        : task.priority === "Medium"
                        ? "bg-amber-50 text-[#F59E0B]"
                        : "bg-blue-50 text-[#2563EB]"
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3: Recent Deals */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.015)] flex flex-col min-h-[380px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Deals</h3>
              <button onClick={() => navigate("/deals")} className="text-xs font-semibold text-blue-600 hover:underline">
                View all
              </button>
            </div>

            <div className="flex-1 space-y-4">
              
              {/* Deal 1 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition">
                <div>
                  <div className="text-xs font-bold text-slate-800">TechNova Solutions</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-semibold">₹12,50,000</div>
                </div>
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#16A34A]">
                  Won
                </span>
              </div>

              {/* Deal 2 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition">
                <div>
                  <div className="text-xs font-bold text-slate-800">BrightEdge Systems</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-semibold">₹8,75,000</div>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#F59E0B]">
                  Negotiation
                </span>
              </div>

              {/* Deal 3 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition">
                <div>
                  <div className="text-xs font-bold text-slate-800">Wave Enterprises</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-semibold">₹15,20,000</div>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#2563EB]">
                  Proposal
                </span>
              </div>

              {/* Deal 4 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition">
                <div>
                  <div className="text-xs font-bold text-slate-800">NextGen Tech</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-semibold">₹6,45,000</div>
                </div>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#8B5CF6]">
                  Qualified
                </span>
              </div>

            </div>
          </div>

        </section>

      </div>
    </DashboardLayout>
  );
}
