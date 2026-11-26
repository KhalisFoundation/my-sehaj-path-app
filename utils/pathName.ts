import { PATH_DATA } from '@constants';

/**
 * Make typed or pasted text safe to use as a path name.
 *
 * A name is one line. The inputs are multiline only so a long name wraps, which
 * also means the return key (or a paste) can put a line break inside the name,
 * and that would be stored and shown in every card. Line breaks become a space,
 * and the result is cut to the length the server accepts.
 */
export const sanitizePathName = (text: string): string =>
  text.replace(/[\r\n]+/g, ' ').slice(0, PATH_DATA.MAX_NAME_LENGTH);

/**
 * Whether the name is at the length limit. The inputs' `maxLength` stops any
 * further typing there, so this is the moment to say why nothing more goes in.
 */
export const isPathNameAtLimit = (name: string): boolean =>
  name.length >= PATH_DATA.MAX_NAME_LENGTH;
