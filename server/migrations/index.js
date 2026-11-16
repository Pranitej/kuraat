/**
 * Ordered list of database migrations. Add new files to the end; never edit one that has already
 * run in a shared environment (UAT/production) — add a new migration instead.
 */
import * as init from './001_init.js';
import * as accountDeletion from './002_account_deletion.js';

export const migrations = [
  { name: '001_init', ...init },
  { name: '002_account_deletion', ...accountDeletion },
];
