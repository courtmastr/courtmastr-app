import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn(() => 'query-ref');
const collectionMock = vi.fn(() => 'collection-ref');
const whereMock = vi.fn(() => 'where-ref');
const getDocsFromServerMock = vi.fn();
const getDocsMock = vi.fn();
const storageRefMock = vi.fn(() => 'storage-ref');
const getDownloadURLMock = vi.fn();

vi.mock('@/services/firebase', () => ({
  db: {},
  storage: {},
  collection: collectionMock,
  getDocs: getDocsMock,
  getDocsFromServer: getDocsFromServerMock,
  query: queryMock,
  where: whereMock,
  ref: storageRefMock,
  getDownloadURL: getDownloadURLMock,
}));

const createQuerySnapshot = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  docs,
  empty: docs.length === 0,
});

describe('usePublicSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('prefers a server read for snapshot metadata and fetches JSON with no-store', async () => {
    const { usePublicSnapshot } = await import('@/composables/usePublicSnapshot');
    const { loadBySlug, snapshot, error } = usePublicSnapshot();

    getDocsFromServerMock.mockResolvedValue(
      createQuerySnapshot([
        {
          id: 't-1',
          data: () => ({
            publicSnapshot: {
              storageUrl: 'https://example.com/latest.json',
            },
          }),
        },
      ])
    );

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ meta: { tournamentId: 't-1' }, categories: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await loadBySlug('tnf-2026');

    expect(getDocsFromServerMock).toHaveBeenCalledTimes(1);
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('https://example.com/latest.json', { cache: 'no-store' });
    expect(error.value).toBeNull();
    expect(snapshot.value?.meta.tournamentId).toBe('t-1');
  });

  it('falls back to cached Firestore metadata if the server read fails', async () => {
    const { usePublicSnapshot } = await import('@/composables/usePublicSnapshot');
    const { loadBySlug, snapshot } = usePublicSnapshot();

    getDocsFromServerMock.mockRejectedValue(new Error('offline'));
    getDocsMock.mockResolvedValue(
      createQuerySnapshot([
        {
          id: 't-2',
          data: () => ({
            publicSnapshot: {
              storageUrl: 'https://example.com/offline-latest.json',
            },
          }),
        },
      ])
    );

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ meta: { tournamentId: 't-2' }, categories: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await loadBySlug('offline');

    expect(getDocsFromServerMock).toHaveBeenCalledTimes(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(snapshot.value?.meta.tournamentId).toBe('t-2');
  });
});
