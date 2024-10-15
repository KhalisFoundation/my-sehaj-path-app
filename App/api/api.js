import axios from 'axios';

export const fetchVerses = async (page) => {
  if (page < 1 || page > 1430) {
    throw new Error('Invalid page number');
  }
  try {
    const response = await axios.get(`https://api.banidb.com/v2/angs/${page}/`);
    return response.data.page.map(verse => verse.verse.unicode);
  } catch (err) {
    throw new Error(`Error fetching data for page ${page}: ${err.message}`);
  }
};
