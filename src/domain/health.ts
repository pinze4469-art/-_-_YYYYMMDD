import type { CompleteQuizAnswers, HealthAssessment } from '../types';

const ACTIVITY_MULTIPLIER = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9
} as const;

function round(value: number, digits = 1): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function category(bmi: number): HealthAssessment['bmiCategory'] {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 24) return 'healthy';
  if (bmi < 28) return 'overweight';
  return 'obese';
}

export function calculateHealthAssessment(answers: CompleteQuizAnswers, baseDate = new Date()): HealthAssessment {
  const { body } = answers;
  const heightM = body.heightCm / 100;
  const bmi = round(body.weightKg / (heightM * heightM), 1);
  const sexAdjustment = answers.gender.gender === 'male' ? 5 : answers.gender.gender === 'female' ? -161 : -78;
  const bmr = 10 * body.weightKg + 6.25 * body.heightCm - 5 * body.age + sexAdjustment;
  const wantsLoss = body.targetWeightKg < body.weightKg;
  const dailyCalories = Math.round(Math.max(1200, bmr * ACTIVITY_MULTIPLIER[answers.activity.activityLevel] + (wantsLoss ? -450 : 250)));
  const weeksToTarget = Math.max(2, Math.ceil(Math.abs(body.weightKg - body.targetWeightKg) / (wantsLoss ? 0.5 : 0.25)));
  const target = new Date(baseDate);
  target.setUTCDate(target.getUTCDate() + weeksToTarget * 7);
  return {
    bmi,
    bmiCategory: category(bmi),
    dailyCalories,
    targetPredictionDate: target.toISOString().slice(0, 10),
    weeksToTarget,
    goalDirection: wantsLoss ? 'loss' : 'gain',
    summary: wantsLoss ? 'A steady calorie deficit is recommended with moderate activity.' : 'A controlled surplus is recommended with strength-focused habits.',
    predictionCurve: Array.from({ length: Math.min(weeksToTarget, 32) + 1 }, (_, week) => {
      const progress = week / Math.min(weeksToTarget, 32);
      const weightKg = round(body.weightKg + (body.targetWeightKg - body.weightKg) * progress, 1);
      return { week, weightKg, bmi: round(weightKg / (heightM * heightM), 1) };
    }),
    macroPlan: {
      proteinGrams: Math.round(body.weightKg * 1.5),
      fatGrams: Math.round((dailyCalories * 0.28) / 9),
      carbGrams: Math.round((dailyCalories - Math.round(body.weightKg * 1.5) * 4 - Math.round((dailyCalories * 0.28) / 9) * 9) / 4)
    },
    riskNotes: []
  };
}
