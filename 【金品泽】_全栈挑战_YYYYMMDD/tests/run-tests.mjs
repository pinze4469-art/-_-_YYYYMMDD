import assert from 'node:assert/strict';
import { calculateHealthAssessment } from '../dist/domain/health.mjs';
import { MemoryQuizRepository } from '../dist/data/repository.mjs';
import { createApp } from '../dist/http/router.mjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const completeAnswers = {
  gender: { gender: 'female' },
  goals: { goals: ['lose_weight', 'increase_energy'] },
  body: { age: 31, heightCm: 168, weightKg: 72, targetWeightKg: 64 },
  activity: { activityLevel: 'moderate' }
};

async function request(app, method, path, body = {}) {
  return app.handle(method, path, body);
} 

test('health algorithm calculates BMI, calories, target date, and curve', () => {
  const result = calculateHealthAssessment(completeAnswers, { baseDate: '2026-07-01T00:00:00.000Z' });
  assert.equal(result.bmi, 25.5);
  assert.equal(result.bmiCategory, 'overweight');
  assert.equal(result.targetPredictionDate, '2026-10-21');
  assert.equal(result.weeksToTarget, 16);
  assert.ok(result.dailyCalories >= 1200);
  assert.ok(result.predictionCurve.length > 5);
  assert.deepEqual(Object.keys(result.macroPlan).sort(), ['carbGrams', 'fatGrams', 'proteinGrams']);
});

test('health algorithm rejects missing, extreme, and unsafe values', () => {
  assert.throws(() => calculateHealthAssessment({ ...completeAnswers, body: { ...completeAnswers.body, heightCm: 0 } }), /Number is out of range/);
  assert.throws(() => calculateHealthAssessment({ ...completeAnswers, body: { ...completeAnswers.body, weightKg: 500 } }), /Number is out of range/);
  assert.throws(() => calculateHealthAssessment({ ...completeAnswers, body: { ...completeAnswers.body, age: 8 } }), /Number is out of range/);
  assert.throws(() => calculateHealthAssessment({ ...completeAnswers, body: { ...completeAnswers.body, heightCm: '170; DROP TABLE users' } }), /Expected a finite number/);
  assert.throws(() => calculateHealthAssessment({ ...completeAnswers, body: { ...completeAnswers.body, targetWeightKg: 40 } }), /unreasonable/);
  assert.throws(() => calculateHealthAssessment({ ...completeAnswers, activity: undefined }), /Quiz is incomplete/);
});

test('step saving supports restore, out-of-order submit, and duplicate idempotency', async () => {
  const repo = new MemoryQuizRepository();
  const app = createApp(repo, { baseDate: '2026-07-01T00:00:00.000Z' });
  const created = await request(app, 'POST', '/api/sessions', { preferredSessionId: 'restore-test-01' });
  assert.equal(created.status, 201);
  let progress = created.body;

  let saved = await request(app, 'PATCH', '/api/sessions/restore-test-01/answers', { step: 'activity', data: { activityLevel: 'moderate' }, expectedVersion: progress.version });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.completedSteps, ['activity']);
  progress = saved.body;

  saved = await request(app, 'PATCH', '/api/sessions/restore-test-01/answers', { step: 'activity', data: { activityLevel: 'moderate' }, expectedVersion: progress.version });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.version, progress.version);

  await request(app, 'PATCH', '/api/sessions/restore-test-01/answers', { step: 'gender', data: { gender: 'female' }, expectedVersion: progress.version });
  const restored = await request(app, 'GET', '/api/sessions/restore-test-01/progress');
  assert.equal(restored.status, 200);
  assert.equal(restored.body.answers.activity.activityLevel, 'moderate');
  assert.equal(restored.body.answers.gender.gender, 'female');
});

test('stale expectedVersion is rejected to protect concurrent updates', async () => {
  const repo = new MemoryQuizRepository();
  const app = createApp(repo);
  await request(app, 'POST', '/api/sessions', { preferredSessionId: 'conflict-test-01' });
  const first = await request(app, 'PATCH', '/api/sessions/conflict-test-01/answers', { step: 'gender', data: { gender: 'male' }, expectedVersion: 0 });
  assert.equal(first.status, 200);
  const second = await request(app, 'PATCH', '/api/sessions/conflict-test-01/answers', { step: 'goals', data: { goals: ['build_strength'] }, expectedVersion: 0 });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'VERSION_CONFLICT');
});

test('result endpoint masks protected fields for unpaid sessions', async () => {
  const repo = new MemoryQuizRepository();
  const app = createApp(repo, { baseDate: '2026-07-01T00:00:00.000Z' });
  await request(app, 'POST', '/api/sessions', { preferredSessionId: 'gate-test-01' });
  await request(app, 'PATCH', '/api/sessions/gate-test-01/answers', { step: 'gender', data: completeAnswers.gender, expectedVersion: 0 });
  await request(app, 'PATCH', '/api/sessions/gate-test-01/answers', { step: 'goals', data: completeAnswers.goals, expectedVersion: 1 });
  await request(app, 'PATCH', '/api/sessions/gate-test-01/answers', { step: 'body', data: completeAnswers.body, expectedVersion: 2 });
  await request(app, 'PATCH', '/api/sessions/gate-test-01/answers', { step: 'activity', data: completeAnswers.activity, expectedVersion: 3 });
  const preview = await request(app, 'POST', '/api/sessions/gate-test-01/complete');
  assert.equal(preview.status, 200);
  assert.equal(preview.body.access, 'preview');
  assert.equal(preview.body.assessment.bmi, undefined);
  assert.equal(preview.body.assessment.predictionCurve, undefined);
  assert.ok(preview.body.assessment.lockedFields.includes('predictionCurve'));
});

test('/pay changes status and result becomes full end to end', async () => {
  const repo = new MemoryQuizRepository();
  const app = createApp(repo, { baseDate: '2026-07-01T00:00:00.000Z' });
  await request(app, 'POST', '/api/sessions', { preferredSessionId: 'pay-test-01' });
  await request(app, 'PATCH', '/api/sessions/pay-test-01/answers', { step: 'gender', data: completeAnswers.gender });
  await request(app, 'PATCH', '/api/sessions/pay-test-01/answers', { step: 'goals', data: completeAnswers.goals });
  await request(app, 'PATCH', '/api/sessions/pay-test-01/answers', { step: 'body', data: completeAnswers.body });
  await request(app, 'PATCH', '/api/sessions/pay-test-01/answers', { step: 'activity', data: completeAnswers.activity });
  const before = await request(app, 'GET', '/api/sessions/pay-test-01/result');
  assert.equal(before.body.access, 'preview');
  const paid = await request(app, 'POST', '/pay', { sessionId: 'pay-test-01' });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.subscriptionStatus, 'active');
  const after = await request(app, 'GET', '/api/sessions/pay-test-01/result');
  assert.equal(after.body.access, 'full');
  assert.equal(after.body.assessment.bmi, 25.5);
  assert.ok(Array.isArray(after.body.assessment.predictionCurve));
});

test('API validation rejects invalid numeric injection and unknown fields', async () => {
  const repo = new MemoryQuizRepository();
  const app = createApp(repo);
  await request(app, 'POST', '/api/sessions', { preferredSessionId: 'validation-01' });
  const injected = await request(app, 'PATCH', '/api/sessions/validation-01/answers', {
    step: 'body',
    data: { age: 31, heightCm: '168; DROP TABLE', weightKg: 72, targetWeightKg: 64 }
  });
  assert.equal(injected.status, 422);
  const unknown = await request(app, 'PATCH', '/api/sessions/validation-01/answers', {
    step: 'gender',
    data: { gender: 'female', admin: true }
  });
  assert.equal(unknown.status, 422);
});

let passed = 0;
let firstFailure = null;
for (const item of tests) {
  try {
    await item.fn();
    passed += 1;
    console.log('PASS ' + item.name);
  } catch (error) {
    firstFailure = error;
    console.error('FAIL ' + item.name);
    console.error(error);
    break;
  }
}

if (firstFailure) {
  throw firstFailure;
}
console.log('\n' + passed + '/' + tests.length + ' tests passed.');
