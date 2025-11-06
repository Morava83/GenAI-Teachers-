import axios from 'axios';

const API_BASE_URL = '/api';

export const generateProblem = async (formData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/generate`, formData, {
      headers: {'Content-Type': 'application/json'},
      timeout: 60000,
    });
    return response.data;
  } catch (error) {
    console.error('Error generating problem:', error);
    throw error;
  }
};

export const healthCheck = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

