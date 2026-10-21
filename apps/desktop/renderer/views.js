import { escape, button, dateLabel, minutes, time } from "./view-utils.js";
export function renderView({ state, surface, selectedId, privateOpen }) {
  const collection = () => [
    ...state.planning.tasks,
    ...state.planning.occurrences,
  ];
  const taskFor = (id) => collection().find((t) => t.id === id);
  function todayMinutes() {
    return state.session.sessions
      .filter((s) => s.status === "finished")
      .reduce(
        (sum, s) =>
          sum +
          (s.dailySlices || [])
            .filter((d) => d.dailyXpDate === state.date)
            .reduce((a, d) => a + minutes(d.milliseconds), 0),
        0,
      );
  }
  function renderSurface() {
    if (surface === "Play") return renderPlay();
    if (surface === "Plan") return renderPlan();
    if (surface === "Journey") return renderJourney();
    if (surface === "Recovery") return renderRecovery();
    if (surface === "Settings") return renderSettings();
    return `<div class="heading"><div><div class="eyebrow">World</div><h1>Your local progress comes first.</h1></div></div><div class="empty"><h2>No online Season connected</h2><p class="hint">Leagues, Guilds and Fixtures need a connected service. This build records your activity locally. It does not invent opponents or rankings.</p>${button("Return to Play", "navigate", "Play")}</div>`;
  }
  function renderPlay() {
    const active = state.session.activeSession,
      selected = taskFor(active?.taskId || selectedId);
    const tasks = [
      ...state.planning.tasks.filter((t) => t.status === "open"),
      ...state.planning.occurrences.filter(
        (t) => t.dailyXpDate === state.date && t.status === "open",
      ),
    ];
    const elapsed = state.summary.focusedMilliseconds;
    const title =
      selected?.title ||
      (active ? "Free Session" : "Choose what matters next.");
    return `${!active && state.session.selection?.reminderStatus === "due" ? `<div class="reminder"><span>Your selected commitment is waiting. Start when you are ready.</span>${button("Dismiss reminder", "dismiss-reminder")}</div>` : ""}<div class="heading"><div><div class="eyebrow">${escape(dateLabel(state.date))}</div><h1>Choose your next move.</h1></div><span class="hint">${todayMinutes()} / ${state.settings.dailyTargetMinutes} min today</span></div><div class="workbench"><section class="rail" aria-label="Commitments"><div class="rowhead"><h3>Your commitments</h3>${button("+ Add", "new", "task")}</div>${tasks.length ? tasks.map((t) => `<div class="task ${t.id === selected?.id ? "selected" : ""}"><button class="task-main" data-action="select" data-id="${escape(t.id)}" aria-pressed="${t.id === selected?.id}"><span class="task-name">${escape(t.title)}</span><span class="detail">${t.estimateMinutes || t.expectedMinutes} min · ${t.routineId ? "Routine" : escape(t.primarySkill)}</span></button><div class="row-actions">${button("Done", "complete-task", t.id)}</div></div>`).join("") : `<div class="empty"><p>No commitments yet.</p><p class="hint">Add one small Task, or begin a free Session.</p></div>`}<section class="support"><div class="rowhead"><h3>Habits</h3>${button("+ Habit", "new", "habit")}</div>${renderHabits()}<p>${button("Private Recovery", "navigate", "Recovery")}</p></section>${renderOverdue()}</section><section class="focus" aria-label="Current Session"><div class="kingdom-scene"><img src="kingdom-ps1.png" alt="" width="1672" height="941"><span class="scene-caption">YOUR NEXT CHAPTER</span></div><div class="focus-content"><div class="eyebrow" id="session-status">${active ? `SESSION ${active.status.toUpperCase()}` : "READY TO PLAY"}</div><h2>${escape(title)}</h2><span class="hint">${escape(selected?.primarySkill || "general/focus")}${selected ? ` · ${selected.estimateMinutes || selected.expectedMinutes} min planned` : ""}</span><div class="timer ${active ? "" : "idle"}" id="session-timer" aria-label="Session elapsed time">${active ? time(elapsed) : "Ready when you are."}</div><p class="hint">${active ? "Finish records focused time. Complete the Task separately." : "Selecting a commitment does not start your Session."}</p>${active?.pendingInactivityEndedAtUtc ? `<div><p>Was the time away focused work?</p><div class="inline">${button("Include time", "idle-include")}${button("Exclude time", "idle-exclude")}</div></div>` : ""}<div class="controls">${active ? button(active.status === "running" ? "Pause Session" : "Resume Session", active.status === "running" ? "pause" : "resume", "", "primary") + button("Finish Session", "finish") + button("Discard", "discard") : button("Start Session", "start", "", "primary") + button("Free Session", "free")}</div></div></section></div>`;
  }
  function renderHabits() {
    const done = new Set(
      state.habit.completions
        .filter((c) => c.dailyXpDate === state.date)
        .map((c) => c.habitId),
    );
    return (
      state.habit.habits
        .filter(
          (h) => h.status === "active" && state.eligibleHabitIds.includes(h.id),
        )
        .map(
          (h) =>
            `<div class="habit"><span>${escape(h.title)}<span class="detail">${state.habit.streaks[h.id]?.current || 0} day streak</span></span>${button(done.has(h.id) ? "Undo" : "Complete", done.has(h.id) ? "undo-habit" : "complete-habit", h.id)}</div>`,
        )
        .join("") || '<p class="hint">Small repeated actions belong here.</p>'
    );
  }
  function renderOverdue() {
    const overdue = state.planning.occurrences.filter(
      (o) => o.status === "overdue",
    );
    if (
      !overdue.length ||
      state.planning.lastGentleDispositionDate === state.date
    )
      return "";
    return `<details class="support"><summary>${overdue.length} overdue · one gentle next step</summary><p>${escape(overdue[0].title)}</p><div class="inline">${button("Try 5 minutes", "overdue-smaller", overdue[0].id)}${button("Tomorrow", "overdue-reschedule", overdue[0].id)}${button("Skip", "overdue-skip", overdue[0].id)}</div></details>`;
  }
  function renderPlan() {
    return `<div class="heading"><div><div class="eyebrow">Plan</div><h1>Give your work direction.</h1></div><div class="inline">${button("+ Task", "new", "task")}${button("+ Routine", "new", "routine")}${button("+ Goal", "new", "goal")}</div></div><div class="plan-grid"><section><h2>Goals and Milestones</h2>${
      state.planning.goals
        .map(
          (g) =>
            `<div class="entity"><div><h3>${escape(g.title)}</h3><p>${escape(g.reason)} · ${escape(g.status)}</p></div><div class="row-actions">${button("Edit", "edit-goal", g.id)}${["active", "paused"].includes(g.status) ? button(g.status === "paused" ? "Resume" : "Pause", "toggle-goal", g.id) : ""}${button("+ Milestone", "new-milestone", g.id)}${g.status === "active" ? button("Achieve", "achieve-goal", g.id) : ""}</div></div>${state.planning.milestones
              .filter((m) => m.goalId === g.id)
              .map(
                (m) =>
                  `<div class="entity"><div>${escape(m.title)}<p>${escape(m.status)} · ${m.measurement.type}</p></div>${m.status !== "completed" ? button("Complete", "complete-milestone", m.id) + button("Edit", "edit-milestone", m.id) : ""}</div>`,
              )
              .join("")}`,
        )
        .join("") ||
      '<p class="hint">Add a Goal when a bigger outcome gives your work meaning.</p>'
    }</section><section><h2>Habits</h2>${state.habit.habits.map((h) => `<div class="entity"><div>${escape(h.title)}<p>${escape(h.status)} · ${state.eligibleHabitIds.includes(h.id) ? "Scheduled today" : "Not scheduled today"}</p></div><div class="row-actions">${h.status === "active" ? button("Edit", "edit-habit", h.id) + button("Remove", "remove-habit", h.id) : ""}</div></div>`).join("") || '<p class="hint">No Habits yet.</p>'}<h2 class="support">Routines</h2>${state.planning.routines.map((r) => `<div class="entity"><div><h3>${escape(r.title)}</h3><p>${r.expectedMinutes} min · ${r.schedule.type === "weekdays" ? "Scheduled weekdays" : "Repeating interval"}</p></div><div class="row-actions">${button("Edit", "edit-routine", r.id)}${button("Remove", "remove-routine", r.id)}</div></div>`).join("") || '<p class="hint">A Routine creates a dated commitment on its scheduled days.</p>'}<div class="support"><h2>Tasks</h2>${state.planning.tasks.map((t) => `<div class="entity"><div>${escape(t.title)}<p>${t.estimateMinutes} min · ${escape(t.status)}</p></div>${t.status === "open" ? button("Edit", "edit-task", t.id) : ""}</div>`).join("") || '<p class="hint">No Tasks yet.</p>'}</div></section></div>`;
  }
  function ledgerReason(entry) {
    if (entry.reason.startsWith("habit completed:")) {
      const habit = state.habit.habits.find((h) => entry.reason.endsWith(h.id));
      return habit ? `Habit completed · ${habit.title}` : "Habit completed";
    }
    if (/^milestone(:| completed:)/.test(entry.reason)) {
      const milestone = state.planning.milestones.find((m) =>
        entry.reason.endsWith(m.id),
      );
      return milestone
        ? `Milestone completed · ${milestone.title}`
        : "Milestone completed";
    }
    return entry.reason;
  }
  function renderJourney() {
    const p = state.progression;
    return `<div class="heading"><div><div class="eyebrow">Journey</div><h1>Your effort stays with you.</h1></div></div><div class="metrics"><div class="metric"><strong>${p.level}</strong>Level · ${escape(p.storyRank)}</div><div class="metric"><strong>${p.totals.lifetimeXp.toLocaleString()}</strong>Lifetime XP</div><div class="metric"><strong>${minutes(state.session.sessions.reduce((a, s) => a + (s.status === "finished" ? s.focusedMilliseconds : 0), 0))}</strong>Focused minutes</div><div class="metric"><strong>${escape(p.momentum)}</strong>Momentum</div></div><section class="ledger"><h2>XP Ledger</h2><p class="hint">Every award has a reason. Finishing a Session does not complete its Task.</p>${
      p.ledger.length
        ? p.ledger
            .slice()
            .reverse()
            .map(
              (e) =>
                `<div class="ledger-row"><strong>${e.lifetimeXp >= 0 ? "+" : ""}${e.lifetimeXp} XP</strong><span>${escape(ledgerReason(e))}</span><time>${escape(e.dailyXpDate || "")}</time></div>`,
            )
            .join("")
        : '<p class="empty">Complete a Habit or finish focused work to make your first entry.</p>'
    }</section><section class="support"><h2>Session history</h2>${
      state.session.sessions
        .filter((s) => s.status === "finished")
        .slice()
        .reverse()
        .map(
          (s) =>
            `<div class="entity"><div>${escape(taskFor(s.taskId)?.title || "Free Session")}<p>${minutes(s.focusedMilliseconds)} min · ${escape(s.primarySkill)}</p></div><span class="hint">${escape(s.dailyXpDate || "")}</span>${button("Correct", "edit-session", s.id)}</div>`,
        )
        .join("") || '<p class="hint">Your finished Sessions appear here.</p>'
    }<h2 class="support">Your kingdom</h2><img class="journey-scene" src="kingdom-ps1.png" alt="A low polygon traveler looking toward a distant castle">${state.story.provinces?.length ? state.story.provinces.map((p) => `<div class="entity"><span>${escape(p.title || p.goalId)}</span><span>${escape(p.status || "")}</span></div>`).join("") : '<p class="hint">Create a Goal in Plan to begin a Province.</p>'}</section>`;
  }
  function renderRecovery() {
    if (!privateOpen)
      return `<div class="heading"><div><div class="eyebrow">Private Recovery</div><h1>A space for your own progress.</h1></div></div><div class="recovery-gate"><h2>Open your private tracks?</h2><p class="hint">This information stays out of the companion plugin and ordinary desktop feedback. Opening this view displays sensitive information on this screen.</p>${button("Open private tracks", "unlock-recovery", "", "primary")}${button("Back to Play", "navigate", "Play")}</div>`;
    return `<div class="heading"><div><div class="eyebrow">Private · visible only in this app</div><h1>Keep moving, at your pace.</h1></div><div class="inline">${button("+ Track", "new", "recovery")}${button("Hide tracks", "lock-recovery")}</div></div>${
      state.recovery.tracks
        .filter((t) => t.status !== "deleted")
        .map((t) => {
          const attempt = state.recovery.attempts.find(
            (a) => a.trackId === t.id && a.status === "active",
          );
          return `<div class="entity"><div><h3>${escape(t.customCategory || t.category)}</h3><p>${attempt ? `Started ${escape(attempt.startDate)}` : "A new attempt can begin when you are ready."}</p></div><div class="inline">${button("Check in", "checkin", t.id)}${button(attempt ? "Record setback" : "Restart", attempt ? "relapse" : "restart-recovery", t.id)}</div></div>`;
        })
        .join("") ||
      '<p class="empty">No private tracks yet. Add one when it is useful to you.</p>'
    }`;
  }
  function renderSettings() {
    return `<div class="heading"><div><div class="eyebrow">Settings</div><h1>Make DailyXP fit your day.</h1></div></div><form id="settings-form" class="settings"><label class="setting">Daily focus target in minutes<input name="dailyTargetMinutes" type="number" min="1" max="720" required value="${state.settings.dailyTargetMinutes}"></label><label class="setting">Day boundary in minutes after midnight<input name="dayBoundaryMinutes" type="number" min="0" max="1439" required value="${state.settings.dayBoundaryMinutes}"></label><p class="hint">240 means 04:00. Existing history keeps its recorded day context.</p><label class="setting">Reduce motion<input name="reducedMotion" type="checkbox" ${state.settings.reducedMotion ? "checked" : ""}></label><label class="setting">Desktop XP notifications<input name="notifications" type="checkbox" ${state.settings.notifications ? "checked" : ""}></label><div>${button("Save settings", "save-settings", "", "primary")}</div></form><section class="support"><h2>Your data</h2><p class="hint">Import copies a legacy plugin backup into an empty desktop profile. It does not change the source. Export includes private data. Store it safely.</p><div class="inline">${button("Import legacy state", "import")}${button("Export backup", "export")}</div><p class="hint">Close hides the window so your Session and companion stay connected. Use DailyXP → Quit DailyXP or Ctrl+Q to stop the application.</p></section>`;
  }
  return renderSurface();
}
