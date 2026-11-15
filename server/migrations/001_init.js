/**
 * Initial schema (design spec §6.6). All ids are UUID strings; all times are UTC DATETIME(3) set by
 * the app's clock; money is DECIMAL(10,2) in SAR; JSON columns hold small structured values.
 */

const timestamps = (t, knex) => {
  t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
  t.datetime('updated_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
};
const money = (t, name) => t.decimal(name, 10, 2).notNullable().defaultTo(0);

export async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary();
    t.string('phone', 9).notNullable().unique().comment('9-digit Saudi mobile, e.g. 501234821');
    t.string('name', 120).notNullable();
    t.string('email', 190).nullable();
    t.enu('gender', ['male', 'female', 'other']).nullable();
    t.specificType('avatar', 'MEDIUMTEXT').nullable().comment('data:image/... URL, max ~300 KB');
    t.string('password_hash', 100).nullable();
    timestamps(t, knex);
  });

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique().comment('SHA-256 of the refresh token');
    t.datetime('expires_at', { precision: 3 }).notNullable();
    t.datetime('revoked_at', { precision: 3 }).nullable();
    timestamps(t, knex);
  });

  await knex.schema.createTable('otp_challenges', (t) => {
    t.uuid('id').primary();
    t.string('phone', 9).notNullable().index();
    t.enu('purpose', ['signup', 'signin', 'reset', 'change-phone']).notNullable();
    t.string('code_hash', 64).notNullable();
    t.json('payload').nullable().comment('sign-up form carried through verification');
    t.uuid('user_id').nullable().comment('set for change-phone (the signed-in user)');
    t.integer('attempts').notNullable().defaultTo(0);
    t.datetime('sent_at', { precision: 3 }).notNullable();
    t.datetime('expires_at', { precision: 3 }).notNullable();
    t.datetime('verified_at', { precision: 3 }).nullable();
    t.datetime('consumed_at', { precision: 3 }).nullable();
    timestamps(t, knex);
  });

  await knex.schema.createTable('addresses', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('label', 60).notNullable();
    t.enu('type', ['home', 'office', 'other']).notNullable();
    t.string('line', 200).notNullable();
    t.string('district', 100).notNullable().defaultTo('');
    t.string('city', 60).notNullable();
    t.string('postcode', 10).notNullable().defaultTo('');
    t.string('landmark', 200).notNullable().defaultTo('');
    t.string('phone', 9).notNullable();
    t.string('contact_name', 120).notNullable().defaultTo('');
    t.decimal('lat', 9, 6).notNullable();
    t.decimal('lng', 9, 6).notNullable();
    t.boolean('is_default').notNullable().defaultTo(false);
    timestamps(t, knex);
    t.index(['user_id', 'is_default']);
  });

  await knex.schema.createTable('carts', (t) => {
    t.uuid('user_id').primary().references('users.id').onDelete('CASCADE');
    t.json('items').notNullable().comment('[{ productId, qty, lastPrice }]');
    t.string('promo_code', 40).nullable();
    timestamps(t, knex);
  });

  await knex.schema.createTable('favorites', (t) => {
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('product_id', 64).notNullable().comment('ROF product id');
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.primary(['user_id', 'product_id']);
  });

  await knex.schema.createTable('saved_cards', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('brand', 30).notNullable();
    t.string('last4', 4).notNullable();
    t.string('expiry', 5).notNullable();
    timestamps(t, knex);
    t.unique(['user_id', 'brand', 'last4']);
  });

  await knex.schema.createTable('orders', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('rof_order_id', 64).notNullable().unique();
    t.integer('rof_order_number').notNullable();
    t.string('rof_status', 40).notNullable();
    t.datetime('rof_status_at', { precision: 3 }).nullable();
    t.tinyint('step').nullable().comment('0-3; null while unknown');
    t.boolean('cancelled').notNullable().defaultTo(false);
    t.string('branch_id', 64).nullable();
    t.string('branch_name', 160).nullable();
    t.decimal('distance_km', 7, 1).nullable();
    t.json('address').notNullable().comment('snapshot incl. location');
    t.string('delivery_phone', 9).notNullable();
    t.json('lines').notNullable().comment('[{ productId, name, qty, price, image }]');
    money(t, 'subtotal');
    money(t, 'discount');
    money(t, 'delivery_fee');
    money(t, 'vat');
    money(t, 'total');
    t.string('promo_code', 40).nullable();
    t.datetime('window_start', { precision: 3 }).notNullable();
    t.datetime('window_end', { precision: 3 }).notNullable();
    t.json('estimates').notNullable().comment('{ preparingAt, outForDeliveryAt, windowStart, windowEnd }');
    t.json('step_times').nullable().comment('{ 0: iso, 1: iso, ... } from the ROF timeline');
    t.json('notified').nullable().comment('status notifications already sent');
    t.datetime('cancelled_at', { precision: 3 }).nullable();
    t.datetime('last_synced_at', { precision: 3 }).nullable();
    t.datetime('code_resent_at', { precision: 3 }).nullable();
    timestamps(t, knex);
    t.index(['user_id', 'created_at']);
  });

  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.uuid('order_id').nullable().references('orders.id').onDelete('SET NULL');
    t.uuid('idempotency_key').notNullable().unique();
    t.enu('method', ['card', 'upi', 'cod']).notNullable();
    t.enu('status', ['authorized', 'captured', 'voided', 'refunded', 'failed', 'needs_review']).notNullable();
    money(t, 'amount');
    t.string('brand', 30).nullable();
    t.string('last4', 4).nullable();
    t.string('upi_id', 120).nullable();
    t.string('transaction_id', 40).nullable();
    t.string('error_code', 60).nullable();
    t.string('error_message', 300).nullable();
    timestamps(t, knex);
  });

  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('type', 30).notNullable();
    t.string('title', 160).notNullable();
    t.string('body', 400).notNullable();
    t.json('link').nullable();
    t.boolean('read').notNullable().defaultTo(false);
    t.datetime('created_at', { precision: 3 }).notNullable().defaultTo(knex.fn.now(3));
    t.index(['user_id', 'created_at']);
  });
}

export async function down(knex) {
  for (const table of [
    'notifications',
    'payments',
    'orders',
    'saved_cards',
    'favorites',
    'carts',
    'addresses',
    'otp_challenges',
    'refresh_tokens',
    'users',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
}
