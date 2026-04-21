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
      paragraphVerseLayouts.current.set(verseId, {
        shabadIndex,
        localY: y,
        height,
      });

      syncParagraphVersePosition(verseId);
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
    createShabadLayoutHandler,
    findCenterVerseId,
    handleViewportLayout,
    requestRecenter,
  };
};
