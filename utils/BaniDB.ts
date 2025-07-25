import { BANIDB_API } from '@constants/API';
import axios from 'axios';

export const BaniDB = async (angNumber: number) => {
  const baniDBUrl = `${BANIDB_API}${angNumber}`;

  try {
    const response = await axios.get(baniDBUrl);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
    };
  }
};
