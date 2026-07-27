import { getStatusBadgeClass } from "../utils";

type Props = {
  label: string;
  value?: string | boolean | null;
};

export default function IntegrationStatusBadge({ label, value }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(value ?? label)}`}>
      {label}
    </span>
  );
}

