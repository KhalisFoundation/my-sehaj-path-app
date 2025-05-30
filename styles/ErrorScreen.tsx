import { StyleSheet } from 'react-native';

export const ErrorScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: 'rgba(253, 198, 6, 0.3)',
    justifyContent: 'center',
  },
  BaniDBImage: {
    maxWidth: 250,
    maxHeight: 250,
    objectFit: 'contain',
    alignSelf: 'center',
  },
  textStyle: {
    fontSize: 24,
    lineHeight: 48,
    color: 'black',
  },
  navContainer: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  HomeIconContainer: {
    backgroundColor: '#11336A',
    width: 'auto',
    alignSelf: 'auto',
    padding: 2,
    borderRadius: 5,
  },
});
