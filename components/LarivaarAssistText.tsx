import React from 'react';
import { StyleSheet, Text } from 'react-native';

export const LARIVAAR_ASSIST_COLORS = ['#11336A', '#9A3412'] as const;

const styles = StyleSheet.create({
  firstWord: { color: LARIVAAR_ASSIST_COLORS[0] },
  secondWord: { color: LARIVAAR_ASSIST_COLORS[1] },
});

interface LarivaarAssistTextProps {
  gurbaniLine: string;
  wordSegments?: string[] | null;
}

/** Only colour verified word boundaries, preserving the reader's exact text. */
export const LarivaarAssistText = ({ gurbaniLine, wordSegments }: LarivaarAssistTextProps) => {
  const separator = gurbaniLine.includes('\u200B') ? '\u200B' : '';
  if (!wordSegments || wordSegments.length < 2 || wordSegments.join(separator) !== gurbaniLine) {
    return <>{gurbaniLine}</>;
  }

  return (
    <>
      {wordSegments.map((word, index) => (
        <Text key={index} style={index % 2 === 0 ? styles.firstWord : styles.secondWord}>
          {word}
          {index < wordSegments.length - 1 ? separator : ''}
        </Text>
      ))}
    </>
  );
};
