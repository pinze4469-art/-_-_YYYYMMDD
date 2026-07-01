import type { QuizRepository, ProgressResponse, QuizStep, ResultResponse } from '../types';

// Runtime implementation is in dist/data/repository.mjs for zero-dependency execution.
// This interface is the production contract a Prisma/PostgreSQL adapter should implement.
export abstract class BaseQuizRepository implements QuizRepository {
  abstract createSession(preferredSessionId?: string): ProgressResponse;
  abstract getProgress(sessionId: string): ProgressResponse;
  abstract saveStep(sessionId: string, step: QuizStep, data: unknown, expectedVersion?: number): ProgressResponse;
  abstract complete(sessionId: string, options?: { baseDate?: string | Date }): ResultResponse;
  abstract getResult(sessionId: string, options?: { baseDate?: string | Date }): ResultResponse;
  abstract activateSubscription(sessionId: string, provider?: string, eventId?: string): { sessionId: string; subscriptionStatus: 'active'; paidAt: string; };
}
