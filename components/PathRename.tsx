import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useLocal } from '@hooks';
import { CrossIcon } from '@icons';
import { PathRenameStyle } from '@styles';

interface Props {
  pathId: number;
  setPathRename: (value: boolean) => void;
  setPathName: (value: string) => void;
}

export const PathRename = ({ pathId, setPathRename, setPathName }: Props) => {
  const { renamePath } = useLocal();
  const [newName, setNewName] = useState<string>('');

  const handleRename = () => {
    renamePath(pathId, newName);
    setPathRename(false);
    setPathName(newName);
  };

  return (
    <BlurView
      blurType="light"
      blurAmount={1}
      reducedTransparencyFallbackColor="grey"
      style={PathRenameStyle.blurView}
    >
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
            onChangeText={setNewName}
            accessibilityLabel="Path name input field"
            accessibilityHint="Enter a new name for your Sehaj Path"
          />
          <TouchableOpacity
            style={PathRenameStyle.updateButton}
            onPress={handleRename}
            accessibilityLabel="Update path name"
            accessibilityRole="button"
            accessibilityHint="Tap to save the new path name"
          >
            <Text style={PathRenameStyle.buttonText}>Update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BlurView>
  );
};
