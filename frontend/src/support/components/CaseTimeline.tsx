import CRMTimeline from "../../components/crm/CRMTimeline";
import type { TimelineItem } from "../../lib/shared/crmTypes";

type Props = {
  items: TimelineItem[];
};

export default function CaseTimeline({ items }: Props) {
  return <CRMTimeline items={items} />;
}

