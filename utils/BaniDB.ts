import axios from "axios";

export const BaniDB = async (angNumber: number) => {
  const baniDBUrl = `https://api.banidb.com/v2/angs/${angNumber}`;

  try {
    const response = await axios.get(baniDBUrl);
    return response.data;
  } catch (error) {
    return "Caught an error while fetching the Bani.";
  }
};
