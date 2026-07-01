export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code, message, details = {}) {
  return new AppError(400, code, message, details);
}

export function validationError(message, details = {}) {
  return new AppError(422, 'VALIDATION_ERROR', message, details);
}

export function notFound(message = 'Resource not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(message = 'Version conflict', details = {}) {
  return new AppError(409, 'VERSION_CONFLICT', message, details);
}

export function appErrorToResponse(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message, details: error.details } }
    };
  }
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }
  };
}
