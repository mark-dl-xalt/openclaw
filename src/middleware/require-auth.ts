/**
 * T050b: Session authentication middleware.
 *
 * Protects routes by requiring a valid session with a userId.
 * Unauthenticated requests are redirected to /login.
 */
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- express-session augments req
  const session = (req as any).session;
  if (!session?.userId) {
    res.redirect("/login");
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pass userId downstream
  (req as any).userId = session.userId;
  next();
}
