/**
 * T031-T034: BackendSelector — runtime backend switching.
 *
 * Exports:
 *   - BackendSelector class: manages the active backend and allows switching
 *   - resolveDefaultBackend: auto-detects the best available backend
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailabilityResult = { available: true } | { available: false; reason?: string };

export interface BackendSelectorOptions {
  default: string;
  checkAvailability: (id: string) => Promise<AvailabilityResult>;
}

export type SwitchResult =
  | { success: true; newBackend: string }
  | { success: false; reason?: string };

type SwitchHandler = (newId: string, previousId: string) => void;

// ---------------------------------------------------------------------------
// BackendSelector
// ---------------------------------------------------------------------------

/**
 * Manages the active CLI backend at runtime and allows switching between
 * registered backends (rovo-dev, claude-cli, codex-cli, etc.).
 */
export class BackendSelector {
  private _active: string;
  private readonly _checkAvailability: (id: string) => Promise<AvailabilityResult>;
  private readonly _handlers: Set<SwitchHandler> = new Set();

  constructor(options: BackendSelectorOptions) {
    this._active = options.default;
    this._checkAvailability = options.checkAvailability;
  }

  /**
   * The currently active backend id.
   */
  get active(): string {
    return this._active;
  }

  /**
   * Attempt to switch to a different backend by id.
   *
   * - If the requested id is already active, returns `{ success: true }` without
   *   calling `checkAvailability` or notifying handlers (no-op).
   * - If the backend is unavailable, returns `{ success: false, reason }` and
   *   leaves `active` unchanged.
   * - On success, updates `active` and notifies all registered `onSwitch` handlers.
   */
  async switchTo(id: string): Promise<SwitchResult> {
    // No-op: already on this backend
    if (id === this._active) {
      return { success: true, newBackend: id };
    }

    const result = await this._checkAvailability(id);
    if (!result.available) {
      const reason = (result as { available: false; reason?: string }).reason;
      return { success: false, reason };
    }

    const previousId = this._active;
    this._active = id;

    // Notify all registered handlers
    for (const handler of this._handlers) {
      handler(id, previousId);
    }

    return { success: true, newBackend: id };
  }

  /**
   * Register a handler that is called whenever the active backend changes.
   *
   * The handler receives `(newId, previousId)`.
   *
   * Returns an unsubscribe function — call it to remove the handler.
   */
  onSwitch(handler: SwitchHandler): () => void {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  }
}

// ---------------------------------------------------------------------------
// resolveDefaultBackend
// ---------------------------------------------------------------------------

/**
 * Options for `resolveDefaultBackend`.
 */
export interface ResolveDefaultBackendOptions {
  /** Async predicate that returns true when the given binary is on PATH. */
  checkPath: (binary: string) => Promise<boolean>;
}

/**
 * Auto-detects and returns the id of the best available backend.
 *
 * Priority:
 *   1. `rovo-dev`  — when Rovo Dev env vars are present AND `acli` binary found
 *   2. `claude-cli` — when `claude` binary found
 *   3. `undefined`  — nothing available (logs a console.warn)
 *
 * Rovo Dev env vars required (any combination that proves a token is set):
 *   - OPENCLAW_LIVE_ROVODEV_TOKEN
 *   - ROVODEV_SITE_URL  (site url)
 *   - ROVODEV_USER_EMAIL (user email)
 *
 * For rovo-dev to be selected, OPENCLAW_LIVE_ROVODEV_TOKEN must be set AND
 * the `acli` binary must be present.
 */
export async function resolveDefaultBackend(
  opts: ResolveDefaultBackendOptions,
): Promise<string | undefined> {
  const { checkPath } = opts;

  // ---- Tier 1: rovo-dev ----
  const hasToken = Boolean(process.env["OPENCLAW_LIVE_ROVODEV_TOKEN"]);
  const hasSiteUrl = Boolean(process.env["ROVODEV_SITE_URL"]);
  const hasUserEmail = Boolean(process.env["ROVODEV_USER_EMAIL"]);
  const rovoDevEnvReady = hasToken && hasSiteUrl && hasUserEmail;

  if (rovoDevEnvReady) {
    const acliPresent = await checkPath("acli");
    if (acliPresent) {
      return "rovo-dev";
    }
  }

  // ---- Tier 2: claude-cli ----
  const claudePresent = await checkPath("claude");
  if (claudePresent) {
    return "claude-cli";
  }

  // ---- Nothing available ----
  console.warn(
    "[backend-selector] No CLI backend is available. " +
      "Set OPENCLAW_LIVE_ROVODEV_TOKEN / ROVODEV_SITE_URL / ROVODEV_USER_EMAIL and install acli, " +
      "or install the claude CLI.",
  );
  return undefined;
}
