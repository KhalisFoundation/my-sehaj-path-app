import React from "react";
import { View, Text } from "react-native";
import { CompletedPathCardStyles } from "../styles/CompletedPath";
import { Constants } from "../constants/Constants";

interface Props {
  sehajPathNumber: number;
  pathCompletionDate: string;
}

const CompletedPathCard = ({ sehajPathNumber, pathCompletionDate }: Props) => {
  return (
    <View style={CompletedPathCardStyles.container}>
      <Text style={CompletedPathCardStyles.sehajText}>
        {Constants.SEHAJ} #{sehajPathNumber}
      </Text>
      <Text style={CompletedPathCardStyles.dateText}>{pathCompletionDate}</Text>
    </View>
  );
};

export default CompletedPathCard;
