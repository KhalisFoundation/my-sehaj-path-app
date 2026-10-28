import React, { type ReactNode } from 'react';
import {
  Image,
  type ImageResizeMode,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

interface BackgroundImageProps {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  children: ReactNode;
}

/**
 * Replacement for React Native's deprecated ImageBackground.
 *
 * Keeping the image absolutely positioned preserves the existing layout: the
 * wrapper determines the size while children render over the image.
 */
export const BackgroundImage = ({
  source,
  style,
  imageStyle,
  resizeMode,
  children,
}: BackgroundImageProps) => {
  const flattenedStyle = StyleSheet.flatten(style);

  return (
    <View style={style}>
      <Image
        source={source}
        resizeMode={resizeMode}
        style={[
          StyleSheet.absoluteFill,
          {
            // Match ImageBackground's sizing workaround for explicitly sized
            // wrappers such as the next-Ang badge.
            width: flattenedStyle?.width,
            height: flattenedStyle?.height,
          },
          imageStyle,
        ]}
      />
      {children}
    </View>
  );
};
