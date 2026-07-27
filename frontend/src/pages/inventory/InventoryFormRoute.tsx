import InventoryFormPage from "../../inventory/components/InventoryFormPage";
import type { InventoryModuleKey } from "../../inventory/types";

type Props = { moduleKey: InventoryModuleKey };

export default function InventoryFormRoute({ moduleKey }: Props) {
  return <InventoryFormPage moduleKey={moduleKey} />;
}
