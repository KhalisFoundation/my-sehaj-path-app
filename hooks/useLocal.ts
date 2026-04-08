import AsyncStorage from '@react-native-async-storage/async-storage';
import { MonthConstant, ErrorConstants, PATH_DATA, Constants } from '@constants';
import { trackEvent, showErrorAlert } from '@utils';
import { isPathCompleted } from '@utils/isPathCompleted';

export interface PathData {
  pathId: number;
  saveData: { angNumber: number; verseId: number };
  progress: number;
  startDate: string;
  completionDate: string;
  pathName: string;
}
export interface DateData {
  pathid: number;
  dates: PathDate[];
  scrollPosition: number;
}
export interface PathDate {
  date: string;
}
export interface FontSizeData {
  fontSize: string;
  number: number;
}
export interface AngsFormat {
  format: 'Punjabi' | 'English';
}

export interface VishraamsSource {
  source: 'sttm' | 'igurbani' | 'sttm2';
}

export interface VishraamsMarker {
  p: number;
  t: string;
}

export interface Visraams {
  sttm2: VishraamsMarker[];
  sttm: VishraamsMarker[];
  igurbani: VishraamsMarker[];
}

export interface Verse {
  verseId: number;
  shabadId: number;
  verse: {
    unicode: string;
  };
  larivaar: {
    unicode: string;
  };
  visraam: Visraams;
}

export interface PathContent {
  page: Verse[];
  source: {
    pageNo: number;
  };
}

export const useLocal = () => {
  const fetchFromLocal = async () => {
    const pathFromLocal = await AsyncStorage.getItem('pathDetails');
    let pathFromLocalArray: PathData[] = [];
    if (pathFromLocal) {
      try {
        pathFromLocalArray = JSON.parse(pathFromLocal);
        if (!Array.isArray(pathFromLocalArray)) {
          pathFromLocalArray = [];
        }
      } catch (parseError) {
        pathFromLocalArray = [];
      }
    }

    const pathDateData = await AsyncStorage.getItem('pathDateDetails');
    let pathDateDataArray: DateData[] = [];

    if (pathDateData) {
      try {
        pathDateDataArray = JSON.parse(pathDateData);
        if (!Array.isArray(pathDateDataArray)) {
          pathDateDataArray = [];
        }
      } catch (parseError) {
        pathDateDataArray = [];
      }
    }

    return { pathDataArray: pathFromLocalArray, pathDateDataArray: pathDateDataArray };
  };

  const handleNewPath = async () => {
    const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
    let pathid = pathDataArray.length > 0 ? pathDataArray.length : 0;
    let newPathid = pathid + 1;
    const date = new Date();
    const startNewPathDate = `${date.getDate()}-${
      MonthConstant[date.getMonth()]
    }-${date.getFullYear()}`;

    const newPath: PathData = {
      pathId: newPathid,
      progress: 1,
      saveData: { angNumber: 0, verseId: 0 },
      startDate: startNewPathDate,
      completionDate: '',
      pathName: `Path #${newPathid}`,
    };

    const newPathDate: DateData = {
      pathid: newPathid,
      dates: [],
      scrollPosition: 0,
    };
    pathDataArray.push(newPath);
    pathDateDataArray.push(newPathDate);
    await AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray));
    await AsyncStorage.setItem('pathDateDetails', JSON.stringify(pathDateDataArray));
    return { pathDataArray, pathDateDataArray, newPathid };
  };

  const handleUpdatePath = async (
    pathId: number,
    angNumber: number,
    verseId: number,
    scrollPosition: number,
    setIsSaved: (value: boolean) => void
  ) => {
    const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
    const date = new Date();
    const todayDate = `${date.getDate()}-${MonthConstant[date.getMonth()]}-${date.getFullYear()}`;
    const matchedPath = pathDataArray.find((path) => path.pathId === pathId);
    const matchedDate = pathDateDataArray.find((path) => path.pathid === pathId);
    const updatedPathDate = pathDateDataArray.filter((path) => path.pathid !== pathId);
    if (matchedPath && matchedDate) {
      const cleanMatchedPathDates = matchedDate.dates.filter((dates) => dates.date !== todayDate);
      matchedPath.saveData = { angNumber, verseId };

      matchedPath.progress = (angNumber / PATH_DATA.LAST_ANG_NUMBER) * 100;

      const updatedDates = [
        ...cleanMatchedPathDates,
        {
          date: todayDate,
        },
      ];

      updatedPathDate.push({
        pathid: pathId,
        dates: updatedDates,
        scrollPosition: scrollPosition,
      });

      // Completion is authoritative only when the exact final ang + final verse is saved.
      if (isPathCompleted(angNumber, verseId)) {
        matchedPath.completionDate = todayDate;
        trackEvent('PathCompleted', 'completed', `path completed`);
      } else {
        matchedPath.completionDate = '';
      }

      await Promise.all([
        AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray)),
        AsyncStorage.setItem('pathDateDetails', JSON.stringify(updatedPathDate)),
      ]);

      setIsSaved(true);
    } else {
      throw new Error(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
    }
  };
  const handleUpdatePathWithErrorHandling = async (
    pathId: number,
    angNumber: number,
    verseId: number,
    scrollPosition: number,
    setIsSaved: (value: boolean) => void
  ) => {
    try {
      await handleUpdatePath(pathId, angNumber, verseId, scrollPosition, setIsSaved);
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
    }
  };
  const clearPathCompletionAndSavedVerse = async (
    pathId: number,
    scrollPosition?: number,
    angNumber?: number
  ) => {
    const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
    const matchedPath = pathDataArray.find((path) => path.pathId === pathId);
    const matchedPathDate = pathDateDataArray.find((pathDate) => pathDate.pathid === pathId);

    if (matchedPath) {
      // Undo completion and clear verse selection, while keeping current ang context.
      matchedPath.completionDate = '';
      matchedPath.saveData = {
        angNumber: angNumber ?? matchedPath.saveData.angNumber,
        verseId: 0,
      };

      // `scrollPosition` is ScrollView `contentOffset.y` (type: number, unit: vertical pixels).
      if (matchedPathDate && scrollPosition !== undefined) {
        matchedPathDate.scrollPosition = scrollPosition;
      }

      await Promise.all([
        AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray)),
        AsyncStorage.setItem('pathDateDetails', JSON.stringify(pathDateDataArray)),
      ]);
      return true;
    }

    throw new Error(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
  };
  // Lightweight write path used during scroll-only mode (no verse/completion mutation). Needed for completion undo.
  const updatePathScrollPosition = async (pathId: number, scrollPosition: number) => {
    const { pathDateDataArray } = await fetchFromLocal();
    const matchedPathDate = pathDateDataArray.find((pathDate) => pathDate.pathid === pathId);

    if (matchedPathDate) {
      // `scrollPosition` is ScrollView `contentOffset.y` (type: number, unit: vertical pixels).
      // Lightweight write path used during scroll-only mode (no verse/completion mutation).
      matchedPathDate.scrollPosition = scrollPosition;
      await AsyncStorage.setItem('pathDateDetails', JSON.stringify(pathDateDataArray));
      return true;
    }

    throw new Error(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
  };

  const renamePath = async (pathId: number, pathName: string) => {
    try {
      const { pathDataArray } = await fetchFromLocal();
      const matchedPath = pathDataArray.find((path: PathData) => path.pathId === pathId);
      const updatedPathDataArray = pathDataArray.filter((path: PathData) => path.pathId !== pathId);

      if (matchedPath) {
        matchedPath.pathName = pathName;
        updatedPathDataArray.push(matchedPath);
        await AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray));
        return true;
      }
      return false;
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_RENAME_PATH);
    }
  };

  const saveFontSize = async (fontSize: FontSizeData) => {
    await AsyncStorage.setItem('fontSize', JSON.stringify(fontSize));
  };

  const fetchFontSize = async () => {
    try {
      const fontSize = await AsyncStorage.getItem('fontSize');
      if (fontSize) {
        try {
          const parsedFontSize = JSON.parse(fontSize);
          if (parsedFontSize && typeof parsedFontSize === 'object') {
            return parsedFontSize;
          } else {
            return { fontSize: 'Small (Default)', number: 18 };
          }
        } catch (parseError) {
          return { fontSize: 'Small (Default)', number: 18 };
        }
      }
      return { fontSize: 'Small (Default)', number: 18 };
    } catch (error) {
      return { fontSize: 'Small (Default)', number: 18 };
    }
  };

  const saveLarivaar = async (larivaar: boolean) => {
    await AsyncStorage.setItem('larivaar', larivaar.toString());
  };

  const fetchLarivaar = async () => {
    try {
      const larivaar = await AsyncStorage.getItem('larivaar');
      return larivaar === 'true';
    } catch (error) {
      return false;
    }
  };

  const saveParagraphMode = async (paragraphMode: boolean) => {
    await AsyncStorage.setItem('paragraphMode', paragraphMode.toString());
  };

  const fetchParagraphMode = async () => {
    try {
      const paragraphMode = await AsyncStorage.getItem('paragraphMode');
      return paragraphMode === 'true';
    } catch (error) {
      return false;
    }
  };

  const saveVishraam = async (vishraam: boolean) => {
    await AsyncStorage.setItem('vishraam', vishraam.toString());
  };

  const fetchVishraam = async () => {
    try {
      const vishraam = await AsyncStorage.getItem('vishraam');
      return vishraam === 'true';
    } catch (error) {
      return false;
    }
  };

  const saveVishraamsSource = async (vishraamsSource: VishraamsSource) => {
    await AsyncStorage.setItem('vishraamsSource', JSON.stringify(vishraamsSource));
  };

  const fetchVishraamsSource = async () => {
    try {
      const vishraamsSource = await AsyncStorage.getItem('vishraamsSource');
      if (vishraamsSource) {
        try {
          const parsedVishraamsSource = JSON.parse(vishraamsSource);
          if (parsedVishraamsSource && typeof parsedVishraamsSource === 'object') {
            return parsedVishraamsSource;
          }
        } catch (parseError) {
          return { source: Constants.DEFAULT_VISHRAAM_SOURCE };
        }
      }
      return { source: Constants.DEFAULT_VISHRAAM_SOURCE };
    } catch (error) {
      return { source: Constants.DEFAULT_VISHRAAM_SOURCE };
    }
  };

  const saveAngsFormat = async (angsFormat: AngsFormat) => {
    await AsyncStorage.setItem('angsFormat', JSON.stringify(angsFormat));
  };

  const fetchAngsFormat = async () => {
    try {
      const angsFormat = await AsyncStorage.getItem('angsFormat');
      if (angsFormat) {
        try {
          const parsedAngsFormat = JSON.parse(angsFormat);
          if (parsedAngsFormat && typeof parsedAngsFormat === 'object') {
            return parsedAngsFormat;
          }
        } catch (parseError) {
          showErrorAlert(ErrorConstants.FAILED_TO_LOAD_ANG_FORMAT);
        }
      }
      return { format: 'Punjabi' };
    } catch (error) {
      return { format: 'Punjabi' };
    }
  };
  const saveConsent = async (consent: boolean) => {
    await AsyncStorage.setItem('consent', consent.toString());
  };

  const fetchConsent = async () => {
    try {
      const consent = await AsyncStorage.getItem('consent');
      if (consent === null) {
        await AsyncStorage.setItem('consent', 'true');
        return true;
      }
      return consent === 'true';
    } catch (error) {
      return false;
    }
  };

  return {
    fetchFromLocal,
    handleNewPath,
    handleUpdatePath,
    saveFontSize,
    fetchFontSize,
    saveLarivaar,
    fetchLarivaar,
    renamePath,
    saveAngsFormat,
    fetchAngsFormat,
    saveConsent,
    fetchConsent,
    handleUpdatePathWithErrorHandling,
    clearPathCompletionAndSavedVerse,
    updatePathScrollPosition,
    saveParagraphMode,
    fetchParagraphMode,
    saveVishraam,
    fetchVishraam,
    saveVishraamsSource,
    fetchVishraamsSource,
  };
};
