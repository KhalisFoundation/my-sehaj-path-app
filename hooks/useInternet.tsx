import NetInfo from "@react-native-community/netinfo";
import { Alert } from "react-native";
import { useState } from "react";

export const useInternet = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const updateOnlineStatus = async () => {
    const netInfo = await NetInfo.fetch();
    setIsOnline(netInfo.isConnected || false);
    return netInfo.isConnected;
  };
  const checkNetwork = async () => {
    const netInfo = await updateOnlineStatus();
    if (!netInfo) {
      Alert.alert(
        "Please connect to the internet.",
        "Offline mode will be soon available.",
        [
          {
            text: "OK",
            onPress: () => {},
          },
        ]
      );
    }
  };
  return { checkNetwork, isOnline, updateOnlineStatus };
};
