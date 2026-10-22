var DEFAULTS = {
  dayBoundaryMinutes: 240,
  dailyTargetMinutes: 120,
  reducedMotion: false,
  notifications: false
};

function validate(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings) ||
      Object.keys(settings).some(function(key) { return !Object.prototype.hasOwnProperty.call(DEFAULTS, key); }) ||
      !Number.isInteger(settings.dayBoundaryMinutes) || settings.dayBoundaryMinutes < 0 || settings.dayBoundaryMinutes > 1439 ||
      !Number.isInteger(settings.dailyTargetMinutes) || settings.dailyTargetMinutes < 1 || settings.dailyTargetMinutes > 720 ||
      typeof settings.reducedMotion !== "boolean" || typeof settings.notifications !== "boolean")
    throw new Error("Invalid settings");
  return Object.assign({}, settings);
}

function project(events) {
  return events.reduce(function(settings, event) {
    return event.type === "settings.changed" ? validate(event.payload.settings) : settings;
  }, Object.assign({}, DEFAULTS));
}

function decide(current, command) {
  if (command.type !== "settings.change") throw new Error("Unsupported settings command");
  var changes = command.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes) ||
      Object.keys(changes).some(function(key) { return !Object.prototype.hasOwnProperty.call(DEFAULTS, key); }))
    throw new Error("Unknown setting");
  var next = validate(Object.assign({}, current, changes));
  return { events: JSON.stringify(next) === JSON.stringify(current) ? [] : [
    { type: "settings.changed", payload: { settings: next } }
  ] };
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { DEFAULTS: DEFAULTS, validate: validate, project: project, decide: decide };
