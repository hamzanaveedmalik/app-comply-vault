import { redirect } from "next/navigation";

/** Canonical workspace settings live at `/settings`; design doc links here. */
export default function WorkspaceSettingsAliasPage() {
  redirect("/settings");
}
