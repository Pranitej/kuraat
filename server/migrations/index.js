/**
 * Ordered list of database migrations. Add new files to the end; never edit one that has already
 * run in a shared environment (UAT/production) — add a new migration instead.
 */
import * as init from './001_init.js';
import * as accountDeletion from './002_account_deletion.js';
import * as location from './003_location.js';
import * as pickup from './004_pickup.js';
import * as internationalPhone from './005_international_phone.js';
import * as addressNoPhone from './006_address_no_phone.js';
import * as addressLocationOptional from './007_address_location_optional.js';
import * as onlinePayment from './008_online_payment.js';

export const migrations = [
  { name: '001_init', ...init },
  { name: '002_account_deletion', ...accountDeletion },
  { name: '003_location', ...location },
  { name: '004_pickup', ...pickup },
  { name: '005_international_phone', ...internationalPhone },
  { name: '006_address_no_phone', ...addressNoPhone },
  { name: '007_address_location_optional', ...addressLocationOptional },
  { name: '008_online_payment', ...onlinePayment },
];
