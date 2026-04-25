/**
 * GET /api/integrations/teams/manifest
 * Epic 1 Story 1.6: Generate Teams App manifest with dynamic app URL
 */

import { NextResponse } from "next/server";
import { requireAppAccess } from "~/server/auth/guards";

export async function GET() {
  const access = await requireAppAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.session.user.role !== "OWNER_CCO") {
    return NextResponse.json({ error: "Only workspace owners can access manifest" }, { status: 403 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://app.complyvault.co";
  const appUrl = baseUrl.replace(/\/$/, "");

  const manifest = {
    $schema: "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
    manifestVersion: "1.16",
    version: "1.0.0",
    id: "00000000-0000-0000-0000-000000000000",
    packageName: "com.complyvault.app",
    developer: {
      name: "ComplyVault",
      websiteUrl: "https://complyvault.co",
      privacyUrl: "https://complyvault.co/privacy",
      termsOfUseUrl: "https://complyvault.co/terms",
    },
    name: {
      short: "ComplyVault",
      full: "ComplyVault Compliance",
    },
    description: {
      short: "Generate audit packs from Teams meetings",
      full:
        "ComplyVault automatically generates exam-ready client interaction records from your Teams meeting recordings. Generate Audit Pack, View Last Audit Pack, Check Status.",
    },
    icons: {
      color: "color.png",
      outline: "outline.png",
    },
    accentColor: "#000000",
    configurableTabs: [
      {
        configurationUrl: `${appUrl}/teams/config`,
        scopes: ["team", "groupchat"],
        context: ["meetingSidePanel", "meetingDetails"],
        meetingSurfaces: [
          {
            surface: "meetingSidePanel",
            contentUrl: `${appUrl}/teams/sidepanel`,
          },
        ],
      },
    ],
    bots: [],
    connectors: [],
    composeExtensions: [],
    permissions: ["identity", "messageTeamMembers"],
    validDomains: (() => {
      try {
        const host = new URL(appUrl).hostname;
        return host === "localhost" ? ["localhost", "complyvault.co"] : [host, "complyvault.co"];
      } catch {
        return ["app.complyvault.co", "complyvault.co"];
      }
    })(),
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Disposition": 'attachment; filename="complyvault-manifest.json"',
    },
  });
}
