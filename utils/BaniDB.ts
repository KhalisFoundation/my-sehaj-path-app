import { API_URL } from '@constants/API';
import axios from 'axios';

export const BaniDB = async (angNumber: number) => {
  const baniDBUrl = `${API_URL}${angNumber}`;

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
