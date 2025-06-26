import { StyleSheet } from 'react-native';

export const HomeScreenStyles = StyleSheet.create({
  backgroundImage: {
    height: '100%',
  },
  container: {
    backgroundColor: 'rgba(245, 245, 245,0.89)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    paddingTop: 59,
    height: '100%',
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: 'rgba(253, 198, 6, 0.3)',
  },
  scrollContainer: {
    minHeight: '100%',
  },

  pathInProgressContianer: {
    marginTop: 41,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathCompletedContainer: {
    marginTop: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
