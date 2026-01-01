export type CalendarViewState = {
  /** Whether the list view pane is visible */
  showList: boolean;

  /**
   * Displayed month in the calendar header.
   * Stored as YYYY-MM-DD (typically the first day of the month) to avoid locale issues.
   */
  displayedMonth: string | null;

  /**
   * Open/closed state for list groups (e.g. "2025/12").
   * We keep explicit false values so user-closed groups don't reopen due to defaults.
   */
  groupOpenState: Record<string, boolean>;

  /**
   * Open day rows in List view.
   * NOTE: This map is expected to only include `true` entries (closed rows should be absent).
   */
  dayOpenState: Record<string, boolean>;

  /**
   * Open child toggles per day (nested under a day row in List view).
   * NOTE: This map is expected to only include entries with at least one true child flag.
   */
  dayChildOpenState: Record<string, { files?: boolean }>;
};

export const defaultViewState: CalendarViewState = {
  showList: false,
  displayedMonth: null,
  groupOpenState: {},
  dayOpenState: {},
  dayChildOpenState: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeBooleanMap(
  raw: unknown,
  opts: { maxKeys: number }
): Record<string, boolean> {
  if (!isRecord(raw)) {
    return {};
  }

  const out: Record<string, boolean> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (count >= opts.maxKeys) {
      break;
    }
    if (typeof k !== "string" || !k) {
      continue;
    }
    if (typeof v === "boolean") {
      out[k] = v;
      count += 1;
    }
  }
  return out;
}

export function sanitizeCalendarViewState(raw: unknown): CalendarViewState {
  if (!isRecord(raw)) {
    return {
      ...defaultViewState,
      groupOpenState: {},
      dayOpenState: {},
      dayChildOpenState: {},
    };
  }

  // Reasonable guardrails; the state can be big on large vaults, but should not explode.
  const MAX_GROUP_KEYS = 20_000;
  const MAX_DAY_KEYS = 50_000;

  const showList = typeof raw.showList === "boolean" ? raw.showList : false;

  const displayedMonth =
    typeof raw.displayedMonth === "string" && raw.displayedMonth.trim()
      ? raw.displayedMonth.trim()
      : null;

  const groupOpenState = sanitizeBooleanMap(raw.groupOpenState, {
    maxKeys: MAX_GROUP_KEYS,
  });

  // dayOpenState: we only keep `true` entries to keep the persisted file small.
  const dayOpenStateRaw = sanitizeBooleanMap(raw.dayOpenState, {
    maxKeys: MAX_DAY_KEYS,
  });
  const dayOpenState: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(dayOpenStateRaw)) {
    if (v === true) {
      dayOpenState[k] = true;
    }
  }

  // dayChildOpenState: only keep children that are explicitly true.
  const dayChildOpenState: Record<string, { files?: boolean }> = {};
  if (isRecord(raw.dayChildOpenState)) {
    let count = 0;
    for (const [k, v] of Object.entries(raw.dayChildOpenState)) {
      if (count >= MAX_DAY_KEYS) {
        break;
      }
      if (!k) {
        continue;
      }
      if (!isRecord(v)) {
        continue;
      }

      const files = v.files === true;
      if (!files) {
        continue;
      }

      dayChildOpenState[k] = { files: true };
      count += 1;
    }
  }

  return {
    showList,
    displayedMonth,
    groupOpenState,
    dayOpenState,
    dayChildOpenState,
  };
}
