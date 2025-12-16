import moment from "moment";
import type { TFile } from "obsidian";

import { buildListItems } from "./listViewModel";

describe("ui/listViewModel", () => {
  const parseDateStr = (dateStr: string) => moment(dateStr, "YYYY-MM-DD", true);
  const getDayDateUID = (date: moment.Moment) => date.format("YYYY-MM-DD");

  const mockFile = (path: string): TFile => ({ path } as unknown as TFile);

  it("includes qualifying daily notes", () => {
    const date = moment("2025-12-15", "YYYY-MM-DD", true);

    const items = buildListItems({
      dailyNoteCandidates: [
        {
          date,
          dateUID: "2025-12-15",
          dateStr: "2025-12-15",
          epoch: date.valueOf(),
          year: 2025,
          file: mockFile("Daily/2025-12-15.md"),
          filePath: "Daily/2025-12-15.md",
          mtime: 1,
          qualifies: true,
        },
      ],
      createdOnDayIndex: {},
      includeCreatedDays: true,
      parseDateStr,
      getDayDateUID,
    });

    expect(items).toHaveLength(1);
    expect(items[0].dateStr).toBe("2025-12-15");
    expect(items[0].dailyNoteExists).toBe(true);
    expect(items[0].filePath).toBe("Daily/2025-12-15.md");
  });

  it("includes a grey placeholder daily note entry when created items exist but no daily note exists", () => {
    const items = buildListItems({
      dailyNoteCandidates: [],
      createdOnDayIndex: {
        "2025-12-14": { notes: [mockFile("Notes/x.md")], files: [] },
      },
      includeCreatedDays: true,
      parseDateStr,
      getDayDateUID,
    });

    expect(items.map((i) => i.dateStr)).toEqual(["2025-12-14"]);
    expect(items[0].dailyNoteExists).toBe(false);
    expect(items[0].filePath).toBe("");
  });

  it("keeps the daily note filePath when the day is included via created items (prevents daily note appearing in created list)", () => {
    const date = moment("2025-12-13", "YYYY-MM-DD", true);

    const items = buildListItems({
      dailyNoteCandidates: [
        {
          date,
          dateUID: "2025-12-13",
          dateStr: "2025-12-13",
          epoch: date.valueOf(),
          year: 2025,
          file: mockFile("Daily/2025-12-13.md"),
          filePath: "Daily/2025-12-13.md",
          mtime: 2,
          qualifies: false,
        },
      ],
      createdOnDayIndex: {
        "2025-12-13": { notes: [mockFile("Daily/2025-12-13.md")], files: [] },
      },
      includeCreatedDays: true,
      parseDateStr,
      getDayDateUID,
    });

    expect(items).toHaveLength(1);
    expect(items[0].dateStr).toBe("2025-12-13");
    expect(items[0].dailyNoteExists).toBe(true);
    expect(items[0].filePath).toBe("Daily/2025-12-13.md");
  });

  it("excludes non-qualifying daily notes when there are no created items", () => {
    const date = moment("2025-12-12", "YYYY-MM-DD", true);

    const items = buildListItems({
      dailyNoteCandidates: [
        {
          date,
          dateUID: "2025-12-12",
          dateStr: "2025-12-12",
          epoch: date.valueOf(),
          year: 2025,
          file: mockFile("Daily/2025-12-12.md"),
          filePath: "Daily/2025-12-12.md",
          mtime: 3,
          qualifies: false,
        },
      ],
      createdOnDayIndex: {},
      includeCreatedDays: true,
      parseDateStr,
      getDayDateUID,
    });

    expect(items).toEqual([]);
  });
});
