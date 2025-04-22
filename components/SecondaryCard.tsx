import React from "react";
import { View, Text } from "react-native";
import { CompletedPathCardStyles } from "@styles";
import { Constants } from "@constants";

interface Props {
  sehajPathNumber: number;
  pathCompletionDate: string;
}

export const SecondaryCard = ({
  sehajPathNumber,
  pathCompletionDate,
}: Props) => {
  return (
    <View style={CompletedPathCardStyles.container}>
      <Text style={CompletedPathCardStyles.sehajText}>
        {Constants.SEHAJ} #{sehajPathNumber}
      </Text>
      <Text style={CompletedPathCardStyles.dateText}>{pathCompletionDate}</Text>
    </View>
  );
};
