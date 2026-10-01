/** The one row an INSERT … RETURNING gives back. */
export function single<T>(rows: T[]): T {
  const [row] = rows
  if (row === undefined) throw new Error("Expected a row, got none")
  return row
}
