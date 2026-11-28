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
import { Constants, PATH_DATA } from '@constants';
import { renamePathCommand } from '../store/commands';
import { isPathNameAtLimit, sanitizePathName } from '../utils/pathName';

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

  // Same rule as CreatePath: one line, and no longer than the server accepts.
  // A longer name is refused with a 400, so the rename would never sync, and a
  // pasted line break would be stored and shown in every card.
  const handleNameChange = (text: string) => {
    const name = sanitizePathName(text);
    setNewName(name);
    setIsValid(name.trim() !== '');
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

  const nameAtLimit = isPathNameAtLimit(newName);

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
          <View
            style={[PathRenameStyle.inputShell, nameAtLimit && PathRenameStyle.inputShellError]}
          >
            <TextInput
              ref={nameInputRef}
              allowFontScaling={false}
              style={PathRenameStyle.input}
              placeholder="Enter New Name"
              placeholderTextColor={'grey'}
              // Controlled, so a cleaned-up name (a pasted line break turned into
              // a space) is what the field shows.
              value={newName}
              maxLength={PATH_DATA.MAX_NAME_LENGTH}
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
                  {newName === '' ? 'Enter New Name' : newName}
                </Text>
              </Pressable>
            )}
          </View>
          {nameAtLimit && (
            <Text style={PathRenameStyle.limitText} accessibilityLiveRegion="polite">
              {Constants.PATH_NAME_TOO_LONG.replace('{max}', String(PATH_DATA.MAX_NAME_LENGTH))}
            </Text>
          )}
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
