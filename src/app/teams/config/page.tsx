/**
 * Epic 1 Story 1.6: Teams App config tab
 * Loaded when adding ComplyVault to a team or group chat
 */

export default function TeamsConfigPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold">ComplyVault</h1>
        <p className="text-muted-foreground text-sm">
          Add ComplyVault to this team to generate audit packs from meeting recordings. The app will
          appear in the meeting sidebar.
        </p>
        <p className="text-sm text-muted-foreground">
          Click &quot;Add&quot; to install. You can generate audit packs, view the last pack, and
          check status directly from your Teams meetings.
        </p>
      </div>
    </div>
  );
}
