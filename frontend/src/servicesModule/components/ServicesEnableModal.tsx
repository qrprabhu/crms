import CRMModalBase from "../../components/crm/CRMModalBase";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfigure: () => void;
};

export default function ServicesEnableModal({ open, onClose, onConfigure }: Props) {
  return (
    <CRMModalBase
      open={open}
      title="Business hours not configured"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfigure}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
          >
            Configure Business hours
          </button>
        </>
      }
      maxWidthClassName="max-w-lg"
    >
      <p className="text-sm text-slate-600">
        To use Services module you need to configure business hours for your organisation.
      </p>
    </CRMModalBase>
  );
}

