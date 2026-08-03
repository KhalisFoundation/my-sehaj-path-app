import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  /** The SSO JWT. Kept in the store so API calls can read it to authorize. */
  token: string;
  // Best-effort from the SSO `/user` endpoint; null when a transient fetch
  // failure leaves us signed in (token present) without the profile yet.
  email: string | null;
  firstname: string | null;
  lastname: string | null;
}

export interface AuthState {
  /** `unknown` until boot hydration finishes reading secure storage. */
  status: 'unknown' | 'signedOut' | 'signedIn';
  /**
   * The SSO JWT, held in memory for API calls to attach as a Bearer token.
   * The durable copy lives in encrypted storage (auth/tokenUtils); this slice
   * is NOT persisted by the legacy write coordinator, so the token never
   * touches AsyncStorage.
   */
  token: string | null;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
}

const initialState: AuthState = {
  status: 'unknown',
  token: null,
  email: null,
  firstname: null,
  lastname: null,
};

/**
 * The email is this app's account key: `sync.account` is compared against it to
 * decide whether the local dataset belongs to the signed-in user. Those checks
 * are exact equality, so the value is normalized once here rather than trusting
 * every login to return identical casing — a differently-cased email from the
 * identity provider would otherwise read as a *different account* and silently
 * disable sync (or trigger an account switch) for the same person.
 */
export const normalizeAccountEmail = (email: string | null): string | null =>
  email === null ? null : email.trim().toLowerCase();

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSignedIn: (state, action: PayloadAction<AuthUser>) => {
      state.status = 'signedIn';
      state.token = action.payload.token;
      state.email = normalizeAccountEmail(action.payload.email);
      state.firstname = action.payload.firstname;
      state.lastname = action.payload.lastname;
    },
    setSignedOut: (state) => {
      state.status = 'signedOut';
      state.token = null;
      state.email = null;
      state.firstname = null;
      state.lastname = null;
    },
  },
});

export const { setSignedIn, setSignedOut } = authSlice.actions;
