import { describe, expect, it } from 'vitest';
import { isSafeProfileAvatar } from '../profile-avatar';
describe('own profile photo privacy boundary', () => {
  it.each(['data:image/jpeg;base64,YWJj', 'data:image/png;base64,YWJj==', 'data:image/webp;base64,YWJj='])('accepts bounded raster data: %s', value => expect(isSafeProfileAvatar(value)).toBe(true));
  it.each(['https://tracking.example/photo', 'data:image/svg+xml;base64,YWJj', 'javascript:alert(1)', 'data:text/html;base64,YWJj', null, undefined, 'data:image/jpeg;base64,' + 'A'.repeat(120000)])('rejects network, active and oversized data', value => expect(isSafeProfileAvatar(value)).toBe(false));
});
