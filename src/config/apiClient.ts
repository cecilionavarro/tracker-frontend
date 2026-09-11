import axios from "axios";

export const API_BASE_URL = window.location.origin;

const API = axios.create({ baseURL: API_BASE_URL });

export default API;
