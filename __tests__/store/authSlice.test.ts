import { makeStore } from '../../store';
import { setSignedIn, setSignedOut } from '../../store/slices/authSlice';
import { hydrateEmptySync, setAccount } from '../../store/slices/syncSlice';

/**
 * `auth.email` is the client-side account key: every sync guard asks whether
 * `sync.account === auth.email`. Those are exact comparisons, so the value has
 * to be stable across logins — otherwise the same person coming back with a
 * differently-cased email reads as a different account.
 */
describe('authSlice account email', () => {
  it('normalizes casing and surrounding whitespace on sign-in', () => {
    const store = makeStore();
    store.dispatch(
      setSignedIn({ token: 't', email: '  User@Example.COM ', firstname: 'U', lastname: 'X' })
    );
    expect(store.getState().auth.email).toBe('user@example.com');
  });

  it('keeps a null email null (a profile lookup that has not resolved yet)', () => {
    const store = makeStore();
    store.dispatch(setSignedIn({ token: 't', email: null, firstname: null, lastname: null }));
    expect(store.getState().auth.email).toBeNull();
  });

  it('still matches a stored account when the provider changes the casing', () => {
    const store = makeStore();
    store.dispatch(hydrateEmptySync());
    // Associated on a previous login...
    store.dispatch(
      setSignedIn({ token: 't', email: 'user@example.com', firstname: 'U', lastname: 'X' })
    );
    store.dispatch(setAccount(store.getState().auth.email));
    store.dispatch(setSignedOut());

    // ...and the identity provider returns a different casing this time.
    store.dispatch(
      setSignedIn({ token: 't2', email: 'User@Example.com', firstname: 'U', lastname: 'X' })
    );

    const state = store.getState();
    expect(state.sync.account).toBe(state.auth.email); // sync stays enabled
  });
});
