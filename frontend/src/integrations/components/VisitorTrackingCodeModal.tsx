import CRMModalBase from "../../components/crm/CRMModalBase";
import { formatTrackingCode } from "../utils";

type Props = {
  open: boolean;
  portalName?: string;
  trackingCode?: string | null;
  onClose: () => void;
};

export default function VisitorTrackingCodeModal({ open, portalName, trackingCode, onClose }: Props) {
  return (
    <CRMModalBase
      open={open}
      title={`Tracking Code${portalName ? ` - ${portalName}` : ""}`}
      footer={<button type="button" onClick={onClose} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">Close</button>}
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Copy this tracking code into your website head or share it with your webmaster.</p>
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
          <code>{formatTrackingCode(trackingCode)}</code>
        </pre>
      </div>
    </CRMModalBase>
  );
}
