import { BANIDB_API } from '@constants/API';
import axios from 'axios';
import { logBreadcrumb, recordError } from './crashlytics';

/**
 * Long enough for a slow mobile connection, short enough that a hung request
 * fails and the reader can offer a retry. Without it a stalled connection kept
 * the page waiting with no end.
 */
const BANIDB_TIMEOUT_MS = 15_000;

export const BaniDB = async (angNumber: number) => {
  const baniDBUrl = `${BANIDB_API}${angNumber}`;

  try {
    const response = await axios.get(baniDBUrl, { timeout: BANIDB_TIMEOUT_MS });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    // No response at all (offline, timed out, dropped) is the device's
    // connection, not a fault, and the reader already offers a retry. Keep it
    // as a breadcrumb. An HTTP error from BaniDB is still reported, with its
    // status so it can be filtered.
    if (axios.isAxiosError(error) && error.response === undefined) {
      logBreadcrumb(
        `BaniDB fetch had no response for ang ${angNumber} (${error.code ?? 'network'})`
      );
    } else {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      recordError(error, `BaniDB fetch failed for ang ${angNumber}`, {
        banidb_status: String(status ?? 'none'),
      });
    }
    return {
      success: false,
    };
  }
};
