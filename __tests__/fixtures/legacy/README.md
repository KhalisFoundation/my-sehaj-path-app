# Legacy storage fixtures — PRODUCTION RELEASE BLOCKER

`store/legacyFormat.ts::parseLegacy` uses **strict** validation: a present-but-
malformed record fails closed (the app shows the hydration-retry screen rather
than silently dropping or defaulting the data). That is the correct behaviour
for protecting user data — but only if "malformed" is defined against the shapes
that **real released builds actually wrote**, not just the current TypeScript
models.

This app is live. Before the Redux release ships, this directory MUST contain
byte-for-byte AsyncStorage captures from every released version that can still
exist on a user's device, so we can prove hydration accepts all of them.

## How to capture (per released shape) — one step

The RELEASE gate (`yarn test:release`) fails until each shape in
`manifest.requiredShapes` has a fixture with `"provenance": "device-captured"`.
You need one capture for `shape-6key` (Android 1.0.2/1.0.3 or iOS 1.0.4) and one
for `shape-9key` (Android 1.0.5 or iOS 1.0.6).

1. Install that released build on a device/simulator.
2. Exercise it: create 1-2 paths, make partial progress, complete one, change a
   few settings, scroll and let it auto-save.
3. Paste this into any screen's component body (temporarily) and reload — it
   prints a ready-to-paste manifest entry (raw strings intact, nothing
   pre-parsed):

   ```js
   import AsyncStorage from '@react-native-async-storage/async-storage';
   // ...inside a component:
   useEffect(() => {
     (async () => {
       const KEYS = ['pathDetails','pathDateDetails','fontSize','larivaar',
         'paragraphMode','vishraam','vishraamsSource','angsFormat','consent'];
       const pairs = await Promise.all(KEYS.map(async (k) => [k, await AsyncStorage.getItem(k)]));
       const source = Object.fromEntries(pairs.filter(([, v]) => v !== null));
       console.log(JSON.stringify({ shapeId: '<shape-6key|shape-9key>',
         provenance: 'device-captured', platforms: [{ platform: '<android|ios>',
         appVersion: '<x.y.z>', build: 0 }], source }, null, 2));
     })();
   }, []);
   ```

4. Copy the logged object into `manifest.json` under `versions`. Anonymise any
   real path names. Then fill in the `expected` block = the FULL Redux store
   state after hydrating those bytes (the lifecycle test checks it exactly; if
   you get `expected` slightly wrong the test tells you the precise diff, so you
   can copy the "Received" value straight back in).
5. `yarn test:release` — it must now be green.

## Wiring

`__tests__/store/legacyFixtures.test.ts` loads `manifest.json` and runs the
FULL upgrade lifecycle per fixture (hydrate → default-fill → mutate →
write-through → fresh hydrate → rollback-readable). The release gate asserts
that every id in `manifest.requiredShapes` is represented. Run it as
`yarn test:release`.

## Rollback window (important)

Forward upgrade INTO Redux is supported for all three historical shapes
(`shape-legacy-toplevel` best-effort, `shape-6key`, `shape-9key`).

Write-back (what this Phase-1 build persists) is **nested `saveData` format
only** — it does NOT emit a top-level `angNumber`. Therefore:

- **Rollback to any `saveData`-format build (Android 1.0.2+/iOS 1.0.4+) is
  supported**: those builds read `saveData`, which is exactly what we write.
- **Rollback to the pre-release top-level-`angNumber` beta is NOT supported**:
  that build reads `path.angNumber`, which we no longer write. This shape was
  never shipped to a store, so this is acceptable. If it ever needs to be a
  rollback target, add dual-format write-back (emit both `saveData` and
  top-level `angNumber`) for one release cycle.
