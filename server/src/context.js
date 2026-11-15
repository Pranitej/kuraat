/**
 * Dependency container passed to routes and services. Tests build it with the test database, the
 * fake ROF, a settable clock and a quiet logger; production builds it in src/index.js.
 */
export function createContext({ config, db, rof = null, clock = { now: () => new Date() }, logger = console, ...services }) {
  return { config, db, rof, clock, logger, ...services };
}
