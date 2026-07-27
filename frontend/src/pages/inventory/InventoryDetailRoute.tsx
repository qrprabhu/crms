import InventoryDetailPage from "../../inventory/components/InventoryDetailPage";
import type { InventoryModuleKey } from "../../inventory/types";

type Props = { moduleKey: InventoryModuleKey };

export default function InventoryDetailRoute({ moduleKey }: Props) {
  return <InventoryDetailPage moduleKey={moduleKey} />;
}
