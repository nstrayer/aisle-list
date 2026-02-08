export const IMAGE_PROCESSING = {
  MAX_LONGEST_EDGE: 1568, // API auto-downscales above this anyway
  MAX_BASE64_BYTES: 5 * 1024 * 1024, // 5MB API limit
  INITIAL_QUALITY: 0.85,
  MIN_QUALITY: 0.4,
  QUALITY_STEP: 0.1,
  FALLBACK_LONGEST_EDGE: 1092, // API's optimal size, last resort
} as const;

/**
 * Scales dimensions proportionally so the longest edge fits within maxLongestEdge.
 * Returns original dimensions if already under the limit. Never upscales.
 */
export function calculateDimensions(
  width: number,
  height: number,
  maxLongestEdge: number = IMAGE_PROCESSING.MAX_LONGEST_EDGE
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= maxLongestEdge) {
    return { width, height };
  }

  const scale = maxLongestEdge / longestEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Calculates the decoded byte count from a base64 string without decoding it.
 * Accounts for padding characters.
 */
export function base64ByteSize(base64: string): number {
  if (base64.length === 0) {
    return 0;
  }

  let padding = 0;
  if (base64.endsWith("==")) {
    padding = 2;
  } else if (base64.endsWith("=")) {
    padding = 1;
  }

  return (base64.length * 3) / 4 - padding;
}

/**
 * Resizes an image file on a canvas and returns JPEG base64 (no data URL prefix).
 */
async function resizeImageOnCanvas(
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<string> {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2d context");
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Preprocesses an image file for the Anthropic API:
 * - Resizes so longest edge <= 1568px
 * - Compresses to JPEG
 * - Progressively reduces quality if result > 5MB
 * - Falls back to smaller dimensions (1092px) as last resort
 *
 * Returns base64 string (no data URL prefix) and media type.
 */
export async function preprocessImageForApi(
  file: File
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const { width: naturalWidth, height: naturalHeight } = bitmap;

  // Calculate target dimensions
  let { width, height } = calculateDimensions(naturalWidth, naturalHeight);

  // Try progressively lower quality levels
  let quality = IMAGE_PROCESSING.INITIAL_QUALITY;
  let base64 = await resizeImageOnCanvas(bitmap, width, height, quality);

  while (
    base64ByteSize(base64) > IMAGE_PROCESSING.MAX_BASE64_BYTES &&
    quality > IMAGE_PROCESSING.MIN_QUALITY
  ) {
    quality -= IMAGE_PROCESSING.QUALITY_STEP;
    quality = Math.max(quality, IMAGE_PROCESSING.MIN_QUALITY);
    base64 = await resizeImageOnCanvas(bitmap, width, height, quality);
  }

  // Last resort: reduce dimensions to fallback size
  if (base64ByteSize(base64) > IMAGE_PROCESSING.MAX_BASE64_BYTES) {
    ({ width, height } = calculateDimensions(
      naturalWidth,
      naturalHeight,
      IMAGE_PROCESSING.FALLBACK_LONGEST_EDGE
    ));
    base64 = await resizeImageOnCanvas(
      bitmap,
      width,
      height,
      IMAGE_PROCESSING.MIN_QUALITY
    );
  }

  bitmap.close();

  return { base64, mediaType: "image/jpeg" };
}
