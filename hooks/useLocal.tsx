import AsyncStorage from "@react-native-async-storage/async-storage";
import { MonthConstant } from "../constants";

interface PathData {
  pathId: number;
  angNumber: number;
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
      angNumber: 0,
      startDate: startNewPathDate,
      completionDate: "",
    });
    pathDateDataArray.push({
      pathid: newPathid,
      dates: [],
    });
    return { pathDataArray, pathDateDataArray, newPathid };
  };
  return { fetchFromLocal, handleNewPath };
};
