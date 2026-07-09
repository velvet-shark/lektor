import { describe, expect, it, vi } from "vitest";
import { PROCESSING_STATUSES, recoverStaleJobs, requeueActiveJobs } from "../src/queue.js";

describe("worker queue recovery", () => {
  it("returns stale processing jobs to the queue on startup", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "job-1" }, { id: "job-2" }] }));

    await expect(recoverStaleJobs(query, 45)).resolves.toEqual(["job-1", "job-2"]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("started_at < now()"),
      [[...PROCESSING_STATUSES], 45]
    );
  });

  it("requeues only active jobs during shutdown", async () => {
    const query = vi.fn(async () => ({ rows: [{ id: "job-1" }] }));

    await expect(requeueActiveJobs(query, ["job-1"])).resolves.toEqual(["job-1"]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("id = any($1::uuid[])"),
      [["job-1"], [...PROCESSING_STATUSES]]
    );
  });

  it("does not query the database when there is no active work", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    await expect(requeueActiveJobs(query, [])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
