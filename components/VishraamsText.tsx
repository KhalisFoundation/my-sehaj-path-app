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

  if (vishraamsData.length === 0) {
    return <Text>{gurbaniLine}</Text>;
  }

  const words = isSegmentedLarivaar
    ? renderWordSegments
    : gurbaniLine.split(' ').filter((w) => w.length > 0);

  if (!words || words.length <= 1) {
    return <Text>{gurbaniLine}</Text>;
  }

  /**
   * Emit one node per MARKED word, and merge every run of unmarked words into a
   * single node.
   *
   * This used to render two `<Text>` elements for every word (the word plus a
   * separator), so a line became ~30 nested text nodes even though only one or
   * two words are ever coloured. In paragraph mode a whole shabad is nested
   * inside ONE parent `<Text>`, so those nodes multiply into hundreds in a
   * single text tree \u2014 which is what made switching paragraph mode on slow to
   * lay out. The rendered string is unchanged; only the node count drops.
   */
  const markerByIndex = new Map(vishraamsData.map((marker) => [marker.p, marker]));
  const separator = isSegmentedLarivaar ? '\u200B' : ' ';
  const nodes: React.ReactNode[] = [];
  let run = '';

  const flushRun = (key: string) => {
    if (run.length > 0) {
      nodes.push(<Text key={`run-${key}`}>{run}</Text>);
      run = '';
    }
  };

  words.forEach((word, wordIndex) => {
    const marker = markerByIndex.get(wordIndex);
    const tail = wordIndex < words.length - 1 ? separator : '';

    if (!marker) {
      run += word + tail;
      return;
    }

    flushRun(`before-${wordIndex}`);
    nodes.push(
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
    // The separator after a coloured word is plain text, so it belongs to the
    // next unmarked run rather than to the coloured node.
    run += tail;
  });
  flushRun('end');

  return <>{nodes}</>;
};
