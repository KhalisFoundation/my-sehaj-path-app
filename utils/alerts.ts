import { Alert } from 'react-native';

interface SaveProgressAlertProps {
  onSaveAndGoBack: () => void;
  onGoBackWithoutSaving: () => void;
  destinationLabel?: string;
}

export const showSaveProgressAlert = ({
  onSaveAndGoBack,
  onGoBackWithoutSaving,
  destinationLabel = 'Home',
}: SaveProgressAlertProps) => {
  // "Go to", not "Open". The destination is a screen the user moves to, not a
  // thing they open — "Open Home" reads wrong, and it got worse the further the
  // destination was from a document: "Open Progress", "Open Streaks".
  Alert.alert(
    'Save Progress?',
    `You have navigated to a different ang. Do you want to save your current progress before going to ${destinationLabel}?`,
    [
      {
        text: `Save & Go to ${destinationLabel}`,
        onPress: onSaveAndGoBack,
      },
      {
        text: `Go to ${destinationLabel} Without Saving`,
        onPress: onGoBackWithoutSaving,
        style: 'destructive',
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
};

/**
 * Confirms an explicit sign-out before it runs. Logout ends the IdP session and
 * clears the local account, so it should not fire on a single accidental tap.
 */
export const showLogoutConfirmAlert = ({ onConfirm }: { onConfirm: () => void }) => {
  Alert.alert(
    'Log out?',
    'Your reading is saved to your account and comes back when you sign in.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log Out',
        onPress: onConfirm,
        style: 'destructive',
      },
    ]
  );
};

/**
 * How long to wait before raising UI from inside an alert button handler.
 *
 * iOS will not present a second alert while the first is still dismissing, and
 * it reports nothing back — the call is simply swallowed and the user sees
 * NOTHING. Tapping the button then looks like a dead control. (The same
 * presentation rule cost us the "Offline reading ready" notice, which iOS
 * refused to show underneath the SSO browser.)
 *
 * The dismissal animation is roughly a quarter second; this clears it with room
 * to spare and is still fast enough to read as a direct response to the tap.
 */
const AFTER_ALERT_DISMISSED_MS = 350;

/**
 * "Sync Now" was tapped with no connection.
 *
 * Checked BEFORE the sync starts rather than reported after it fails. Without a
 * connection the request cannot even be attempted, so closing the drawer and
 * running a progress notice would be theatre — and the failure it ends in says
 * "unable to sync" without saying the one thing the user can act on.
 */
/**
 * "Sync now" was tapped with no connection.
 *
 * `runManualSync` already refuses and raises a status notice, but the drawer
 * closes on the way there — so from the user's side the menu vanishes and
 * little else obviously happens. Checking before anything moves keeps the menu
 * in place and names the one thing they can act on.
 */
export const showOfflineSyncAlert = () => {
  Alert.alert(
    'No internet connection',
    'Connect to the internet to sync your progress. Your reading stays safe on this device in the meantime.',
    [{ text: 'OK', style: 'default' }]
  );
};

export const showOfflineBeforeLogoutAlert = () => {
  Alert.alert(
    'No internet connection',
    'Connect to the internet to sync your progress, then log out. Your reading stays safe on this device in the meantime.',
    [{ text: 'OK', style: 'default' }]
  );
};

/**
 * Blocks logout while reading exists only on this device.
 *
 * Logging out now removes the local copy, so anything the server has not
 * confirmed would be gone for good. There is deliberately NO "log out anyway":
 * both answers here are safe ones, and the destructive third option is exactly
 * the data loss this prompt exists to prevent.
 */
export const showUnsyncedBeforeLogoutAlert = ({ onSyncNow }: { onSyncNow: () => void }) => {
  Alert.alert(
    'Unsynced progress',
    'Some of your reading is not saved to your account yet. Sync it first so nothing is lost when you log out.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sync Now',
        // Deferred, not called directly. Everything this starts is UI — another
        // alert when offline, or closing the drawer Modal and raising the sync
        // notice — and all of it is unreliable while this alert is still on
        // screen dismissing. Running it after makes the tap actually do
        // something instead of silently doing nothing.
        onPress: () => setTimeout(onSyncNow, AFTER_ALERT_DISMISSED_MS),
      },
    ]
  );
};

/**
 * Shown when the user is leaving the path screen but the position could not be
 * saved. We never trap the user: they can retry (stay) or leave anyway.
 */
export const showLeaveAnywayAlert = ({ onLeaveAnyway }: { onLeaveAnyway: () => void }) => {
  Alert.alert(
    "Couldn't save your progress",
    'We could not save your current reading position. You can try again, or leave anyway (your latest position may not be saved).',
    [
      {
        text: 'Try Again',
        style: 'cancel',
      },
      {
        text: 'Leave Anyway',
        onPress: onLeaveAnyway,
        style: 'destructive',
      },
    ]
  );
};
