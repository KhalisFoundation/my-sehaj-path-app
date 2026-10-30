import React from 'react';
import { Animated, View } from 'react-native';
import { Constants, Routes } from '@constants';
import { PathScreenStyles } from '@styles';
import { AngsNavigation } from './AngsNavigation';
import { DrawerMenu } from './DrawerMenu';
import { FinishReadingSheet } from './FinishReadingSheet';
import { Loading } from './Loading';
import { Message } from './Message';
import { PathControls } from './PathControls';
import { PathLiveStatus } from './PathLiveStatus';

interface Props {
  alertIndicator: React.ReactNode | undefined;
  isSaving: boolean;
  found: boolean;
  isFollowing: boolean;
  requestExit: () => void;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  fadeAnim: React.MutableRefObject<Animated.Value>;
  onSettings: () => void;
  followingLabel: string;
  readerNotice: string | null;
  takeoverInProgress: boolean;
  readerLeftNoticeOpen: boolean;
  readerRejoined: boolean;
  endedBy: string | null;
  endedAt: { startAng: number; endAng: number } | null;
  endedNoticeOpen: boolean;
  readerLabel: string | null;
  startedAt?: string;
  onDismissReaderLeft: () => void;
  onLeaveAfterReading: () => void;
  savingMessage: string;
  readerDriving: boolean;
  readerStartAng?: number;
  pathAng: number;
  finishOpen: boolean;
  finishing: boolean;
  onConfirmFinish: () => void;
  onCancelFinish: () => void;
  isAngsNavigationVisible: boolean;
  setIsAngsNavigationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  onRightAng: () => void;
  onLeftAng: () => void;
  isAngNavigation: boolean;
  setIsAngNavigation: React.Dispatch<React.SetStateAction<boolean>>;
  fetchAngData: (ang: number) => Promise<boolean>;
  updatePathAng: (ang: number) => void;
  drawerVisible: boolean;
  onCloseDrawer: () => void;
  onNavigateDrawer: (route: string) => void;
  pathId: number;
  onGoToAng: () => void;
  onSave: () => void;
}

/** All UI layered above the scripture reader. */
export const PathScreenOverlays = ({
  alertIndicator,
  isSaving,
  found,
  isFollowing,
  requestExit,
  setIsSaving,
  fadeAnim,
  onSettings,
  followingLabel,
  readerNotice,
  takeoverInProgress,
  readerLeftNoticeOpen,
  readerRejoined,
  endedBy,
  endedAt,
  endedNoticeOpen,
  readerLabel,
  startedAt,
  onDismissReaderLeft,
  onLeaveAfterReading,
  savingMessage,
  readerDriving,
  readerStartAng,
  pathAng,
  finishOpen,
  finishing,
  onConfirmFinish,
  onCancelFinish,
  isAngsNavigationVisible,
  setIsAngsNavigationVisible,
  onRightAng,
  onLeftAng,
  isAngNavigation,
  setIsAngNavigation,
  fetchAngData,
  updatePathAng,
  drawerVisible,
  onCloseDrawer,
  onNavigateDrawer,
  pathId,
  onGoToAng,
  onSave,
}: Props) => (
  <>
    {alertIndicator !== undefined && (
      <Loading alertIndicator={alertIndicator} alertText={Constants.ALERT_TEXT_LOADING} />
    )}

    {!isSaving && !found && !isFollowing && (
      <View style={PathScreenStyles.navigationContainer}>
        <PathControls
          handleGoBack={requestExit}
          setIsSaving={setIsSaving}
          fadeAnim={fadeAnim}
          onSettings={onSettings}
        />
      </View>
    )}

    <PathLiveStatus
      isFollowing={isFollowing}
      followingLabel={followingLabel}
      readerNotice={readerNotice}
      takeoverInProgress={takeoverInProgress}
      readerLeftNoticeOpen={readerLeftNoticeOpen}
      readerRejoined={readerRejoined}
      endedBy={endedBy}
      endedAt={endedAt}
      endedNoticeOpen={endedNoticeOpen}
      liveReaderLabel={readerLabel}
      startedAt={startedAt}
      onDismissReaderLeft={onDismissReaderLeft}
      onLeaveAfterReading={onLeaveAfterReading}
    />

    {isSaving && <Message message={savingMessage} fadeAnim={fadeAnim.current} />}
    {found && <Message message={Constants.RESUMING_SAVED_PROGRESS} fadeAnim={fadeAnim.current} />}

    {readerDriving && readerStartAng !== undefined && (
      <FinishReadingSheet
        visible={finishOpen}
        startAng={readerStartAng}
        currentAng={pathAng}
        startedAt={startedAt}
        busy={finishing}
        onConfirm={onConfirmFinish}
        onCancel={onCancelFinish}
      />
    )}

    {isAngsNavigationVisible && !isFollowing && (
      <AngsNavigation
        setIsAngsNavigationVisible={setIsAngsNavigationVisible}
        handleRightArrow={onRightAng}
        handleLeftArrow={onLeftAng}
        pathAng={pathAng}
        isAngNavigation={isAngNavigation}
        setIsAngNavigation={setIsAngNavigation}
        fetchAngData={fetchAngData}
        updatePathAng={updatePathAng}
      />
    )}

    <DrawerMenu
      isVisible={drawerVisible}
      onClose={onCloseDrawer}
      onNavigate={onNavigateDrawer}
      currentRoute={Routes.Path}
      pathId={pathId}
      onGoToAngPress={onGoToAng}
      onSavePress={onSave}
    />
  </>
);
