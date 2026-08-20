// DailyXP's feature-neutral, offline event journal.
// Keep this file Qt-free so the same contract runs in QML, Node, Rails fixtures,
// and a future non-Omarchy client.

var JOURNAL_SCHEMA_VERSION = 1;
var EVENT_SCHEMA_VERSION = 1;
var UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
var EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_.-]*$/;
var IANA_TIMEZONE_PATTERN = /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+$/;

function fail(field, reason) {
  throw new Error(field + ": " + reason);
}

function isUuidV4(value) {
  return UUID_V4_PATTERN.test(String(value || ""));
}

function uuidV4(random) {
  var source = typeof random === "function" ? random : Math.random;
  var bytes = [];
  for (var i = 0; i < 16; i += 1) {
    var sample = Number(source());
    if (!isFinite(sample) || sample < 0 || sample >= 1) fail("random", "must return values from 0 up to but not including 1");
    bytes.push(Math.floor(sample * 256));
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var hex = bytes.map(function(byte) { return ("0" + byte.toString(16)).slice(-2); }).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" + hex.slice(20);
}

function validUtcInstant(value) {
  if (typeof value !== "string" || !/Z$/.test(value)) return false;
  var parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function zoneContext(occurredAtUtc, timezone) {
  if (!validUtcInstant(occurredAtUtc)) fail("occurredAtUtc", "must be a canonical UTC instant with milliseconds");
  var zone = String(timezone || "");
  if (!IANA_TIMEZONE_PATTERN.test(zone)) fail("timezone", "must be an IANA timezone name such as Africa/Cairo");
  var formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    });
  } catch (error) {
    fail("timezone", "is not available in the runtime timezone database");
  }
  var values = {};
  formatter.formatToParts(new Date(occurredAtUtc)).forEach(function(part) {
    if (part.type !== "literal") values[part.type] = part.value;
  });
  var milliseconds = occurredAtUtc.slice(20, 23);
  var localDateTime = values.year + "-" + values.month + "-" + values.day + "T" +
    values.hour + ":" + values.minute + ":" + values.second + "." + milliseconds;
  var parts = localParts(localDateTime);
  var localMillis = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], parts[6]);
  var utcOffsetMinutes = (localMillis - new Date(occurredAtUtc).getTime()) / 60000;
  if (!Number.isInteger(utcOffsetMinutes)) fail("timezone", "resolved to a non-minute UTC offset");
  return { timezone: zone, localDateTime: localDateTime, utcOffsetMinutes: utcOffsetMinutes };
}

function systemTimezone() {
  var zone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  if (!IANA_TIMEZONE_PATTERN.test(zone)) return "Etc/UTC";
  return zone;
}

function localParts(value) {
  var match = LOCAL_DATE_TIME_PATTERN.exec(String(value || ""));
  if (!match) fail("localDateTime", "must be YYYY-MM-DDTHH:mm:ss.sss without an offset");
  var parts = match.slice(1).map(Number);
  var instant = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], parts[6]));
  if (instant.getUTCFullYear() !== parts[0] || instant.getUTCMonth() !== parts[1] - 1 ||
      instant.getUTCDate() !== parts[2] || instant.getUTCHours() !== parts[3] ||
      instant.getUTCMinutes() !== parts[4] || instant.getUTCSeconds() !== parts[5] ||
      instant.getUTCMilliseconds() !== parts[6])
    fail("localDateTime", "contains an invalid calendar value");
  return parts;
}

function formatDate(year, month, day) {
  return String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function dailyXpDate(localDateTime, dayBoundaryMinutes) {
  var boundary = Number(dayBoundaryMinutes);
  if (!Number.isInteger(boundary) || boundary < 0 || boundary > 1439)
    fail("dayBoundaryMinutes", "must be an integer from 0 through 1439");
  var parts = localParts(localDateTime);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (parts[3] * 60 + parts[4] < boundary) date.setUTCDate(date.getUTCDate() - 1);
  return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function isJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  var prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.keys(value).every(function(key) { return isJsonValue(value[key]); });
}

function cloneJson(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneJson);
  var copy = {};
  Object.keys(value).forEach(function(key) { copy[key] = cloneJson(value[key]); });
  return copy;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function createEvent(input) {
  var source = input || {};
  var eventId = source.eventId || uuidV4();
  var resolved = zoneContext(source.occurredAtUtc, source.timezone);
  var suppliedLocalDateTime = source.localDateTime === undefined ? resolved.localDateTime : source.localDateTime;
  var suppliedOffset = source.utcOffsetMinutes === undefined ? resolved.utcOffsetMinutes : source.utcOffsetMinutes;
  var frozenOccurrenceKey = source.occurrenceKey === undefined || source.occurrenceKey === null
    ? null : String(source.occurrenceKey);
  var candidate = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    eventId: String(eventId),
    deviceId: String(source.deviceId || ""),
    type: String(source.type || ""),
    occurredAtUtc: source.occurredAtUtc,
    localDateTime: suppliedLocalDateTime,
    dailyXpDate: dailyXpDate(suppliedLocalDateTime, source.dayBoundaryMinutes),
    occurrenceKey: frozenOccurrenceKey,
    context: {
      timezone: source.timezone,
      utcOffsetMinutes: suppliedOffset,
      dayBoundaryMinutes: source.dayBoundaryMinutes
    },
    payload: cloneJson(source.payload)
  };
  validateEvent(candidate);
  if (candidate.localDateTime !== resolved.localDateTime || candidate.context.utcOffsetMinutes !== resolved.utcOffsetMinutes)
    fail("event.context.timezone", "does not match the timezone rules at occurredAtUtc");
  return deepFreeze(candidate);
}

function validateEvent(value) {
  if (!value || value.schemaVersion !== EVENT_SCHEMA_VERSION) fail("event.schemaVersion", "unsupported version");
  if (!isUuidV4(value.eventId)) fail("event.eventId", "must be an RFC 4122 version-4 UUID");
  if (!isUuidV4(value.deviceId)) fail("event.deviceId", "must be an RFC 4122 version-4 UUID");
  if (!EVENT_TYPE_PATTERN.test(String(value.type || ""))) fail("event.type", "is invalid");
  if (!validUtcInstant(value.occurredAtUtc)) fail("event.occurredAtUtc", "is invalid");
  var parts = localParts(value.localDateTime);
  if (!DATE_PATTERN.test(String(value.dailyXpDate || ""))) fail("event.dailyXpDate", "is invalid");
  if (value.occurrenceKey !== null && (typeof value.occurrenceKey !== "string" || value.occurrenceKey === ""))
    fail("event.occurrenceKey", "must be null or a nonempty string");
  if (!value.context || !IANA_TIMEZONE_PATTERN.test(String(value.context.timezone || "")))
    fail("event.context.timezone", "must be an IANA timezone name such as Africa/Cairo");
  if (!Number.isInteger(value.context.utcOffsetMinutes) || value.context.utcOffsetMinutes < -840 || value.context.utcOffsetMinutes > 840)
    fail("event.context.utcOffsetMinutes", "is invalid");
  if (!Number.isInteger(value.context.dayBoundaryMinutes) || value.context.dayBoundaryMinutes < 0 || value.context.dayBoundaryMinutes > 1439)
    fail("event.context.dayBoundaryMinutes", "is invalid");
  if (dailyXpDate(value.localDateTime, value.context.dayBoundaryMinutes) !== value.dailyXpDate)
    fail("event.dailyXpDate", "does not match the recorded local context");
  var localMillis = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], parts[6]);
  var contextualMillis = new Date(value.occurredAtUtc).getTime() + value.context.utcOffsetMinutes * 60000;
  if (localMillis !== contextualMillis)
    fail("event.context", "UTC instant, localDateTime, and utcOffsetMinutes contradict each other");
  if (!isJsonValue(value.payload)) fail("event.payload", "must contain JSON values only");
  return true;
}

function createJournal(deviceId) {
  if (!isUuidV4(deviceId)) fail("deviceId", "must be an RFC 4122 version-4 UUID");
  return deepFreeze({ schemaVersion: JOURNAL_SCHEMA_VERSION, deviceId: String(deviceId), events: [] });
}

function validateJournalShape(journal) {
  if (!journal || journal.schemaVersion !== JOURNAL_SCHEMA_VERSION) fail("journal.schemaVersion", "unsupported version");
  if (!isUuidV4(journal.deviceId)) fail("journal.deviceId", "must be an RFC 4122 version-4 UUID");
  if (!Array.isArray(journal.events)) fail("journal.events", "must be an array");
  journal.events.forEach(validateEvent);
  return true;
}

function append(journal, value) {
  validateJournalShape(journal);
  validateEvent(value);
  for (var i = 0; i < journal.events.length; i += 1)
    if (journal.events[i].eventId === value.eventId) return journal;
  var nextEvents = journal.events.map(cloneJson);
  nextEvents.push(cloneJson(value));
  return deepFreeze({ schemaVersion: JOURNAL_SCHEMA_VERSION, deviceId: journal.deviceId, events: nextEvents });
}

function normalizeJournal(value) {
  validateJournalShape(value);
  var seen = Object.create(null);
  var events = [];
  for (var i = 0; i < value.events.length; i += 1) {
    var eventId = value.events[i].eventId;
    if (seen[eventId]) continue;
    seen[eventId] = true;
    events.push(cloneJson(value.events[i]));
  }
  return deepFreeze({ schemaVersion: JOURNAL_SCHEMA_VERSION, deviceId: value.deviceId, events: events });
}

function rebuildProjection(journal) {
  validateJournalShape(journal);
  var seen = Object.create(null);
  var appliedEventIds = [];
  var countsByType = {};
  var countsByDailyXpDate = {};
  var occurrenceSeen = Object.create(null);
  var uniqueOccurrenceKeys = [];
  var lastEventAtUtc = null;
  for (var i = 0; i < journal.events.length; i += 1) {
    var value = journal.events[i];
    if (seen[value.eventId]) continue;
    seen[value.eventId] = true;
    appliedEventIds.push(value.eventId);
    var typeCount = Object.prototype.hasOwnProperty.call(countsByType, value.type) ? countsByType[value.type] : 0;
    Object.defineProperty(countsByType, value.type, {
      value: typeCount + 1, writable: true, enumerable: true, configurable: true
    });
    var dayCount = Object.prototype.hasOwnProperty.call(countsByDailyXpDate, value.dailyXpDate)
      ? countsByDailyXpDate[value.dailyXpDate] : 0;
    Object.defineProperty(countsByDailyXpDate, value.dailyXpDate, {
      value: dayCount + 1, writable: true, enumerable: true, configurable: true
    });
    if (value.occurrenceKey !== null && !occurrenceSeen[value.occurrenceKey]) {
      occurrenceSeen[value.occurrenceKey] = true;
      uniqueOccurrenceKeys.push(value.occurrenceKey);
    }
    lastEventAtUtc = value.occurredAtUtc;
  }
  return deepFreeze({
    schemaVersion: 1,
    eventCount: appliedEventIds.length,
    appliedEventIds: appliedEventIds,
    countsByType: countsByType,
    countsByDailyXpDate: countsByDailyXpDate,
    uniqueOccurrenceKeys: uniqueOccurrenceKeys,
    lastEventAtUtc: lastEventAtUtc
  });
}

function occurrenceKey(routineId, frozenDailyXpDate) {
  var id = String(routineId || "");
  var date = String(frozenDailyXpDate || "");
  if (id === "") fail("routineId", "is required");
  if (!DATE_PATTERN.test(date)) fail("dailyXpDate", "must be YYYY-MM-DD");
  return "routine:" + encodeURIComponent(id) + ":day:" + date;
}

function canonicalStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ":" + canonicalStringify(value[key]);
  }).join(",") + "}";
}

function exportJournal(journal) {
  return canonicalStringify(normalizeJournal(journal)) + "\n";
}

function loadFailure(code, message, raw) {
  return { ok: false, code: code, message: message, recoverable: true, originalRaw: raw };
}

function loadJournal(raw) {
  var original = typeof raw === "string" ? raw : String(raw || "");
  var parsed;
  try {
    parsed = JSON.parse(original);
  } catch (error) {
    return loadFailure("malformed_json", "State is not valid JSON; keep the original as a backup.", original);
  }

  try {
    if (parsed && parsed.schemaVersion === JOURNAL_SCHEMA_VERSION) {
      return { ok: true, migrated: false, backupRaw: "", journal: normalizeJournal(parsed) };
    }
    if (parsed && parsed.version === 0) {
      var migrated = normalizeJournal({
        schemaVersion: JOURNAL_SCHEMA_VERSION,
        deviceId: parsed.deviceId,
        events: parsed.events
      });
      return { ok: true, migrated: true, backupRaw: original, journal: migrated };
    }
    return loadFailure("unsupported_version", "State version is unsupported; keep the original as a backup.", original);
  } catch (error) {
    return loadFailure("invalid_state", "State is not valid for this version; keep the original as a backup. " + error.message, original);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    JOURNAL_SCHEMA_VERSION: JOURNAL_SCHEMA_VERSION,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    isUuidV4: isUuidV4,
    uuidV4: uuidV4,
    zoneContext: zoneContext,
    systemTimezone: systemTimezone,
    dailyXpDate: dailyXpDate,
    createEvent: createEvent,
    validateEvent: validateEvent,
    createJournal: createJournal,
    append: append,
    rebuildProjection: rebuildProjection,
    occurrenceKey: occurrenceKey,
    exportJournal: exportJournal,
    loadJournal: loadJournal
  };
}
