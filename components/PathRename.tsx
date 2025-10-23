import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Pressable, StyleSheet } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useLocal } from '@hooks';
import { CrossIcon } from '@icons';
import { PathRenameStyle } from '@styles';
import { trackPathRenameEvent } from '@utils';

interface Props {
  pathId: number;
  setPathRename: (value: boolean) => void;
  setPathName: (value: string) => void;
}

export const PathRename = ({ pathId, setPathRename, setPathName }: Props) => {
  const { renamePath } = useLocal();
  const [newName, setNewName] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean>(true);

  const handleNameChange = (text: string) => {
    setNewName(text);
    setIsValid(text.trim() !== '');
  };

  const isUpdateButtonDisabled = !isValid || newName.trim() === '';

  const handleRename = () => {
    if (isUpdateButtonDisabled) {
      return;
    }
    trackPathRenameEvent('click', `rename path ${newName}`);
    renamePath(pathId, newName);
    setPathRename(false);
    setPathName(newName);
  };

  return (
    <View style={PathRenameStyle.blurView}>
      <BlurView
        blurType="light"
        blurAmount={2}
        reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.3)"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={PathRenameStyle.overlayContainer}>
        <View style={PathRenameStyle.renameContainer}>
          <Pressable
            style={PathRenameStyle.crossIcon}
            onPress={() => setPathRename(false)}
            accessibilityLabel="Close rename dialog"
            accessibilityRole="button"
            accessibilityHint="Tap to close without saving changes"
          >
            <CrossIcon />
          </Pressable>
          <Text style={PathRenameStyle.renameText}>Rename Your Path:</Text>
          <TextInput
            style={PathRenameStyle.input}
            placeholder="Enter New Name"
            placeholderTextColor={'grey'}
            autoFocus={false}
            value={newName}
            onChangeText={handleNameChange}
            accessibilityLabel="Path name input field"
            accessibilityHint="Enter a new name for your Sehaj Path"
          />
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
