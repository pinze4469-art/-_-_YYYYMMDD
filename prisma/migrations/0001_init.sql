CREATE TYPE subscription_status AS ENUM ('inactive', 'active', 'expired');
CREATE TYPE quiz_step AS ENUM ('gender', 'goals', 'body', 'activity');

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_version INTEGER NOT NULL DEFAULT 0,
  subscription_status subscription_status NOT NULL DEFAULT 'inactive'
);

CREATE TABLE quiz_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  step quiz_step NOT NULL,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, step)
);

CREATE TABLE health_assessments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES user_sessions(id) ON DELETE CASCADE,
  bmi NUMERIC(5,2) NOT NULL,
  bmi_category TEXT NOT NULL,
  daily_calories INTEGER NOT NULL,
  target_prediction_date TIMESTAMPTZ NOT NULL,
  prediction_curve JSONB NOT NULL,
  macro_plan JSONB NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES user_sessions(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'inactive',
  provider TEXT NOT NULL DEFAULT 'mock',
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_subscription_status ON user_sessions(subscription_status);
CREATE INDEX idx_quiz_answers_session_version ON quiz_answers(session_id, version);
CREATE INDEX idx_payment_events_subscription_created_at ON payment_events(subscription_id, created_at);
