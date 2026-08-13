import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';

type VersePosition = {
  y: number;
  height: number;
};

type ParagraphVerseLayout = {
  shabadIndex: number;
  localY: number;
  height: number;
  measuredFromTextLayout?: boolean;
};

/**
 * Movement below this is not worth a scroll command.
 *
 * Paragraph layout resolves verse by verse, so the resume recentre is asked for
 * repeatedly with near-identical targets. Re-issuing `scrollTo` each time cuts
 * short the movement already in flight, which reads as stutter.
 */
const RECENTER_EPSILON_PX = 8;

type UsePathReaderCenteringArgs = {
  scrollRef: RefObject<ScrollView | null>;
  scrollOffset: RefObject<number>;
  setCenterVerseId?: (verseId: number) => void;
  scrollToVerseId?: number;
};

export const usePathReaderCentering = ({
  scrollRef,
  scrollOffset,
  setCenterVerseId,
  scrollToVerseId,
}: UsePathReaderCenteringArgs) => {
  const viewportHeight = useRef<number>(0);
  const versePositions = useRef<Map<number, VersePosition>>(new Map());
  const paragraphOffsets = useRef<Map<number, number>>(new Map());
  const paragraphVerseLayouts = useRef<Map<number, ParagraphVerseLayout>>(new Map());
  const hasScrolledToVerse = useRef<boolean>(false);

  const recenterVerse = useCallback(
    (verseId: number, options?: { animated?: boolean }) => {
      const position = versePositions.current.get(verseId);
      if (!position || !scrollRef.current || viewportHeight.current <= 0) {
        return;
      }

      const verseCenterY = position.y + position.height / 2;
      const screenCenterY = viewportHeight.current / 2;
      const targetScroll = Math.max(0, verseCenterY - screenCenterY);

      // Already effectively there: issuing another scroll would only cut short
      // whatever movement is in flight. Paragraph layout resolves verse by
      // verse, so this fires repeatedly with near-identical targets.
      if (Math.abs(scrollOffset.current - targetScroll) < RECENTER_EPSILON_PX) {
        scrollOffset.current = targetScroll;
        setCenterVerseId?.(verseId);
        hasScrolledToVerse.current = true;
        return;
      }

      scrollRef.current.scrollTo({
        y: targetScroll,
        animated: options?.animated ?? false,
      });
      scrollOffset.current = targetScroll;
      setCenterVerseId?.(verseId);
      hasScrolledToVerse.current = true;
    },
    [scrollRef, scrollOffset, setCenterVerseId]
  );

  const findCenterVerseId = useCallback(
    (scrollY: number) => {
      if (!setCenterVerseId || versePositions.current.size === 0) {
        return;
      }

      const centerY = scrollY + viewportHeight.current / 2;
      let closestVerseId: number | null = null;
      let minDistance = Infinity;

      versePositions.current.forEach((position, verseId) => {
        const verseCenter = position.y + position.height / 2;
        const distance = Math.abs(verseCenter - centerY);

        if (distance < minDistance) {
          minDistance = distance;
          closestVerseId = verseId;
        }
      });

      if (closestVerseId !== null) {
        setCenterVerseId(closestVerseId);
      }
    },
    [setCenterVerseId]
  );

  const syncParagraphVersePosition = useCallback(
    (verseId: number) => {
      const localLayout = paragraphVerseLayouts.current.get(verseId);
      if (!localLayout) {
        return;
      }

      const shabadOffset = paragraphOffsets.current.get(localLayout.shabadIndex);
      if (shabadOffset === undefined) {
        return;
      }

      const resolvedY = shabadOffset + localLayout.localY;
      versePositions.current.set(verseId, { y: resolvedY, height: localLayout.height });

      // This is the RESUME move: animate it. It used to be an instant jump that
      // cut off the smooth scroll `useScrollToSavedPath` had already started,
      // which is what made resuming a path in paragraph mode look janky.
      if (scrollToVerseId === verseId && !hasScrolledToVerse.current) {
        recenterVerse(verseId, { animated: true });
      }
    },
    [recenterVerse, scrollToVerseId]
  );

  const createLayoutHandler = useCallback(
    (verseId: number) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      versePositions.current.set(verseId, { y, height });

      // This is the RESUME move: animate it. It used to be an instant jump that
      // cut off the smooth scroll `useScrollToSavedPath` had already started,
      // which is what made resuming a path in paragraph mode look janky.
      if (scrollToVerseId === verseId && !hasScrolledToVerse.current) {
        recenterVerse(verseId, { animated: true });
      }
    },
    [recenterVerse, scrollToVerseId]
  );

  const createParagraphVerseLayoutHandler = useCallback(
    (verseId: number, shabadIndex: number) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      const existingLayout = paragraphVerseLayouts.current.get(verseId);

      if (existingLayout?.measuredFromTextLayout) {
        return;
      }

      paragraphVerseLayouts.current.set(verseId, {
        shabadIndex,
        localY: y,
        height,
        measuredFromTextLayout: false,
      });

      syncParagraphVersePosition(verseId);
    },
    [syncParagraphVersePosition]
  );

  const createParagraphVerseTextLayoutHandler = useCallback(
    (shabadIndex: number, verses: { verseId: number; text: string }[]) => (event: any) => {
      const lines = event?.nativeEvent?.lines;
      if (!Array.isArray(lines) || lines.length === 0) {
        return;
      }

      let cumulativeLineLength = 0;
      const lineRanges = lines.map((line: any) => {
        const text = typeof line?.text === 'string' ? line.text : '';
        const start = cumulativeLineLength;
        cumulativeLineLength += text.length;

        return {
          start,
          end: cumulativeLineLength,
          y: line?.y ?? 0,
          height: line?.height ?? 0,
        };
      });

      // Both verses and lines advance monotonically through the same character
      // stream, so walk them together instead of re-scanning every line for each
      // verse. That rescan was O(verses x lines) and ran on every paragraph
      // layout — including at resume, while the scroll animation is playing.
      let verseStart = 0;
      let lineCursor = 0;
      verses.forEach(({ verseId, text }) => {
        const verseEnd = verseStart + text.length;

        // Skip lines that ended before this verse begins; they cannot overlap
        // this verse or any later one.
        while (lineCursor < lineRanges.length && lineRanges[lineCursor].end <= verseStart) {
          lineCursor += 1;
        }

        let lastOverlapping = lineCursor;
        while (
          lastOverlapping + 1 < lineRanges.length &&
          lineRanges[lastOverlapping + 1].start < verseEnd
        ) {
          lastOverlapping += 1;
        }

        if (lineCursor < lineRanges.length && lineRanges[lineCursor].start < verseEnd) {
          const firstLine = lineRanges[lineCursor];
          const lastLine = lineRanges[lastOverlapping];

          paragraphVerseLayouts.current.set(verseId, {
            shabadIndex,
            localY: firstLine.y,
            height: Math.max(lastLine.y + lastLine.height - firstLine.y, lastLine.height),
            measuredFromTextLayout: true,
          });

          syncParagraphVersePosition(verseId);
        }

        verseStart = verseEnd;
      });
    },
    [syncParagraphVersePosition]
  );

  const createShabadLayoutHandler = useCallback(
    (shabadIndex: number) => (event: LayoutChangeEvent) => {
      const { y } = event.nativeEvent.layout;
      paragraphOffsets.current.set(shabadIndex, y);

      paragraphVerseLayouts.current.forEach((layout, verseId) => {
        if (layout.shabadIndex === shabadIndex) {
          syncParagraphVersePosition(verseId);
        }
      });
    },
    [syncParagraphVersePosition]
  );

  const clearMeasuredVerses = useCallback(
    (resetCenterVerse = false) => {
      versePositions.current.clear();
      paragraphOffsets.current.clear();
      paragraphVerseLayouts.current.clear();
      hasScrolledToVerse.current = false;

      if (resetCenterVerse) {
        setCenterVerseId?.(0);
      }
    },
    [setCenterVerseId]
  );

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  const requestRecenter = useCallback(
    (verseId?: number) => {
      if (!verseId) {
        return;
      }

      hasScrolledToVerse.current = false;
      requestAnimationFrame(() => {
        if (!hasScrolledToVerse.current) {
          recenterVerse(verseId);
        }
      });
    },
    [recenterVerse]
  );

  return {
    clearMeasuredVerses,
    createLayoutHandler,
    createParagraphVerseLayoutHandler,
    createParagraphVerseTextLayoutHandler,
    createShabadLayoutHandler,
    findCenterVerseId,
    handleViewportLayout,
    requestRecenter,
  };
};
