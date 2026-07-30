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

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSignedIn: (state, action: PayloadAction<AuthUser>) => {
      state.status = 'signedIn';
      state.token = action.payload.token;
      state.email = action.payload.email;
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
