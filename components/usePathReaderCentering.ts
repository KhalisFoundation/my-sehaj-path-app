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
    (verseId: number) => {
      const position = versePositions.current.get(verseId);
      if (!position || !scrollRef.current || viewportHeight.current <= 0) {
        return;
      }

      const verseCenterY = position.y + position.height / 2;
      const screenCenterY = viewportHeight.current / 2;
      const targetScroll = Math.max(0, verseCenterY - screenCenterY);

      scrollRef.current.scrollTo({
        y: targetScroll,
        animated: false,
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

      if (scrollToVerseId === verseId && !hasScrolledToVerse.current) {
        recenterVerse(verseId);
      }
    },
    [recenterVerse, scrollToVerseId]
  );

  const createLayoutHandler = useCallback(
    (verseId: number) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      versePositions.current.set(verseId, { y, height });

      if (scrollToVerseId === verseId && !hasScrolledToVerse.current) {
        recenterVerse(verseId);
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

      let verseStart = 0;
      verses.forEach(({ verseId, text }) => {
        const verseEnd = verseStart + text.length;
        const matchingLines = lineRanges.filter(
          (line) => line.end > verseStart && line.start < verseEnd
        );

        if (matchingLines.length > 0) {
          const firstLine = matchingLines[0];
          const lastLine = matchingLines[matchingLines.length - 1];

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
