import { validationError } from './errors.mjs';
import { validateCompleteAnswers } from './validation.mjs';

const ACTIVITY_MULTIPLIER = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9
};

function round(value, digits = 1) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 24) return 'healthy';
  if (bmi < 28) return 'overweight';
  return 'obese';
}

function sexAdjustment(gender) {
  if (gender === 'male') return 5;
  if (gender === 'female') return -161;
  return -78;
}

export function calculateHealthAssessment(rawAnswers, options = {}) {
  const answers = validateCompleteAnswers(rawAnswers);
  const body = answers.body;
  const heightM = body.heightCm / 100;
  const bmi = round(body.weightKg / (heightM * heightM), 1);
  const targetBmi = body.targetWeightKg / (heightM * heightM);
  if (targetBmi < 17 || targetBmi > 32) {
    throw validationError('Target BMI is outside a safe coaching range', { targetBmi: round(targetBmi, 1) });
  }

  const bmr = 10 * body.weightKg + 6.25 * body.heightCm - 5 * body.age + sexAdjustment(answers.gender.gender);
  const maintenance = bmr * ACTIVITY_MULTIPLIER[answers.activity.activityLevel];
  const wantsLoss = body.targetWeightKg < body.weightKg;
  const primaryGoal = answers.goals.goals[0];
  const calorieAdjustment = wantsLoss ? -450 : primaryGoal === 'build_strength' ? 250 : 180;
  const dailyCalories = Math.round(Math.max(1200, maintenance + calorieAdjustment));

  const diffKg = Math.abs(body.weightKg - body.targetWeightKg);
  const weeklyRateKg = wantsLoss ? 0.5 : 0.25;
  const weeksToTarget = Math.max(2, Math.ceil(diffKg / weeklyRateKg));
  const startDate = options.baseDate ? new Date(options.baseDate) : new Date();
  const targetDate = addDays(startDate, weeksToTarget * 7);
  const curve = [];
  const maxPoints = Math.min(weeksToTarget, 32);
  for (let week = 0; week <= maxPoints; week += 1) {
    const progress = maxPoints === 0 ? 1 : week / maxPoints;
    const projectedWeight = body.weightKg + (body.targetWeightKg - body.weightKg) * progress;
    curve.push({
      week,
      weightKg: round(projectedWeight, 1),
      bmi: round(projectedWeight / (heightM * heightM), 1)
    });
  }

  const proteinGrams = Math.round(body.weightKg * (primaryGoal === 'build_strength' ? 1.8 : 1.5));
  const fatGrams = Math.round((dailyCalories * 0.28) / 9);
  const carbGrams = Math.round((dailyCalories - proteinGrams * 4 - fatGrams * 9) / 4);

  return {
    bmi,
    bmiCategory: bmiCategory(bmi),
    dailyCalories,
    targetPredictionDate: targetDate.toISOString().slice(0, 10),
    weeksToTarget,
    goalDirection: wantsLoss ? 'loss' : 'gain',
    summary: wantsLoss ? 'A steady calorie deficit is recommended with moderate activity.' : 'A controlled surplus is recommended with strength-focused habits.',
    predictionCurve: curve,
    macroPlan: { proteinGrams, fatGrams, carbGrams },
    riskNotes: targetBmi < 18.5 ? ['Target BMI is near the lower healthy boundary.'] : []
  };
}

export function maskAssessmentForPreview(assessment) {
  return {
    bmiCategory: assessment.bmiCategory,
    weeksToTarget: assessment.weeksToTarget,
    summary: assessment.summary,
    lockedFields: ['bmi', 'dailyCalories', 'targetPredictionDate', 'predictionCurve', 'macroPlan', 'riskNotes'],
    paywall: {
      required: true,
      message: 'Unlock exact BMI, calories, prediction curve, target date, and macro plan.'
    }
  };
}
