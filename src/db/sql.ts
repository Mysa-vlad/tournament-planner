/**
 * SQL tagged template: значення ніколи не вклеюються в текст запиту, а стають
 * параметрами $1..$n — захист від SQL-ін'єкцій без ORM (рекомендація завдання 2).
 *
 *   sql`SELECT * FROM teams WHERE id = ${id}` → { text: 'SELECT * FROM teams WHERE id = $1', values: [id] }
 */
export interface SqlQuery {
  readonly text: string;
  readonly values: readonly unknown[];
}

export const sql = (strings: TemplateStringsArray, ...values: readonly unknown[]): SqlQuery => ({
  text: strings.reduce((acc, part, i) => `${acc}$${String(i)}${part}`),
  values,
});
