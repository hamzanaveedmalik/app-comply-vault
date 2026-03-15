/**
 * IntegrationHub — Central export and adapter registry
 * Epic 6 Story 6.1a: Module boundaries and folder structure
 */

export * from "./types";
export { BaseIntegrationAdapter } from "./base-adapter";

import { zoomAdapter } from "./adapters/zoom";

export const adapters = { zoom: zoomAdapter } as const;
