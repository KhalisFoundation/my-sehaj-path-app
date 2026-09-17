import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, TouchableOpacity, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from './AppText';
import { InviteSheetStyles as styles } from '@styles';
import { Constants, ErrorConstants, UIConstants } from '@constants';
import { showErrorAlert } from '../utils/Error';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';
import { recordError } from '../utils/crashlytics';
import { createInvite, enableSharing, listActiveInvites } from '../store/groupApi';
import { inviteLinkFor } from '../navigation/linking';
import { getStoredInvite, storeInviteLink } from '../store/inviteLink';
import type { SehajPathActiveInvite } from '@api/generated/types.gen';

const EXPIRY_OPTIONS: Array<{ label: string; hours: number | null }> = [
  { label: Constants.EXPIRY_24_HOURS, hours: 24 },
  { label: Constants.EXPIRY_7_DAYS, hours: 168 },
  { label: Constants.EXPIRY_30_DAYS, hours: 720 },
  { label: Constants.NO_EXPIRY, hours: null },
];

const formatExpiry = (expiresAt: string | null): string => {
  if (expiresAt === null) {
    return Constants.NO_EXPIRY;
  }

  const formatted = new Date(expiresAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${Constants.EXPIRES} ${formatted}`;
};

interface Props {
  visible: boolean;
  sehajPathId: string;
  onClose: () => void;
  /** Called once sharing is on, so the caller can reload its member list. */
  onShared?: () => void;
  /** Called after the server accepts a newly created invite link. */
  onCreated?: () => void;
  autoCreate?: boolean;
  initialExpiryHours?: number | null;
}

/**
 * "Invite a member", as a sheet over the path rather than a screen of its own.
 *
 * Inviting is a step inside looking at a path, not a place to navigate to — the
 * reader wants the link and then wants to be back where they were. A sheet also
 * keeps the path visible behind it, which is the context that makes the link
 * mean something.
 *
 * Opening the sheet enables sharing, then reuses the newest encrypted link the
 * server gives to an active admin. A new raw token is minted only when the
 * admin explicitly chooses an expiry and taps "Create new link".
 */
export const InviteSheet = ({
  visible,
  sehajPathId,
  onClose,
  onShared,
  onCreated,
  autoCreate = false,
  initialExpiryHours = 168,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [link, setLink] = useState<string | null>(null);
  const [linkExpiry, setLinkExpiry] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryHours, setExpiryHours] = useState<number | null>(initialExpiryHours);
  const [activeInvites, setActiveInvites] = useState<SehajPathActiveInvite[]>([]);
  const [linkExpired, setLinkExpired] = useState(false);
  const [creating, setCreating] = useState(false);
  const [inviteLoadSucceeded, setInviteLoadSucceeded] = useState(false);
  const [inviteLoadFailed, setInviteLoadFailed] = useState(false);
  const [loadRetryKey, setLoadRetryKey] = useState(0);
  const [createFailed, setCreateFailed] = useState(false);
  // Start loading so opening the sheet never briefly shows the create state
  // before the active-link request has returned.
  const [loadingInvite, setLoadingInvite] = useState(true);

  useEffect(() => {
    if (!visible) {
      setLink(null);
      setLinkExpiry(null);
      setActiveInvites([]);
      setLinkExpired(false);
      setInviteLoadSucceeded(false);
      setInviteLoadFailed(false);
      setCreateFailed(false);
      setLoadingInvite(true);
      return;
    }
    let cancelled = false;

    const loadInvite = async () => {
      setProblem(null);
      setCopied(false);
      setLoadingInvite(true);
      setInviteLoadSucceeded(false);
      setInviteLoadFailed(false);

      try {
        const shared = await enableSharing(sehajPathId);
        if (cancelled) {
          return;
        }
        if (!shared.ok) {
          setProblem(shared.message);
          setInviteLoadFailed(true);
          return;
        }
        onShared?.();

        const [stored, active] = await Promise.all([
          getStoredInvite(sehajPathId),
          listActiveInvites(sehajPathId),
        ]);
        if (!cancelled) {
          // An unsuccessful active-invites response is not the same as an
          // empty response. Treating it as empty made a temporary outage look
          // like a first-time invite and could cause an admin to mint links
          // unnecessarily. Keep the sheet in an explicit error state instead.
          if (!active.ok) {
            setProblem(active.message);
            setLink(null);
            setLinkExpiry(null);
            setActiveInvites([]);
            setLinkExpired(false);
            setInviteLoadSucceeded(false);
            setInviteLoadFailed(true);
            return;
          }
          const now = Date.now();
          const serverInvites = active.data.filter(
            (invite) => invite.expiresAt === null || new Date(invite.expiresAt).getTime() > now
          );
          const storedIsValid =
            stored !== null &&
            (stored.expiresAt === null || new Date(stored.expiresAt).getTime() > now);
          const reusableInvite = serverInvites.find((invite) => invite.token !== null);
          setLinkExpired(stored !== null && !storedIsValid && reusableInvite === undefined);
          let nextLink: string | null = null;
          if (reusableInvite?.token) {
            nextLink = inviteLinkFor(reusableInvite.token);
          } else if (storedIsValid && stored !== null) {
            nextLink = stored.link;
          }
          setLink(nextLink);
          setLinkExpiry(
            reusableInvite?.expiresAt ?? (storedIsValid ? stored?.expiresAt : null) ?? null
          );
          setActiveInvites(serverInvites);
          setInviteLoadSucceeded(true);
          setInviteLoadFailed(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingInvite(false);
        }
      }
    };

    loadInvite().catch((error: unknown) => {
      if (cancelled) {
        return;
      }
      recordError(error, 'InviteSheet: failed to load active invite links');
      // Do not fall back to the create-link state when loading failed. That
      // state means the server explicitly confirmed that no active link
      // exists; an outage must remain visible as an error with no controls.
      setLoadingInvite(false);
      setLink(null);
      setLinkExpiry(null);
      setActiveInvites([]);
      setLinkExpired(false);
      setInviteLoadSucceeded(false);
      setInviteLoadFailed(true);
      setProblem(ErrorConstants.FAILED_TO_LOAD_INVITE_LINK);
    });
    return () => {
      cancelled = true;
    };
    // `onShared` is deliberately not a dependency: it is redefined on every
    // render of the parent, and depending on it would mint a fresh link each
    // time the path behind the sheet re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRetryKey, visible, sehajPathId]);

  const retryInviteLoad = useCallback(() => {
    setProblem(null);
    setInviteLoadFailed(false);
    setLoadRetryKey((value) => value + 1);
  }, []);

  const createNewLink = useCallback(async () => {
    if (creating) {
      return;
    }
    setCreating(true);
    setProblem(null);
    setCreateFailed(false);
    trackSharedPathEvent('INVITE_CREATE');
    try {
      const invite = await createInvite(sehajPathId, expiryHours);
      if (invite.ok) {
        const nextLink = inviteLinkFor(invite.data.token);
        await storeInviteLink(sehajPathId, nextLink, invite.data.expiresAt);
        setLink(nextLink);
        setLinkExpiry(invite.data.expiresAt);
        setActiveInvites((current) => [
          {
            id: invite.data.id,
            token: invite.data.token,
            expiresAt: invite.data.expiresAt,
            createdAt: invite.data.createdAt,
          },
          ...current,
        ]);
        setCreateFailed(false);
        // Let the parent update its invite action immediately. The sheet may
        // be closed before a follow-up active-invites request completes.
        onCreated?.();
      } else {
        // Transport and 5xx failures are recorded centrally by groupApi. A
        // handled 4xx here still matters because it blocked an explicit admin
        // action, so record it once at this UI boundary without duplicating the
        // transport/server report.
        if (invite.kind === 'refused' && invite.status < 500) {
          recordError(new Error(invite.message), 'InviteSheet: create invite refused', {
            group_failure_kind: 'refused',
            group_http_status: String(invite.status),
          });
        }
        const message = invite.message || ErrorConstants.FAILED_TO_CREATE_INVITE;
        setProblem(message);
        setCreateFailed(true);
        showErrorAlert(message);
      }
    } catch (error) {
      recordError(error, 'InviteSheet: failed to create or store invite link');
      showErrorAlert(ErrorConstants.FAILED_TO_CREATE_INVITE);
      setProblem(ErrorConstants.FAILED_TO_CREATE_INVITE);
      setCreateFailed(true);
    } finally {
      setCreating(false);
    }
  }, [creating, expiryHours, onCreated, sehajPathId]);

  const retryCreate = useCallback(() => {
    setProblem(null);
    createNewLink().catch(() => undefined);
  }, [createNewLink]);

  useEffect(() => {
    if (
      visible &&
      inviteLoadSucceeded &&
      !loadingInvite &&
      autoCreate &&
      link === null &&
      !creating
    ) {
      createNewLink().catch(() => undefined);
    }
  }, [autoCreate, createNewLink, creating, inviteLoadSucceeded, link, loadingInvite, visible]);

  const copy = useCallback(() => {
    if (!link) {
      return;
    }
    trackSharedPathEvent('INVITE_COPY');
    Clipboard.setString(link);
    // Confirmed in place rather than with a toast: the reader is looking at the
    // button they just pressed, and a copy with no acknowledgement gets pressed
    // again and again.
    setCopied(true);
  }, [link]);

  const share = useCallback(async () => {
    if (!link) {
      return;
    }
    trackSharedPathEvent('INVITE_SHARE');
    try {
      await Share.share({ message: link });
    } catch {
      // Dismissing the sheet rejects on some platforms. Nothing went wrong.
    }
  }, [link]);

  // The server keeps a one-way hash of invite tokens. A link can therefore be
  // copied only when this device saved the raw token at creation time. When
  // there are several server-side links, showing their identical-looking dates
  // is not actionable; the newest one is enough to explain the state.
  const newestActiveInvite = activeInvites[0] ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the dimmed area closes, which is what a sheet is expected to do. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: 34 + insets.bottom }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>{Constants.INVITE_MEMBER_TITLE}</Text>
        <Text style={styles.inviteDescription}>{Constants.INVITE_LINK_DIRECT_JOIN_HINT}</Text>

        {problem !== null ? (
          <View style={styles.loadingState}>
            <Text style={styles.problem}>{problem}</Text>
            {inviteLoadFailed && (
              <TouchableOpacity
                style={styles.share}
                onPress={retryInviteLoad}
                accessibilityRole="button"
                accessibilityLabel={Constants.RETRY}
              >
                <Text style={styles.shareText}>{Constants.RETRY}</Text>
              </TouchableOpacity>
            )}
            {createFailed && (
              <TouchableOpacity
                style={styles.share}
                onPress={retryCreate}
                accessibilityRole="button"
                accessibilityLabel={Constants.RETRY}
              >
                <Text style={styles.shareText}>{Constants.RETRY}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : loadingInvite ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={UIConstants.PRIMARY_COLOR} />
            <Text style={styles.loadingText}>{Constants.LOADING_INVITE_LINK}</Text>
          </View>
        ) : link === null ? (
          <>
            {linkExpired && <Text style={styles.hint}>{Constants.INVITE_LINK_EXPIRED}</Text>}
            {newestActiveInvite !== null ? (
              <View style={styles.activeInvites}>
                <Text style={styles.sectionLabel}>{Constants.EXISTING_ACTIVE_LINK}</Text>
                <Text style={styles.expiryText}>{formatExpiry(newestActiveInvite.expiresAt)}</Text>
                <Text style={styles.hint}>{Constants.ACTIVE_INVITE_LINK_UNAVAILABLE}</Text>
              </View>
            ) : null}
            <Text style={styles.sectionLabel}>
              {newestActiveInvite === null ? Constants.CREATE_A_LINK : Constants.LINK_EXPIRY}
            </Text>
            <View style={styles.expiryOptions}>
              {EXPIRY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.expiryOption,
                    expiryHours === option.hours && styles.expirySelected,
                  ]}
                  onPress={() => setExpiryHours(option.hours)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.expiryOptionText,
                      expiryHours === option.hours && styles.expirySelectedText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.createLinkMessage}>{Constants.CREATE_LINK_HINT}</Text>
            <TouchableOpacity
              style={[styles.share, creating && styles.disabled]}
              onPress={createNewLink}
              disabled={creating}
              accessibilityRole="button"
            >
              {creating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.shareText}>{Constants.CREATE_LINK}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.linkRow}>
              <Text style={styles.link} numberOfLines={1}>
                {link}
              </Text>
              <TouchableOpacity
                style={styles.copy}
                onPress={copy}
                accessibilityRole="button"
                accessibilityLabel={Constants.COPY_LINK}
              >
                <Text style={styles.copyText}>
                  {copied ? Constants.COPIED : Constants.COPY_LINK}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.expiryText}>{formatExpiry(linkExpiry)}</Text>

            <TouchableOpacity
              style={styles.share}
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel={Constants.SHARING_OPTIONS}
            >
              <Text style={styles.shareText}>{Constants.SHARING_OPTIONS}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
};
