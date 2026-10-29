import { Request } from 'express';
import { ApiMeta } from './response';

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Parses ?page= & ?limit= safely, clamping to sane bounds. */
export function parsePagination(req: Request, defaultLimit = DEFAULT_LIMIT): Pagination {
  const rawPage = Number.parseInt(String(req.query.page ?? '1'), 10);
  const rawLimit = Number.parseInt(String(req.query.limit ?? defaultLimit), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}

/** Builds the `meta` block for a paginated list response. */
export function paginationMeta(total: number, { page, limit }: Pagination, extra?: ApiMeta): ApiMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    ...(extra || {}),
  };
}
