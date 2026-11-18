/**
 * Branch pickup (design 2026-11-18 §5.3, §6): an order is delivery or pickup. A pickup order has no
 * delivery address and no delivery window, and can be paid at the branch.
 */
export async function up(knex) {
  await knex.schema.alterTable('orders', (t) => {
    t.enu('fulfilment', ['delivery', 'pickup']).notNullable().defaultTo('delivery').after('user_id');
    t.json('address').nullable().alter();
    t.datetime('window_start', { precision: 3 }).nullable().alter();
    t.datetime('window_end', { precision: 3 }).nullable().alter();
  });
  await knex.schema.alterTable('payments', (t) => {
    t.enu('method', ['card', 'upi', 'cod', 'branch']).notNullable().alter();
  });
}

export async function down(knex) {
  await knex('payments').where({ method: 'branch' }).update({ method: 'cod' });
  await knex('orders').where({ fulfilment: 'pickup' }).delete();
  await knex.schema.alterTable('payments', (t) => {
    t.enu('method', ['card', 'upi', 'cod']).notNullable().alter();
  });
  await knex.schema.alterTable('orders', (t) => {
    t.json('address').notNullable().alter();
    t.datetime('window_start', { precision: 3 }).notNullable().alter();
    t.datetime('window_end', { precision: 3 }).notNullable().alter();
    t.dropColumn('fulfilment');
  });
}
