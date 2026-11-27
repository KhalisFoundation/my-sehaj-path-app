import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';
import { Constants } from '@constants';
import { ProgressIcon, StreakIcon, GoToAngIcon, AllPathLogoIcon } from '@icons';
import { SaveIconMenu } from '@icons/SaveIconMenu.icon';
import { SettingsMenu } from '@icons/SettingsMenu.icon';

export interface DrawerMenuRow {
  id: string;
  label: string;
  route: string;
  showOnHome?: boolean;
  Icon: ComponentType<SvgProps>;
}

export const DRAWER_MENU_ITEMS: DrawerMenuRow[] = [
  {
    id: 'all-paths',
    label: Constants.ALL_PATHS,
    route: 'Home',
    showOnHome: true,
    Icon: AllPathLogoIcon,
  },
  {
    id: 'progress',
    label: Constants.PROGRESS,
    route: 'Progress',
    showOnHome: false,
    Icon: ProgressIcon,
  },
  {
    id: 'streaks',
    label: Constants.STREAKS,
    route: 'Streaks',
    showOnHome: false,
    Icon: StreakIcon,
  },
  {
    id: 'go-to-ang',
    label: Constants.GO_TO_ANG,
    route: 'GoToAng',
    showOnHome: false,
    Icon: GoToAngIcon,
  },
  {
    id: 'save',
    label: Constants.SAVE,
    route: 'Save',
    showOnHome: false,
    Icon: SaveIconMenu,
  },
  {
    id: 'settings',
    label: Constants.SETTINGS,
    route: 'Setting',
    showOnHome: true,
    Icon: SettingsMenu,
  },
];
