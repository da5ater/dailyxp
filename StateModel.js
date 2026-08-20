// Pure crash-safe storage-envelope helpers shared by QML and Node tests.
// Event semantics remain in EventModel.js; this file only preserves its raw
// canonical journal alongside the temporary foundation probe index.

var SCHEMA_VERSION = 1;

function emptyPayload() {
  return { probeEvents: [] };
}

function copyPayload(payload) {
  var source = payload && Array.isArray(payload.probeEvents) ? payload.probeEvents : [];
  var copy = { probeEvents: source.map(function(id) { return String(id); }) };
  if (payload && Object.prototype.hasOwnProperty.call(payload, "eventJournalRaw"))
    copy.eventJournalRaw = payload.eventJournalRaw;
  return copy;
}

function checksumFor(schemaVersion, generation, payload) {
  var input = JSON.stringify({
    schemaVersion: schemaVersion,
    generation: generation,
    payload: copyPayload(payload)
  });
  var hash = 0x811c9dc5;
  for (var i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ("00000000" + hash.toString(16)).slice(-8);
}

function createEnvelope(payload, generation) {
  var safeGeneration = Number(generation);
  if (!Number.isInteger(safeGeneration) || safeGeneration < 0) safeGeneration = 0;
  var safePayload = copyPayload(payload);
  return {
    schemaVersion: SCHEMA_VERSION,
    generation: safeGeneration,
    payload: safePayload,
    checksum: checksumFor(SCHEMA_VERSION, safeGeneration, safePayload)
  };
}

function encode(envelope) {
  return JSON.stringify(envelope) + "\n";
}

function decode(raw) {
  try {
    if (typeof raw !== "string" || raw.trim() === "") return { valid: false };
    var parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return { valid: false };
    if (!Number.isInteger(parsed.generation) || parsed.generation < 0) return { valid: false };
    if (!parsed.payload || !Array.isArray(parsed.payload.probeEvents)) return { valid: false };
    if (Object.prototype.hasOwnProperty.call(parsed.payload, "eventJournalRaw") &&
        typeof parsed.payload.eventJournalRaw !== "string") return { valid: false };

    var seen = {};
    for (var i = 0; i < parsed.payload.probeEvents.length; i += 1) {
      var id = parsed.payload.probeEvents[i];
      if (typeof id !== "string" || id === "" || seen[id]) return { valid: false };
      seen[id] = true;
    }

    var expected = checksumFor(parsed.schemaVersion, parsed.generation, parsed.payload);
    if (parsed.checksum !== expected) return { valid: false };
    return { valid: true, envelope: createEnvelope(parsed.payload, parsed.generation) };
  } catch (error) {
    return { valid: false };
  }
}

function recover(primaryRaw, backupRaw) {
  return recoverDetailed(primaryRaw, backupRaw).envelope;
}

function recoverDetailed(primaryRaw, backupRaw) {
  var primary = decode(primaryRaw);
  var backup = decode(backupRaw);
  if (primary.valid && backup.valid) {
    var chosen = backup.envelope.generation > primary.envelope.generation ? backup.envelope : primary.envelope;
    return { envelope: chosen, source: chosen === primary.envelope ? "primary" : "backup", fresh: false, error: "" };
  }
  if (primary.valid) return { envelope: primary.envelope, source: "primary", fresh: false, error: "" };
  if (backup.valid) return { envelope: backup.envelope, source: "backup", fresh: false, error: "" };
  var primaryPresent = typeof primaryRaw === "string" && primaryRaw.trim() !== "";
  var backupPresent = typeof backupRaw === "string" && backupRaw.trim() !== "";
  return {
    envelope: createEnvelope(emptyPayload(), 0),
    source: "none",
    fresh: !primaryPresent && !backupPresent,
    error: primaryPresent || backupPresent
      ? "No checksum-valid DailyXP state was found; the original files were left unchanged."
      : ""
  };
}

function addProbeEvent(envelope, eventId) {
  var id = String(eventId || "");
  if (id === "" || envelope.payload.probeEvents.indexOf(id) !== -1) return envelope;
  var payload = copyPayload(envelope.payload);
  payload.probeEvents.push(id);
  return createEnvelope(payload, envelope.generation + 1);
}

function withEventJournal(envelope, eventJournalRaw) {
  var raw = String(eventJournalRaw || "");
  if (raw === "" || envelope.payload.eventJournalRaw === raw) return envelope;
  var payload = copyPayload(envelope.payload);
  payload.eventJournalRaw = raw;
  return createEnvelope(payload, envelope.generation + 1);
}

function recordProbe(envelope, eventId, eventJournalRaw) {
  var id = String(eventId || "");
  var raw = String(eventJournalRaw || "");
  if (id === "" || raw === "" || envelope.payload.probeEvents.indexOf(id) !== -1) return envelope;
  var payload = copyPayload(envelope.payload);
  payload.probeEvents.push(id);
  payload.eventJournalRaw = raw;
  return createEnvelope(payload, envelope.generation + 1);
}

function savePlan(currentEnvelope, nextEnvelope) {
  return {
    backupRaw: encode(currentEnvelope),
    primaryRaw: encode(nextEnvelope)
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    emptyPayload: emptyPayload,
    createEnvelope: createEnvelope,
    encode: encode,
    decode: decode,
    recover: recover,
    recoverDetailed: recoverDetailed,
    addProbeEvent: addProbeEvent,
    withEventJournal: withEventJournal,
    recordProbe: recordProbe,
    savePlan: savePlan
  };
}
