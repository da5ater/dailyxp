// Pure state-envelope helpers shared by QML and the Node fault tests.
// Product events and projections intentionally belong to MODEL-001.

var SCHEMA_VERSION = 1;

function emptyPayload() {
  return { probeEvents: [] };
}

function copyPayload(payload) {
  var source = payload && Array.isArray(payload.probeEvents) ? payload.probeEvents : [];
  return { probeEvents: source.map(function(id) { return String(id); }) };
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
  var primary = decode(primaryRaw);
  var backup = decode(backupRaw);
  if (primary.valid && backup.valid)
    return backup.envelope.generation > primary.envelope.generation ? backup.envelope : primary.envelope;
  if (primary.valid) return primary.envelope;
  if (backup.valid) return backup.envelope;
  return createEnvelope(emptyPayload(), 0);
}

function addProbeEvent(envelope, eventId) {
  var id = String(eventId || "");
  if (id === "" || envelope.payload.probeEvents.indexOf(id) !== -1) return envelope;
  var payload = copyPayload(envelope.payload);
  payload.probeEvents.push(id);
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
    addProbeEvent: addProbeEvent,
    savePlan: savePlan
  };
}
