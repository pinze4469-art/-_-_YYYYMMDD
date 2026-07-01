import type { QuizRepository } from '../types';

export interface HttpResult<T = unknown> {
  status: number;
  body: T;
}

export interface QuizApp {
  handle(method: string, path: string, body?: unknown): Promise<HttpResult>;
}

// Runtime implementation is in dist/http/router.mjs. It depends only on this repository contract,
// making it straightforward to swap the local JSON adapter for Prisma/PostgreSQL.
export function createApp(_repo: QuizRepository): QuizApp {
  throw new Error('Use dist/http/router.mjs at runtime or compile src with a TypeScript build step.');
}
