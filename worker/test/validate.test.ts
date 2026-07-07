import { describe, it, expect } from "vitest";
import { parseProbe, validateInput, MAX_DURATION_S } from "../src/validate.js";

const probeJson = (opts: {
  duration?: string;
  streams?: { codec_type?: string; duration?: string }[];
}) =>
  JSON.stringify({
    format: opts.duration !== undefined ? { duration: opts.duration } : {},
    streams: opts.streams ?? [],
  });

describe("parseProbe", () => {
  it("reads duration and stream types from ffprobe json", () => {
    const info = parseProbe(
      probeJson({
        duration: "42.5",
        streams: [{ codec_type: "video" }, { codec_type: "audio" }],
      })
    );
    expect(info.durationS).toBe(42.5);
    expect(info.hasAudio).toBe(true);
    expect(info.hasVideo).toBe(true);
  });

  it("detects missing audio stream", () => {
    const info = parseProbe(probeJson({ duration: "10", streams: [{ codec_type: "video" }] }));
    expect(info.hasAudio).toBe(false);
    expect(info.hasVideo).toBe(true);
  });

  it("falls back to stream durations when format duration is missing", () => {
    const info = parseProbe(
      probeJson({
        streams: [
          { codec_type: "video", duration: "31.2" },
          { codec_type: "audio", duration: "30.9" },
        ],
      })
    );
    expect(info.durationS).toBe(31.2);
  });

  it("throws on unparseable output", () => {
    expect(() => parseProbe("not json")).toThrow(/unparseable/);
  });
});

describe("validateInput", () => {
  const ok = { durationS: 60, hasAudio: true, hasVideo: true };

  it("accepts a valid clip", () => {
    expect(validateInput(ok)).toBeNull();
  });

  it("accepts a clip exactly at the limit", () => {
    expect(validateInput({ ...ok, durationS: MAX_DURATION_S })).toBeNull();
  });

  it("rejects clips over 90s with a friendly message", () => {
    expect(validateInput({ ...ok, durationS: 90.5 })).toMatch(/too long: 91s \(max 90s\)/);
  });

  it("rejects clips with no audio stream", () => {
    expect(validateInput({ ...ok, hasAudio: false })).toBe("This clip has no audio track");
  });

  it("rejects files with no video stream", () => {
    expect(validateInput({ ...ok, hasVideo: false })).toMatch(/does not contain a video/);
  });

  it("rejects zero/unknown duration", () => {
    expect(validateInput({ ...ok, durationS: 0 })).toMatch(/duration/);
    expect(validateInput({ ...ok, durationS: NaN })).toMatch(/duration/);
  });
});
