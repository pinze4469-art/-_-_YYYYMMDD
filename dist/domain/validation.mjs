import { validationError } from './errors.mjs';

export const STEPS = ['gender', 'goals', 'body', 'activity'];

const GENDERS = ['female', 'male', 'non_binary', 'prefer_not_to_say'];
const GOALS = ['lose_weight', 'build_strength', 'increase_energy', 'improve_mobility', 'reduce_stress'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'athlete'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownKeys(value, allowed, scope) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw validationError('Unknown field in ' + scope, { field: key, allowed });
    }
  }
}

function enumValue(value, allowed, field) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw validationError('Invalid enum value', { field, allowed });
  }
  return value;
}

function finiteNumber(value, field, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw validationError('Expected a finite number', { field });
  }
  if (integer && !Number.isInteger(value)) {
    throw validationError('Expected an integer', { field });
  }
  if (value < min || value > max) {
    throw validationError('Number is out of range', { field, min, max, value });
  }
  return value;
}

export function validateSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(sessionId)) {
    throw validationError('Invalid sessionId format', { sessionId });
  }
  return sessionId;
}

export function validateCreateSessionPayload(payload = {}) {
  if (!isPlainObject(payload)) {
    throw validationError('Request body must be an object');
  }
  rejectUnknownKeys(payload, ['preferredSessionId'], 'create session');
  if (payload.preferredSessionId !== undefined) {
    validateSessionId(payload.preferredSessionId);
  }
  return { preferredSessionId: payload.preferredSessionId };
}

export function validateAnswerPayload(payload) {
  if (!isPlainObject(payload)) {
    throw validationError('Request body must be an object');
  }
  rejectUnknownKeys(payload, ['step', 'data', 'expectedVersion'], 'answer request');
  const step = enumValue(payload.step, STEPS, 'step');
  if (payload.expectedVersion !== undefined) {
    finiteNumber(payload.expectedVersion, 'expectedVersion', 0, 100000, true);
  }
  return {
    step,
    data: validateStepData(step, payload.data),
    expectedVersion: payload.expectedVersion
  };
}

export function validatePayPayload(payload) {
  if (!isPlainObject(payload)) {
    throw validationError('Request body must be an object');
  }
  rejectUnknownKeys(payload, ['sessionId', 'provider', 'eventId'], 'pay request');
  return {
    sessionId: validateSessionId(payload.sessionId),
    provider: typeof payload.provider === 'string' && payload.provider ? payload.provider : 'mock',
    eventId: typeof payload.eventId === 'string' ? payload.eventId : undefined
  };
}

export function validateStepData(step, data) {
  if (!isPlainObject(data)) {
    throw validationError('Step data must be an object', { step });
  }
  if (step === 'gender') {
    rejectUnknownKeys(data, ['gender'], 'gender step');
    return { gender: enumValue(data.gender, GENDERS, 'gender') };
  }
  if (step === 'goals') {
    rejectUnknownKeys(data, ['goals'], 'goals step');
    if (!Array.isArray(data.goals) || data.goals.length < 1 || data.goals.length > 3) {
      throw validationError('Goals must contain one to three values', { field: 'goals' });
    }
    const uniqueGoals = [...new Set(data.goals.map((goal) => enumValue(goal, GOALS, 'goals')))]
    if (uniqueGoals.length !== data.goals.length) {
      throw validationError('Goals must be unique', { field: 'goals' });
    }
    return { goals: uniqueGoals };
  }
  if (step === 'body') {
    rejectUnknownKeys(data, ['age', 'heightCm', 'weightKg', 'targetWeightKg'], 'body step');
    const age = finiteNumber(data.age, 'age', 13, 90, true);
    const heightCm = finiteNumber(data.heightCm, 'heightCm', 120, 230);
    const weightKg = finiteNumber(data.weightKg, 'weightKg', 35, 250);
    const targetWeightKg = finiteNumber(data.targetWeightKg, 'targetWeightKg', 35, 250);
    const ratio = targetWeightKg / weightKg;
    if (Math.abs(targetWeightKg - weightKg) < 1) {
      throw validationError('Target weight should differ from current weight by at least 1 kg', { field: 'targetWeightKg' });
    }
    if (ratio < 0.75 || ratio > 1.25) {
      throw validationError('Target weight is unreasonable for this program', { field: 'targetWeightKg', current: weightKg, target: targetWeightKg });
    }
    return { age, heightCm, weightKg, targetWeightKg };
  }
  if (step === 'activity') {
    rejectUnknownKeys(data, ['activityLevel'], 'activity step');
    return { activityLevel: enumValue(data.activityLevel, ACTIVITY_LEVELS, 'activityLevel') };
  }
  throw validationError('Unsupported step', { step });
}

export function validateCompleteAnswers(answers) {
  if (!isPlainObject(answers)) {
    throw validationError('Answers must be an object');
  }
  const missing = STEPS.filter((step) => !answers[step]);
  if (missing.length > 0) {
    throw validationError('Quiz is incomplete', { missing });
  }
  return {
    gender: validateStepData('gender', answers.gender),
    goals: validateStepData('goals', answers.goals),
    body: validateStepData('body', answers.body),
    activity: validateStepData('activity', answers.activity)
  };
}
