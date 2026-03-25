import React from 'react';
import { Text } from 'react-native';
import { VishraamsTheme } from '@constants/VishraamsTheme';
import { VishraamsMarker, Visraams } from '@hooks/useLocal';
import { Constants } from '@constants/constant';

type VishraamsTextProps = {
  gurbaniLine: string;
  vishraams: Visraams;
  fontSize: number;
  vishraamsSource?: string;
  originalVerse?: string;
};

export const VishraamsText: React.FC<VishraamsTextProps> = ({
  gurbaniLine,
  vishraams,
  fontSize,
  vishraamsSource = Constants.DEFAULT_VISHRAAM_SOURCE,
  originalVerse,
}) => {
  const vishraamsData = vishraams?.[vishraamsSource as keyof Visraams] || [];

  if (!vishraamsData || vishraamsData.length === 0) {
    return <Text>{gurbaniLine}</Text>;
  }

  const isLarivaar = !gurbaniLine.includes(' ');
  const referenceText = isLarivaar && originalVerse ? originalVerse : gurbaniLine;
  const words = referenceText.split(' ').filter(w => w.length > 0);

  if (isLarivaar && originalVerse) {
    let larivaarPos = 0;

    return (
      <>
        {words.map((word, wordIndex) => {
          const marker = vishraamsData.find((v: VishraamsMarker) => v.p === wordIndex);
          const wordLength = word.length;
          const wordText = gurbaniLine.substring(larivaarPos, larivaarPos + wordLength);

          larivaarPos += wordLength;

          if (marker) {
            const isMainPause = marker.t === 'v';
            const pauseConfig = isMainPause
              ? VishraamsTheme.mainPause
              : VishraamsTheme.lightPause;

            return (
              <Text
                key={`word-${wordIndex}`}
                style={{
                  color: pauseConfig.text,
                  fontWeight: VishraamsTheme.coloredWords.fontWeight,
                }}
              >
                {wordText}
              </Text>
            );
          }

          return <Text key={`word-${wordIndex}`}>{wordText}</Text>;
        })}
      </>
    );
  }

  return (
    <>
      {words.map((word, wordIndex) => {
        const marker = vishraamsData.find((v: VishraamsMarker) => v.p === wordIndex);

        const element = marker ? (
          <Text
            key={`word-${wordIndex}`}
            style={{
              color:
                marker.t === 'v'
                  ? VishraamsTheme.mainPause.text
                  : VishraamsTheme.lightPause.text,
              fontWeight: VishraamsTheme.coloredWords.fontWeight,
            }}
          >
            {word}
          </Text>
        ) : (
          <Text key={`word-${wordIndex}`}>{word}</Text>
        );

        return (
          <React.Fragment key={`frag-${wordIndex}`}>
            {element}
            {wordIndex < words.length - 1 && <Text> </Text>}
          </React.Fragment>
        );
      })}
    </>
  );
};