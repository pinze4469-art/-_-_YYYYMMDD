import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { conflict, notFound, validationError } from '../domain/errors.mjs';
import { STEPS, validateSessionId, validateStepData } from '../domain/validation.mjs';
import { calculateHealthAssessment, maskAssessmentForPreview } from '../domain/health.mjs';

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function deepEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

function makeId(prefix) {
  return prefix + '_' + randomUUID().replace(/-/g, '').slice(0, 16);
}

export class MemoryQuizRepository {
  constructor(initialState = undefined) {
    this.sessions = new Map();
    if (initialState && Array.isArray(initialState.sessions)) {
      for (const session of initialState.sessions) {
        this.sessions.set(session.sessionId, clone(session));
      }
    }
  }

  persist() {}

  snapshot() {
    return { sessions: Array.from(this.sessions.values()).map(clone) };
  }

  createSession(preferredSessionId = undefined) {
    const sessionId = preferredSessionId ? validateSessionId(preferredSessionId) : makeId('q');
    if (this.sessions.has(sessionId)) {
      return this.toProgress(this.sessions.get(sessionId));
    }
    const session = {
      sessionId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 0,
      subscriptionStatus: 'inactive',
      answers: {},
      assessment: null,
      subscription: null,
      paymentEvents: []
    };
    this.sessions.set(sessionId, session);
    this.persist();
    return this.toProgress(session);
  }

  getSession(sessionId) {
    validateSessionId(sessionId);
    const session = this.sessions.get(sessionId);
    if (!session) throw notFound('Session not found');
    return session;
  }

  getProgress(sessionId) {
    return this.toProgress(this.getSession(sessionId));
  }

  saveStep(sessionId, step, data, expectedVersion = undefined) {
    const session = this.getSession(sessionId);
    const normalized = validateStepData(step, data);
    const existing = session.answers[step];
    if (existing && deepEqual(existing, normalized)) {
      return this.toProgress(session);
    }
    if (expectedVersion !== undefined && expectedVersion !== session.version) {
      throw conflict('Session was updated by another request', { expectedVersion, currentVersion: session.version });
    }
    session.answers[step] = normalized;
    session.version += 1;
    session.updatedAt = nowIso();
    session.assessment = null;
    this.persist();
    return this.toProgress(session);
  }

  complete(sessionId, options = {}) {
    const session = this.getSession(sessionId);
    const assessment = calculateHealthAssessment(session.answers, options);
    session.assessment = assessment;
    session.completedAt = nowIso();
    session.updatedAt = nowIso();
    this.persist();
    return this.resultFor(session);
  }

  getResult(sessionId, options = {}) {
    const session = this.getSession(sessionId);
    if (!session.assessment) {
      const missing = STEPS.filter((step) => !session.answers[step]);
      if (missing.length > 0) {
        throw validationError('Quiz is incomplete', { missing });
      }
      session.assessment = calculateHealthAssessment(session.answers, options);
      session.completedAt = session.completedAt || nowIso();
      this.persist();
    }
    return this.resultFor(session);
  }

  activateSubscription(sessionId, provider = 'mock', eventId = undefined) {
    const session = this.getSession(sessionId);
    const paidAt = nowIso();
    session.subscriptionStatus = 'active';
    session.subscription = {
      id: session.subscription ? session.subscription.id : makeId('sub'),
      status: 'active',
      provider,
      paidAt,
      expiresAt: null
    };
    session.paymentEvents.push({
      id: eventId || makeId('evt'),
      type: 'payment.succeeded',
      provider,
      rawPayload: { sessionId, provider, eventId: eventId || null },
      createdAt: paidAt
    });
    session.updatedAt = paidAt;
    this.persist();
    return { sessionId, subscriptionStatus: session.subscriptionStatus, paidAt };
  }

  resultFor(session) {
    const full = session.subscriptionStatus === 'active';
    return {
      sessionId: session.sessionId,
      subscriptionStatus: session.subscriptionStatus,
      access: full ? 'full' : 'preview',
      assessment: full ? clone(session.assessment) : maskAssessmentForPreview(session.assessment)
    };
  }

  toProgress(session) {
    const completedSteps = STEPS.filter((step) => Boolean(session.answers[step]));
    const nextStep = STEPS.find((step) => !session.answers[step]) || 'complete';
    return {
      sessionId: session.sessionId,
      version: session.version,
      subscriptionStatus: session.subscriptionStatus,
      completedSteps,
      nextStep,
      answers: clone(session.answers),
      updatedAt: session.updatedAt
    };
  }
}

export class FileQuizRepository extends MemoryQuizRepository {
  constructor(filePath) {
    const state = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : undefined;
    super(state);
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.persist();
  }

  persist() {
    if (this.filePath) {
      writeFileSync(this.filePath, JSON.stringify(this.snapshot(), null, 2), 'utf8');
    }
  }
}

export function seedDemoSessions(repo) {
  const baseAnswers = {
    gender: { gender: 'female' },
    goals: { goals: ['lose_weight', 'increase_energy'] },
    body: { age: 31, heightCm: 168, weightKg: 72, targetWeightKg: 64 },
    activity: { activityLevel: 'moderate' }
  };
  for (const item of [
    { id: 'demo-free-session', paid: false },
    { id: 'demo-paid-session', paid: true }
  ]) {
    repo.createSession(item.id);
    const session = repo.getSession(item.id);
    session.answers = clone(baseAnswers);
    session.version = 4;
    session.assessment = calculateHealthAssessment(session.answers, { baseDate: '2026-07-01T00:00:00.000Z' });
    session.completedAt = session.completedAt || nowIso();
    session.subscriptionStatus = item.paid ? 'active' : 'inactive';
    if (item.paid) {
      session.subscription = { id: 'sub_demo_paid', status: 'active', provider: 'mock', paidAt: nowIso(), expiresAt: null };
    }
  }
  repo.persist();
}
