import axios from "axios";

export const API_BASE_URL = "http://localhost:4004";

const API = axios.create({ baseURL: API_BASE_URL });

export default API;
