export default function RiactDemoLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">{children}</div>
  );
}
