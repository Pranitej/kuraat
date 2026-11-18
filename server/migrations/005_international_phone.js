/**
 * International mobile numbers: Saudi numbers stay 9 digits (501234821), every other country is stored as
 * "+<country code><number>" (up to 16 characters). The phone columns were 9 characters wide, so they are widened to 20.
 * No data changes: every existing value stays exactly as it is.
 */
const COLUMNS = [
  ['users', 'phone', { nullable: true }], // NULL once an account is deleted (migration 002)
  ['otp_challenges', 'phone', { nullable: false }],
  ['addresses', 'phone', { nullable: false }],
  ['orders', 'delivery_phone', { nullable: false }],
];

export async function up(knex) {
  for (const [table, column, { nullable }] of COLUMNS) {
    await knex.schema.alterTable(table, (t) => {
      const col = t.string(column, 20);
      (nullable ? col.nullable() : col.notNullable()).alter();
    });
  }
}

export async function down(knex) {
  // Narrowing would cut foreign numbers off: refuse rather than lose or delete anything.
  for (const [table, column] of COLUMNS) {
    const { n } = await knex(table).whereRaw('CHAR_LENGTH(??) > 9', [column]).count({ n: '*' }).first();
    if (Number(n) > 0) throw new Error(`Cannot narrow ${table}.${column}: ${n} international number(s) are stored`);
  }
  for (const [table, column, { nullable }] of COLUMNS) {
    await knex.schema.alterTable(table, (t) => {
      const col = t.string(column, 9);
      (nullable ? col.nullable() : col.notNullable()).alter();
    });
  }
}
