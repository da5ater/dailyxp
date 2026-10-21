import { escape, button } from "./view-utils.js";

function provinceLabel(province, occupied) {
  if (occupied) return "Hollow King · Resting";
  if (province.status === "achieved") return "Reclaimed · Visitable";
  if (province.status === "sleeping") return "Resting Province";
  return "Growing Province";
}
function renderProvince(province, occupied) {
  const p = province;
  const unit =
    p.progressKind === "milestones"
      ? "landmarks built"
      : "commitments with progress";
  const progressCopy = p.total
    ? `${p.completed} / ${p.total} ${unit}`
    : p.status === "achieved"
      ? "Goal achieved. This Province stays reclaimed."
      : "No linked work yet.";
  const landmarks = p.landmarks
    .map(
      (l) =>
        `<li><span aria-hidden="true">${l.status === "built" ? "◆" : "◇"}</span> ${escape(l.title)} <span class="hint">· ${l.status === "built" ? "Built" : "Planned"}</span></li>`,
    )
    .join("");
  return `<article class="province" data-province-id="${escape(p.id)}"><div class="province-top"><span class="eyebrow">${provinceLabel(p, occupied)}</span><span class="province-fraction">${Math.round(p.fraction * 100)}%</span></div><h2>${escape(p.title)}</h2><progress max="1" value="${p.fraction}" aria-label="${escape(p.title)} province progress"></progress><p class="hint">${progressCopy}</p>${landmarks ? `<ul class="landmarks">${landmarks}</ul>` : p.status === "achieved" ? "" : '<p class="hint">Link a Task or Milestone in Plan to shape this Province.</p>'}</article>`;
}
export function renderWorld(state) {
  const story = state.story;
  const provinces = story.provinces.filter((p) =>
    ["active", "sleeping", "achieved"].includes(p.status),
  );
  const hollow = story.antagonists.find((a) => a.id === "hollow-king");
  const occupied = new Set(hollow?.provinces || []);
  const cards = provinces
    .map((p) => renderProvince(p, occupied.has(p.id)))
    .join("");
  return `<div class="heading"><div><div class="eyebrow">World · Your reclaimed kingdom</div><h1>Every small step leaves a mark.</h1></div>${button("Open Plan", "navigate", "Plan")}</div>
    <section class="world-momentum" aria-label="Momentum"><div><span class="eyebrow">Momentum</span><h2>${escape(story.momentum)}</h2><p>${escape(story.momentumCause)}</p></div><img src="kingdom-ps1.png" alt="" width="1672" height="941"></section>
    ${hollow ? `<section class="world-return" aria-label="Hollow King"><h2>Hollow King</h2><p>${escape(hollow.cause)}</p><p class="hint">Your earned progress stays yours. One meaningful action can begin the return.</p></section>` : ""}
    <section class="provinces" aria-label="Goal provinces">${cards || `<div class="empty"><h2>Your first Province begins with a Goal.</h2><p class="hint">Create a Goal in Plan. Its Milestones and meaningful linked work build the landscape here.</p>${button("Create a Goal in Plan", "navigate", "Plan")}</div>`}</section>`;
}
