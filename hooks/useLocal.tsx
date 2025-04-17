import AsyncStorage from "@react-native-async-storage/async-storage";
import { MonthConstant } from "../constants";

export interface PathData {
  pathId: number;
  saveData: { angNumber: number; verseId: number };
  progress: number;
  startDate: string;
  completionDate: string;
}
interface DateData {
  pathid: number;
  dates: PathDate[];
}
interface PathDate {
  date: string;
  angs: number;
}
export const useLocal = () => {
  const fetchFromLocal = async () => {
    const pathFromLocal = await AsyncStorage.getItem("pathDetails");
    const pathFromLocalArray: PathData[] = pathFromLocal
      ? JSON.parse(pathFromLocal)
      : [];
    const pathDateData = await AsyncStorage.getItem("pathDateDetails");
    const pathDateDataArray: DateData[] = pathDateData
      ? JSON.parse(pathDateData)
      : [];
    return { pathDataArray: pathFromLocalArray, pathDateDataArray };
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
      completionDate: "",
    });
    pathDateDataArray.push({
      pathid: newPathid,
      dates: [],
    });
    return { pathDataArray, pathDateDataArray, newPathid };
  };
  const handleUpdatePath = async (
    pathId: number,
    angNumber: number,
    verseId: number,
    setIsSaved: (value: boolean) => void
  ) => {
    const { pathDataArray } = await fetchFromLocal();
    const matchedPath = pathDataArray.find((path) => path.pathId === pathId);
    if (matchedPath) {
      matchedPath.saveData = { angNumber, verseId };
      matchedPath.progress = (angNumber / 1430) * 100;
      console.log(matchedPath);
      if (verseId == 60403) {
        const date = new Date();
        const completionDate = `${date.getDate()}-${
          MonthConstant[date.getMonth()]
        }-${date.getFullYear()}`;
        matchedPath.completionDate = completionDate;
      }
      await AsyncStorage.setItem("pathDetails", JSON.stringify(pathDataArray));
      setIsSaved(true);
    } else {
      console.log("path not found");
    }
  };
  return { fetchFromLocal, handleNewPath, handleUpdatePath };
};
