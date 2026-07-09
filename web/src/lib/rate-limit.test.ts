import { describe, expect, it } from "vitest";
import { clientFingerprint } from "./rate-limit";

describe("clientFingerprint", () => {
  it("uses the first forwarded address and never returns the raw IP", () => {
    const result = clientFingerprint("203.0.113.7, 10.0.0.1", "salt");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    expect(result).not.toContain("203.0.113.7");
  });

  it("is stable for the same client and salt", () => {
    expect(clientFingerprint("203.0.113.7", "salt")).toBe(
      clientFingerprint("203.0.113.7", "salt")
    );
  });

  it("returns null when the proxy supplied no address", () => {
    expect(clientFingerprint(null, "salt")).toBeNull();
  });
});
