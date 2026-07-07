import { describe, it, expect, vi } from "vitest";
import { isExpired, keysForJob, runCleanup } from "../src/cleanup.js";

describe("isExpired", () => {
  const now = new Date("2026-07-07T12:00:00Z");

  it("is false within 24h", () => {
    expect(isExpired(new Date("2026-07-06T13:00:00Z"), now)).toBe(false);
  });

  it("is true after 24h", () => {
    expect(isExpired(new Date("2026-07-06T11:59:00Z"), now)).toBe(true);
  });

  it("is false exactly at 24h", () => {
    expect(isExpired(new Date("2026-07-06T12:00:00Z"), now)).toBe(false);
  });
});

describe("keysForJob", () => {
  it("includes the upload key and both result variants", () => {
    expect(keysForJob({ id: "abc", meta: { input_key: "uploads/abc.mp4" } })).toEqual([
      "uploads/abc.mp4",
      "results/abc.mp4",
      "results/abc-wm.mp4",
    ]);
  });

  it("omits the upload key when the job has none", () => {
    expect(keysForJob({ id: "abc", meta: {} })).toEqual([
      "results/abc.mp4",
      "results/abc-wm.mp4",
    ]);
  });

  it("ignores a non-string input_key", () => {
    expect(keysForJob({ id: "abc", meta: { input_key: 42 } })).toEqual([
      "results/abc.mp4",
      "results/abc-wm.mp4",
    ]);
  });
});

describe("runCleanup", () => {
  const expiredRows = [
    { id: "job-1", meta: { input_key: "uploads/job-1.mp4" } },
    { id: "job-2", meta: {} },
  ];

  function makeQuery() {
    return vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("select")) return { rows: expiredRows };
      return { rows: [], params };
    });
  }

  it("deletes every key and scrubs each job row", async () => {
    const query = makeQuery();
    const deleteObject = vi.fn(async () => {});
    const result = await runCleanup({ query, deleteObject, log: () => {} });

    expect(result.jobs).toBe(2);
    expect(result.deletedKeys).toEqual([
      "uploads/job-1.mp4",
      "results/job-1.mp4",
      "results/job-1-wm.mp4",
      "results/job-2.mp4",
      "results/job-2-wm.mp4",
    ]);
    expect(result.failedKeys).toEqual([]);

    // one select + one scrub update per job
    const updates = query.mock.calls.filter(([sql]) => sql.includes("update jobs"));
    expect(updates.map(([, params]) => params)).toEqual([["job-1"], ["job-2"]]);
    // scrub sets meta.deleted and clears urls
    expect(updates[0][0]).toContain(`"deleted": true`);
    expect(updates[0][0]).toContain("result_url = null");
  });

  it("still scrubs the row when a delete fails, and reports the failure", async () => {
    const query = makeQuery();
    const deleteObject = vi.fn(async (key: string) => {
      if (key === "results/job-1.mp4") throw new Error("boom");
    });
    const logs: string[] = [];
    const result = await runCleanup({ query, deleteObject, log: (m) => logs.push(m) });

    expect(result.jobs).toBe(2);
    expect(result.failedKeys).toEqual(["results/job-1.mp4"]);
    expect(result.deletedKeys).toHaveLength(4);
    expect(logs.some((l) => l.includes("FAILED to delete results/job-1.mp4"))).toBe(true);
    expect(logs.some((l) => l.includes("scrubbed job job-1"))).toBe(true);
  });

  it("does nothing when no jobs are expired", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const deleteObject = vi.fn(async () => {});
    const result = await runCleanup({ query, deleteObject, log: () => {} });
    expect(result.jobs).toBe(0);
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
