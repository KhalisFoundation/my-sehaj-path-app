import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../App';

/**
 * Navigation ref used only for notification presses that arrive outside a
 * mounted screen (including a cold start). Regular in-app navigation keeps
 * using the screen navigation prop.
 */
export const pushNavigationRef = createNavigationContainerRef<RootStackParamList>();
