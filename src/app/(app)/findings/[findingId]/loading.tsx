export default function FindingLoading(): React.JSX.Element {
  return (
    <div className="min-h-0 bg-surface-page px-6 py-6" aria-busy="true" aria-label="Loading finding">
      <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-4">
        <div className="h-4 w-40 rounded bg-[#eef0ee]" />
        <div className="h-8 w-80 rounded bg-[#e8ebe8]" />
        <div className="h-16 rounded-[8px] bg-[#eef0ee]" />
        <div className="h-40 rounded-[12px] border border-[#e6e8e6] bg-white" />
      </div>
    </div>
  );
}
