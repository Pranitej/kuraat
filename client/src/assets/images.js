/** Resolves image keys used by the domain catalogue to bundled web assets. */

import logoWhite from './images/brand/logo-white.png';
import logoMaroon from './images/brand/logo-maroon.png';

const productFiles = import.meta.glob('./images/products/*.jpg', { eager: true, import: 'default' });

const productImages = Object.fromEntries(
  Object.entries(productFiles).map(([path, url]) => [path.split('/').pop().replace('.jpg', ''), url]),
);

export const logos = { white: logoWhite, maroon: logoMaroon };

export function productImage(key) {
  return productImages[key] || '';
}

/** All photos of a product, in gallery order. */
export function productGallery(product) {
  return product.images.map(productImage);
}

/** Welcome-screen hero photography (Truffle Box · Classic, from the client brand guide). */
export const welcomeHero = productImage('truffle-box-classic-1');
