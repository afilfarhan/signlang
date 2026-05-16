/**
 * Feature flags unit tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isEnabled, enableFlag, disableFlag, getAllFlags } from "../featureFlags";

describe("featureFlags", () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    // Mock window.location.search
    vi.stubGlobal("window", { location: { search: "" } });
  });

  it("all flags are off by default", () => {
    const flags = getAllFlags();
    expect(flags.nmm).toBe(false);
    expect(flags.personalization).toBe(false);
    expect(flags.bsl).toBe(false);
    expect(flags.continuous).toBe(false);
    expect(flags.webgpu).toBe(false);
  });

  it("enableFlag persists to localStorage", () => {
    enableFlag("nmm");
    expect(isEnabled("nmm")).toBe(true);
  });

  it("disableFlag removes from localStorage", () => {
    enableFlag("personalization");
    expect(isEnabled("personalization")).toBe(true);
    disableFlag("personalization");
    expect(isEnabled("personalization")).toBe(false);
  });

  it("enabling one flag does not affect others", () => {
    enableFlag("bsl");
    expect(isEnabled("bsl")).toBe(true);
    expect(isEnabled("nmm")).toBe(false);
    expect(isEnabled("continuous")).toBe(false);
  });

  it("getAllFlags reflects current state", () => {
    enableFlag("webgpu");
    enableFlag("nmm");
    const flags = getAllFlags();
    expect(flags.webgpu).toBe(true);
    expect(flags.nmm).toBe(true);
    expect(flags.personalization).toBe(false);
  });
});