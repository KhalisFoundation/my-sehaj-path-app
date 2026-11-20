import React, { useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  type TextInputInstance,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { BlurView } from '@react-native-community/blur';
import { CrossIcon } from '@icons';
import { PathRenameStyle } from '@styles';
import { trackEvent } from '@utils';
import { renamePathCommand } from '../store/commands';

interface Props {
  pathId: number;
  initialPathName: string;
  setPathRename: (value: boolean) => void;
  setPathName: (value: string) => void;
}

export const PathRename = ({ pathId, initialPathName, setPathRename, setPathName }: Props) => {
  const [newName, setNewName] = useState<string>(initialPathName);
  const [isValid, setIsValid] = useState<boolean>(initialPathName.trim() !== '');
  const [isNameInputFocused, setIsNameInputFocused] = useState(false);
  const nameInputRef = useRef<TextInputInstance>(null);

  const handleNameChange = (text: string) => {
    setNewName(text);
    setIsValid(text.trim() !== '');
  };

  const focusNameInput = () => {
    setIsNameInputFocused(true);
    const cursorPosition = newName.length;
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.setNativeProps({
        selection: { start: cursorPosition, end: cursorPosition },
      });
    });
  };

  const isUpdateButtonDisabled =
    !isValid || newName.trim() === '' || newName.trim() === initialPathName.trim();

  const handleRename = async () => {
    if (isUpdateButtonDisabled) {
      return;
    }
    // Only close and report the new name once the rename is durable.
    // renamePathCommand alerts on failure; keep the dialog open so the user
    // can retry.
    const saved = await renamePathCommand(pathId, newName);
    if (!saved) {
      return;
    }
    // Never send user-entered path names to analytics.
    trackEvent('PathRename', 'result', 'Path Renamed');
    setPathRename(false);
    setPathName(newName);
  };

  return (
    <View style={PathRenameStyle.blurView}>
      <BlurView
        blurType="dark"
        blurAmount={1}
        reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.55)"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setPathRename(false)}
        accessibilityLabel="Close rename dialog"
        accessibilityRole="button"
      />
      <View style={PathRenameStyle.overlayContainer} pointerEvents="box-none">
        <View style={PathRenameStyle.renameContainer}>
          <Pressable
            style={PathRenameStyle.crossIcon}
            onPress={() => setPathRename(false)}
            hitSlop={8}
            accessibilityLabel="Close rename dialog"
            accessibilityRole="button"
            accessibilityHint="Tap to close without saving changes"
          >
            <CrossIcon />
          </Pressable>
          <Text style={PathRenameStyle.renameText}>Rename Your Path</Text>
          <View style={PathRenameStyle.inputShell}>
            <TextInput
              ref={nameInputRef}
              allowFontScaling={false}
              style={PathRenameStyle.input}
              placeholder="Enter New Name"
              placeholderTextColor={'grey'}
              defaultValue={initialPathName}
              selectTextOnFocus={false}
              scrollEnabled
              onFocus={() => setIsNameInputFocused(true)}
              onBlur={() => setIsNameInputFocused(false)}
              onChangeText={handleNameChange}
              accessibilityLabel="Path name input field"
              accessibilityHint="Enter a new name for your Sehaj Path"
            />
            {!isNameInputFocused && (
              <Pressable
                style={PathRenameStyle.inputPreview}
                onPress={focusNameInput}
                accessibilityLabel="Path name input field"
                accessibilityRole="button"
                accessibilityHint="Tap to edit the path name"
              >
                <Text
                  style={[
                    PathRenameStyle.inputPreviewText,
                    newName === '' && PathRenameStyle.inputPlaceholder,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {newName || 'Enter New Name'}
                </Text>
              </Pressable>
            )}
          </View>
          {!isValid && newName !== '' && (
            <Text style={PathRenameStyle.warningText}>Name cannot be empty</Text>
          )}
          <TouchableOpacity
            style={[
              PathRenameStyle.updateButton,
              isUpdateButtonDisabled && PathRenameStyle.disabledButton,
            ]}
            onPress={handleRename}
            disabled={isUpdateButtonDisabled}
            accessibilityLabel="Update path name"
            accessibilityRole="button"
            accessibilityHint="Tap to save the new path name"
            accessibilityState={{ disabled: isUpdateButtonDisabled }}
          >
            <Text
              style={[
                PathRenameStyle.buttonText,
                isUpdateButtonDisabled && PathRenameStyle.disabledButtonText,
              ]}
            >
              Update
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
