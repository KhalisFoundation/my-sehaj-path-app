import axios from "axios";

export const BaniDB = async (angNumber: number) => {
  try {
    const response = await axios.get("https://api.banidb.com/v2/health");
    console.log(response.data);
  } catch (error) {
    console.log(error);
  }
};
