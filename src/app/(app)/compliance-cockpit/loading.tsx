export default function ComplianceCockpitLoading(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-16 rounded-lg bg-surface-border" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_240px]">
        <div className="h-48 rounded-lg bg-surface-border" />
        <div className="h-96 rounded-lg bg-surface-border" />
        <div className="h-64 rounded-lg bg-surface-border" />
      </div>
    </div>
  );
}
