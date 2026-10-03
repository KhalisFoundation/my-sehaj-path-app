import React from 'react';
import { Image } from 'react-native';

type AndroidParagraphSaveIconProps = {
  size: number;
};

/** Android drawable-backed inline image. */
export const AndroidParagraphSaveIcon = ({ size }: AndroidParagraphSaveIconProps) => (
  <Image
    source={{ uri: 'save_inline' }}
    resizeMode="contain"
    style={{
      width: size,
      height: size,
      marginLeft: size * 0.12,
      transform: [{ translateY: size * 0.25 }],
    }}
  />
);
