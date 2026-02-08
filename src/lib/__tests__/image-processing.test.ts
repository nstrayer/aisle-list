import { describe, it, expect } from "vitest";
import {
  calculateDimensions,
  base64ByteSize,
  IMAGE_PROCESSING,
} from "../image-processing";

describe("calculateDimensions", () => {
  it("returns original dimensions when already small", () => {
    expect(calculateDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("returns original dimensions when exactly at limit", () => {
    expect(calculateDimensions(1568, 1000)).toEqual({
      width: 1568,
      height: 1000,
    });
  });

  it("scales down landscape images by longest edge", () => {
    expect(calculateDimensions(4000, 3000)).toEqual({
      width: 1568,
      height: 1176,
    });
  });

  it("scales down portrait images by longest edge", () => {
    expect(calculateDimensions(3000, 4000)).toEqual({
      width: 1176,
      height: 1568,
    });
  });

  it("scales down square images", () => {
    expect(calculateDimensions(3000, 3000)).toEqual({
      width: 1568,
      height: 1568,
    });
  });

  it("handles typical iPhone photo dimensions", () => {
    expect(calculateDimensions(4032, 3024)).toEqual({
      width: 1568,
      height: 1176,
    });
  });

  it("handles tiny 1x1 images without upscaling", () => {
    expect(calculateDimensions(1, 1)).toEqual({ width: 1, height: 1 });
  });

  it("preserves aspect ratio within 1% for non-clean ratios", () => {
    const result = calculateDimensions(5000, 3333);
    const originalRatio = 5000 / 3333;
    const resultRatio = result.width / result.height;
    const drift = Math.abs(resultRatio - originalRatio) / originalRatio;
    expect(drift).toBeLessThan(0.01);
  });

  it("uses custom maxLongestEdge for fallback dimension path", () => {
    expect(calculateDimensions(2000, 1500, 1092)).toEqual({
      width: 1092,
      height: 819,
    });
  });

  it("does not upscale small images", () => {
    expect(calculateDimensions(500, 300)).toEqual({ width: 500, height: 300 });
  });
});

describe("base64ByteSize", () => {
  it('computes correct size for "Hello" (SGVsbG8=)', () => {
    expect(base64ByteSize("SGVsbG8=")).toBe(5);
  });

  it('computes correct size for "abc" with no padding (YWJj)', () => {
    expect(base64ByteSize("YWJj")).toBe(3);
  });

  it('computes correct size for "a" with double padding (YQ==)', () => {
    expect(base64ByteSize("YQ==")).toBe(1);
  });

  it("returns 0 for empty string", () => {
    expect(base64ByteSize("")).toBe(0);
  });

  it("computes correct size for 300 bytes", () => {
    const buf = Buffer.alloc(300, 0x42);
    const b64 = buf.toString("base64");
    expect(base64ByteSize(b64)).toBe(300);
  });

  it("matches Buffer.from for real base64 data", () => {
    // Simulate a small JPEG-like payload
    const buf = Buffer.alloc(1024, 0xff);
    const b64 = buf.toString("base64");
    const actual = Buffer.from(b64, "base64").length;
    expect(base64ByteSize(b64)).toBe(actual);
  });

  it("correctly identifies data over 5MB limit", () => {
    // 5MB + 1 byte
    const size = IMAGE_PROCESSING.MAX_BASE64_BYTES + 1;
    const buf = Buffer.alloc(size, 0x00);
    const b64 = buf.toString("base64");
    expect(base64ByteSize(b64)).toBeGreaterThan(IMAGE_PROCESSING.MAX_BASE64_BYTES);
  });
});

describe("preprocessImageForApi", () => {
  it.todo(
    "canvas-dependent -- covered by E2E tests (npm run test:e2e)"
  );
});
