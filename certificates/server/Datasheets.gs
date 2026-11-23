/**
 * Akhnaton Certificates – online datasheet lookup (Google Apps Script)
 *
 * The certificates app asks this script for the datasheet of an instrument (maker + model).
 * The script asks Gemini with Google Search (a real web search), keeps the answer in a Google Sheet,
 * and gives it back. Each model is searched once; after that everybody gets it from the sheet.
 *
 * One-time setup (about 10 minutes, on the laptop):
 *  1. https://aistudio.google.com/apikey  →  "Create API key"  →  copy it.
 *  2. https://script.google.com  →  New project  →  paste this whole file instead of the empty code.
 *  3. Project Settings (gear on the left)  →  Script Properties  →  Add:
 *        GEMINI_KEY = the key from step 1
 *        APP_KEY    = any word you choose (the app sends it, so strangers cannot use your quota)
 *  4. Run the function "setup" once (top bar: choose setup → Run) and allow the permissions.
 *     It creates the sheet "Akhnaton – Datasheets" in your Google Drive.
 *  5. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 *     Copy the Web app URL and send it (with the APP_KEY word) to Claude – it goes into the app's config.js.
 *
 * Free tier (Google, Nov 2026): Gemini 2.5 Flash with Google Search – 500 searches a day, free.
 */
var MODEL = 'gemini-3.8-flash';

function setup() {
  var pr = PropertiesService.getScriptProperties();
  if (!pr.getProperty('SHEET_ID')) {
    var ss = SpreadsheetApp.create('Akhnaton – Datasheets');
    ss.getSheets()[0].setName('Datasheets').appendRow(['key', 'maker', 'model', 'product', 'description', 'rMin', 'rMax', 'unit', 'resolution', 'accuracy', 'note', 'sources', 'found', 'date', 'by']);
    pr.setProperty('SHEET_ID', ss.getId());
  }
  if (!pr.getProperty('GEMINI_KEY')) throw new Error('Add GEMINI_KEY in Project Settings → Script Properties first');
  return 'OK – sheet ' + pr.getProperty('SHEET_ID');
}

function doGet() { return json_({ ok: true, data: { app: 'Akhnaton datasheets', time: new Date().toISOString() } }); }

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}'), pr = PropertiesService.getScriptProperties();
    if ((pr.getProperty('APP_KEY') || '') !== String(req.key || '')) throw new Error('Wrong app key');
    if (req.action === 'list') return json_({ ok: true, data: list_() });
    if (req.action === 'company') return json_({ ok: true, data: company_(req.id, req.name, req.official, !!req.fresh) });
    if (req.action === 'companies') return json_({ ok: true, data: companies_() });
    if (req.action === 'save') return json_({ ok: true, data: save_(req.entry || {}, req.by || 'claude') });
    if (req.action === 'datasheet') return json_({ ok: true, data: lookup_(req.maker, req.model, req.description, !!req.fresh) });
    if (req.action === 'photo') return json_({ ok: true, data: photo_(req) });
    if (req.action === 'listphoto') return json_({ ok: true, data: listPhoto_(req) });
    if (req.action === 'fieldsheet') return json_({ ok: true, data: fieldSheet_(req) });
    throw new Error('Unknown action');
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function key_(maker, model) { return (String(maker || '') + '|' + String(model || '')).toLowerCase().replace(/[\s\-_.]+/g, ''); }
function sheet_() { var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID'); if (!id) throw new Error('Run setup first'); return SpreadsheetApp.openById(id).getSheetByName('Datasheets'); }
function rowObj_(r) { return { key: r[0], maker: r[1], model: r[2], product: r[3], description: r[4], rMin: r[5], rMax: r[6], unit: r[7], resolution: r[8], accuracy: r[9], note: r[10], sources: String(r[11] || '').split(' ').filter(String), found: r[12] === true || r[12] === 'TRUE', date: r[13], by: r[14] || 'web' }; }
function list_() { var v = sheet_().getDataRange().getValues(); return v.slice(1).map(rowObj_); }

function lookup_(maker, model, desc, fresh) {
  if (!model) throw new Error('No model');
  var sh = sheet_(), k = key_(maker, model), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === k && !fresh) return rowObj_(v[i]);
  var gk = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); if (!gk) throw new Error('GEMINI_KEY is missing in Script Properties');
  var prompt = 'Search the web for the manufacturer datasheet / user manual of this measuring instrument and read its specifications.\n' +
    'Manufacturer: ' + (maker || '?') + '\nModel: ' + model + '\nWhat it is (may be rough): ' + (desc || '?') + '\n' +
    'Answer with ONLY one JSON object, no other text: {"found": true|false, "maker": "manufacturer name as the maker writes it", "model": "model exactly as the maker writes it", "product": "short product name", "description": "short English description of the instrument", ' +
    '"rMin": number or "", "rMax": number or "", "unit": "unit of the main measuring range, e.g. °C, %RH, bar, Pa, g, rpm, m/s", "resolution": number or "", "accuracy": "as in the datasheet", "note": "one short line, e.g. other ranges/versions exist"}. ' +
    'If the instrument measures two things (e.g. temperature and humidity), give temperature in rMin/rMax/unit/resolution and the other one in note. If you cannot find the real datasheet, set found=false and leave the numbers empty – never guess.';
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': gk },
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] })
  });
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var j = JSON.parse(res.getContentText()), c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');
  var m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('No answer from the search');
  var o = JSON.parse(m[0]), src = (((c.groundingMetadata || {}).groundingChunks) || []).map(function (g) { return g.web && g.web.uri; }).filter(String).slice(0, 4);
  var row = [k, o.maker || maker || '', o.model || model, o.product || '', o.description || '', o.rMin === undefined ? '' : o.rMin, o.rMax === undefined ? '' : o.rMax, o.unit || '', o.resolution === undefined ? '' : o.resolution, o.accuracy || '', o.note || '', src.join(' '), !!o.found, new Date(), 'web'];
  var at = -1; for (var r = 1; r < v.length; r++) if (v[r][0] === k) { at = r + 1; break; }
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return rowObj_(row);
}

/* what Bishoy confirms through Claude (once a month) is kept too – it never overwrites a datasheet found online */
function save_(e, by) {
  if (!e.model) throw new Error('No model');
  var sh = sheet_(), k = key_(e.maker, e.model), v = sh.getDataRange().getValues();
  var row = [k, e.maker || '', e.model, e.product || '', e.description || '', e.rMin === undefined ? '' : e.rMin, e.rMax === undefined ? '' : e.rMax, e.unit || '', e.resolution === undefined ? '' : e.resolution, e.accuracy || '', e.note || '', '', true, new Date(), by];
  for (var i = 1; i < v.length; i++) if (v[i][0] === k) { if (v[i][14] === 'web' && v[i][12] === true) return rowObj_(v[i]); sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return rowObj_(row); }
  sh.appendRow(row); return rowObj_(row);
}

/* companies: legal name, address (factory first) and phone, from a web search – kept in the tab "Companies" */
function coSheet_() { var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')), sh = ss.getSheetByName('Companies');
  if (!sh) { sh = ss.insertSheet('Companies'); sh.appendRow(['id', 'name', 'en', 'ar', 'addr', 'tel', 'site', 'sources', 'found', 'date']); } return sh; }
function coRow_(r) { return { id: r[0], name: r[1], en: r[2], ar: r[3], addr: r[4], tel: r[5], site: r[6], sources: String(r[7] || '').split(' ').filter(String), found: r[8] === true || r[8] === 'TRUE', date: r[9] }; }
function companies_() { return coSheet_().getDataRange().getValues().slice(1).map(coRow_); }
function company_(id, name, official, fresh) {
  if (!id || !name) throw new Error('No company');
  var sh = coSheet_(), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === id && !fresh) return coRow_(v[i]);
  var gk = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  var prompt = 'Find the contact details of this Egyptian company (a customer of a calibration laboratory): "' + name + '"' + (official ? ' (also written: "' + official + '")' : '') + '.\n' +
    'Search Google, Google Maps, the company website, LinkedIn, Egyptian Drug Authority lists, Yellow Pages Egypt, Kompass, Zawya and other business directories. The name may be in Arabic or English.\n' +
    'Answer with ONLY one JSON object: {"found": true|false, "en": "full name in English as the company writes it (S.A.E. etc. if used)", "ar": "name in Arabic if seen", "addr": "address of its factory / plant in Egypt (else its office), written professionally in English", "site": "factory" or "head office" or "listing", "tel": "main phone in international format, e.g. +20 2 1234 5678"}.\n' +
    'found = true when you found a real address or phone for THIS company from any source above (a Google Maps or directory listing is enough). Only when nothing is found for this company: found=false and empty fields. Never invent numbers.';
  var call = function () { return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': gk }, payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }) }); };
  var res = call(); for (var t = 0; t < 3 && (res.getResponseCode() === 429 || res.getResponseCode() >= 500); t++) { Utilities.sleep(8000 * (t + 1)); res = call(); }
  if (!gk) throw new Error('GEMINI_KEY is missing in the script properties');
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var j = JSON.parse(res.getContentText()), c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (p) { return p.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('No answer from the search');
  var o = JSON.parse(m[0]), src = (((c.groundingMetadata || {}).groundingChunks) || []).map(function (g) { return g.web && g.web.uri; }).filter(String).slice(0, 4);
  var row = [id, name, o.en || '', o.ar || '', o.addr || '', o.tel || '', o.site || '', src.join(' '), !!o.found, new Date()];
  var at = -1; for (var r = 1; r < v.length; r++) if (v[r][0] === id) { at = r + 1; break; }
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return coRow_(row);
}

/* photos of a customer's instrument (nameplate + display): kept in the Drive folder "Akhnaton – Device photos",
   read by Gemini (the photos themselves are kept by the jobs server), so everybody on the team gets the same photos and the same reading – no Claude needed */
/* a photo / scan of a customer's calibration list (the table they give us) – every row with its codes, read by Gemini (22 Nov 2026) */
function listPhoto_(req) {
  var imgs = (req.images || []).slice(0, 6); if (!imgs.length) throw new Error('No photos');
  var gk = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); if (!gk) throw new Error('GEMINI_KEY is missing in Script Properties');
  var prompt = 'These photo(s) show a list of instruments a customer sends to a calibration laboratory (a table: No., instrument name, instrument code, item code, serial, required points, acceptance criteria…).\n' +
    'Read EVERY row exactly as written. Answer with ONLY one JSON object, no other text:\n' +
    '{"rows": [{"no": "", "name": "instrument name with model", "instCode": "instrument / machine code", "itemCode": "item code (e.g. QC11-015/TS.01) – empty if the table has none", "serial": "", "points": "required points with unit", "criteria": "acceptance criteria"}]}\n' +
    'Rules: one entry for every item-code line (an instrument with 2 item codes gives 2 entries with the same instCode and name). Copy codes character by character: 1 is a digit, not the letter I; 0 is a digit, not O. Never invent rows.';
  var parts = [{ text: prompt }].concat(imgs.map(function (b) { return { inline_data: { mime_type: 'image/jpeg', data: b } }; }));
  /* v9: reading a list needs no long thinking – thinking set to low (a 4-row photo took 6 minutes and timed out with the default); a model that refuses the setting is asked again without it; no new model is tried after 150 s */
  var MODELS = [MODEL, 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'], mi = 0, think = true, t0 = Date.now(); var call = function () { var gc = { responseMimeType: 'application/json', maxOutputTokens: 12000 }; if (think) gc.thinkingConfig = { thinkingLevel: 'low' }; return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[mi] + ':generateContent', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': gk }, payload: JSON.stringify({ contents: [{ parts: parts }], generationConfig: gc }) }); }; /* no temperature 0 – Gemini 3 can loop with it (a list took 5+ minutes) */
  var res = call(); if (res.getResponseCode() === 400 && /thinking/i.test(res.getContentText())) { think = false; res = call(); }
  while ((res.getResponseCode() === 429 || res.getResponseCode() === 404 || res.getResponseCode() >= 500) && mi < MODELS.length - 1 && Date.now() - t0 < 150000) { mi++; res = call(); if (res.getResponseCode() === 400 && /thinking/i.test(res.getContentText())) { think = false; res = call(); } } /* a busy model (503) → the next one, no waiting */
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160));
  var j = JSON.parse(res.getContentText()), c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (q) { return q.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/);
  var o = {}; try { o = m ? JSON.parse(m[0]) : {}; } catch (x) { o = {}; }
  return { rows: o.rows || [] };
}
/* v9: one or two pages of our own handwritten CALIBRATION DATA REPORT (the field sheet) → the items with their readings (Bishoy, 23 Nov 2026) */
function gem_(parts, maxTok) { var gk = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); if (!gk) throw new Error('GEMINI_KEY is missing in Script Properties');
  var MODELS = [MODEL, 'gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'], mi = 0, think = true, t0 = Date.now();
  var call = function () { var gc = { responseMimeType: 'application/json', maxOutputTokens: maxTok || 8000 }; if (think) gc.thinkingConfig = { thinkingLevel: 'low' }; return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[mi] + ':generateContent', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': gk }, payload: JSON.stringify({ contents: [{ parts: parts }], generationConfig: gc }) }); };
  var res = call(); if (res.getResponseCode() === 400 && /thinking/i.test(res.getContentText())) { think = false; res = call(); }
  while ((res.getResponseCode() === 429 || res.getResponseCode() === 404 || res.getResponseCode() >= 500) && mi < MODELS.length - 1 && Date.now() - t0 < 150000) { mi++; res = call(); if (res.getResponseCode() === 400 && /thinking/i.test(res.getContentText())) { think = false; res = call(); } }
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160));
  var j = JSON.parse(res.getContentText()), c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (q) { return q.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : {}; } catch (x) { return {}; } }
function fieldSheet_(req) {
  var imgs = (req.images || []).slice(0, 3); if (!imgs.length) throw new Error('No pages');
  var prompt = 'Each photo is a page of a calibration laboratory\'s own field form "CALIBRATION DATA REPORT", filled in BY HAND. A page can hold one or two forms.\n' +
    'For every form that has something written in it, read the handwriting carefully. Answer with ONLY one JSON object, no other text:\n' +
    '{"form": true, "items": [{"code": "the Code written in ITEM TO BE CALIBRATED (else the UUT Code)", "description": "", "manufacturer": "", "model": "", "serial": "", "location": "", "range": "as written, e.g. 0 -> 28 or (0-10) bar", "resolution": "", "unit": "unit written anywhere on the form (bar, °C, mS/cm, m3/h, mV, %…)", "rows": [{"ref": "number in the Nominal (Reference Value) column", "uut": "number in the U.U.T. Results column"}], "notes": "anything else written (e.g. 6 bar, OK, accepted, New)", "unsure": "the fields or numbers you could not read for sure"}]}\n' +
    'Rules: if the page is not this form, answer {"form": false, "items": []}. Copy numbers digit by digit with their decimal point; never invent a value – leave it empty. A crossed-out value is not taken; the value written next to it is. Keep the rows in the order written.';
  var parts = [{ text: prompt }].concat(imgs.map(function (b) { return { inline_data: { mime_type: 'image/jpeg', data: b } }; }));
  var o = gem_(parts, 8000); return { form: o.form !== false, items: o.items || [] };
}
function photo_(req) {
  var imgs = (req.images || []).slice(0, 8); if (!imgs.length) throw new Error('No photos');
  var ids = []; /* the photos themselves are kept by the jobs server (it already has Drive) */
  var gk = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); if (!gk) throw new Error('GEMINI_KEY is missing in Script Properties');
  var prompt = 'These ' + imgs.length + ' photo(s) show ONE measuring instrument at a customer of a calibration laboratory – usually its nameplate / label / asset sticker and its display while it is switched on.\n' +
    'Read ONLY what is really visible. Answer with ONLY one JSON object, no other text:\n' +
    '{"maker": "", "model": "", "serial": "", "code": "customer asset / tag code if a sticker shows one", "description": "short English name, e.g. Temperature & Humidity Indicator, Pressure Gauge, Digital Timer", ' +
    '"items": [{"quantity": "Temperature", "unit": "°C", "resolution": "0.1", "shown": "23.4 – exactly as on the display", "rMin": "", "rMax": ""}], "notes": "one short line: anything unclear"}\n' +
    'Rules: one entry in items for every quantity the display shows (temperature, humidity, pressure, time…). resolution = the smallest step of the digits shown (23.45 → 0.01, 23.4 → 0.1, 23 → 1); for a dial gauge use the smallest scale division if readable. ' +
    'rMin / rMax only when the range is printed on the instrument or the dial. Units exactly: °C, %RH, bar, mbar, Pa, kPa, psi, g, kg, rpm, min, s, m/s, L/min, µS/cm, pH, lux. Never guess or invent – leave a field empty when it is not visible.';
  var parts = [{ text: prompt }].concat(imgs.map(function (b) { return { inline_data: { mime_type: 'image/jpeg', data: b } }; }));
  var call = function () { return UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': gk }, payload: JSON.stringify({ contents: [{ parts: parts }] }) }); };
  var res = call(); for (var t = 0; t < 3 && (res.getResponseCode() === 429 || res.getResponseCode() >= 500); t++) { Utilities.sleep(6000 * (t + 1)); res = call(); }
  if (res.getResponseCode() !== 200) return { ids: ids, error: 'Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 160) };
  var j = JSON.parse(res.getContentText()), c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (q) { return q.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/);
  var o = {}; try { o = m ? JSON.parse(m[0]) : {}; } catch (x) { o = {}; }
  return { ids: ids, read: o };
}

function testListPhoto() { var t0 = Date.now(); var b = UrlFetchApp.fetch('https://bishoyloza-sketch.github.io/certificates/tmpt/lp.jpg').getBlob(); var r = listPhoto_({ images: [Utilities.base64Encode(b.getBytes())] }); Logger.log(((Date.now() - t0) / 1000) + ' s, rows ' + r.rows.length + ': ' + r.rows.map(function (x) { return x.itemCode || x.instCode; }).join(' ')); }
function testModels() { var gk = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); var r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': gk }, muteHttpExceptions: true }); var j = JSON.parse(r.getContentText()); Logger.log((j.models || []).map(function (m) { return m.name.replace('models/', ''); }).filter(function (n) { return /flash|pro/.test(n); }).join(', ')); }
