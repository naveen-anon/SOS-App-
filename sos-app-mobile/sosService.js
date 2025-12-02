import axios from 'axios';

const BACKEND_URL = 'https://your-backend.example.com';

export async function sendSOS(payload) {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/sos`, payload);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err };
  }
}
