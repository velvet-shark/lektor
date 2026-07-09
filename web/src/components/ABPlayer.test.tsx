import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ABPlayer from "./ABPlayer";

Object.assign(globalThis, { React });

describe("ABPlayer", () => {
  it("does not preload gallery videos when their duration is known", () => {
    const html = renderToStaticMarkup(
      <ABPlayer
        originalUrl="/original.mp4"
        lektorUrl="/lektor.mp4"
        durationS={81}
        labels={{ original: "Original", lektor: "Lektor" }}
      />
    );

    expect(html.match(/preload="none"/g)).toHaveLength(2);
    expect(html).toContain("1:21");
    expect(html).not.toContain('preload="auto"');
  });

  it("preloads metadata when a dynamic clip has no known duration", () => {
    const html = renderToStaticMarkup(
      <ABPlayer
        originalUrl="/original.mp4"
        lektorUrl="/lektor.mp4"
        labels={{ original: "Original", lektor: "Lektor" }}
      />
    );

    expect(html.match(/preload="metadata"/g)).toHaveLength(2);
    expect(html).not.toContain('preload="auto"');
  });
});
