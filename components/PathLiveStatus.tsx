import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Constants } from '@constants';
import { DialogStyles, PathScreenStyles } from '@styles';
import { Dialog } from './Dialog';
import { FinishReadingSheet } from './FinishReadingSheet';

interface Props {
  isFollowing: boolean;
  followingLabel: string;
  readerNotice: string | null;
  takeoverInProgress: boolean;
  readerLeftNoticeOpen: boolean;
  readerRejoined: boolean;
  endedBy: string | null;
  endedAt: { startAng: number; endAng: number } | null;
  endedNoticeOpen: boolean;
  liveReaderLabel: string | null;
  startedAt?: string | null;
  onDismissReaderLeft: () => void;
  onLeaveAfterReading: () => void;
}

/** Status UI for a live Sehaj Path turn, kept separate from the reader itself. */
export const PathLiveStatus = ({
  isFollowing,
  followingLabel,
  readerNotice,
  takeoverInProgress,
  readerLeftNoticeOpen,
  endedBy,
  endedAt,
  endedNoticeOpen,
  liveReaderLabel,
  startedAt,
  onDismissReaderLeft,
  onLeaveAfterReading,
}: Props) => {
  return (
    <>
      {isFollowing && (
        <View style={PathScreenStyles.followingBanner}>
          <Text style={PathScreenStyles.followingText}>{followingLabel}</Text>
        </View>
      )}

      {!isFollowing && readerNotice !== null && (
        <View style={PathScreenStyles.readerNotice}>
          <Text style={PathScreenStyles.readerNoticeText}>{readerNotice}</Text>
          {takeoverInProgress && (
            <Text style={PathScreenStyles.readerNoticeHint}>{Constants.TAKEOVER_SAVE_HINT}</Text>
          )}
        </View>
      )}

      {endedBy !== null && endedAt !== null && (
        <FinishReadingSheet
          visible={endedNoticeOpen}
          finishedBy={endedBy}
          startAng={endedAt.startAng}
          currentAng={endedAt.endAng}
          startedAt={startedAt}
          onConfirm={onLeaveAfterReading}
          onCancel={onLeaveAfterReading}
        />
      )}

      {isFollowing && endedBy === null && (
        <Dialog visible={readerLeftNoticeOpen} onRequestClose={onDismissReaderLeft}>
          <Text style={DialogStyles.title}>Reader has left</Text>
          <Text style={DialogStyles.message}>
            {liveReaderLabel ?? 'The reader'} has disconnected. Their reading is paused while we
            wait for them to reconnect. We will resume automatically if they return.
          </Text>
          <View style={DialogStyles.actions}>
            <Pressable
              style={DialogStyles.primaryButton}
              onPress={onLeaveAfterReading}
              accessibilityRole="button"
            >
              <Text style={DialogStyles.primaryText}>Back to Home</Text>
            </Pressable>
          </View>
        </Dialog>
      )}
    </>
  );
};
