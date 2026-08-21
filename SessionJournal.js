// Adapter from pure Session event intents to the versioned local journal.

function appendIntents(journal, intents, context, eventModel) {
  if (!eventModel || typeof eventModel.createEvent !== "function")
    throw new Error("eventModel: compatible EventModel is required");
  var values = Array.isArray(intents) ? intents : [];
  var eventIds = context && Array.isArray(context.eventIds) ? context.eventIds : [];
  var next = journal;
  values.forEach(function(intent, index) {
    var eventId = eventIds[index] || eventModel.uuidV4();
    next = eventModel.append(next, eventModel.createEvent({
      eventId: eventId,
      deviceId: journal.deviceId,
      type: intent.type,
      occurredAtUtc: context.occurredAtUtc,
      localDateTime: context.localDateTime,
      timezone: context.timezone,
      utcOffsetMinutes: context.utcOffsetMinutes,
      systemTimezoneVerified: context.systemTimezoneVerified === true,
      dayBoundaryMinutes: context.dayBoundaryMinutes,
      occurrenceKey: intent.occurrenceKey,
      payload: intent.payload
    }));
  });
  return next;
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { appendIntents: appendIntents };
