import { randomUUID } from 'node:crypto';

/** New primary key for our tables. */
export const newId = () => randomUUID();
