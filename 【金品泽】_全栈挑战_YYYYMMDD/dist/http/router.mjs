import { appErrorToResponse, badRequest } from '../domain/errors.mjs';
import { validateAnswerPayload, validateCreateSessionPayload, validatePayPayload, validateSessionId } from '../domain/validation.mjs';

function json(status, body) {
  return { status, body };
}

function routeParts(requestPath) {
  const url = new URL(requestPath, 'http://local.test');
  return url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

export function createApp(repo, options = {}) {
  return {
    async handle(method, requestPath, body = {}) {
      try {
        const upper = method.toUpperCase();
        const parts = routeParts(requestPath);

        if (upper === 'GET' && parts.length === 1 && parts[0] === 'health') {
          return json(200, { ok: true });
        }

        if (upper === 'POST' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'sessions') {
          const payload = validateCreateSessionPayload(body || {});
          return json(201, repo.createSession(payload.preferredSessionId));
        }

        if (parts[0] === 'api' && parts[1] === 'sessions' && parts[2]) {
          const sessionId = validateSessionId(parts[2]);
          if (upper === 'GET' && parts[3] === 'progress' && parts.length === 4) {
            return json(200, repo.getProgress(sessionId));
          }
          if (upper === 'PATCH' && parts[3] === 'answers' && parts.length === 4) {
            const payload = validateAnswerPayload(body || {});
            return json(200, repo.saveStep(sessionId, payload.step, payload.data, payload.expectedVersion));
          }
          if (upper === 'POST' && parts[3] === 'complete' && parts.length === 4) {
            return json(200, repo.complete(sessionId, { baseDate: options.baseDate }));
          }
          if (upper === 'GET' && parts[3] === 'result' && parts.length === 4) {
            return json(200, repo.getResult(sessionId, { baseDate: options.baseDate }));
          }
        }

        if (upper === 'POST' && parts.length === 1 && parts[0] === 'pay') {
          const payload = validatePayPayload(body || {});
          return json(200, repo.activateSubscription(payload.sessionId, payload.provider, payload.eventId));
        }

        throw badRequest('ROUTE_NOT_FOUND', 'No route matches this request', { method: upper, path: requestPath });
      } catch (error) {
        return appErrorToResponse(error);
      }
    }
  };
}
