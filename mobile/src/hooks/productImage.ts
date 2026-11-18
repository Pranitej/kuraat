import { useProductImage as useProductImageJs } from './useProductImage.js';

/**
 * The shared useProductImage (identical to the web's), typed: the current photo of a product from the
 * product-by-id API, or null while loading, when RSOF no longer has the product, or when the lookup failed.
 */
export const useProductImage = useProductImageJs as unknown as (productId: string | null | undefined) => string | null;
