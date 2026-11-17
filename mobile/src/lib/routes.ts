/**
 * The shared route map (config/routes.js — identical to the web's), typed for Expo Router's typed
 * routes. Screens import ROUTES from here; the paths themselves live in the shared file.
 */
import type { Href } from 'expo-router';
import { ROUTES as SHARED_ROUTES } from '@/config/routes.js';

type Shared = typeof SHARED_ROUTES;
type Typed = { [K in keyof Shared]: Shared[K] extends (...args: infer A) => string ? (...args: A) => Href : Href };

export const ROUTES = SHARED_ROUTES as unknown as Typed;
