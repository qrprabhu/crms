type CRMEmptyStateProps = {
  message: string;
};

export default function CRMEmptyState({ message }: CRMEmptyStateProps) {
  return <p className="text-sm text-slate-500">{message}</p>;
}
