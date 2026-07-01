export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';
export type Goal = 'lose_weight' | 'build_strength' | 'increase_energy' | 'improve_mobility' | 'reduce_stress';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type QuizStep = 'gender' | 'goals' | 'body' | 'activity';
export type SubscriptionStatus = 'inactive' | 'active' | 'expired';

export interface GenderAnswer { gender: Gender; }
export interface GoalsAnswer { goals: Goal[]; }
export interface BodyAnswer { age: number; heightCm: number; weightKg: number; targetWeightKg: number; }
export interface ActivityAnswer { activityLevel: ActivityLevel; }

export interface QuizAnswers {
  gender?: GenderAnswer;
  goals?: GoalsAnswer;
  body?: BodyAnswer;
  activity?: ActivityAnswer;
}

export interface CompleteQuizAnswers {
  gender: GenderAnswer;
  goals: GoalsAnswer;
  body: BodyAnswer;
  activity: ActivityAnswer;
}

export interface PredictionPoint { week: number; weightKg: number; bmi: number; }
export interface MacroPlan { proteinGrams: number; fatGrams: number; carbGrams: number; }

export interface HealthAssessment {
  bmi: number;
  bmiCategory: 'underweight' | 'healthy' | 'overweight' | 'obese';
  dailyCalories: number;
  targetPredictionDate: string;
  weeksToTarget: number;
  goalDirection: 'loss' | 'gain';
  summary: string;
  predictionCurve: PredictionPoint[];
  macroPlan: MacroPlan;
  riskNotes: string[];
}

export interface QuizSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  subscriptionStatus: SubscriptionStatus;
  answers: QuizAnswers;
  assessment: HealthAssessment | null;
}

export interface ProgressResponse {
  sessionId: string;
  version: number;
  subscriptionStatus: SubscriptionStatus;
  completedSteps: QuizStep[];
  nextStep: QuizStep | 'complete';
  answers: QuizAnswers;
  updatedAt: string;
}

export interface ResultResponse {
  sessionId: string;
  subscriptionStatus: SubscriptionStatus;
  access: 'preview' | 'full';
  assessment: HealthAssessment | {
    bmiCategory: HealthAssessment['bmiCategory'];
    weeksToTarget: number;
    summary: string;
    lockedFields: string[];
    paywall: { required: true; message: string; };
  };
}

export interface QuizRepository {
  createSession(preferredSessionId?: string): ProgressResponse;
  getProgress(sessionId: string): ProgressResponse;
  saveStep(sessionId: string, step: QuizStep, data: unknown, expectedVersion?: number): ProgressResponse;
  complete(sessionId: string, options?: { baseDate?: string | Date }): ResultResponse;
  getResult(sessionId: string, options?: { baseDate?: string | Date }): ResultResponse;
  activateSubscription(sessionId: string, provider?: string, eventId?: string): { sessionId: string; subscriptionStatus: 'active'; paidAt: string; };
}
