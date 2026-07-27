import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { EmailCredibilityMetric, EmailCredibilityReport } from "../types";
import { formatCredibilityScore } from "../utils";

type Props = {
  metrics: EmailCredibilityMetric[];
  report?: EmailCredibilityReport | null;
};

export default function EmailCredibilityDashboard({ metrics, report }: Props) {
  const latest = metrics[0];
  const chartData = metrics.slice(0, 6).map((item) => ({
    period: item.report_period_end,
    delivered: item.delivered_count,
    bounced: item.bounced_count,
  })).reverse();

  return (
    <CRMSectionCard title="Email Credibility">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Credibility Score", value: formatCredibilityScore(latest?.score) },
            { label: "Spam Complaints", value: String(latest?.spam_complaints ?? report?.spam_complaints ?? 0) },
            { label: "Bounce Volume", value: String(latest?.bounce_volume ?? 0) },
            { label: "Total Sent", value: String(latest?.total_sent ?? report?.total_sent ?? 0) },
            { label: "Delivered", value: String(latest?.delivered_count ?? report?.delivered_count ?? 0) },
            { label: "Bounced", value: String(latest?.bounced_count ?? report?.bounced_count ?? 0) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
        <div className="h-[260px] rounded-xl border border-slate-200 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="period" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="delivered" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="bounced" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </CRMSectionCard>
  );
}

