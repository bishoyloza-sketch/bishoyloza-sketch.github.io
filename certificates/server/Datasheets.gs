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
var MODEL = 'gemini-2.5-flash';

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
  var prompt = 'Search the web for this Egyptian company (a customer of a calibration laboratory): "' + name + '"' + (official ? ' (registered name: "' + official + '")' : '') + '.\n' +
    'Answer with ONLY one JSON object: {"found": true|false, "en": "full legal name in English as the company writes it (with S.A.E. etc. if used)", "ar": "legal name in Arabic if found", "addr": "address of its factory / plant in Egypt (if no factory, the head office), written professionally in English", "site": "factory" or "head office", "tel": "main phone in international format, e.g. +20 2 1234 5678"}. Use official sources (company website, Egyptian Drug Authority, stock exchange, government registers) first. If not sure, found=false and leave fields empty – never guess.';
  var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': gk }, payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }) });
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  var j = JSON.parse(res.getContentText()), c = (j.candidates || [])[0] || {}, txt = ((c.content || {}).parts || []).map(function (p) { return p.text || ''; }).join(''), m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('No answer from the search');
  var o = JSON.parse(m[0]), src = (((c.groundingMetadata || {}).groundingChunks) || []).map(function (g) { return g.web && g.web.uri; }).filter(String).slice(0, 4);
  var row = [id, name, o.en || '', o.ar || '', o.addr || '', o.tel || '', o.site || '', src.join(' '), !!o.found, new Date()];
  var at = -1; for (var r = 1; r < v.length; r++) if (v[r][0] === id) { at = r + 1; break; }
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return coRow_(row);
}
