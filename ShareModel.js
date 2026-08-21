// Share cards: preview with field removal, save/copy, no auto-post, recovery isolated.
function clone(v){ if(v===null||typeof v!=="object") return v; if(Array.isArray(v)) return v.map(clone); var c={}; Object.keys(v).forEach(k=>Object.defineProperty(c,k,{value:clone(v[k]),writable:true,enumerable:true,configurable:true})); return c; }
function freeze(v){ if(!v||typeof v!=="object"||Object.isFrozen(v)) return v; Object.keys(v).forEach(k=>freeze(v[k])); return Object.freeze(v); }
var CARD_TYPES=["session","period","skill","progression","goal","habit","recovery","fixture","season","guild"];
function createCard(type, data, options){
  if(CARD_TYPES.indexOf(type)===-1) throw new Error("cardType: is invalid");
  var fields=clone(data||{});
  var opts=options||{};
  // preview: remove every field if requested
  var previewFields=clone(fields);
  if(opts.removeFields) opts.removeFields.forEach(function(f){ delete previewFields[f]; });
  // recovery isolated: ordinary cards never include recovery unless type is recovery and explicitly consented
  if(type!=="recovery" && previewFields.recovery) delete previewFields.recovery;
  if(type==="recovery" && !opts.recoveryConsented) throw new Error("recoveryConsented: is required for recovery cards");
  // sample mode fictional isolated
  var card={ id: opts.cardId||"card:"+Date.now(), type: type, fields: freeze(previewFields), branding: "DailyXP", sample: !!opts.sampleMode, sampleLabel: opts.sampleMode ? "Sample – fictional data" : null };
  if(opts.sampleMode) card.isolated=true;
  return freeze(card);
}
function exportCard(card, action){
  // action: save, copy, preparePost (x, linkedin, facebook)
  if(!card) throw new Error("card: is required");
  if(["save","copy","preparePost"].indexOf(action)===-1) throw new Error("action: is invalid");
  // never auto-post
  return freeze({ cardId: card.id, action: action, previewedFields: Object.keys(card.fields), preparedUrl: action==="preparePost" ? "https://example.com/post?card="+encodeURIComponent(card.id) : null });
}
if(typeof module!=="undefined"&&module.exports) module.exports={ CARD_TYPES, createCard, exportCard };
