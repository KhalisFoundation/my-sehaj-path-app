# Keep screen awake while reading

Enable **Settings → Display Options → Keep screen awake while reading** to prevent auto-lock during reading. The switch is off by default, so existing users retain normal auto-lock behavior. Disabling it immediately releases the hold.

## Implementation

`PathScreen` combines the saved opt-in, loaded content, and the visibility of the drawer and Ang picker. `useReaderKeepAwake` owns navigation focus, application-state subscriptions, and native acquire/release cleanup. Opening either overlay, navigating away, backgrounding, losing content, or unmounting releases the hold. Returning to visible reading reacquires it only when opted in. Repeated application-state events do not duplicate native calls.

The switch uses the existing acknowledged settings command, durable write journal, account snapshots, and settings sync. `sehajKeepScreenAwake_v1` stores the boolean separately from the nine frozen legacy keys. Missing or malformed local values and old account snapshots default to off; malformed remote values are ignored.

The MIT-licensed `@sayem314/react-native-keep-awake` 2.0.0 bridge supports the app's React Native New Architecture. It controls the iOS application idle timer and Android foreground window flag without changing system auto-lock settings or adding Android permissions. Install dependencies, reinstall iOS pods, and rebuild the native app after adding the bridge.

## Validation

Jest covers lifecycle cleanup, both actual screen overlay handlers, opt-in/out, restart and account persistence, remote validation, failed-save rollback, and legacy compatibility. Run `yarn test --runInBand --watchman=false` with repository dependencies installed.

Native screenshots, UIKit readings, environment limitations, and the manual QA sequence are attached to [PR #121](https://github.com/KhalisFoundation/my-sehaj-path-app/pull/121). They are preview-run evidence; no native UI-test suite is included in this feature. Android and physical-device idle-duration checks remain outstanding.
