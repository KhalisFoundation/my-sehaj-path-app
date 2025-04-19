import { View, Text, TouchableOpacity } from "react-native";
import React, { useEffect, useState } from "react";
import RightChevron from "../../icons/RightChevron.icon";
import { FontSizeStyle } from "../../styles/FontSizeStyles";
import { ListItem, Overlay } from "@rneui/themed";
import { LeftArrowIcon } from "../../icons/LeftArrow.icon";
import NavContent from "../NavContent";
import { FontSizes } from "../../constants/FontSize";
import CheckMarkIcon from "../../icons/Checkmark.icon";
import { useLocal } from "../../hooks/useLocal";
import SimpleText from "../SimpleText";
import { fontSizeData } from "../../hooks/useLocal";

export default function FontSize() {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<fontSizeData>({
    fontSize: "Small (Default)",
    number: 18,
  });
  const handleToggle = () => setIsVisible(!isVisible);
  const { saveFontSize, fetchFontSize } = useLocal();
  const handleFontSize = (size: fontSizeData) => {
    setFontSize(size);
    handleToggle();
    saveFontSize(size);
  };
  useEffect(() => {
    const fetchFromLocal = async () => {
      const fontSizeData = await fetchFontSize();
      setFontSize(fontSizeData);
    };
    fetchFromLocal();
  }, []);
  return (
    <>
      <TouchableOpacity style={FontSizeStyle.container} onPress={handleToggle}>
        <SimpleText
          simpleText={"Font-Size"}
          simpleTextStyle={FontSizeStyle.fontSizeText}
        />
        <View style={FontSizeStyle.fontSizeContainer}>
          <SimpleText
            simpleText={fontSize.fontSize || "Default"}
            simpleTextStyle={FontSizeStyle.text}
          />
          <RightChevron />
        </View>
      </TouchableOpacity>

      {isVisible && (
        <Overlay
          isVisible={isVisible}
          onBackdropPress={handleToggle}
          overlayStyle={FontSizeStyle.overlayContainer}
        >
          <View>
            <View style={FontSizeStyle.overlayHeader}>
              <NavContent
                navIcon={<LeftArrowIcon />}
                onPress={() => handleToggle()}
              />
              <NavContent text={"Select you Font Size"} />
            </View>
            <View style={FontSizeStyle.overlayContent}>
              {FontSizes.map((size, index) => (
                <ListItem onPress={() => handleFontSize(size)} key={index}>
                  <ListItem.Content style={FontSizeStyle.overlayTextContainer}>
                    <ListItem.Title style={FontSizeStyle.overlayText}>
                      {size.fontSize}
                    </ListItem.Title>
                    {fontSize.fontSize === size.fontSize && <CheckMarkIcon />}
                  </ListItem.Content>
                </ListItem>
              ))}
            </View>
          </View>
        </Overlay>
      )}
    </>
  );
}
