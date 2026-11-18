/**
 * An address no longer carries a mobile number: the customer has one number, the one on the account
 * (fixed when the account is created), and RSOF finds a customer's orders by it.
 * down() puts the column back empty-able; the numbers that were stored are not recoverable.
 */
export async function up(knex) {
  await knex.schema.alterTable('addresses', (t) => {
    t.dropColumn('phone');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('addresses', (t) => {
    t.string('phone', 20).nullable();
  });
}
