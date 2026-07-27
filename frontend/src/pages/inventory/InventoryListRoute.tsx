import InventoryListPage from "../../inventory/components/InventoryListPage";
import type { InventoryModuleKey } from "../../inventory/types";

type Props = { moduleKey: InventoryModuleKey };

export default function InventoryListRoute({ moduleKey }: Props) {
  return <InventoryListPage moduleKey={moduleKey} />;
}
