/**
 * Feature flags for SignTutor v2.
 * All v2 features are off by default and can be enabled via:
 *   1. localStorage key "signtutor.flags" (user-controlled)
 *   2. URL query param ?flag=nmm,personalization (dev/testing)
 *   3. Environment variable NEXT_PUBLIC_FLAGS (build-time)
 *
 * Flags:
 *   nmm            - Non-manual marker scoring (W4)
 *   personalization - On-device adapter fine-tuning (W5)
 *   bsl            - BSL beta language (W7)
 *   continuous     - Continuous SLR research preview (W8)
 *   webgpu         - WebGPU execution provider (stretch goal)
 */

export type FeatureFlag =
  | "nmm"
  | "personalization"
  | "bsl"
  | "continuous"
  | "webgpu";

const BUILD_FLAGS = new Set<FeatureFlag>(
  (process.env.NEXT_PUBLIC_FLAGS ?? "").split(",").filter(Boolean) as FeatureFlag[]
);

function getStoredFlags(): Set<FeatureFlag> {
  if (typeof globalThis.localStorage === "undefined") return new Set();
  try {
    const raw = globalThis.localStorage.getItem("signtutor.flags");
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as FeatureFlag[]);
  } catch {
    return new Set();
  }
}

function getUrlFlags(): Set<FeatureFlag> {
  if (typeof globalThis.window === "undefined") return new Set();
  const params = new URLSearchParams(window.location.search);
  const flagParam = params.get("flag") ?? params.get("flags") ?? "";
  return new Set(flagParam.split(",").filter(Boolean) as FeatureFlag[]);
}

export function isEnabled(flag: FeatureFlag): boolean {
  if (BUILD_FLAGS.has(flag)) return true;
  if (getStoredFlags().has(flag)) return true;
  if (getUrlFlags().has(flag)) return true;
  return false;
}

export function enableFlag(flag: FeatureFlag): void {
  if (typeof globalThis.localStorage === "undefined") return;
  const flags = getStoredFlags();
  flags.add(flag);
  globalThis.localStorage.setItem("signtutor.flags", JSON.stringify([...flags]));
}

export function disableFlag(flag: FeatureFlag): void {
  if (typeof globalThis.localStorage === "undefined") return;
  const flags = getStoredFlags();
  flags.delete(flag);
  globalThis.localStorage.setItem("signtutor.flags", JSON.stringify([...flags]));
}

export function getAllFlags(): Record<FeatureFlag, boolean> {
  return {
    nmm:             isEnabled("nmm"),
    personalization: isEnabled("personalization"),
    bsl:             isEnabled("bsl"),
    continuous:      isEnabled("continuous"),
    webgpu:          isEnabled("webgpu"),
  };
}