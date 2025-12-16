# Problem
List view mixes multiple inclusion rules and reuses unrelated settings, producing confusing results (e.g., daily notes filtered by word count but days still appear via “created on this day”), and it has a few small UI/state inconsistencies.
## Current state (confirmed)
* Daily notes are sourced from `$dailyNotes` (via `getAllDailyNotes`) and rendered in List view.
* `computeList()` in `src/ui/Calendar.svelte:809-970` filters daily notes using `$settings.wordsPerDot` as a minimum word-count threshold (`wordCount < wordsPerDot` ⇒ excluded).
* A separate “created on this day” index is built by scanning `vault.getFiles()` and bucketing by `file.stat.ctime` into `notes` (md/canvas) and `files` (other) in `src/ui/Calendar.svelte:587-666`.
* `computeList()` then adds placeholder day items for any `createdOnDayIndex` dates not present in the filtered daily-note list (`src/ui/Calendar.svelte:867-886`). Placeholder items have `filePath: ""`, so:
    * Ollama title generation/refresh is hidden (it requires `item.filePath`).
    * The daily note can appear inside the “created notes” child list because exclusion is `f.path !== item.filePath`.
* Word-count “dots” use `wordsPerDot` too, but `getWordLengthAsDots()` clamps to a minimum of 1 dot for any existing note (`src/ui/sources/wordCount.ts:14-24`), which doesn’t align with List view’s `wordCount < wordsPerDot` filter.
* Active selection uses `getDateUIDFromFile()` which explicitly does not check file path (`src/ui/utils.ts:42-58`), so non-daily files that match the date format can still highlight a day.
* Minor UI/state issues in List view:
    * `DayChildOpenState` tracks `notes`, but notes are not rendered as a toggled subgroup (only `files` uses the subgroup toggle) (`src/ui/Calendar.svelte:519-523`, `1668+`).
    * “No attachments created…” is unreachable because the attachments subgroup is only rendered when `getCreatedFilesForItem(item).length` is truthy (`src/ui/Calendar.svelte:1668-1714`).
## Proposed changes
1. Define explicit List view semantics and settings
* Add list-specific settings to `ISettings`/`defaultSettings`:
    * `listViewMinWords` (default `0` so all daily notes are shown by default)
    * `listViewIncludeCreatedDays` (default `true` so days can appear from “created on this day” items too)
* Stop using `wordsPerDot` as the List view filter (optional one-time migration: initialize `listViewMinWords = wordsPerDot` only if you want to preserve legacy behavior).
* “Created on this day” bucketing should be based on `file.stat.ctime` (creation time).
2. Build List items as a per-day union (not “filtered daily notes + placeholder days”)
* Extract a pure TS helper (e.g. `src/ui/listViewModel.ts`) that merges:
    * daily note for a day (if it exists)
    * created-on-day buckets for that day (ctime-based)
* Make daily-note presence explicit in the model so UI can render it consistently (e.g. `dailyNote?: TFile` + `dailyNoteExists: boolean` and optionally an `expectedDailyNotePath`).
* Inclusion predicate: show day if (daily note exists) OR (`listViewIncludeCreatedDays` && created bucket has items).
* If a day has created items but no daily note, still render the daily note entry in a greyed-out “not created” style (optionally clickable to create/open).
* When rendering created notes, always exclude the daily note for that date (look it up by date if needed), so it can’t “move” into the created-notes list.
3. UI/UX alignment
* Update empty-state copy to match the semantics (it’s currently “No qualifying daily notes.”).
* Fix the unreachable attachments empty message (either remove the dead branch or render the subgroup unconditionally).
* Either implement a “Notes” subgroup toggle using the existing `dayChildOpenState[item.dateUID]?.notes`, or remove the unused `notes` state entirely.
4. Fix active selection correctness
* Update `getDateUIDFromFile()` to only return a UID when the file is actually one of the indexed daily/weekly notes (e.g., compare against `$dailyNotes`/`$weeklyNotes` records), preventing false highlights.
5. Tests
* Add Jest unit tests for the new list model helper (covering: daily note missing + created items ⇒ grey placeholder; created bucket ctime bucketing; daily note exclusion from children; inclusion predicate behavior).
## Confirmed requirements
* Show all daily notes by default.
* If a daily note doesn’t exist but there are created items for that day, still show the day and render the daily note entry in a “not created” greyed-out style.
* “Created on this day” should be computed from `file.stat.ctime`.
