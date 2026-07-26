import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { getMediaPostureState } from "~/server/retention/media-posture";
import { listParkedIngests } from "~/server/retention/parked-ingest";
import { countRetainedMedia } from "~/server/retention/purge-retained-media";
import { redirectPathForMissingWorkspace } from "~/server/workspace/no-workspace-redirect";
import { MediaPostureForm } from "./media-posture-form";
import { ParkedIngestList } from "./parked-ingest-list";
import { PurgeRetainedMediaCard } from "./purge-retained-media-card";

export default async function MediaPosturePage() {
  const session = await auth();

  if (!session?.user?.workspaceId) {
    if (!session?.user) {
      redirect("/auth/signin");
    }
    redirect(
      await redirectPathForMissingWorkspace(session.user.id, session.user.email),
    );
  }

  const workspaceId = session.user.workspaceId;
  const state = await getMediaPostureState(workspaceId);
  if (!state) {
    redirect("/dashboard");
  }

  const isCco = session.user.role === "OWNER_CCO";
  const parkedItems = await listParkedIngests(workspaceId);
  const retainedCount =
    state.posture === "DISCARD" ? await countRetainedMedia(workspaceId) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Source media policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose whether ComplyVault retains original meeting recordings after
          transcription. This is a documented policy position, so there is no default.
        </p>
      </div>

      <MediaPostureForm
        workspaceId={workspaceId}
        currentPosture={state.posture}
        postureSetAt={state.postureSetAt ? state.postureSetAt.toISOString() : null}
        readOnly={!isCco}
      />

      <ParkedIngestList
        workspaceId={workspaceId}
        items={parkedItems}
        postureSet={state.posture !== null}
        canReplay={isCco}
      />

      {isCco && retainedCount > 0 && (
        <PurgeRetainedMediaCard
          workspaceId={workspaceId}
          retainedCount={retainedCount}
        />
      )}
    </div>
  );
}
