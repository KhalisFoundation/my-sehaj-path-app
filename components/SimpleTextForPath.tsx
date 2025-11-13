import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Text, Pressable, Animated, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocal } from '@hooks';
import { SaveIcon } from '@icons';
import { SimpleTextForPathStyles } from '@styles';
import { showErrorAlert } from '@utils/Error';
import { ErrorConstants, UIConstants } from '@constants';

interface Props {
  gurbaniLine: string;
  onSelection: () => void;
  isSaving: boolean;
  pressIndex: number;
  index: number;
  onSave: () => void;
  verseId: number;
  savedPathVerseId: number;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  setPressIndex: (value: number) => void;
  setSavedPathVerseId: (value: number) => void;
  found: boolean;
  setFound: (value: boolean) => void;
}

const SimpleTextForPathComponent = ({
  gurbaniLine,
  onSelection,
  isSaving,
  pressIndex,
  index,
  onSave,
  verseId,
  savedPathVerseId,
  setIsSaved,
  setIsSaving,
  setPressIndex,
  setSavedPathVerseId,
  found,
  setFound,
}: Props) => {
  const [fontSize, setFontSize] = useState<number>(18);
  const isLongPressingRef = useRef<boolean>(false);
  const animationValueRef = useRef(new Animated.Value(0));
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const { fetchFontSize } = useLocal();

  useFocusEffect(
    useCallback(() => {
      const fetch = async () => {
        try {
          const fontSizeData = await fetchFontSize();
          setFontSize(fontSizeData.number);
        } catch (e) {
          showErrorAlert(ErrorConstants.FAILED_TO_LOAD_FONT_SIZE);
          setFontSize(18);
        }
      };
      fetch();
    }, [fetchFontSize])
  );

  const handleLongPress = useCallback(() => {
    if (isLongPressingRef.current) {
      return;
    }
    isLongPressingRef.current = true;
    if (found) {
      setFound(false);
    }
    if (animationRef.current) {
      animationRef.current.stop();
    }
    animationValueRef.current.setValue(0);
    animationRef.current = Animated.timing(animationValueRef.current, {
      toValue: 1,
      duration: 50,
      useNativeDriver: true,
    });

    animationRef.current.start(() => {
      requestAnimationFrame(() => {
        setIsSaving(false);
        setIsSaved(false);
        onSelection();
        setIsSaving(true);
        setIsSaved(true);
        setPressIndex(index);
        setSavedPathVerseId(verseId);
        onSave();
        setTimeout(() => {
          isLongPressingRef.current = false;
          animationRef.current = null;
        }, 100);
      });
    });
  }, [
    found,
    setFound,
    setIsSaving,
    setIsSaved,
    onSelection,
    setPressIndex,
    index,
    setSavedPathVerseId,
    verseId,
    onSave,
  ]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  const isSelected = useMemo(
    () => verseId === savedPathVerseId || (isSaving && pressIndex === index),
    [verseId, savedPathVerseId, isSaving, pressIndex, index]
  );

  const accessibilityLabel = useMemo(
    () => `Gurbani line ${index + 1}${isSelected ? ', selected' : ''}`,
    [index, isSelected]
  );

  const textStyle = useMemo(
    () => ({
      ...SimpleTextForPathStyles.text,
      fontSize,
      lineHeight: fontSize * 2.2,
    }),
    [fontSize]
  );

  const containerStyle = useMemo(
    () => (isSelected ? SimpleTextForPathStyles.coloredContainer : undefined),
    [isSelected]
  );

  return (
    <Pressable
      onPress={() => {
        if (isSaving) {
          onSelection();
          onSave();
        }
      }}
      style={containerStyle}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onLongPress={handleLongPress}
      delayLongPress={Platform.OS === 'ios' ? 150 : 500}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      accessibilityHint="Tap to select, long press to save this line"
    >
      <Text suppressHighlighting={true} style={textStyle}>
        {gurbaniLine}
        {isSelected && (
          <SaveIcon
            color={UIConstants.SAVE_ICON_COLOR}
            width={fontSize * 1.2}
            height={fontSize * 1.2}
          />
        )}
      </Text>
    </Pressable>
  );
};

export const SimpleTextForPath = React.memo(SimpleTextForPathComponent, (prevProps, nextProps) => {
  return (
    prevProps.gurbaniLine === nextProps.gurbaniLine &&
    prevProps.isSaving === nextProps.isSaving &&
    prevProps.pressIndex === nextProps.pressIndex &&
    prevProps.index === nextProps.index &&
    prevProps.verseId === nextProps.verseId &&
    prevProps.savedPathVerseId === nextProps.savedPathVerseId &&
    prevProps.found === nextProps.found
  );
});
