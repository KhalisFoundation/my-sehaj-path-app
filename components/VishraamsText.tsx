import React from 'react';
import { Text } from 'react-native';
import { VishraamsTheme } from '@constants/VishraamsTheme';
import type { Visraams } from '../types';
import { Constants } from '@constants/constant';

type VishraamsTextProps = {
  gurbaniLine: string;
  renderWordSegments?: string[] | null;
  vishraams: Visraams;
  vishraamsSource?: string;
};

export const VishraamsText: React.FC<VishraamsTextProps> = ({
  gurbaniLine,
  renderWordSegments,
  vishraams,
  vishraamsSource = Constants.DEFAULT_VISHRAAM_SOURCE,
}) => {
  const vishraamsData = vishraams?.[vishraamsSource as keyof Visraams] || [];
  const isSegmentedLarivaar = !!(renderWordSegments && renderWordSegments.length > 1);
  const getMarker = (wordIndex: number) => vishraamsData.find((v) => v.p === wordIndex);
  const getWordTextElement = (word: string, wordIndex: number) => {
    const marker = getMarker(wordIndex);
    if (!marker) {
      return <Text key={`word-${wordIndex}`}>{word}</Text>;
    }

    return (
      <Text
        key={`word-${wordIndex}`}
        style={{
          color: marker.t === 'v' ? VishraamsTheme.mainPause.text : VishraamsTheme.lightPause.text,
          fontWeight: VishraamsTheme.coloredWords.fontWeight,
        }}
      >
        {word}
      </Text>
    );
  };

  if (vishraamsData.length === 0) {
    return <Text>{gurbaniLine}</Text>;
  }

  const words = isSegmentedLarivaar
    ? renderWordSegments
    : gurbaniLine.split(' ').filter((w) => w.length > 0);

  if (!words || words.length <= 1) {
    return <Text>{gurbaniLine}</Text>;
  }

  return (
    <>
      {words.map((word, wordIndex) => {
        const element = getWordTextElement(word, wordIndex);

        return (
          <React.Fragment key={`frag-${wordIndex}`}>
            {element}
            {wordIndex < words.length - 1 && <Text>{isSegmentedLarivaar ? '\u200B' : ' '}</Text>}
          </React.Fragment>
        );
      })}
    </>
  );
};
