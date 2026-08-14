import { generateUuid, getOrCreatePathUuid } from '../../utils/pathIdUtils';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateUuid', () => {
  it('produces a valid v4 UUID', () => {
    expect(generateUuid()).toMatch(UUID_V4_RE);
  });

  it('is effectively unique across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateUuid()));
    expect(set.size).toBe(1000);
  });
});

describe('getOrCreatePathUuid', () => {
  it('creates and maps a UUID on first use', () => {
    const { pathUuid, pathUuids } = getOrCreatePathUuid(1, {});
    expect(pathUuid).toMatch(UUID_V4_RE);
    expect(pathUuids[1]).toBe(pathUuid);
  });

  it('returns the existing UUID and the same map on later use', () => {
    const existing = { 1: '11111111-2222-4333-8444-555555555555' };
    const result = getOrCreatePathUuid(1, existing);
    expect(result.pathUuid).toBe(existing[1]);
    expect(result.pathUuids).toBe(existing);
  });
});
