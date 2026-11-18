import { useEffect, useState } from 'react';
import { loadProductImage } from '@/services/productImage.js';

/**
 * The current photo of a product (see services/productImage.js): null while it loads, when the product is
 * gone from RSOF, has no photo, or the lookup failed. Callers draw the placeholder for null.
 */
export function useProductImage(productId) {
  const [state, setState] = useState({ id: productId, src: null });
  useEffect(() => {
    let alive = true;
    setState({ id: productId, src: null });
    loadProductImage(productId).then((src) => alive && setState({ id: productId, src }));
    return () => {
      alive = false;
    };
  }, [productId]);
  // A new product id never shows the previous product's photo while its own is loading.
  return state.id === productId ? state.src : null;
}
