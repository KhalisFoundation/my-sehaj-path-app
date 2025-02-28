import React from "react";
import { View, Text } from "react-native";
import { CompletedPathCardStyles } from "../styles/CompletedPath";

interface Props {
  sehajPathNumber: number;
  pathCompletionDate: string;
}

const CompletedPathCard = ({ sehajPathNumber, pathCompletionDate }: Props) => {
  return (
    <View style={CompletedPathCardStyles.container}>
      <Text style={CompletedPathCardStyles.sehajText}>
        Sehaj #{sehajPathNumber}
      </Text>
      <Text style={CompletedPathCardStyles.dateText}>{pathCompletionDate}</Text>
    </View>
  );
};

export default CompletedPathCard;
