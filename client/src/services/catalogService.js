/** Catalogue from the server (which reads it from RSOF): active products only. */
import { apiRequest } from './api.js';

export const listCategories = () => apiRequest('/categories');
export const listProducts = () => apiRequest('/products');
/** The full product: the list has no detail rows (RSOF sends field definitions only per product). */
export const getProductDetail = (id) => apiRequest(`/products/${encodeURIComponent(id)}`);
