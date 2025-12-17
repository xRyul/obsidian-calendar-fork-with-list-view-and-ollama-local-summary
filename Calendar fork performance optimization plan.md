# Problem statement
Calendar UI responsiveness can degrade on large vaults because the plugin repeatedly reads/parses note contents and builds/renders large list-view DOM trees on the main thread.
## Current state (verified)
* Calendar day/week metadata is recomputed on every render: `obsidian-calendar-ui` calls `getDailyMetadata(sources, day)` / `getWeeklyMetadata(...)` for every visible cell; it simply `Promise.all`s every source with no memoization. (`node_modules/obsidian-calendar-ui/src/components/Calendar.svelte:94-117`, `node_modules/obsidian-calendar-ui/src/metadata.ts:24-41`)
* Two built-in sources do full file reads + regex work per invocation:
    * Word count dots: `vault.cachedRead(note)` + `getWordCount(...)`. (`src/ui/sources/wordCount.ts:14-24`)
    * Task dot: `vault.cachedRead(note)` + regex match. (`src/ui/sources/tasks.ts:9-17`)
* The view triggers frequent full-calendar updates:
    * `CalendarView.onFileModified` calls `calendar.tick()` for any daily/weekly note modification; `file-open`, create/delete, and settings updates also call `tick()` / `reindex()`. (`src/view.ts:60-216`, `src/ui/Calendar.svelte:1145-1154`)
* List view recomputation is O(#dailyNotes) and may require reading every daily note to enforce “Min words”:
    * `computeList()` loops all daily note files; when `listViewMinWords>0` it reads each file and counts words (with a per-session mtime cache). (`src/ui/Calendar.svelte:734-747`, `src/ui/Calendar.svelte:860-916`)
* “Created items” indexing is O(#vaultFiles) and currently rebuilds by scanning `vault.getFiles()` and formatting dates with `moment(...)`.
    * It is re-triggered (debounced) on create/delete/rename while list view is open. (`src/ui/Calendar.svelte:630-717`, `src/ui/Calendar.svelte:1207-1215`)
* List view renders all groups/items into the DOM even when groups are collapsed because `<details>` hides content but does not prevent Svelte from creating it.
    * Groups recurse unconditionally in `ListGroup.svelte`, and the main list iterates all items. (`src/ui/ListGroup.svelte:9-41`, `src/ui/Calendar.svelte:1783-1924`)
* Active-file highlighting does an O(N) scan over daily/weekly indexes on each file-open to decide whether the file is a daily/weekly note. (`src/ui/utils.ts:55-74`, `src/ui/stores.ts:67-70`)
## Proposed changes (priority order)
1) Add a shared derived-metrics cache for note text parsing
* Create a small module (e.g. `src/ui/noteMetrics.ts`) that provides cached, mtime-keyed async getters:
    * `getWordCount(file)` (reuses existing `getWordCount(text)`)
    * `getOpenTaskCount(file)`
* Use it in:
    * `src/ui/sources/wordCount.ts` and `src/ui/sources/tasks.ts`
    * list view filtering in `src/ui/Calendar.svelte` (replace its local `wordCountCache`)
* Add bounded size (LRU or max entries) to prevent unbounded memory growth.
Impact: removes repeated `cachedRead + regex` across calendar rerenders and across list/calendar duplication.
2) Throttle/coalesce calendar refresh triggers
* In `src/view.ts`, debounce `calendar.tick()` and list refresh requests originating from vault events (modify/create/delete) to a small window (e.g. 150–300ms), so rapid event bursts don’t cause repeated full-metadata recomputation.
* Keep correctness: still refresh promptly, just coalesced.
Impact: reduces “work per keystroke/save” when daily notes change.
3) Make list view rendering lazy (and optionally virtualized)
* Update `src/ui/ListGroup.svelte` to render child groups/items only when the group is open (gated by `openState[node.id]`).
* Optionally (phase 2): add list virtualization for the day rows inside an opened group (or flatten rendering) to avoid thousands of `<details>` nodes.
Impact: large drop in DOM size and initial render cost for large histories.
4) Replace full rescan “created on this day” indexing with incremental maintenance
* Build the index once on list-open (or first enable), then update it incrementally on vault events:
    * create: add to bucket for `ctime`
    * delete: remove
    * rename: update path within the same bucket
* Replace `moment(ctime).format("YYYY-MM-DD")` in the hot loop with a fast Date formatter for `YYYY-MM-DD` (local time) to reduce CPU.
Impact: avoids O(#vaultFiles) rescans during normal use.
5) Optimize active-file date UID lookup to O(1)
* Maintain reverse maps/sets keyed by `file.path` when daily/weekly stores reindex (or derive them once per reindex), and use that for `activeFile.setFile` instead of scanning `Object.values(record)`.
Impact: makes file-open highlighting constant-time even with thousands of daily notes.
## Validation
* Add lightweight timing logs behind a debug flag (or `console.debug`) for:
    * per-month metadata computation (aggregate)
    * list recompute duration
    * created-on-day index build duration
* Test on a large vault scenario (synthetic if needed): measure list open time, scroll/expand responsiveness, and “modify daily note” jitter before/after.
## Risks / notes
* Any caching must be invalidated by `mtime` (and handle rename/delete) to avoid stale dots/filters.
* Virtualization (if added) can affect focus/tab order and accessibility behavior because rows may be mounted/unmounted while navigating; the current list already supports basic keyboard interaction (Tab + Enter/Space on buttons/`<details>` and `tabindex="0"` entries). Keep full virtualization as phase 2 after the simpler “render children only when open” gating, and validate keyboard behavior.
