import React from 'react';
import { ActivityIndicator, Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { FinishReadingSheetStyles as styles } from '@styles';
import { displayReadingAng } from '../utils/readingAng';
import { asLocalDateTime, isValidDateTime } from '../utils/dateTime';

interface Props {
  visible: boolean;
  /**
   * Who finished, when this device was only watching.
   *
   * Present turns the sheet from a question into an announcement: a follower
   * has nothing to confirm — the turn is already over — so it reports what
   * happened and shows them out rather than offering a decision.
   */
  finishedBy?: string | null;
  /** Where the turn began, from the session — not from this device's memory. */
  startAng: number;
  /** Where the reader is now. */
  currentAng: number;
  /** When the turn began, so the reading can be reported as a stretch of time. */
  startedAt?: string | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * How long the turn has run, in the words somebody would use.
 *
 * Rounded to the minute and never below one: a turn that lasted forty seconds
 * reading as "0 min" makes the whole summary look broken, and nobody reads for
 * zero minutes.
 */
const durationLabel = (startedAt: string | null | undefined): string | null => {
  if (!startedAt) {
    return null;
  }
  if (!isValidDateTime(startedAt)) {
    return null;
  }
  const minutes = Math.max(1, Math.round(asLocalDateTime().diff(startedAt, 'minute', true)));
  if (minutes < 60) {
    return `in ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} hr` : `in ${hours} hr ${rest} min`;
};

/**
 * Confirming the end of a turn.
 *
 * Asked rather than assumed. Ending a turn is not just leaving a screen — it
 * releases the reading to the rest of the group and writes the position
 * everybody else will follow from. Backing out of a page by accident should not
 * do that, so the way out is a decision with a way back.
 *
 * It also reports the turn back to the reader, which is the only moment that
 * information exists in one place: where they began, where they reached, and
 * how much that was.
 */
export const FinishReadingSheet = ({
  visible,
  startAng,
  currentAng,
  startedAt,
  finishedBy = null,
  busy = false,
  onConfirm,
  onCancel,
}: Props) => {
  // The API stores 0 for an untouched path. It is Ang 1 to a reader, but the
  // raw 0 must remain on the live session for finish's concurrency check.
  const displayedStartAng = displayReadingAng(startAng);
  const angsRead = Math.max(0, currentAng - displayedStartAng);
  const duration = durationLabel(startedAt);
  const watching = finishedBy !== null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close" />
      <View style={styles.centre} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.tick}>
            <Text style={styles.tickMark}>✓</Text>
          </View>

          <Text style={styles.title}>
            {watching ? `${finishedBy} has finished reading` : 'Finish your reading?'}
          </Text>

          <Text style={styles.label}>{watching ? 'Started at Ang' : 'You started at Ang'}</Text>
          <Text style={styles.figure}>{displayedStartAng}</Text>

          <Text style={styles.label}>{watching ? 'Reached Ang' : 'You are at Ang'}</Text>
          <Text style={styles.figure}>{currentAng}</Text>

          <Text style={styles.label}>{watching ? 'They read' : 'You read'}</Text>
          <View style={styles.readRow}>
            <Text style={styles.readCount}>{angsRead}</Text>
            <View style={styles.readRule} />
            <View>
              <Text style={styles.readUnit}>{angsRead === 1 ? 'Ang' : 'Angs'}</Text>
              {duration !== null && <Text style={styles.readUnit}>{duration}</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.confirm, busy && styles.disabled]}
            onPress={onConfirm}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.confirmText}>{watching ? 'OK' : 'Finish & Log'}</Text>
            )}
          </TouchableOpacity>

          {/* A follower has nothing to decline — the turn ended without them. */}
          {!watching && (
            <TouchableOpacity onPress={onCancel} accessibilityRole="button" disabled={busy}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};
