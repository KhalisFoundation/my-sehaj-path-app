import axios from 'axios';

export const BaniDB = async (angNumber: number) => {
  const baniDBUrl = `https://api.banidb.com/v2/angs/${angNumber}`;

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
