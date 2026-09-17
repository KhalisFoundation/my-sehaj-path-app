import React, { useCallback, useState, useMemo } from 'react';
import { View, ImageBackground, ScrollView, BackHandler, TouchableOpacity } from 'react-native';
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
} from '@components';
import { PathData, useScreenAnalytics, useDrawerNavigation } from '@hooks';
import { Constants, Routes, EDGES_ALL_SIDES } from '@constants';
import { HomeScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { MenuIcon, SyncedCheckIcon } from '@icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { removePathAndSyncState } from '../store';
import { selectVisiblePaths } from '../store/selectors';
import { onForeground } from '../store/syncLifecycle';
import { sortPathsForHome } from '../store/pathOrdering';
import { avatarUrlFor, listMembers } from '../store/groupApi';
import type { AvatarMember } from '../components/MemberAvatars';
import { HomeScreenBackground } from '../assets/Images';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen = React.memo(({ navigation, route }: HomeProps) => {
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const [membersByPathId, setMembersByPathId] = useState<Record<number, AvatarMember[]>>({});
  const dispatch = useAppDispatch();
  // Not the raw slice: a deleted path lingers there until the server confirms.
  const paths = useAppSelector(selectVisiblePaths);
  const syncMeta = useAppSelector((state) => state.sync.meta);
  const { handleDrawerNavigate } = useDrawerNavigation();
  // Set by Continue on its way here. Cleared once read, so returning to Home
  // later never replays a confirmation for something deleted minutes ago.
  const pathDeleted = route.params?.pathDeleted === true;
  useScreenAnalytics('HomeScreen', 'HomeScreen');

  const { pathInProgress, pathCompleted } = useMemo(() => {
    const orderedPaths = sortPathsForHome(paths, syncMeta);
    // Keep "completed" strict: both completionDate and final checkpoint must match.
    const completed = orderedPaths.filter((path: PathData) => path.completionDate !== '');
    const inProgress = orderedPaths.filter((path: PathData) => path.completionDate === '');
    return { pathInProgress: inProgress, pathCompleted: completed };
  }, [paths, syncMeta]);

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

  // Member avatars are only meaningful for server-backed shared paths. Keep
  // this request out of personal paths, and discard a late response when the
  // user leaves Home before it finishes.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const sharedPaths = paths.filter((path) => {
        const meta = syncMeta[path.pathId];
        return meta?.shared === true && meta.groupId !== undefined;
      });

      const loadMembers = async () => {
        const entries = await Promise.all(
          sharedPaths.map(async (path) => {
            const groupId = syncMeta[path.pathId]?.groupId;
            if (!groupId) {
              return [path.pathId, []] as const;
            }
            const result = await listMembers(groupId);
            if (!result.ok) {
              // 403/404 both mean this account cannot access this group any
              // more (the API may hide a missing path as 404). Do not remove
              // it for 401, offline, or 5xx failures: those can recover and
              // are not proof that the path was removed.
              const accessWasRemoved =
                result.kind === 'refused' && (result.status === 403 || result.status === 404);
              if (accessWasRemoved && !cancelled) {
                dispatch(removePathAndSyncState({ pathId: path.pathId }));
              }
              return [path.pathId, []] as const;
            }
            const members: AvatarMember[] = result.data
              .filter((member) => member.status === 'ACTIVE')
              .map((member) => ({
                id: member.id,
                displayLabel: member.displayLabel,
                avatarUri: avatarUrlFor(groupId, member),
              }));
            return [path.pathId, members] as const;
          })
        );

        if (!cancelled) {
          setMembersByPathId(Object.fromEntries(entries));
        }
      };

      loadMembers().catch(() => {
        if (!cancelled) {
          setMembersByPathId({});
        }
      });

      return () => {
        cancelled = true;
      };
    }, [dispatch, paths, syncMeta])
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

  const pathInProgressCards = useMemo(
    () =>
      pathInProgress?.map((path: PathData) => (
        <PrimaryCard
          key={path.pathId}
          sehajPathName={path.pathName}
          angNumber={path.saveData.angNumber}
          progress={path.progress}
          members={membersByPathId[path.pathId]}
          onPress={() => {
            navigation.push(Routes.Continue, { pathId: path.pathId });
          }}
        />
      )),
    [pathInProgress, membersByPathId, navigation]
  );

  const pathCompletedCards = useMemo(
    () =>
      pathCompleted.map((path: PathData) => (
        <SecondaryCard
          key={path.pathId}
          pathName={path.pathName}
          pathCompletionDate={path.completionDate}
          members={membersByPathId[path.pathId]}
        />
      )),
    [pathCompleted, membersByPathId]
  );

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <SyncPopup mode="unowned" />
      <SignInPopup />
      <SyncUnavailablePopup />
      <ImageBackground
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
        <ScrollView contentContainerStyle={HomeScreenStyles.scrollContainer}>
          <View style={HomeScreenStyles.container}>
            <Headline headline={Constants.ITS_FINE_DAY_FOR} />
            <Headline headline={Constants.SEHAJ_PATH_ENGLISH} />
            {pathInProgress?.length > 0 ? (
              <View style={HomeScreenStyles.pathInProgressContianer}>
                <Label label={Constants.SEHAJ_PATH_IN_PROGRESS} />
                <Slider arrayOfCards={pathInProgressCards} widthOfCard={199} dotsIndicator={true} />
              </View>
            ) : undefined}
            <PrimaryButton buttonTitle={Constants.START_NEW} onPress={handleStart} />
            {pathCompleted?.length > 0 ? (
              <View style={HomeScreenStyles.pathCompletedContainer}>
                <Label label={Constants.SEHAJ_PATH_COMPLETED} />
                <Slider arrayOfCards={pathCompletedCards} widthOfCard={130} dotsIndicator={false} />
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
        <DrawerMenu
          isVisible={isDrawerVisible}
          onClose={handleCloseDrawer}
          onNavigate={handleDrawerNavigate}
          currentRoute={Routes.Home}
          showOnlyHomeItems={true}
        />
      </ImageBackground>
    </SafeAreaView>
  );
});
