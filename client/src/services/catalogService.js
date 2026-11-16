/** Catalogue from the server (which reads it from RSOF): active products only. */
import { apiRequest } from './api.js';

export const listCategories = () => apiRequest('/categories');
export const listProducts = () => apiRequest('/products');
