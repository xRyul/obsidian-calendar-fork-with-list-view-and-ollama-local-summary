export type ListItemTagColor = {
  label: string;
  color: string;
  iconId: string;
};

const ICON_PREFIX = "calendar-list-tag-swatch";

export const LIST_ITEM_TAG_COLORS: ListItemTagColor[] = [
  { label: "Red", color: "#ef4444", iconId: `${ICON_PREFIX}-red` },
  { label: "Orange", color: "#f97316", iconId: `${ICON_PREFIX}-orange` },
  { label: "Yellow", color: "#eab308", iconId: `${ICON_PREFIX}-yellow` },
  { label: "Green", color: "#22c55e", iconId: `${ICON_PREFIX}-green` },
  { label: "Blue", color: "#3b82f6", iconId: `${ICON_PREFIX}-blue` },
  { label: "Purple", color: "#a855f7", iconId: `${ICON_PREFIX}-purple` },
  { label: "Pink", color: "#ec4899", iconId: `${ICON_PREFIX}-pink` },
  { label: "Gray", color: "#64748b", iconId: `${ICON_PREFIX}-gray` },
];

export function buildListItemTagColorSwatchSvg(color: string): string {
  const fill = (color ?? "").trim();

  // Rounded square swatch; using `currentColor` stroke keeps it visible in both light/dark themes.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect x="5" y="5" width="14" height="14" rx="3" ry="3" fill="${fill}" stroke="currentColor" stroke-width="1.25" />
</svg>`;
}
