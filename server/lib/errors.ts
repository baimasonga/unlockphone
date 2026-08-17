import type { NextFunction, Request, Response } from 'express';

/** An error whose message is safe to show the customer. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'bad_request', details);
  }
  static unauthorized(message = 'Sign in to continue.') {
    return new ApiError(401, message, 'unauthorized');
  }
  static forbidden(message = 'You do not have access to that.') {
    return new ApiError(403, message, 'forbidden');
  }
  static notFound(message = 'Not found.') {
    return new ApiError(404, message, 'not_found');
  }
  static conflict(message: string) {
    return new ApiError(409, message, 'conflict');
  }
  static tooMany(message = 'Too many requests. Try again shortly.') {
    return new ApiError(429, message, 'rate_limited');
  }
}

/** Wraps an async handler so rejections reach the error middleware. */
export function asyncRoute<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }
  // Anything unmapped is a bug: log it in full, tell the customer nothing.
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side.', code: 'internal' });
}
