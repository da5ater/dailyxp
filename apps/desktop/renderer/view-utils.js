export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const button = (label, action, id = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" data-id="${escape(id)}">${escape(label)}</button>`;
export const dateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
export const minutes = (ms) => Math.floor((ms || 0) / 60000);
export function time(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}
