/**
 * Card payments move to RSOF (19 Nov 2026): the customer pays on RSOF's payment-link page, so a card order is
 * placed first and paid after. New payment states:
 *   pending        — the order is in RSOF, the customer has not paid on RSOF's page yet
 *   refund_pending — a paid order was cancelled; the money goes back through RSOF / the store, not through us
 * paid_at: when RSOF first told us the order is paid (answer "AlreadyPaid").
 * down() refuses while any payment is in one of the new states.
 */
const OLD_STATUSES = ['authorized', 'captured', 'voided', 'refunded', 'failed', 'needs_review'];

export async function up(knex) {
  await knex.schema.alterTable('payments', (t) => {
    t.enu('status', [...OLD_STATUSES, 'pending', 'refund_pending']).notNullable().alter();
    t.datetime('paid_at', { precision: 3 }).nullable();
  });
}

export async function down(knex) {
  const { n } = await knex('payments').whereIn('status', ['pending', 'refund_pending']).count({ n: '*' }).first();
  if (Number(n) > 0) throw new Error(`Cannot remove the online payment states: ${n} payment(s) use them`);
  await knex.schema.alterTable('payments', (t) => {
    t.dropColumn('paid_at');
    t.enu('status', OLD_STATUSES).notNullable().alter();
  });
}
