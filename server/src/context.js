/**
 * Dependency container passed to routes and services. Tests build it with the test database, the
 * fake ROF and a settable clock; production builds it in src/index.js.
 */
export function createContext({ config, db, rof = null, clock = { now: () => new Date() }, ...services }) {
  return { config, db, rof, clock, ...services };
}
