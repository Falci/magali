// Deterministic color assignment for contact avatars based on name.
// The same name always yields the same color — no runtime state needed.

const PALETTE = [
  { bg: "#fecdd3", text: "#9f1239" }, // rose
  { bg: "#fed7aa", text: "#9a3412" }, // orange
  { bg: "#fef08a", text: "#854d0e" }, // yellow
  { bg: "#bbf7d0", text: "#14532d" }, // green
  { bg: "#a7f3d0", text: "#064e3b" }, // emerald
  { bg: "#99f6e4", text: "#134e4a" }, // teal
  { bg: "#bae6fd", text: "#0c4a6e" }, // sky
  { bg: "#bfdbfe", text: "#1e3a8a" }, // blue
  { bg: "#c7d2fe", text: "#312e81" }, // indigo
  { bg: "#ddd6fe", text: "#4c1d95" }, // violet
  { bg: "#f5d0fe", text: "#701a75" }, // fuchsia
  { bg: "#fbcfe8", text: "#831843" }, // pink
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function contactAvatarStyle(
  firstName: string,
  lastName?: string | null,
): { backgroundColor: string; color: string } {
  const key = `${firstName}${lastName ?? ""}`;
  const { bg, text } = PALETTE[hash(key) % PALETTE.length];
  return { backgroundColor: bg, color: text };
}
