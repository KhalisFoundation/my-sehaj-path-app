import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path, LinearGradient, Stop, Defs } from 'react-native-svg';
import { PathProgressCardStyles } from '@styles';
import { Constants, UIConstants } from '@constants';

interface Prop {
  sehajPathName: string;
  angNumber: number;
  progress: number;
  onPress: () => void;
}

export const PrimaryCard = ({ sehajPathName, angNumber, progress, onPress }: Prop) => {
  progress = progress >= 100 ? UIConstants.PROGRESS_CIRCLE_MAX_PROGRESS : progress;
  const size = UIConstants.PROGRESS_CIRCLE_SIZE;
  const strokeWidth = UIConstants.PROGRESS_CIRCLE_STROKE_WIDTH;
  const center = size / 2;
  const circleRadius = (size - strokeWidth) / 2;
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) => {
    const angleInRadians = (((angleInDegrees - 90) % 360) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const calculateArcPath = (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };
  const progressAngle = UIConstants.PROGRESS_CIRCLE_FULL_ANGLE * (progress / 100);
  const startAngle = UIConstants.PROGRESS_CIRCLE_START_ANGLE;
  const endAngle = progressAngle;

  return (
    <TouchableOpacity
      style={PathProgressCardStyles.container}
      onPress={onPress}
      accessibilityLabel={`${sehajPathName}, Ang ${angNumber}, ${progress}% complete`}
      accessibilityRole="button"
      accessibilityHint="Tap to continue this Sehaj Path"
    >
      <View style={PathProgressCardStyles.textContainer}>
        <Text style={PathProgressCardStyles.sehajText}>{sehajPathName}</Text>
        <Text style={PathProgressCardStyles.angText}>
          {Constants.ANG} <Text style={PathProgressCardStyles.angNumber}>{angNumber}</Text>
        </Text>
      </View>
      <View
        style={{
          ...PathProgressCardStyles.progressContainer,
          transform: [{ rotateY: '180deg' }],
        }}
        accessibilityLabel={`Progress circle showing ${progress}% completion`}
        accessibilityRole="image"
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient
              id="filledGrad"
              x1={UIConstants.GRADIENT_X1}
              y1={UIConstants.GRADIENT_Y1}
              x2={UIConstants.GRADIENT_X2}
              y2={UIConstants.GRADIENT_Y2}
            >
              <Stop offset="0%" stopColor={UIConstants.PROGRESS_FILLED_COLOR_START} />
              <Stop offset="100%" stopColor={UIConstants.PROGRESS_FILLED_COLOR_END} />
            </LinearGradient>
            <LinearGradient
              id="unfilledGrad"
              x1={UIConstants.GRADIENT_X1}
              y1={UIConstants.GRADIENT_Y1}
              x2={UIConstants.GRADIENT_X2}
              y2={UIConstants.GRADIENT_Y2}
            >
              <Stop offset="0%" stopColor={UIConstants.PROGRESS_UNFILLED_COLOR} />
              <Stop offset="100%" stopColor={UIConstants.PROGRESS_UNFILLED_COLOR} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={circleRadius}
            fill="none"
            stroke="url(#unfilledGrad)"
            strokeWidth={strokeWidth}
          />
          <Path
            d={calculateArcPath(center, center, circleRadius, startAngle, endAngle)}
            fill="none"
            stroke="url(#filledGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </TouchableOpacity>
  );
};
