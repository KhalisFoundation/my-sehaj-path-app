import React, { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, BackHandler, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  Headline,
  Slider,
  PrimaryButton,
  PrimaryCard,
  SecondaryCard,
  Label,
  DrawerMenu,
  SyncPopup,
  SignInPopup,
  SyncUnavailablePopup,
  Message,
  PathMembershipRemovalDialog,
} from '@components';
import { PathData, useScreenAnalytics, useDrawerNavigation } from '@hooks';
import { Constants, Routes, EDGES_ALL_SIDES, UIConstants } from '@constants';
import { HomeScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { MenuIcon, SyncedCheckIcon } from '@icons';
import { useAppSelector } from '../store/hooks';
import { selectVisiblePaths } from '../store/selectors';
import { onForeground } from '../store/syncLifecycle';
import { isPathCompletedForHome, sortPathsForHome } from '../store/pathOrdering';
import { avatarUrlFor } from '../store/groupApi';
import type { AvatarMember } from '../components/MemberAvatars';
import { HomeScreenBackground } from '../assets/Images';
import { BackgroundImage } from '../components/BackgroundImage';
import { completedCardDimensionsFor } from '../components/SecondaryCard';
import { fontSizeIndexOf } from '@constants/FontSize';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen = React.memo(({ navigation, route }: HomeProps) => {
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  // Not the raw slice: a deleted path lingers there until the server confirms.
  const paths = useAppSelector(selectVisiblePaths);
  const syncMeta = useAppSelector((state) => state.sync.meta);
  const memberMetadata = useAppSelector((state) => state.memberMetadata.byPathId);
  const completedCardWidth = completedCardDimensionsFor(
    useAppSelector((state) => fontSizeIndexOf(state.settings.fontSize))
  ).width;
  const { handleDrawerNavigate } = useDrawerNavigation();
  const pathDeleted = route.params?.pathDeleted === true;
  const pathMembershipEnded = route.params?.pathMembershipEnded === true;
  const membershipRemovalNotice = route.params?.membershipRemovalNotice;
  const showMembershipRemovalDialog = membershipRemovalNotice !== undefined;
  useScreenAnalytics('HomeScreen', 'HomeScreen');

  const { pathInProgress, pathCompleted } = useMemo(() => {
    const orderedPaths = sortPathsForHome(paths, syncMeta);
    const completed = orderedPaths.filter((path: PathData) => isPathCompletedForHome(path));
    const inProgress = orderedPaths.filter((path: PathData) => !isPathCompletedForHome(path));
    return { pathInProgress: inProgress, pathCompleted: completed };
  }, [paths, syncMeta]);

  // V2 supplies the capped avatar stack and exact active-reader count with the
  // path itself. Do not turn one Home refresh into a `/members` request per
  // card; full rosters are loaded only by the member-management screens.
  const membersByPathId = useMemo<Record<number, AvatarMember[]>>(
    () =>
      Object.fromEntries(
        paths.map((path) => {
          const meta = syncMeta[path.pathId];
          const groupId = meta?.groupId;
          let members: AvatarMember[] = [];
          if (meta?.shared && groupId) {
            members = (memberMetadata[path.pathId]?.memberPreviews ?? []).map((member) => ({
              id: member.id,
              displayLabel: member.displayLabel,
              avatarUri: avatarUrlFor(groupId, member),
            }));
          }
          return [path.pathId, members];
        })
      ),
    [memberMetadata, paths, syncMeta]
  );

  useFocusEffect(
    useCallback(() => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        timeoutId = setTimeout(() => {
          BackHandler.exitApp();
        }, 100);
        return true;
      });

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        backHandler.remove();
      };
    }, [])
  );

  // Home is the safe place to pull another device's progress. The lifecycle
  // helper first uploads any local work; it never applies a stale GET response
  // over offline edits.
  useFocusEffect(
    useCallback(() => {
      // Home is reached only after leaving the reader. Explicitly request an
      // unguarded pull so a response cannot be fetched then skipped because
      // React Navigation has not yet run PathScreen's focus cleanup.
      onForeground(null);
      return undefined;
    }, [])
  );

  const handleStart = useCallback(() => {
    navigation.push(Routes.CreatePath);
  }, [navigation]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerVisible(false);
  }, []);

  const dismissMembershipRemovalNotice = useCallback(() => {
    navigation.setParams({ membershipRemovalNotice: undefined });
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    try {
      // Upload queued local work before pulling another device's paths. This
      // is the same ordering used when Home regains focus, so a refresh can
      // never overwrite offline reading progress with an older server copy.
      await onForeground(null);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const pathInProgressCards = useMemo(
    () =>
      pathInProgress?.map((path: PathData) => (
        <PrimaryCard
          key={path.pathId}
          sehajPathName={path.pathName}
          angNumber={path.saveData.angNumber}
          progress={path.progress}
          members={membersByPathId[path.pathId]}
          memberCount={memberMetadata[path.pathId]?.memberCount}
          onPress={() => {
            // Open straight away, with no request of its own. Waiting for a
            // members check here left the tap dead for up to the request
            // timeout, and a second tap pushed Continue twice.
            //
            // The member count Home already has from the accessible-paths
            // snapshot is the server's total of active members, this user
            // included. More than one lets a shared path show Turns on the
            // first frame, while a personal path never does. Continue's own
            // members load then has the final say.
            //
            // No route-level group id: invite-ready personal paths have one
            // too, and with stale metadata it could briefly show group-only UI.
            const knownOtherMember = (memberMetadata[path.pathId]?.memberCount ?? 0) > 1;
            navigation.push(Routes.Continue, { pathId: path.pathId, knownOtherMember });
          }}
        />
      )),
    [pathInProgress, membersByPathId, memberMetadata, navigation]
  );

  const pathCompletedCards = useMemo(
    () =>
      pathCompleted.map((path: PathData) => (
        <SecondaryCard
          key={path.pathId}
          pathName={path.pathName}
          pathCompletionDate={path.completionDate}
          members={membersByPathId[path.pathId]}
          memberCount={memberMetadata[path.pathId]?.memberCount}
        />
      )),
    [memberMetadata, pathCompleted, membersByPathId]
  );

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <SyncPopup mode="unowned" />
      <SignInPopup />
      <SyncUnavailablePopup />
      <PathMembershipRemovalDialog
        visible={showMembershipRemovalDialog}
        pathName={membershipRemovalNotice?.pathName}
        adminName={membershipRemovalNotice?.adminName}
        onDismiss={dismissMembershipRemovalNotice}
      />
      <BackgroundImage
        source={HomeScreenBackground}
        resizeMode="cover"
        style={HomeScreenStyles.backgroundImage}
      >
        <TouchableOpacity
          style={HomeScreenStyles.menuButton}
          onPress={() => setIsDrawerVisible(true)}
          accessibilityLabel="Menu"
          accessibilityRole="button"
          hitSlop={12}
        >
          <MenuIcon color="#0D2346" />
        </TouchableOpacity>
        <ScrollView
          contentContainerStyle={HomeScreenStyles.scrollContainer}
          alwaysBounceVertical={true}
          overScrollMode="always"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={UIConstants.PRIMARY_COLOR}
              titleColor={UIConstants.PRIMARY_COLOR}
              colors={[UIConstants.PRIMARY_COLOR]}
              onRefresh={() => {
                handleRefresh().catch(() => undefined);
              }}
            />
          }
        >
          <View style={HomeScreenStyles.container}>
            <Headline headline={Constants.ITS_FINE_DAY_FOR} />
            <Headline headline={Constants.SEHAJ_PATH_ENGLISH} />
            {pathInProgress?.length > 0 ? (
              <View style={HomeScreenStyles.pathInProgressContianer}>
                <Label label={Constants.SEHAJ_PATH_IN_PROGRESS} />
                <Slider
                  arrayOfCards={pathInProgressCards}
                  widthOfCard={199}
                  dotsIndicator={true}
                  dotsContainerStyle={HomeScreenStyles.progressDots}
                />
              </View>
            ) : undefined}
            <PrimaryButton buttonTitle={Constants.START_NEW} onPress={handleStart} />
            {pathCompleted?.length > 0 ? (
              <View style={HomeScreenStyles.pathCompletedContainer}>
                <Label label={Constants.SEHAJ_PATH_COMPLETED} />
                <Slider
                  arrayOfCards={pathCompletedCards}
                  widthOfCard={completedCardWidth}
                  dotsIndicator={false}
                  contentContainerStyle={HomeScreenStyles.completedCardsContent}
                />
              </View>
            ) : undefined}
          </View>
        </ScrollView>
        {pathDeleted ? (
          <Message
            message={Constants.PATH_DELETED}
            icon={<SyncedCheckIcon />}
            style={HomeScreenStyles.deletedNotice}
            onHidden={() => navigation.setParams({ pathDeleted: undefined })}
          />
        ) : null}
        {pathMembershipEnded ? (
          <Message
            message={Constants.PATH_MEMBERSHIP_ENDED}
            icon={<SyncedCheckIcon />}
            style={HomeScreenStyles.deletedNotice}
            onHidden={() => navigation.setParams({ pathMembershipEnded: undefined })}
          />
        ) : null}
        <DrawerMenu
          isVisible={isDrawerVisible}
          onClose={handleCloseDrawer}
          onNavigate={handleDrawerNavigate}
          currentRoute={Routes.Home}
          showOnlyHomeItems={true}
        />
      </BackgroundImage>
    </SafeAreaView>
  );
});
