import { View, Text, TouchableOpacity, TextInput, Pressable } from 'react-native';
import React, { useState } from 'react';
import { PathRenameStyle } from '@styles/PathRenameStyle';
import { BlurView } from '@react-native-community/blur';
import { useLocal } from '@hooks/useLocal';
import { CrossIcon } from '@icons';

interface Props {
  pathId: number;
  setPathRename: any;
  setPathName: any;
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
          <Pressable style={PathRenameStyle.crossIcon} onPress={() => setPathRename(false)}>
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
          />
          <TouchableOpacity style={PathRenameStyle.updateButton} onPress={handleRename}>
            <Text style={PathRenameStyle.buttonText}>Update</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BlurView>
  );
};
