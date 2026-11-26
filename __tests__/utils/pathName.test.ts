import { PATH_DATA } from '@constants';
import { sanitizePathName } from '../../utils/pathName';

describe('sanitizePathName', () => {
  it('leaves an ordinary name alone', () => {
    expect(sanitizePathName('Family path')).toBe('Family path');
  });

  it('turns a line break into a space, so one name stays on one line', () => {
    expect(sanitizePathName('Morning\nPath')).toBe('Morning Path');
    expect(sanitizePathName('Morning\r\nPath')).toBe('Morning Path');
  });

  it('treats a run of line breaks as one gap', () => {
    expect(sanitizePathName('A\n\n\nB')).toBe('A B');
  });

  it('cuts a name to the length the server accepts', () => {
    const long = 'a'.repeat(PATH_DATA.MAX_NAME_LENGTH + 40);
    expect(sanitizePathName(long)).toHaveLength(PATH_DATA.MAX_NAME_LENGTH);
  });

  it('keeps a name that is exactly at the limit', () => {
    const exact = 'a'.repeat(PATH_DATA.MAX_NAME_LENGTH);
    expect(sanitizePathName(exact)).toBe(exact);
  });

  it('keeps Gurmukhi text intact', () => {
    expect(sanitizePathName('ਸਹਿਜ ਪਾਠ')).toBe('ਸਹਿਜ ਪਾਠ');
  });

  it('matches the limit the API validates', () => {
    // `CreateSehajPathDto` and `SyncPathDto` both use @Length(1, 100).
    expect(PATH_DATA.MAX_NAME_LENGTH).toBe(100);
  });
});
