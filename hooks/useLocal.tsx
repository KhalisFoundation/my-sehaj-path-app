import AsyncStorage from '@react-native-async-storage/async-storage';
import { MonthConstant } from '@constants';

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
    const pathFromLocal = await AsyncStorage.getItem('pathDetails');
    const pathFromLocalArray: PathData[] = pathFromLocal ? JSON.parse(pathFromLocal) : [];
    const pathDateData = await AsyncStorage.getItem('pathDateDetails');
    const pathDateDataArray: DateData[] = pathDateData ? JSON.parse(pathDateData) : [];
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
    pathDataArray.push({
      pathId: newPathid,
      progress: 1,
      saveData: { angNumber: 0, verseId: 0 },
      startDate: startNewPathDate,
      completionDate: '',
      pathName: `Path #${newPathid}`,
    });
    pathDateDataArray.push({
      pathid: newPathid,
      dates: [],
      scrollPosition: 0,
    });
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
      console.log('path not found');
    }
  };

  const renamePath = async (pathId: number, pathName: string) => {
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
  };

  const saveFontSize = async (fontSize: FontSizeData) => {
    await AsyncStorage.setItem('fontSize', JSON.stringify(fontSize));
  };

  const fetchFontSize = async () => {
    const fontSize = await AsyncStorage.getItem('fontSize');
    return fontSize ? JSON.parse(fontSize) : { fontSize: 'Small (Default)', number: 18 };
  };

  const saveLarivaar = async (larivaar: boolean) => {
    await AsyncStorage.setItem('larivaar', larivaar.toString());
  };

  const fetchLarivaar = async () => {
    const larivaar = await AsyncStorage.getItem('larivaar');
    return larivaar === 'true';
  };

  const saveAngsFormat = async (angsFormat: AngsFormat) => {
    await AsyncStorage.setItem('angsFormat', JSON.stringify(angsFormat));
  };

  const fetchAngsFormat = async () => {
    const angsFormat = await AsyncStorage.getItem('angsFormat');
    return angsFormat ? JSON.parse(angsFormat) : { format: 'Punjabi' };
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
