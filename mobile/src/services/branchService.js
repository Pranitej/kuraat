/** Delivery branches from the server (RSOF hub branches + our opening hours, openNow in Saudi time). */
import { apiRequest } from './api.js';

export const listBranches = () => apiRequest('/branches');
