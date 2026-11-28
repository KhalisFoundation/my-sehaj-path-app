// Native blur has no test renderer. Components import it as a named export
// (`import { BlurView } from '@react-native-community/blur'`), so the mock must
// provide the names as host components rather than export a bare string.
module.exports = {
  BlurView: 'BlurView',
  VibrancyView: 'VibrancyView',
};
