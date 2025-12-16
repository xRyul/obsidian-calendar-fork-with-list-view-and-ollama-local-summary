import type { Moment } from "moment";
import type { TFile } from "obsidian";

export type CreatedOnDayBucket = { notes: TFile[]; files: TFile[] };

export type DailyNoteCandidate = {
  date: Moment;
  dateUID: string;
  dateStr: string;
  epoch: number;
  year: number;

  file: TFile;
  filePath: string;
  mtime: number;

  qualifies: boolean;
};

export type ListItem = {
  date: Moment;
  dateUID: string;
  dateStr: string;
  epoch: number;
  year: number;

  // Daily note (if it exists)
  file?: TFile;
  filePath: string;
  mtime: number;
  dailyNoteExists: boolean;
};

export type YearGroup = { year: number; items: ListItem[] };

export function buildListItems(params: {
  dailyNoteCandidates: DailyNoteCandidate[];
  createdOnDayIndex?: Record<string, CreatedOnDayBucket> | null;
  includeCreatedDays: boolean;
  parseDateStr: (dateStr: string) => Moment;
  getDayDateUID: (date: Moment) => string;
}): ListItem[] {
  const {
    dailyNoteCandidates,
    createdOnDayIndex,
    includeCreatedDays,
    parseDateStr,
    getDayDateUID,
  } = params;

  const byDate = new Map<string, DailyNoteCandidate>();
  for (const candidate of dailyNoteCandidates) {
    const prev = byDate.get(candidate.dateStr);
    // Prefer the most recently modified file if duplicates exist.
    if (!prev || (candidate.mtime ?? 0) > (prev.mtime ?? 0)) {
      byDate.set(candidate.dateStr, candidate);
    }
  }

  const includedDates = new Set<string>();

  // Include qualifying daily notes.
  for (const candidate of byDate.values()) {
    if (candidate.qualifies) {
      includedDates.add(candidate.dateStr);
    }
  }

  // Include days that have created-on-day items (even if the daily note doesn't qualify).
  if (includeCreatedDays && createdOnDayIndex && typeof createdOnDayIndex === "object") {
    for (const [dateStr, bucket] of Object.entries(createdOnDayIndex)) {
      const hasItems =
        (bucket?.notes?.length ?? 0) > 0 || (bucket?.files?.length ?? 0) > 0;
      if (hasItems) {
        includedDates.add(dateStr);
      }
    }
  }

  const items: ListItem[] = [];

  for (const dateStr of includedDates) {
    const candidate = byDate.get(dateStr);

    if (candidate) {
      items.push({
        date: candidate.date,
        dateUID: candidate.dateUID,
        dateStr: candidate.dateStr,
        epoch: candidate.epoch,
        year: candidate.year,

        file: candidate.file,
        filePath: candidate.filePath,
        mtime: candidate.mtime,
        dailyNoteExists: true,
      });
      continue;
    }

    // Created-only day: include a placeholder daily note entry.
    const date = parseDateStr(dateStr);
    if (!date?.isValid?.()) {
      continue;
    }

    items.push({
      date,
      dateUID: getDayDateUID(date),
      dateStr,
      epoch: date.valueOf(),
      year: date.year(),

      file: undefined,
      filePath: "",
      mtime: 0,
      dailyNoteExists: false,
    });
  }

  items.sort((a, b) => b.epoch - a.epoch);
  return items;
}
