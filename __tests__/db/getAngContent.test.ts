jest.mock('../../db/downloadDatabase', () => ({ isDatabaseInstalled: jest.fn() }));
jest.mock('../../db/connection', () => ({ getBani: jest.fn() }));
jest.mock('@utils', () => ({ BaniDB: jest.fn(), recordError: jest.fn() }));

import { getAngContent } from '../../db/getAngContent';
import { isDatabaseInstalled } from '../../db/downloadDatabase';
import { getBani } from '../../db/connection';
import { BaniDB } from '@utils';

const mockedInstalled = isDatabaseInstalled as jest.Mock;
const mockedGetBani = getBani as jest.Mock;
const mockedApi = BaniDB as jest.Mock;

// A single ang exactly as @khalisfoundation/banidb.getAng returns it (verified against
// the real DB): `source.pageNo`, full verse fields, `visraam` keyed by source.
const ANG = {
  source: { sourceId: 'G', gurmukhi: null, unicode: null, english: null, pageNo: 5 },
  count: 1,
  navigation: { previous: 4, next: 6 },
  page: [
    {
      verseId: 10,
      shabadId: 3,
      verse: { gurmukhi: 'g', unicode: 'ੳ' },
      larivaar: { gurmukhi: 'gl', unicode: 'ੳl' },
      translation: {},
      transliteration: {},
      visraam: { sttm: [{ p: '2', t: 'v' }], sttm2: [], igurbani: [] },
    },
  ],
};

beforeEach(() => jest.clearAllMocks());

describe('getAngContent', () => {
  it('reads the DB and maps getAng -> PathContent (normalizing visraam marks)', async () => {
    mockedInstalled.mockResolvedValue(true);
    mockedGetBani.mockResolvedValue({ getAng: jest.fn().mockResolvedValue(ANG) });

    const result = await getAngContent(5);

    expect(result).toEqual({
      success: true,
      source: 'db',
      data: {
        source: { pageNo: 5 },
        page: [
          {
            verseId: 10,
            shabadId: 3,
            verse: { unicode: 'ੳ' },
            larivaar: { unicode: 'ੳl' },
            // mark `p` normalized from the string "2" to the number 2
            visraam: { sttm2: [], sttm: [{ p: 2, t: 'v' }], igurbani: [] },
          },
        ],
      },
    });
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it('uses the BaniDB API (source "api") only when the DB is not installed', async () => {
    mockedInstalled.mockResolvedValue(false);
    mockedApi.mockResolvedValue({ success: true, data: { page: [], source: { pageNo: 1 } } });

    const result = await getAngContent(1);

    expect(mockedApi).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
    expect(result.source).toBe('api');
    expect(mockedGetBani).not.toHaveBeenCalled();
  });

  it('falls back to the API when an installed DB cannot be read', async () => {
    // A corrupt DB must not permanently block reading when the API is reachable.
    mockedInstalled.mockResolvedValue(true);
    mockedGetBani.mockResolvedValue({
      getAng: jest.fn().mockRejectedValue(new Error('db read failed')),
    });
    mockedApi.mockResolvedValue({ success: true, data: { page: [], source: { pageNo: 7 } } });

    const result = await getAngContent(7);

    expect(mockedApi).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      success: true,
      data: { page: [], source: { pageNo: 7 } },
      source: 'api',
    });
  });
});
