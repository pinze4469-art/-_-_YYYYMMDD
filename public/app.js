const stepMeta = [
  { id: 'gender', title: 'Choose your profile', subtitle: 'This helps estimate energy needs.', choices: [
    ['female', 'Female', 'Uses the female BMR adjustment.'],
    ['male', 'Male', 'Uses the male BMR adjustment.'],
    ['non_binary', 'Non-binary', 'Uses a neutral BMR adjustment.'],
    ['prefer_not_to_say', 'Prefer not to say', 'Uses a neutral BMR adjustment.']
  ]},
  { id: 'goals', title: 'Pick your goals', subtitle: 'Choose up to three. The first goal influences calories.', choices: [
    ['lose_weight', 'Lose weight', 'A steady, realistic deficit.'],
    ['build_strength', 'Build strength', 'A controlled surplus for training.'],
    ['increase_energy', 'Increase energy', 'Daily habits and activity.'],
    ['improve_mobility', 'Improve mobility', 'Gentle consistency.'],
    ['reduce_stress', 'Reduce stress', 'A calmer weekly rhythm.']
  ]},
  { id: 'body', title: 'Body metrics', subtitle: 'These values are validated on the server.' },
  { id: 'activity', title: 'Activity level', subtitle: 'Estimate your current weekly baseline.' },
  { id: 'result', title: 'Your assessment', subtitle: 'Preview is gated until the mock payment callback runs.' }
];

const state = { sessionId: localStorage.getItem('quizSessionId'), progress: null, selected: {} };
const app = document.getElementById('app');
const rail = document.getElementById('rail');
const sessionBadge = document.getElementById('sessionBadge');

document.getElementById('resetBtn').addEventListener('click', async () => {
  localStorage.removeItem('quizSessionId');
  state.sessionId = null;
  state.progress = null;
  state.selected = {};
  await init();
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await response.json();
  if (!response.ok) {
    const message = json.error ? json.error.message : 'Request failed';
    throw new Error(message);
  }
  return json;
}

async function init() {
  if (!state.sessionId) {
    const created = await api('/api/sessions', { method: 'POST', body: {} });
    state.sessionId = created.sessionId;
    localStorage.setItem('quizSessionId', state.sessionId);
  }
  state.progress = await api('/api/sessions/' + state.sessionId + '/progress');
  sessionBadge.textContent = 'Session: ' + state.sessionId + ' | version ' + state.progress.version;
  render();
}

function currentStep() {
  if (!state.progress) return 'gender';
  return state.progress.nextStep === 'complete' ? 'result' : state.progress.nextStep;
}

function renderRail() {
  const done = new Set(state.progress ? state.progress.completedSteps : []);
  const active = currentStep();
  rail.innerHTML = stepMeta.map((step, index) => {
    const cls = ['step-dot'];
    if (done.has(step.id) || step.id === 'result' && active === 'result') cls.push('done');
    if (step.id === active) cls.push('active');
    return '<div class="' + cls.join(' ') + '"><span>' + (index + 1) + '</span><strong>' + step.title + '</strong></div>';
  }).join('');
}

function render() {
  renderRail();
  const step = currentStep();
  if (step === 'gender') return renderGender();
  if (step === 'goals') return renderGoals();
  if (step === 'body') return renderBody();
  if (step === 'activity') return renderActivity();
  return renderResult();
}

function header(meta) {
  return '<h2>' + meta.title + '</h2><p>' + meta.subtitle + '</p>';
}

function choiceButton(value, title, desc, selected) {
  return '<button class="choice ' + (selected ? 'selected' : '') + '" data-value="' + value + '" type="button"><strong>' + title + '</strong><span>' + desc + '</span></button>';
}

function renderGender() {
  const meta = stepMeta[0];
  const saved = state.progress.answers.gender ? state.progress.answers.gender.gender : null;
  app.innerHTML = header(meta) + '<div class="choice-grid">' + meta.choices.map((c) => choiceButton(c[0], c[1], c[2], saved === c[0])).join('') + '</div>';
  app.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => save('gender', { gender: btn.dataset.value })));
}

function renderGoals() {
  const meta = stepMeta[1];
  const saved = new Set(state.progress.answers.goals ? state.progress.answers.goals.goals : []);
  app.innerHTML = header(meta) + '<div class="choice-grid">' + meta.choices.map((c) => choiceButton(c[0], c[1], c[2], saved.has(c[0]))).join('') + '</div><div class="actions"><button id="saveGoals" type="button">Continue</button></div>';
  app.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => btn.classList.toggle('selected')));
  document.getElementById('saveGoals').addEventListener('click', () => {
    const goals = Array.from(app.querySelectorAll('.choice.selected')).map((btn) => btn.dataset.value).slice(0, 3);
    save('goals', { goals });
  });
}

function renderBody() {
  const body = state.progress.answers.body || { age: 31, heightCm: 168, weightKg: 72, targetWeightKg: 64 };
  app.innerHTML = header(stepMeta[2]) + '<div class="form-grid">'
    + field('age', 'Age', body.age)
    + field('heightCm', 'Height (cm)', body.heightCm)
    + field('weightKg', 'Current weight (kg)', body.weightKg)
    + field('targetWeightKg', 'Target weight (kg)', body.targetWeightKg)
    + '</div><div class="actions"><button id="saveBody" type="button">Continue</button></div><div id="error"></div>';
  document.getElementById('saveBody').addEventListener('click', () => {
    save('body', {
      age: Number(document.getElementById('age').value),
      heightCm: Number(document.getElementById('heightCm').value),
      weightKg: Number(document.getElementById('weightKg').value),
      targetWeightKg: Number(document.getElementById('targetWeightKg').value)
    });
  });
}

function field(id, label, value) {
  return '<label for="' + id + '">' + label + '<input id="' + id + '" type="number" step="0.1" value="' + value + '" /></label>';
}

function renderActivity() {
  const saved = state.progress.answers.activity ? state.progress.answers.activity.activityLevel : 'moderate';
  app.innerHTML = header(stepMeta[3]) + '<div class="form-grid"><label for="activityLevel">Weekly movement<select id="activityLevel">'
    + option('sedentary', 'Mostly sitting', saved)
    + option('light', 'Light exercise', saved)
    + option('moderate', 'Moderate exercise', saved)
    + option('active', 'Active lifestyle', saved)
    + option('athlete', 'Athlete-level training', saved)
    + '</select></label></div><div class="actions"><button id="complete" type="button">Calculate result</button></div>';
  document.getElementById('complete').addEventListener('click', async () => {
    await save('activity', { activityLevel: document.getElementById('activityLevel').value }, false);
    await api('/api/sessions/' + state.sessionId + '/complete', { method: 'POST', body: {} });
    state.progress = await api('/api/sessions/' + state.sessionId + '/progress');
    renderResult();
  });
}

function option(value, text, selected) {
  return '<option value="' + value + '" ' + (value === selected ? 'selected' : '') + '>' + text + '</option>';
}

async function save(step, data, rerender = true) {
  try {
    state.progress = await api('/api/sessions/' + state.sessionId + '/answers', {
      method: 'PATCH',
      body: { step, data, expectedVersion: state.progress.version }
    });
    sessionBadge.textContent = 'Session: ' + state.sessionId + ' | version ' + state.progress.version;
    if (rerender) render();
  } catch (error) {
    const box = document.getElementById('error') || app;
    box.insertAdjacentHTML('beforeend', '<div class="alert">' + error.message + '</div>');
  }
}

async function renderResult() {
  try {
    const result = await api('/api/sessions/' + state.sessionId + '/result');
    const a = result.assessment;
    if (result.access === 'preview') {
      app.innerHTML = header(stepMeta[4]) + '<div class="alert">' + a.paywall.message + '</div>'
        + '<div class="result-grid"><div class="metric"><span>Category</span><strong>' + a.bmiCategory + '</strong></div><div class="metric"><span>Timeline</span><strong>' + a.weeksToTarget + ' weeks</strong></div><div class="metric"><span>Access</span><strong>Preview</strong></div></div>'
        + '<p>' + a.summary + '</p><div class="actions"><button class="pay" id="payBtn" type="button">Unlock with /pay</button><button class="secondary" id="reloadBtn" type="button">Reload result</button></div>';
      document.getElementById('payBtn').addEventListener('click', async () => { await api('/pay', { method: 'POST', body: { sessionId: state.sessionId } }); renderResult(); });
      document.getElementById('reloadBtn').addEventListener('click', renderResult);
    } else {
      app.innerHTML = header(stepMeta[4])
        + '<div class="result-grid"><div class="metric"><span>BMI</span><strong>' + a.bmi + '</strong></div><div class="metric"><span>Calories</span><strong>' + a.dailyCalories + '</strong></div><div class="metric"><span>Target date</span><strong>' + a.targetPredictionDate + '</strong></div></div>'
        + '<p>' + a.summary + '</p><pre>' + JSON.stringify(a.predictionCurve.slice(0, 8), null, 2) + '</pre>';
    }
  } catch (error) {
    app.innerHTML = header(stepMeta[4]) + '<div class="alert">' + error.message + '</div>';
  }
}

init().catch((error) => { app.innerHTML = '<div class="alert">' + error.message + '</div>'; });
