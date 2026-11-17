/** Own profile images are raster data, never a third-party host or SVG. */
export function isSafeProfileAvatar(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 120_000
    && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
