/**
 * An address no longer needs coordinates (decided 19 Nov 2026): sharing the location is the customer's choice,
 * an order can be placed without it, and RSOF asks the customer for it on WhatsApp once the order exists.
 * down() makes the columns required again and refuses while any address has no location.
 */
export async function up(knex) {
  await knex.schema.alterTable('addresses', (t) => {
    t.decimal('lat', 9, 6).nullable().alter();
    t.decimal('lng', 9, 6).nullable().alter();
  });
}

export async function down(knex) {
  const { n } = await knex('addresses').whereNull('lat').orWhereNull('lng').count({ n: '*' }).first();
  if (Number(n) > 0) throw new Error(`Cannot make addresses.lat/lng required: ${n} address(es) have no location`);
  await knex.schema.alterTable('addresses', (t) => {
    t.decimal('lat', 9, 6).notNullable().alter();
    t.decimal('lng', 9, 6).notNullable().alter();
  });
}
