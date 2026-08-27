import type { Request, Response } from "express";
import { randomBytes } from "crypto";

/**
 * Shared server-error reporting helpers.
 *
 * Two goals:
 *  1. Every failure that would otherwise surface as a bare "Internal Server Error"
 *     leaves a full server log line (method, path, stack, correlation id, reference).
 *  2. The client always receives a *specific* reason plus a short reference code the
 *     user can quote back to an engineer.
 */

/** Short, human-quotable reference code (e.g. "7F3A1C"). */
export function newErrorReference(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function correlationIdFor(req?: Request): string {
  return (req as any)?.auditContext?.correlationId || "none";
}

function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || "(no message)",
      stack: error.stack || `${error.name}: ${error.message}`,
    };
  }
  if (typeof error === "string") {
    return { message: error, stack: error };
  }
  try {
    const serialized = JSON.stringify(error);
    return { message: serialized || "(no message)", stack: serialized || "(no stack)" };
  } catch {
    return { message: String(error), stack: String(error) };
  }
}

/**
 * Write a full, correlatable log entry for a server-side failure.
 * Returns the reference code that was logged so it can be handed to the caller.
 */
export function logServerError(
  scope: string,
  error: unknown,
  req?: Request,
  reference: string = newErrorReference(),
): string {
  const { message, stack } = describe(error);
  const method = req?.method || "UNKNOWN";
  const path = (req as any)?.originalUrl || req?.path || "unknown";

  console.error(
    `[ServerError] ref=${reference} scope=${scope} correlationId=${correlationIdFor(req)} ` +
      `${method} ${path} message=${message}`,
  );
  console.error(`[ServerError] ref=${reference} stack:\n${stack}`);

  return reference;
}

/** Append the reference code so it is visible wherever the message is rendered. */
export function withReference(message: string, reference: string): string {
  return `${message} (reference: ${reference})`;
}

/**
 * Log a failure and answer with a specific, referenced 500 response.
 * `reason` must describe what actually failed - never a generic catch-all.
 */
export function respondWithServerError(
  req: Request,
  res: Response,
  scope: string,
  error: unknown,
  reason: string,
  extra: Record<string, unknown> = {},
): Response {
  const reference = logServerError(scope, error, req);
  const message = withReference(reason, reference);
  return res.status(500).json({ error: message, message, reference, ...extra });
}
