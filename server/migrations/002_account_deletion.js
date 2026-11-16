/**
 * Account deletion (App Store guideline 5.1.1(v), Google Play account-deletion policy).
 * A deleted account keeps its row as an anonymous tombstone so placed orders (records RSOF and
 * the branch keep) still point at it; the phone is released so the number can sign up again.
 */
const PURPOSES = ['signup', 'signin', 'reset', 'change-phone'];

export async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.string('phone', 9).nullable().alter(); // NULL once deleted; MySQL's unique index allows many NULLs
    t.datetime('deleted_at', { precision: 3 }).nullable();
  });
  await knex.schema.alterTable('otp_challenges', (t) => {
    t.enu('purpose', [...PURPOSES, 'delete-account']).notNullable().alter();
  });
}

export async function down(knex) {
  await knex('otp_challenges').where({ purpose: 'delete-account' }).delete();
  await knex.schema.alterTable('otp_challenges', (t) => {
    t.enu('purpose', PURPOSES).notNullable().alter();
  });
  await knex('users').whereNotNull('deleted_at').delete();
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('deleted_at');
    t.string('phone', 9).notNullable().alter();
  });
}
