import { PgSelect } from "db";
import { db } from "db/client";

export async function withPagination<T extends PgSelect>(
  query: T,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const page = Math.min(
    Math.max(parseInt(searchParams.page?.toString() ?? "0"), 1),
    3000,
  );
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.size?.toString() ?? "0"), 20),
    100,
  );
  const offset = (page - 1) * pageSize;

  const total = await db.$count(query);
  const rows = await query.offset(offset).limit(pageSize);

  return { page, pageSize, total, rows };
}
