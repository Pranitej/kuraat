/**
 * Location (design 2026-11-18 §5.6, §6): the customer's last known location, captured once per app
 * session and used for pickup pins later; and whether an order's pin reached ROF (ROF assigns the
 * branch from it — when it did not, RSOF staff assign by hand).
 */
export async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.decimal('last_lat', 9, 6).nullable();
    t.decimal('last_lng', 9, 6).nullable();
    t.datetime('last_location_at', { precision: 3 }).nullable();
  });
  await knex.schema.alterTable('orders', (t) => {
    t.boolean('location_shared').nullable().comment('null = placed before pins were sent');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('orders', (t) => {
    t.dropColumn('location_shared');
  });
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('last_lat');
    t.dropColumn('last_lng');
    t.dropColumn('last_location_at');
  });
}
