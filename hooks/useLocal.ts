import AsyncStorage from '@react-native-async-storage/async-storage';
import { MonthConstant, ErrorConstants } from '@constants';
import { showErrorAlert } from '@utils';

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
  angs: number;
}
export interface FontSizeData {
  fontSize: string;
  number: number;
}
export interface AngsFormat {
  format: string;
}
export const useLocal = () => {
  const fetchFromLocal = async () => {
    try {
      const pathFromLocal = await AsyncStorage.getItem('pathDetails');
      let pathFromLocalArray: PathData[] = [];

      if (pathFromLocal) {
        pathFromLocalArray = JSON.parse(pathFromLocal);
        if (!Array.isArray(pathFromLocalArray)) {
          console.warn('Stored path data is not an array, resetting to empty array');
          pathFromLocalArray = [];
        }
      }

      const pathDateData = await AsyncStorage.getItem('pathDateDetails');
      let pathDateDataArray: DateData[] = [];

      if (pathDateData) {
        pathDateDataArray = JSON.parse(pathDateData);
        if (!Array.isArray(pathDateDataArray)) {
          showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_PROGRESS);
          pathDateDataArray = [];
        }
      }

      return { pathDataArray: pathFromLocalArray, pathDateDataArray: pathDateDataArray };
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_SEHAJ_PATHS_DATA);
      return { pathDataArray: [], pathDateDataArray: [] };
    }
  };

  const handleNewPath = async () => {
    try {
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

      return { pathDataArray, pathDateDataArray, newPathid };
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
      throw error;
    }
  };

  const handleUpdatePath = async (
    pathId: number,
    angNumber: number,
    verseId: number,
    scrollPosition: number,
    setIsSaved: (value: boolean) => void
  ) => {
    try {
      const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
      const date = new Date();
      const todayDate = `${date.getDate()}-${MonthConstant[date.getMonth()]}-${date.getFullYear()}`;
      const matchedPath = pathDataArray.find((path) => path.pathId === pathId);
      const matchedDate = pathDateDataArray.find((path) => path.pathid === pathId);
      const updatedPathDate = pathDateDataArray.filter((path) => path.pathid !== pathId);

      if (matchedPath && matchedDate) {
        const cleanMatchedPathDates = matchedDate.dates.filter((dates) => dates.date !== todayDate);

        const lastAngs =
          cleanMatchedPathDates.length > 0
            ? cleanMatchedPathDates[cleanMatchedPathDates.length - 1].angs
            : 0;
        const lastestAngsDone = angNumber - lastAngs;
        matchedPath.saveData = { angNumber, verseId };
        matchedPath.progress = (angNumber / 1430) * 100;

        const updatedDates = [
          ...cleanMatchedPathDates,
          {
            date: todayDate,
            angs: lastestAngsDone,
          },
        ];

        updatedPathDate.push({
          pathid: pathId,
          dates: updatedDates,
          scrollPosition: scrollPosition,
        });

        if (angNumber === 1430 && verseId === 60403) {
          matchedPath.completionDate = todayDate;
        }

        await AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray));
        await AsyncStorage.setItem('pathDateDetails', JSON.stringify(updatedPathDate));
        setIsSaved(true);
      } else {
        console.warn(`Path with ID ${pathId} not found during update operation`);
      }
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
    }
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
    try {
      await AsyncStorage.setItem('fontSize', JSON.stringify(fontSize));
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
      throw error;
    }
  };

  const fetchFontSize = async () => {
    try {
      const fontSize = await AsyncStorage.getItem('fontSize');
      if (fontSize) {
        const parsedFontSize = JSON.parse(fontSize);
        if (
          parsedFontSize &&
          typeof parsedFontSize.fontSize === 'string' &&
          typeof parsedFontSize.number === 'number'
        ) {
          return parsedFontSize;
        } else {
          console.warn('Invalid font size data structure, using default');
          return { fontSize: 'Small (Default)', number: 18 };
        }
      }
      return { fontSize: 'Small (Default)', number: 18 };
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_FONT_SIZE);
      return { fontSize: 'Small (Default)', number: 18 };
    }
  };

  const saveLarivaar = async (larivaar: boolean) => {
    try {
      await AsyncStorage.setItem('larivaar', larivaar.toString());
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_LARIVAAR);
      throw error;
    }
  };

  const fetchLarivaar = async () => {
    try {
      const larivaar = await AsyncStorage.getItem('larivaar');
      return larivaar === 'true';
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_LARIVAAR);
      return false;
    }
  };

  const saveAngsFormat = async (angsFormat: AngsFormat) => {
    try {
      await AsyncStorage.setItem('angsFormat', JSON.stringify(angsFormat));
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_ANG_FORMAT);
      throw error;
    }
  };

  const fetchAngsFormat = async () => {
    try {
      const angsFormat = await AsyncStorage.getItem('angsFormat');
      if (angsFormat) {
        const parsedAngsFormat = JSON.parse(angsFormat);
        if (parsedAngsFormat && typeof parsedAngsFormat.format === 'string') {
          return parsedAngsFormat;
        } else {
          console.warn('Invalid angs format data structure, using default');
          return { format: 'Punjabi' };
        }
      }
      return { format: 'Punjabi' };
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_ANG_FORMAT);
      return { format: 'Punjabi' };
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
  };
};
