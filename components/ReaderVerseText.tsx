import React from 'react';
import type { Visraams } from '../types';
import { useAppSelector } from '../store/hooks';
import { LarivaarAssistText } from './LarivaarAssistText';
import { VishraamsText } from './VishraamsText';

interface ReaderVerseTextProps {
  gurbaniLine: string;
  renderWordSegments?: string[] | null;
  vishraams: Visraams;
}

/** Shared colour policy for line and paragraph readers. */
export const ReaderVerseText = ({
  gurbaniLine,
  renderWordSegments,
  vishraams,
}: ReaderVerseTextProps) => {
  const assist = useAppSelector(
    (state) => state.settings.larivaar && state.settings.larivaarAssist
  );
  const vishraam = useAppSelector((state) => state.settings.vishraam);
  const source = useAppSelector((state) => state.settings.vishraamsSource.source);

  if (assist) {
    return <LarivaarAssistText gurbaniLine={gurbaniLine} wordSegments={renderWordSegments} />;
  }
  if (vishraam) {
    return (
      <VishraamsText
        gurbaniLine={gurbaniLine}
        renderWordSegments={renderWordSegments}
        vishraams={vishraams}
        vishraamsSource={source}
      />
    );
  }
  return <>{gurbaniLine}</>;
};
