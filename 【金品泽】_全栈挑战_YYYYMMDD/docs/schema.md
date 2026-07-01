# Database Schema

```mermaid
erDiagram
  UserSession ||--o{ QuizAnswer : has
  UserSession ||--o| HealthAssessment : has
  UserSession ||--o| Subscription : owns
  Subscription ||--o{ PaymentEvent : records

  UserSession {
    string id PK
    datetime createdAt
    datetime updatedAt
    int currentVersion
    string subscriptionStatus
  }

  QuizAnswer {
    string id PK
    string sessionId FK
    string step
    json payload
    int version
    datetime createdAt
    datetime updatedAt
  }

  HealthAssessment {
    string id PK
    string sessionId FK
    decimal bmi
    string bmiCategory
    int dailyCalories
    datetime targetPredictionDate
    json predictionCurve
    json macroPlan
    datetime createdAt
  }

  Subscription {
    string id PK
    string sessionId FK
    string status
    string provider
    datetime paidAt
    datetime expiresAt
  }

  PaymentEvent {
    string id PK
    string subscriptionId FK
    string type
    json rawPayload
    datetime createdAt
  }
```

## Design notes

- UserSession is the stable session identity used for anonymous funnel recovery.
- QuizAnswer stores each step separately and uses a unique (sessionId, step) constraint, which makes repeated step submissions idempotent and extensible when new quiz steps are added.
- currentVersion supports optimistic concurrency for concurrent tab updates.
- HealthAssessment is separated from raw answers so calculation history can later become versioned without changing answer storage.
- Subscription and PaymentEvent are split so access control can read a simple status while payment callbacks remain auditable.
