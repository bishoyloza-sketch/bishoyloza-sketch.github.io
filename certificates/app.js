/* Akhnaton Certificates – app (same look, people, PINs and company list as Akhnaton Devices) */
(function () {
'use strict';
var CFG = window.APP_CONFIG || {};

/* ================= helpers ================= */
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
var norm = function (s) { return String(s || '').toLowerCase().replace(/[\s\-_.\/()&]/g, ''); };
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('akhc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('akhc.' + k, JSON.stringify(v)); } catch (e) { toast('Phone storage is full', true); } },
  del: function (k) { try { localStorage.removeItem('akhc.' + k); } catch (e) {} }
};
/* photos go to IndexedDB (too big for localStorage) */
var MEMIMG = {};
var IDB = {
  db: null,
  open: function () { var self = this; if (self.db) return Promise.resolve(self.db);
    return new Promise(function (res, rej) { var r = indexedDB.open('akhc', 1); r.onupgradeneeded = function () { r.result.createObjectStore('img'); }; r.onsuccess = function () { self.db = r.result; res(self.db); }; r.onerror = function () { rej(r.error); }; }); },
  put: function (k, v) { MEMIMG[k] = v; return this.open().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction('img', 'readwrite'); t.objectStore('img').put(v, k); t.oncomplete = res; t.onerror = function () { res(); }; }); }).catch(function () {}); },
  get: function (k) { if (MEMIMG[k]) return Promise.resolve(MEMIMG[k]); return this.open().then(function (db) { return new Promise(function (res) { var q = db.transaction('img').objectStore('img').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
};
function toast(t, bad) { var e = $('#toast'); e.textContent = t; e.className = (bad ? 'bad ' : '') + 'on'; clearTimeout(e._t); e._t = setTimeout(function () { e.className = ''; }, 3600); }
function dialog(title, msg, yes, no) { return new Promise(function (r) {
  $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>' + esc(title) + '</h3><p>' + msg + '</p><div class="cf"><button class="btn ghost" id="dN">' + esc(no || 'Cancel') + '</button><button class="btn" id="dY">' + esc(yes || 'Yes') + '</button></div></div></div>';
  var done = function (v) { $('#dlg-root').innerHTML = ''; r(v); }; $('#dY').onclick = function () { done(true); }; $('#dN').onclick = function () { done(false); }; }); }
function pickFiles(accept, multi) { return new Promise(function (r) { var f = $('#fileIn'); f.accept = accept; f.multiple = !!multi; f.value = ''; f.onchange = function () { r(Array.prototype.slice.call(f.files)); }; f.click(); }); }
function shrink(file, max, q) { return new Promise(function (res) { var img = new Image(), url = URL.createObjectURL(file);
  img.onload = function () { var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q || 0.8)); };
  img.onerror = function () { res(null); }; img.src = url; }); }
function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); }
function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return String(iso); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }

var I = {
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  cam: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  xls: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/></svg>',
  unit: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-3M12 5V3"/></svg>',
  mach: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M15 9h3M15 12h3M15 15h3"/></svg>',
  doc: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/></svg>',
  po: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  offer: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  ok: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
  visit: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  ms: '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#F25022" d="M2 2h9.5v9.5H2z"/><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00A4EF" d="M2 12.5h9.5V22H2z"/><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z"/></svg>'
};


/* tiny .xlsx reader (no library needed): returns { sheetName: [[cell, …], …] } */
function readXlsx(buf) {
  var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), td = new TextDecoder();
  var eocd = -1; for (var i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return Promise.reject(new Error('Not an Excel file'));
  var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), files = {};
  for (var k = 0; k < n; k++) { var m = dv.getUint16(off + 10, true), cs = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
    var name = td.decode(u8.subarray(off + 46, off + 46 + nl)), ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); files[name] = { m: m, d: u8.subarray(ds, ds + cs) }; off += 46 + nl + el + cl; }
  var get = function (nm) { var f = files[nm]; if (!f) return Promise.resolve(''); if (f.m === 0) return Promise.resolve(td.decode(f.d));
    return new Response(new Blob([f.d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
  var xml = function (t) { return new DOMParser().parseFromString(t, 'application/xml'); };
  return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'), get('xl/sharedStrings.xml')]).then(function (r) {
    var wb = xml(r[0]), rels = {}, ss = [];
    Array.prototype.forEach.call(xml(r[1]).getElementsByTagName('Relationship'), function (e) { rels[e.getAttribute('Id')] = e.getAttribute('Target'); });
    if (r[2]) Array.prototype.forEach.call(xml(r[2]).getElementsByTagName('si'), function (si) { ss.push(Array.prototype.map.call(si.getElementsByTagName('t'), function (t) { return t.textContent; }).join('')); });
    var sheets = Array.prototype.map.call(wb.getElementsByTagName('sheet'), function (e) { var t = rels[e.getAttribute('r:id')] || ''; return { name: e.getAttribute('name'), path: t.replace(/^\/?(xl\/)?/, 'xl/') }; });
    var out = {};
    return Promise.all(sheets.map(function (sh) { return get(sh.path).then(function (t) { var rows = [];
      Array.prototype.forEach.call(xml(t).getElementsByTagName('row'), function (row) { var arr = [];
        Array.prototype.forEach.call(row.getElementsByTagName('c'), function (c) { var ref = c.getAttribute('r') || '', col = 0; ref.replace(/[A-Z]+/, function (L) { for (var q = 0; q < L.length; q++) col = col * 26 + L.charCodeAt(q) - 64; });
          var ty = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], val = '';
          if (ty === 's') val = ss[+((v && v.textContent) || 0)] || ''; else if (ty === 'inlineStr') val = Array.prototype.map.call(c.getElementsByTagName('t'), function (x) { return x.textContent; }).join(''); else val = v ? v.textContent : '';
          arr[(col || arr.length + 1) - 1] = val; });
        rows.push(Array.from(arr, function (x) { return x == null ? '' : x; })); });
      out[sh.name] = rows; }); })).then(function () { return out; }); }); }
/* ================= Claude mode: the same app opened inside Claude uses the user's own Claude connectors ================= */
var CL = { on: !!(window.claude && typeof window.claude.use === 'function'), mcp: null, sample: null, dl: null, imgs: false };
CL.ready = CL.on ? Promise.all([claude.use('mcp').catch(function () { return null; }), claude.use('sample').catch(function () { return null; }), claude.use('downloads').catch(function () { return null; })])
  .then(function (r) { CL.mcp = r[0]; CL.sample = r[1]; CL.dl = r[2]; if (CL.sample && CL.sample.limits) return CL.sample.limits().then(function (l) { CL.imgs = !!(l && l.images); }).catch(function () {}); }) : Promise.resolve();
var M365 = 'Microsoft 365', GDRIVE = 'Google Drive';
var CL_DRIVE = 'b!-PWHJdIcZ0-gKkia4j9odEgetIygwXxKmFhm4bIxj5SHSByxhJikSrSa5YHlcuHY', CL_CERT_FOLDER = '01D2DJYVWLHWJ5M4UNGVAY4BQO5PP3NDBF'; /* General/Certificates */
var DATA_SHEET_ID = '17Ge4w5MyfBuqUSXEo3GDcwcSRbi0wrrXCJzzdnBWdUc'; /* Akhnaton Device Tracker – Data */
function clErr(e) { var c = e && e.code;
  return new Error(({ needs_reauth: 'Reconnect ' + (e.server || 'the connector') + ' in claude.ai → Settings → Connectors', server_not_connected: 'Add the ' + (e.server || '') + ' connector in claude.ai → Settings → Connectors', approval_required: 'Allow the app to use ' + (e.server || 'the connector') + ' (claude.ai asks once)', not_in_manifest: 'This connector is not allowed for the app – allow it in claude.ai', blocked_by_policy: 'Blocked by your organization', server_unavailable: (e.server || 'The server') + ' is not answering – try again', not_granted: 'Open the app inside Claude' })[c] || (e && (e.message || e.code)) || String(e)); }
function clCall(server, tool, input) { return CL.ready.then(function () { if (!CL.mcp) throw new Error('Open the app inside Claude to reach SharePoint');
  return CL.mcp.callTool(server, tool, input).catch(function (e) { if (e && e.retryable) return new Promise(function (r) { setTimeout(r, (e.retryAfterMs || 1500) + 500); }).then(function () { return CL.mcp.callTool(server, tool, input); }); throw e; }).catch(function (e) { throw clErr(e); }); }); }
function clText(r) { var t = (r.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n'); if (t) return t; return typeof r.payload === 'string' ? r.payload : (r.payload ? JSON.stringify(r.payload) : ''); }
function clObjs(r) { if (Array.isArray(r.payload)) return r.payload; var out = [];
  (r.content || []).forEach(function (b) { if (b.type !== 'text') return; var s = b.text, d = 0, st = -1, ins = false, es = false;
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (ins) { if (es) es = false; else if (c === '\\') es = true; else if (c === '"') ins = false; continue; }
      if (c === '"') ins = true; else if (c === '{') { if (!d) st = i; d++; } else if (c === '}') { d--; if (!d && st >= 0) { try { out.push(JSON.parse(s.slice(st, i + 1))); } catch (e) {} st = -1; } } } });
  if (!out.length && r.payload && typeof r.payload === 'object') out.push(r.payload); return out; }
/* people, companies, lab devices – read from the Akhnaton Devices data sheet (same list as the devices app) */
var CL_DB = null;
function clData() { if (CL_DB) return Promise.resolve(CL_DB);
  return clCall(GDRIVE, 'download_file_content', { fileId: DATA_SHEET_ID, exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }).then(function (r) {
    var o = r.payload && r.payload.content ? r.payload : clObjs(r)[0]; if (!o || !o.content) throw new Error('Could not read the Akhnaton Devices data sheet');
    var bin = atob(o.content), buf = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return readXlsx(buf.buffer).then(function (wb) {
      var tab = function (name) { var rows = (wb[name] || []).filter(function (x) { return x.some(function (c) { return String(c).trim(); }); }); var h = rows.shift() || [];
        return rows.filter(function (x) { return x[0]; }).map(function (x) { var ob = {}; h.forEach(function (k, j) { ob[k] = x[j] == null ? '' : x[j]; }); return ob; }); };
      var tf = function (v) { return String(v).toLowerCase() !== 'false' && String(v) !== '0'; };
      var dt = function (v) { v = String(v || ''); if (/^\d{5}(\.\d+)?$/.test(v)) { var d = new Date(Date.UTC(1899, 11, 30) + parseFloat(v) * 864e5); return d.toISOString().slice(0, 10); } return v; };
      CL_DB = { users: tab('Users').map(function (u) { return { id: u.id, name: u.name, role: u.role, active: tf(u.active) }; }).filter(function (u) { return u.active; }),
        companies: tab('Companies').map(function (c) { return { id: c.id, name: c.name, official: c.official, code: String(c.code || ''), group: c.group, active: tf(c.active), lastUsed: c.lastUsed }; }),
        devices: tab('Devices').map(function (d) { return { id: d.id, category: d.category, manufacturer: d.manufacturer, description: d.description, model: d.model, serial: d.serial, range: d.range, accuracy: d.accuracy, calDue: dt(d.calDue), active: tf(d.active) }; }) };
      return CL_DB; }); }); }
function clApi(req) { var a = req.action;
  if (a === 'people') return clData().then(function (d) { return d.users; });
  if (a === 'login') return clData().then(function (d) { var u = d.users.filter(function (x) { return x.id === req.userId; })[0]; if (!u) throw new Error('Unknown person'); return { user: u, mustChange: false }; });
  if (a === 'state') return clData();
  if (a === 'saveCompany') return Promise.reject(new Error('Add new companies in Akhnaton Devices – they show here right after.'));
  return Promise.reject(new Error('Not available inside Claude')); }
function clSearch(q, size) { return clCall(M365, 'sharepoint_search', { query: q, limit: Math.min(size || 25, 50), offset: 0 }).then(function (r) {
  return clObjs(r).filter(function (o) { return o && o.name && o.uri; }).map(function (o) { return { id: o.uri, uri: o.uri, driveId: o.driveId, itemId: o.id, name: o.name, webUrl: o.webUrl || '', mod: o.lastModifiedDateTime, summary: String(o.summary || o.content || '').replace(/<[^>]+>/g, '') }; }); }); }
function clRead(uri) { var txt = '', page = 1, chain = function (k) { var inp = { uri: uri }; if (page > 1) inp.startPage = page;
    return clCall(M365, 'read_resource', inp).then(function (r) { var t = clText(r); txt += '\n' + t; var m = t.match(/startPage\s*=\s*(\d+)/); if (m && +m[1] > page && k < 8) { page = +m[1]; return chain(k + 1); } return txt; }); };
  return chain(0); }
function clPages(uri) { return clRead(uri).then(function (t) { return t.split(/\n+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 40; }).map(function (x) { return [x]; }); }); }
function clOrders() { return clSearch('Calibration Orders', 10).then(function (fs) { var f = fs.filter(function (x) { return /^Calibration Orders\.xlsx$/i.test(x.name); }).sort(function (a, b) { return String(b.mod).localeCompare(String(a.mod)); })[0]; if (!f) return [];
  return clCall(M365, 'read_resource', { uri: f.uri, startPage: 2, endPage: 2 }).then(function (r) { var lines = clText(r).split('\n'), i = lines.findIndex(function (l) { return /^ID\t/i.test(l) || /\tCustomer\t/i.test(l); }); if (i < 0) return [];
    var v = []; for (var k = i; k < lines.length; k++) { if (!lines[k].trim() || /^##|^Formulas/.test(lines[k])) break; v.push(lines[k].split('\t')); } return ordersFrom(v, f.name); }); }); }
function clFolder(parent, name) { return clCall(M365, 'sharepoint_create_folder', { driveId: CL_DRIVE, parentItemId: parent, name: name, conflictBehavior: 'fail' }).then(function (r) { var o = clObjs(r)[0] || {}; return o.id; })
  .catch(function () { return clCall(M365, 'sharepoint_folder_search', { name: name, limit: 50, offset: 0 }).then(function (r) { var hit = clObjs(r).filter(function (o) { return o.driveId === CL_DRIVE && o.name === name && /\/Certificates\/Orders(\/[^/]+)?$/.test(decodeURIComponent(o.webUrl || '')); });
    var want = name === 'Orders' ? hit.filter(function (o) { return /\/Certificates\/Orders$/.test(decodeURIComponent(o.webUrl)); }) : hit.filter(function (o) { return /\/Certificates\/Orders\/[^/]+$/.test(decodeURIComponent(o.webUrl)); }); if (!want[0]) throw new Error('Could not open the Orders folder on SharePoint'); return want[0].id; }); }); }
function clUpload(p, file) { if (file.size > 1048000) return Promise.reject(new Error('The file is bigger than 1 MB – attach a photo instead'));
  return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.readAsDataURL(file); }).then(function (b64) {
    return clFolder(CL_CERT_FOLDER, 'Orders').then(function (orders) { return clFolder(orders, String(p.company.name).replace(/["*:<>?\/\\|#%]/g, ' ').trim()); })
      .then(function (fid) { return clCall(M365, 'sharepoint_upload_file', { driveId: CL_DRIVE, parentItemId: fid, filename: file.name, contentBase64: b64, conflictBehavior: 'rename' }); })
      .then(function (r) { var o = clObjs(r)[0] || {}; return { id: o.uri || o.id, webUrl: o.webUrl, name: o.name || file.name }; }); }); }
function clSave(blob, name) { return CL.ready.then(function () { if (!CL.dl) throw new Error('Downloading needs the app inside claude.ai'); return CL.dl.save({ filename: name, data: blob }); }); }
function clOcr(dataUrl) { return CL.ready.then(function () { if (!CL.sample || !CL.imgs) throw new Error('Reading photos needs the app inside claude.ai');
  return fetch(dataUrl).then(function (r) { return r.blob(); }).then(function (b) { return CL.sample('Transcribe every piece of text in this photo exactly as written, line by line. Keep codes, numbers, units and dashes exactly. Output only the text.', { images: [b] }); }).then(function (r) { return r.text || ''; }); }); }
/* read a certificate with Claude (exact values, no rounding) */
function clExtract(sec, hint) { return CL.ready.then(function () { if (!CL.sample) throw new Error('Reading certificates needs the app inside claude.ai');
  var text = sec.map(function (pg) { return pg.join(' '); }).join('\n\n---PAGE---\n\n').slice(0, 24000);
  return CL.sample.json('Below is text (spacing is messy) from ONE calibration certificate of Akhnaton calibration lab. ' + hint + '\nExtract it as JSON. Copy every value EXACTLY as written – never compute, round, correct or invent a number. Only repair spacing inside one number/token ("5 0"→"50", "- 0.02"→"-0.02", "0.0 1"→"0.01", "48 - 925 - 2026"→"48-925-2026"); keep trailing zeros. Missing → "".\n' +
    'If the results have ascending/descending or Up/Down columns put the second set in reading2/deviation2 and set dirs to 2, else dirs 1. ref = the standard/reference value (if there is no separate column use the nominal point). limit = the acceptance limit of that row as written ("" if only a global limit). Ignore repeatability / eccentricity tables.\n' +
    'Return JSON only: {"fields":{"certNo":"","manufacturer":"","description":"","code":"","model":"","serial":"","range":"","calRange":"","resolution":"","limits":"","calDate":"","dataSheetRef":"","procedure":""},"dirs":1,"points":[{"point":"","ref":"","reading":"","deviation":"","reading2":"","deviation2":"","limit":""}]}\n\nTEXT:\n"""\n' + text + '\n"""', { modelTier: 'default' })
    .then(function (j) { j = j || {}; return { fields: j.fields || {}, points: j.points || [], dirs: j.dirs === 2 ? 2 : 1 }; }); }); }

/* ================= server (same as Akhnaton Devices) ================= */
var Api = { call: function (req) {
  if (CL.on) return clApi(req);
  if (!CFG.API_URL) return Promise.reject(new Error('Server address is missing in config.js'));
  return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' })
    .then(function (r) { if (!r.ok) throw new Error('The server did not answer (' + r.status + '). Check the internet and try again.'); return r.json(); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || 'Something went wrong.'); return j.data; });
} };
(function () { try { var pr = JSON.parse(localStorage.getItem('akhc.projects') || '[]'); pr.forEach(function (p) { (p.items || []).forEach(function (it) { if (it.old && it.old.status === 'searching') it.old = null; }); }); localStorage.setItem('akhc.projects', JSON.stringify(pr)); } catch (e) {} })();
var S = { session: LS.get('session', null), me: null, people: LS.get('people', null), data: LS.get('cache', null), projects: LS.get('projects', []), cur: null, view: 'home' };
function req(action, payload) { return Api.call({ action: action, userId: S.session && S.session.userId, pin: S.session && S.session.pin, payload: payload || {} }); }
function refresh() { return req('state').then(function (d) { S.data = { companies: d.companies, users: d.users, devices: d.devices, at: Date.now() }; LS.set('cache', S.data);
  S.me = (d.users || []).filter(function (u) { return u.id === S.session.userId; })[0] || S.me; return d; }); }
function saveProjects() { LS.set('projects', S.projects); }
var isAdmin = function () { return S.me && S.me.role === 'admin'; };

/* ================= Microsoft / SharePoint ================= */
var SCOPES = ['User.Read', 'Files.ReadWrite.All', 'Sites.Read.All'];
var MS = { app: null, account: null, ready: null, error: '' };
MS.ready = (function () {
  if (!CFG.MS_CLIENT_ID) { MS.error = 'not-configured'; return Promise.resolve(); }
  if (!window.msal) { MS.error = 'Microsoft sign-in did not load. Check the internet.'; return Promise.resolve(); }
  MS.app = new msal.PublicClientApplication({ auth: { clientId: CFG.MS_CLIENT_ID, authority: 'https://login.microsoftonline.com/' + (CFG.MS_TENANT || 'organizations'), redirectUri: location.origin + location.pathname.replace(/index\.html$/, '') },
    cache: { cacheLocation: 'localStorage' } });
  return MS.app.handleRedirectPromise().then(function (r) { if (r && r.account) MS.account = r.account; if (!MS.account) MS.account = MS.app.getAllAccounts()[0] || null; })
    .catch(function (e) { MS.error = e.message || String(e); });
})();
function msSignIn() { if (!MS.app) return toast(MS.error === 'not-configured' ? 'SharePoint is not set up yet (config.js)' : MS.error, true); MS.app.loginRedirect({ scopes: SCOPES, prompt: 'select_account' }); }
function msToken() { return MS.ready.then(function () {
  if (!MS.app || !MS.account) throw new Error('Sign in to SharePoint first');
  return MS.app.acquireTokenSilent({ scopes: SCOPES, account: MS.account }).then(function (r) { return r.accessToken; })
    .catch(function (e) { if (e instanceof msal.InteractionRequiredAuthError) { MS.app.acquireTokenRedirect({ scopes: SCOPES, account: MS.account }); } throw e; }); }); }
function graph(method, path, body) { return msToken().then(function (tk) {
  return fetch('https://graph.microsoft.com/v1.0' + path, { method: method, headers: Object.assign({ Authorization: 'Bearer ' + tk }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined })
    .then(function (r) { if (r.status === 403) throw new Error('SharePoint said no access (403). Your company may need to allow this app.'); if (!r.ok) return r.text().then(function (t) { throw new Error('SharePoint error ' + r.status + ': ' + t.slice(0, 160)); }); return r.json(); }); }); }
var FILES = { ok: null, err: '' };
var useFiles = function () { return !!CFG.FILES_URL; };
var spOn = function () { if (CL.on) return true; return useFiles() ? FILES.ok !== false : !!(MS.app && MS.account); };
function fcall(action, payload) { if (!CFG.FILES_URL) return Promise.reject(new Error('The files server is not set up yet'));
  return fetch(CFG.FILES_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, userId: S.session && S.session.userId, pin: S.session && S.session.pin, payload: payload || {} }), redirect: 'follow' })
    .then(function (r) { if (!r.ok) throw new Error('The files server did not answer (' + r.status + ')'); return r.json(); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || 'Something went wrong'); return j.data; }); }
function filesPing() { if (!useFiles()) return Promise.resolve(); return fcall('ping').then(function (d) { FILES.ok = true; FILES.root = d.root; FILES.err = d.root ? '' : 'The SharePoint copy is not on Google Drive yet'; }).catch(function (e) { FILES.ok = false; FILES.err = e.message; }); }
/* search files in SharePoint / OneDrive */
function spSearch(q, size) {
  if (CL.on) return clSearch(q, size);
  if (useFiles()) return fcall('search', { q: q, limit: size || 25 }).then(function (l) { return l.map(function (f) { return { id: f.id, driveId: '', name: f.name, webUrl: f.webUrl, mod: f.mod, path: f.path, summary: '' }; }); });
  return graph('POST', '/search/query', { requests: [{ entityTypes: ['driveItem'], query: { queryString: q }, from: 0, size: size || 25 }] }).then(function (r) {
    var out = []; ((r.value || [])[0] || { hitsContainers: [] }).hitsContainers.forEach(function (c) { (c.hits || []).forEach(function (h) { var x = h.resource || {};
      if (!x.name || x.folder) return;
      out.push({ id: x.id, name: x.name, webUrl: x.webUrl || '', driveId: x.parentReference && x.parentReference.driveId, mod: x.lastModifiedDateTime, by: x.lastModifiedBy && x.lastModifiedBy.user && x.lastModifiedBy.user.displayName, summary: String(h.summary || '').replace(/<[^>]+>/g, '') }); }); });
    return out; }); }
function pathOf(f) { if (f.path) return '/' + f.path; try { return decodeURIComponent(f.webUrl || ''); } catch (e) { return f.webUrl || ''; } }
var ORDERS_CACHE = null;
function ordersFrom(v, fname) { var hd = (v[0] || []).map(function (x) { return String(x).trim().toLowerCase(); });
  var col = function (re) { for (var i = 0; i < hd.length; i++) if (re.test(hd[i])) return i; return -1; };
  var cC = col(/^customer/), cN = col(/po\.? *\/?price offer number|po.*number/), cV = col(/po\.? value/), cD = col(/po\.? date/), cJ = col(/job type/);
  return v.slice(1).filter(function (row) { return row[cC]; }).map(function (row) { return { customer: String(row[cC]).trim(), number: String(row[cN] == null ? '' : row[cN]).trim(), value: row[cV], date: row[cD], job: cJ >= 0 ? row[cJ] : '', file: fname }; }); }
function calibrationOrders() { /* rows of "Calibration Orders.xlsx" → Main Dashboard */
  if (ORDERS_CACHE) return Promise.resolve(ORDERS_CACHE);
  if (CL.on) return clOrders().then(function (o) { ORDERS_CACHE = o; return o; });
  if (useFiles()) return fcall('sheet', { name: 'Calibration Orders.xlsx', tab: 'Main Dashboard' }).then(function (r) { ORDERS_CACHE = ordersFrom(r.values || [], r.file || 'Calibration Orders.xlsx'); return ORDERS_CACHE; });
  return spSearch('filename:"Calibration Orders.xlsx"', 10).then(function (fs) {
    var f = fs.filter(function (x) { return /^Calibration Orders\.xlsx$/i.test(x.name); }).sort(function (a, b) { return String(b.mod).localeCompare(String(a.mod)); })[0];
    if (!f) return [];
    return graph('GET', '/drives/' + f.driveId + '/items/' + f.id + "/workbook/worksheets('Main Dashboard')/usedRange?$select=values").then(function (r) {
      var v = r.values || [], hd = (v[0] || []).map(function (x) { return String(x).trim().toLowerCase(); });
      var col = function (re) { for (var i = 0; i < hd.length; i++) if (re.test(hd[i])) return i; return -1; };
      var cC = col(/^customer/), cN = col(/po\.? *\/?price offer number|po.*number/), cV = col(/po\.? value/), cD = col(/po\.? date/), cJ = col(/job type/);
      ORDERS_CACHE = v.slice(1).filter(function (row) { return row[cC]; }).map(function (row) { return { customer: String(row[cC]).trim(), number: String(row[cN] == null ? '' : row[cN]).trim(), value: row[cV], date: row[cD], job: cJ >= 0 ? row[cJ] : '', file: f.name }; });
      return ORDERS_CACHE; }); }); }

/* ================= sheet (full-screen panel) ================= */
var sheetFn = null;
function openSheet(fn) { sheetFn = fn; renderSheet(); }
function renderSheet() { var root = $('#sheet-root'); if (!sheetFn) { root.innerHTML = ''; return; } var s = sheetFn(); var b = $('.sheet-b'), keep = b ? b.scrollTop : 0;
  root.innerHTML = '<div class="sheet-bg"><div class="sheet"><div class="sheet-h"><button class="icon-btn" data-close style="color:var(--navy)">' + I.back + '</button><h2>' + s.title + '</h2></div><div class="sheet-b">' + s.body + '</div>' + (s.foot ? '<div class="sheet-f">' + s.foot + '</div>' : '') + '</div></div>';
  $('.sheet-b').scrollTop = keep; $('[data-close]').onclick = closeSheet; if (s.mount) s.mount(); }
function closeSheet() { sheetFn = null; renderSheet(); render(); }

/* ================= login ================= */
function renderLogin() {
  var pick = null, pin = '', app = $('#app');
  function draw() {
    var people = (S.people || []).slice(), order = { admin: 0, keeper: 1, engineer: 2 }, roleName = { admin: 'Admin', keeper: 'Lab keeper', engineer: 'Engineer' };
    people.sort(function (a, b) { return (order[a.role] - order[b.role]) || a.name.localeCompare(b.name); });
    app.innerHTML = '<div class="login"><div class="login-top"><img src="logo-en-light.png" alt="Akhnaton Trading and Representation">' +
      '<h1><small>Akhnaton</small>Certificates</h1><p>Calibration certificates from last year\'s data.</p></div><div class="login-card"><div>' +
      (!pick ? '<div class="sec" style="margin-top:4px"><h2>Who are you?</h2><small>' + (CL.on ? 'Tap your name' : 'Same PIN as Akhnaton Devices') + '</small></div>' +
        (people.length ? '<div class="people">' + people.map(function (p) { return '<button data-u="' + p.id + '"><b>' + esc(p.name) + '</b><small>' + (roleName[p.role] || p.role) + '</small></button>'; }).join('') + '</div>'
          : '<div class="empty"><b>Loading names…</b>Check the internet connection.</div>')
      : '<div class="sec" style="margin-top:4px"><h2>' + esc(pick.name) + '</h2><button class="btn ghost sm" data-back>Change</button></div><p style="text-align:center;margin:8px 0 0;color:var(--muted)">Enter your 4-digit PIN</p>' +
        '<div class="pin" id="pin">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < pin.length ? 'f' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) { return k ? '<button data-k="' + k + '">' + k + '</button>' : '<span></span>'; }).join('') + '</div>') +
      '</div></div></div>';
    $$('[data-u]').forEach(function (b) { b.onclick = function () { pick = people.filter(function (p) { return p.id === b.dataset.u; })[0]; pin = ''; if (CL.on) { pin = '----'; return tryLogin(); } draw(); }; });
    var bk = $('[data-back]'); if (bk) bk.onclick = function () { pick = null; draw(); };
    $$('[data-k]').forEach(function (b) { b.onclick = function () { var k = b.dataset.k; if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k; draw(); if (pin.length === 4) tryLogin(); }; });
  }
  function tryLogin() { Api.call({ action: 'login', userId: pick.id, pin: pin }).then(function (r) {
      if (r.mustChange) { pin = ''; draw(); return dialog('Choose your PIN first', 'Open <b>Akhnaton Devices</b> once and choose your own PIN, then sign in here with it.', 'OK', 'Close'); }
      S.session = { userId: pick.id, pin: pin }; LS.set('session', S.session); S.me = r.user; boot();
    }).catch(function (e) { pin = ''; draw(); var p = $('#pin'); if (p) p.classList.add('shake'); toast(e.message, true); }); }
  draw();
  Api.call({ action: 'people' }).then(function (p) { S.people = p; LS.set('people', p); if (!pick) draw(); }).catch(function (e) { if (!S.people) toast(CL.on ? (e && e.message) || 'Could not load the names' : 'Cannot reach the server. Check the internet.', true); });
}
function signOut() { S.session = null; S.me = null; LS.del('session'); renderLogin(); }

/* ================= app shell ================= */
function top(title, sub, extra) {
  return '<div class="top"><div class="top-row"><div class="brand"><img src="logo-en-light.png" alt="Akhnaton"><span class="bdiv"></span><span class="bname"><small>Akhnaton</small><b>Certificates</b></span></div>' +
    '<span class="sync' + (spOn() && !FILES.err ? '' : ' off') + '" title="SharePoint"><i></i>' + (spOn() && !FILES.err ? 'SharePoint' : 'Offline') + '</span></div>' +
    (title ? '<div class="ptitle">' + title + '</div>' : '') + (sub ? '<div class="hello" style="margin-top:4px">' + sub + '</div>' : '') + (extra || '') + '</div>'; }
function render() {
  if (!S.session) return renderLogin();
  var p = S.cur ? S.projects.filter(function (x) { return x.id === S.cur; })[0] : null;
  if (!p) { S.cur = null; return renderHome(); }
  if (p.stage !== 'done') return renderWizard(p);
  return renderOverview(p);
}
function boot() { render(); filesPing().then(function () { if (!sheetFn) render(); }); refresh().then(function () { if (!sheetFn) render(); }).catch(function (e) { if (/PIN|sign in/i.test(e.message)) return signOut(); toast(e.message, true); }); }

/* ================= home ================= */
function msCard() {
  if (CL.on) return CL.mcp ? '<div class="okline">' + I.ok.replace(/28/g, '20') + ' SharePoint connected through your Claude account</div>' : '<div class="okline"><span class="spin dark"></span> Connecting…</div>';
  if (useFiles()) { if (FILES.ok === null) return '<div class="okline"><span class="spin dark"></span> Checking the SharePoint copy…</div>';
    if (FILES.ok && !FILES.err) return '<div class="okline">' + I.ok.replace(/28/g, '20') + ' SharePoint files connected (copy on Google Drive)</div>';
    return '<div class="note warnbox"><b>SharePoint files are not reachable yet.</b><br>' + esc(FILES.err) + '</div>'; }
  if (spOn()) return '<div class="okline">' + I.ms + ' SharePoint connected · ' + esc(MS.account.username) + '</div>';
  if (MS.error === 'not-configured') return '<div class="note warnbox">SharePoint is not set up yet. Bishoy needs to add the Microsoft app ID to <b>config.js</b> (one time).</div>';
  return '<div class="card"><h3>Connect SharePoint</h3><div class="meta">To find old certificates, POs and contracts, sign in with your work account.</div>' + (MS.error ? '<div class="note warnbox" style="margin:10px 0 0">' + esc(MS.error) + '</div>' : '') +
    '<div class="cf"><button class="btn" id="msIn">' + I.ms + ' Sign in with Microsoft</button></div></div>'; }
function projTitle(p) { return p.company ? p.company.name : 'New project'; }
var TYPES = { contract: ['Contract', I.doc], po: ['Purchase order (PO)', I.po], offer: ['Price offer', I.offer], approval: ['General approval', I.ok], visit: ['One visit', I.visit] };
function renderHome() {
  var mine = S.projects.slice().sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
  $('#app').innerHTML = '<div class="shell">' + top('', '<span>Hello</span><strong>' + esc(S.me ? S.me.name : (S.session && S.session.userId)) + '</strong>') + '<main>' + msCard() + dueCard() +
    '<div class="sec"><h2>Projects</h2><small>' + mine.length + '</small></div>' +
    (mine.length ? mine.map(function (p) { return '<button class="card bar projcard" style="--c:' + (p.stage === 'done' ? 'var(--office)' : 'var(--service)') + '" data-p="' + p.id + '"><h3>' + esc(projTitle(p)) + '</h3>' +
      '<div class="meta">' + [p.depts && p.depts.length ? p.depts.join(', ') : '', p.orderType ? TYPES[p.orderType][0] + (p.order && p.order.number ? ' ' + esc(p.order.number) : '') : '', (p.items || []).length ? p.items.length + ' items' : ''].filter(Boolean).join(' · ') + '</div>' +
      '<div class="meta">' + (p.stage === 'done' ? 'Ready' : 'Setting up…') + ' · ' + fmtDate(p.created) + '</div></button>'; }).join('')
      : '<div class="empty"><b>No projects yet</b>Tap “New project” to start.</div>') +
    '<div class="cf" style="margin-top:22px"><button class="btn ghost" id="out">Sign out</button></div></main></div>' +
    '<button class="btn fab" id="newP">' + I.plus + ' New project</button>';
  $('#newP').onclick = function () { var p = { id: uid(), created: new Date().toISOString(), by: S.session.userId, stage: 'company', company: null, deptSug: null, depts: [], orderType: '', order: null, orderFiles: null, items: [], machines: [] };
    S.projects.push(p); saveProjects(); S.cur = p.id; render(); window.scrollTo(0, 0); };
  $$('[data-p]').forEach(function (b) { b.onclick = function () { S.cur = b.dataset.p; render(); window.scrollTo(0, 0); }; });
  var dg = $('#dueGo'); if (dg) dg.onclick = dueScan;
  $('#out').onclick = signOut; var mi = $('#msIn'); if (mi) mi.onclick = msSignIn;
}

/* ================= wizard ================= */
var STAGES = ['company', 'date', 'dept', 'type', 'order', 'items'];
var STAGE_T = { company: ['Company', 'Which company is this work for?'], date: ['Calibration date', 'One date for all the items – you can change it for one item later'], dept: ['Department', 'Which department(s)?'], type: ['Order type', 'What is the work based on?'], order: ['Order document', 'Choose it from SharePoint'], items: ['Items', 'What will be calibrated?'] };
var W = { q: '' };
function go(p, stage) { p.stage = stage; p.reached = Math.max(p.reached || 0, FIDX[stage] || 0); saveProjects(); W.q = ''; W.busy = false; render(); window.scrollTo(0, 0); }
function renderWizard(p) {
  var k = STAGES.indexOf(p.stage), t = STAGE_T[p.stage];
  var dots = stepBar(p);
  $('#app').innerHTML = '<div class="shell" style="padding-bottom:110px">' + top(t[0], esc(t[1]), dots) + '<main id="wm"></main></div><div class="wiz-foot"><div id="wf"></div></div>';
  bindStepBar(p); bindHome();
  ({ company: wCompany, date: wDate, dept: wDept, type: wType, order: wOrder, items: wItems })[p.stage](p);
}
function foot(p, nextLabel, nextOk, onNext, extra) {
  var k = STAGES.indexOf(p.stage);
  $('#wf').innerHTML = '<button class="btn ghost" id="wb">' + (k ? 'Back' : 'Cancel') + '</button>' + (extra || '') + '<button class="btn blue" id="wn"' + (nextOk ? '' : ' disabled') + '>' + nextLabel + '</button>';
  $('#wb').onclick = function () { if (k) return go(p, STAGES[k - 1]);
    if (!p.company && !(p.items || []).length) { S.projects = S.projects.filter(function (x) { return x.id !== p.id; }); saveProjects(); } S.cur = null; render(); };
  $('#wn').onclick = onNext; }

/* ---- 1. company (shared list from Akhnaton Devices) ---- */
function wCompany(p) {
  var cos = ((S.data && S.data.companies) || []).filter(function (c) { return c.active !== false; });
  var q = norm(W.q), list = cos.filter(function (c) { return !q || norm(c.name + ' ' + (c.official || '') + ' ' + (c.code || '')).indexOf(q) >= 0; });
  list.sort(function (a, b) { return String(b.lastUsed || '').localeCompare(String(a.lastUsed || '')) || a.name.localeCompare(b.name); });
  if (!q) { var recent = list.filter(function (c) { return c.lastUsed; }).slice(0, 5), rest = cos.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  var row = function (c) { var on = p.company && p.company.id === c.id;
    return '<button class="row' + (on ? ' sel' : '') + '" data-c="' + c.id + '"><span class="check">' + (on ? '✓' : '') + '</span><span class="t"><b>' + esc(c.name) + '</b>' + (c.official ? '<small class="ar" dir="auto">' + esc(c.official) + '</small>' : '') + '</span>' + (c.code ? '<span class="cocode">' + esc(c.code) + '</span>' : '') + '</button>'; };
  $('#wm').innerHTML = '<div class="search">' + I.search + '<input id="cq" placeholder="Search company, Arabic name or code" value="' + esc(W.q) + '" autocomplete="off"></div>' +
    (!S.data ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Loading the company list…</b></div>'
      : (q ? (list.length ? '<div class="list">' + list.slice(0, 80).map(row).join('') + '</div>' : '<div class="empty"><b>No company found</b>' + (isAdmin() ? 'Add it below.' : 'Ask the admin to add it in Akhnaton Devices.') + '</div>')
        : (recent.length ? '<div class="sec" style="margin-top:4px"><h2>Recent</h2></div><div class="list">' + recent.map(row).join('') + '</div>' : '') +
          '<div class="sec"><h2>All companies</h2><small>' + cos.length + '</small></div><div class="list">' + rest.map(row).join('') + '</div>')) +
    '<div class="small" style="margin-top:12px">Same list as Akhnaton Devices – a company added there shows here.</div>' +
    (isAdmin() ? '<div class="cf"><button class="btn ghost" id="addCo">' + I.plus + ' Add a company</button></div>' : '');
  var inp = $('#cq'); inp.oninput = function () { W.q = inp.value; var pos = inp.selectionStart; wCompany(p); var n = $('#cq'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-c]').forEach(function (b) { b.onclick = function () { var c = cos.filter(function (x) { return x.id === b.dataset.c; })[0];
    if (!p.company || p.company.id !== c.id) { p.deptSug = null; p.depts = []; p.orderFiles = null; p.order = null; }
    p.company = { id: c.id, name: c.name, official: c.official || '', code: c.code || '', group: c.group || '' }; saveProjects(); go(p, 'date'); }; });
  var ac = $('#addCo'); if (ac) ac.onclick = function () { companySheet(p); };
  foot(p, 'Next', !!p.company, function () { go(p, 'date'); });
}
function companySheet(p) { var f = { name: W.q || '', official: '', code: '', group: 'Client' };
  openSheet(function () { return { title: 'Add a company', body:
    '<div class="note">It is saved in the shared list, so it shows in Akhnaton Devices too.</div>' +
    '<label class="f"><span>Short name</span><input class="inp" data-f="name" value="' + esc(f.name) + '"></label>' +
    '<label class="f"><span>Official name (as on certificates)</span><input class="inp" data-f="official" dir="auto" value="' + esc(f.official) + '"></label>' +
    '<label class="f"><span>Customer ID / code</span><input class="inp" data-f="code" value="' + esc(f.code) + '" placeholder="e.g. 10EP, 62, 260"></label>' +
    '<label class="f"><span>Group</span><div class="seg">' + ['Client', 'EVA Group'].map(function (g) { return '<button data-g="' + g + '" class="' + (f.group === g ? 'on' : '') + '">' + g + '</button>'; }).join('') + '</div></label>',
    foot: '<button class="btn" id="coSave">Save company</button>',
    mount: function () { $$('[data-f]').forEach(function (e) { e.oninput = function () { f[e.dataset.f] = e.value; }; });
      $$('[data-g]').forEach(function (b) { b.onclick = function () { f.group = b.dataset.g; renderSheet(); }; });
      $('#coSave').onclick = function () { if (!f.name.trim()) return toast('Write the company name', true); var b = $('#coSave'); b.disabled = true;
        req('saveCompany', { company: f }).then(function (r) { return refresh().then(function () { return r; }); }).then(function (r) {
          var c = S.data.companies.filter(function (x) { return x.id === r.id; })[0]; if (c) { p.company = { id: c.id, name: c.name, official: c.official || '', code: c.code || '', group: c.group || '' }; p.deptSug = null; saveProjects(); }
          sheetFn = null; renderSheet(); toast('Company saved'); if (c) go(p, 'date'); else render();
        }).catch(function (e) { b.disabled = false; toast(e.message, true); }); }; } }; }); }

/* ---- calibration date (all items) ---- */
function wDate(p) { var inf = ensureInfo(p); if (!inf.cal) { inf.cal = d2s(new Date()); calcDates(inf); saveProjects(); } if (!inf.woPre) inf.woPre = (String(p.company.code || '').match(/^\d+/) || [''])[0];
  var F = function (k, l, t) { return '<label class="f"><span>' + l + '</span><input class="inp" ' + (t ? 'type="date" ' : '') + 'data-i="' + k + '" value="' + esc(inf[k]) + '"></label>'; };
  $('#wm').innerHTML = '<div class="card bar"><h3>' + esc(p.company.name) + '</h3></div>' + F('cal', 'Calibration date', 1) +
    '<div class="note">Work order ≈ 1 week before · Date of issue = 3 working days after (same month) · Received ≈ issue − 7 · Due = +1 year · working days Sun – Thu. You can change any of them.</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' + F('wo', 'Work order date', 1) + F('woPre', 'WO number prefix (the 10 in 10/21/10/2026)') + F('iss', 'Date of issue', 1) + F('rec', 'Date received', 1) + F('due', 'Due date', 1) + '</div>' +
    '<div class="note" id="woShow" style="background:var(--office-soft);color:#14603C">WORK ORDER No.: <b>' + esc(woNo(inf) || '—') + '</b></div><div id="dw">' + dateWarns(inf).map(function (w) { return '<div class="note warnbox">' + esc(w) + '</div>'; }).join('') + '</div>' +
    '<div class="small">An item calibrated on another day: open the item and set its own date.</div>';
  $$('[data-i]').forEach(function (e) { e.oninput = function () { inf[e.dataset.i] = e.value; if (e.dataset.i === 'cal') { calcDates(inf); ['wo', 'iss', 'rec', 'due'].forEach(function (k) { $('[data-i="' + k + '"]').value = inf[k]; }); }
    $('#woShow').innerHTML = 'WORK ORDER No.: <b>' + esc(woNo(inf) || '—') + '</b>'; $('#dw').innerHTML = dateWarns(inf).map(function (w) { return '<div class="note warnbox">' + esc(w) + '</div>'; }).join(''); saveProjects(); }; });
  foot(p, 'Next', true, function () { go(p, 'dept'); }); }

/* ---- 2. department (suggested from earlier years on SharePoint) ---- */
var DEPT_WORDS = ['Production', 'Utilities', 'Utility', 'QC', 'Quality Control', 'QA', 'Micro', 'Microbiology', 'Laboratory', 'Labs', 'Lab', 'R&D', 'Warehouse', 'Store', 'Stores', 'Stability', 'Engineering', 'Maintenance', 'Packaging', 'Sterile', 'Solid', 'Semi Solid', 'Liquid', 'Injection', 'Vials', 'Ampoules', 'Insulin', 'Penem', 'Vaccine', 'Water Station', 'Water', 'HVAC', 'Biotech', 'Cosmetics', 'Pilot'];
var PLANLIKE = /plan|^20\d\d$|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b20\d\d\b|reports?|letters?|cover|old|new folder|archive/i;
function companyTerms(c) { var t = [c.name]; if (c.official && c.official !== c.name) t.push(c.official);
  var short = c.name.replace(/\(.*?\)/g, '').replace(/\b(company|co\.?|s\.a\.e\.?|sae|llc|ltd|egypt|pharmaceuticals?|industries|for)\b/gi, '').replace(/\s+/g, ' ').trim(); if (short && t.indexOf(short) < 0) t.push(short); return t; }
function suggestDepts(p) {
  var c = p.company, terms = companyTerms(c), toks = terms.map(function (t) { return t.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(function (w) { return w.length > 2 && !/pharma|company|egypt|for|the|and/.test(w); }); });
  var qs = terms.slice(0, 2).map(function (t) { return '"' + t.replace(/"/g, '') + '"'; }); if (c.code) qs.push('"' + c.code + '-"'); /* cert numbers start with the customer ID */
  return Promise.all(qs.map(function (q) { return spSearch(q, 50).catch(function () { return []; }); })).then(function (rs) {
    var files = [].concat.apply([], rs), seen = {}, folders = {}, depts = {}, plans = {}, certFolders = {};
    files.forEach(function (f) { if (seen[f.id]) return; seen[f.id] = 1; var path = pathOf(f), m = path.match(/\/Certificates\/(.+)$/i); if (!m) return;
      var seg = m[1].split('/'), yr = (seg[0].match(/20\d\d/) || [''])[0], cust = seg[1] || '';
      var lc = cust.toLowerCase(); var hit = toks.some(function (ws) { return ws.some(function (w) { return lc.indexOf(w) >= 0; }); }) || (c.code && f.name.indexOf(c.code + '-') === 0);
      if (!hit || seg.length < 3) return;
      certFolders[seg[0] + '/' + cust] = 1;
      seg.slice(2, -1).forEach(function (fo) { var key = fo.trim(); if (!key) return; var bag = PLANLIKE.test(key) ? plans : folders; (bag[key] = bag[key] || { n: 0, years: {} }).n++; if (yr) bag[key].years[yr] = 1; });
      DEPT_WORDS.forEach(function (w) { if (new RegExp('\\b' + w.replace(/[&]/g, '\\&') + '\\b', 'i').test(f.name)) { (depts[w] = depts[w] || { n: 0, years: {} }).n++; if (yr) depts[w].years[yr] = 1; } }); });
    var out = Object.keys(folders).map(function (k) { return { name: k, n: folders[k].n, years: Object.keys(folders[k].years).sort(), from: 'folder' }; })
      .concat(Object.keys(depts).filter(function (k) { return !folders[k]; }).map(function (k) { return { name: k, n: depts[k].n, years: Object.keys(depts[k].years).sort(), from: 'file names' }; }));
    out.sort(function (a, b) { return b.n - a.n; });
    p.deptSug = { at: Date.now(), list: out.slice(0, 15), plans: Object.keys(plans).slice(0, 8), certFolders: Object.keys(certFolders), files: Object.keys(seen).length };
    saveProjects(); return p.deptSug; }); }
function wDept(p) {
  var sug = p.deptSug, sel = p.depts || [];
  if (!sug && spOn() && !W.busy) { W.busy = true; suggestDepts(p).catch(function (e) { toast(e.message, true); p.deptSug = { list: [], plans: [], err: e.message }; }).then(function () { W.busy = false; if (p.stage === 'dept') render(); }); }
  var names = (sug ? sug.list.map(function (s) { return s.name; }) : []).concat(sel.filter(function (d) { return !sug || !sug.list.some(function (s) { return s.name === d; }); }));
  $('#wm').innerHTML = '<div class="card bar"><h3>' + esc(p.company.name) + '</h3>' + (p.company.official ? '<div class="meta" dir="auto">' + esc(p.company.official) + '</div>' : '') + '</div>' +
    (!spOn() ? '<div class="note">Connect SharePoint on the home screen to get suggestions from earlier years. You can still type the departments.</div>'
      : !sug ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Looking at earlier years on SharePoint…</b>Certificates and folders of this company.</div>'
      : '<div class="sec" style="margin-top:4px"><h2>Suggested</h2><small>' + (sug.files || 0) + ' files checked</small></div>' + (sug.err ? '<div class="note warnbox">' + esc(sug.err) + '</div>' : '')) +
    (names.length ? '<div class="list">' + names.map(function (n) { var s = sug && sug.list.filter(function (x) { return x.name === n; })[0], on = sel.indexOf(n) >= 0;
      return '<div class="row' + (on ? ' sel' : '') + '"><button class="check" data-d="' + esc(n) + '" style="border:2px solid ' + (on ? 'var(--blue)' : 'var(--line)') + ';' + (on ? 'background:var(--blue)' : '') + '">' + (on ? '✓' : '') + '</button><span class="t" data-d2="' + esc(n) + '"><b>' + esc(n) + '</b>' +
        (s ? '<small>Seen in ' + s.n + ' file' + (s.n > 1 ? 's' : '') + (s.years.length ? ' · ' + s.years.join(', ') : '') + ' · from ' + s.from + '</small>' : '<small>Added by you</small>') + '</span><button class="icon-btn" data-ed="' + esc(n) + '" style="color:var(--muted)">' + I.edit + '</button></div>'; }).join('') + '</div>'
      : (sug && spOn() ? '<div class="empty"><b>No departments found in earlier years</b>Type one below, or skip.</div>' : '')) +
    (sug && sug.plans && sug.plans.length ? '<div class="small" style="margin-top:8px">Plans seen before: ' + sug.plans.map(esc).join(', ') + '</div>' : '') +
    '<div class="sec"><h2>Add a department</h2></div><div class="orow" style="display:flex;gap:8px"><input class="inp" id="nd" placeholder="e.g. Production, Utilities, Labs"><button class="btn" id="ndA" style="flex:none">Add</button></div>' +
    (spOn() && sug ? '<div class="cf"><button class="btn ghost sm" id="reS" style="flex:none">Search again</button></div>' : '');
  var tog = function (n) { var i = sel.indexOf(n); if (i >= 0) sel.splice(i, 1); else sel.push(n); p.depts = sel; saveProjects(); wDept(p); };
  $$('[data-d]').forEach(function (b) { b.onclick = function () { tog(b.dataset.d); }; }); $$('[data-d2]').forEach(function (b) { b.onclick = function () { tog(b.dataset.d2); }; });
  $$('[data-ed]').forEach(function (b) { b.onclick = function () { var old = b.dataset.ed;
    $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>Edit department</h3><input class="inp" id="edv" value="' + esc(old) + '"><div class="cf"><button class="btn ghost" id="edDel">Remove</button><button class="btn" id="edOk">Save</button></div></div></div>';
    $('#edOk').onclick = function () { var v = $('#edv').value.trim(); $('#dlg-root').innerHTML = ''; if (!v) return; if (sug) sug.list.forEach(function (s) { if (s.name === old) s.name = v; }); var i = sel.indexOf(old); if (i >= 0) sel[i] = v; else sel.push(v); p.depts = sel; saveProjects(); wDept(p); };
    $('#edDel').onclick = function () { $('#dlg-root').innerHTML = ''; if (sug) sug.list = sug.list.filter(function (s) { return s.name !== old; }); p.depts = sel.filter(function (x) { return x !== old; }); saveProjects(); wDept(p); }; }; });
  $('#ndA').onclick = function () { var v = $('#nd').value.trim(); if (!v) return; if (sel.indexOf(v) < 0) sel.push(v); p.depts = sel; saveProjects(); wDept(p); };
  var rs = $('#reS'); if (rs) rs.onclick = function () { p.deptSug = null; wDept(p); };
  foot(p, sel.length ? 'Next' : 'Next', sel.length > 0, function () { p.deptSkip = false; go(p, 'type'); }, '<button class="btn ghost" id="wSkip">Skip</button>');
  $('#wSkip').onclick = function () { p.depts = []; p.deptSkip = true; go(p, 'type'); };
}

/* ---- 3. order type ---- */
function wType(p) {
  $('#wm').innerHTML = '<div class="cats big">' + Object.keys(TYPES).map(function (k) { return '<button data-t="' + k + '" class="' + (p.orderType === k ? 'on' : '') + '">' + TYPES[k][1] + '<b>' + TYPES[k][0] + '</b><small>' +
    { contract: 'Yearly contract', po: 'The customer\'s PO', offer: 'Separate price offer', approval: 'General approval', visit: 'Single visit' }[k] + '</small></button>'; }).join('') + '</div>';
  $$('[data-t]').forEach(function (b) { b.onclick = function () { if (p.orderType !== b.dataset.t) { p.orderFiles = null; p.order = null; } p.orderType = b.dataset.t; saveProjects(); go(p, 'order'); }; });
  foot(p, 'Next', !!p.orderType, function () { go(p, 'order'); });
}

/* ---- 4. order document from SharePoint ---- */
var TYPE_WORDS = { contract: ['contract', 'عقد', 'agreement'], po: ['PO', 'purchase order', 'أمر توريد'], offer: ['offer', 'quotation', 'عرض سعر'], approval: ['approval', 'موافقة'], visit: ['visit', 'زيارة'] };
var DOC_EXT = /\.(pdf|docx?|xlsx?|jpe?g|png|msg|eml)$/i;
var ORDER_FOLDER = CFG.FILES_URL ? 'Google Drive › Akhnaton Certificates – Uploads' : 'General/Certificates/Orders'; /* where an attached PO / document is saved on SharePoint (can be changed) */
function findOrderFiles(p) {
  var terms = companyTerms(p.company).slice(0, 2), words = TYPE_WORDS[p.orderType] || [], qs = [];
  terms.forEach(function (t) { words.slice(0, 2).forEach(function (w) { qs.push('"' + t.replace(/"/g, '') + '" ' + (w.indexOf(' ') > 0 ? '"' + w + '"' : w)); }); });
  var toks = terms.map(function (t) { return t.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(function (w) { return w.length > 2 && !/pharma|company|egypt|for|the|and/.test(w); }); });
  return Promise.all([Promise.all(qs.map(function (q) { return spSearch(q, 25).catch(function () { return []; }); })), p.orderType === 'po' || p.orderType === 'offer' ? calibrationOrders().catch(function () { return []; }) : Promise.resolve([])]).then(function (r) {
    var seen = {}, files = [].concat.apply([], r[0]).filter(function (f) { if (seen[f.id] || !DOC_EXT.test(f.name) || /cal\.?\s*cert|cover page/i.test(f.name)) return false; seen[f.id] = 1; return true; });
    var score = function (f) { var s = 0, nm = f.name.toLowerCase(), pa = pathOf(f).toLowerCase(); words.forEach(function (w) { if (nm.indexOf(w.toLowerCase()) >= 0) s += 3; if (pa.indexOf(w.toLowerCase()) >= 0) s += 1; });
      toks.forEach(function (ws) { ws.forEach(function (w) { if (nm.indexOf(w) >= 0) s += 2; else if (pa.indexOf(w) >= 0) s += 1; }); }); return s; };
    files.forEach(function (f) { f.score = score(f); });
    files.sort(function (a, b) { return b.score - a.score || String(b.mod).localeCompare(String(a.mod)); });
    var cn = norm(p.company.official), cn2 = norm(p.company.name);
    var nums = (r[1] || []).filter(function (o) { var x = norm(o.customer); return x && (x === cn || x === cn2 || (cn && (x.indexOf(cn) >= 0 || cn.indexOf(x) >= 0)) || x.indexOf(cn2) >= 0); });
    /* a PO number from Calibration Orders that appears in a file name → that file is the PO */
    files.forEach(function (f) { nums.forEach(function (n) { if (n.number && n.number.length > 3 && f.name.indexOf(n.number) >= 0) { f.score += 10; f.number = n.number; f.value = n.value; f.date = n.date; } }); });
    files.sort(function (a, b) { return b.score - a.score || String(b.mod).localeCompare(String(a.mod)); });
    p.orderFiles = { at: Date.now(), list: files.slice(0, 20).map(function (f) { return { id: f.id, driveId: f.driveId, name: f.name, webUrl: f.webUrl, mod: f.mod, by: f.by, number: f.number || '', value: f.value || '', date: f.date || '', folder: pathOf(f).replace(/^https:\/\/[^/]+/, '').split('/').slice(-2, -1)[0] || '' }; }), nums: nums };
    /* contract / offer / approval: pre-select the best match so you only confirm */
    if (p.orderType !== 'po' && files[0] && files[0].score >= 4 && !(p.order && (p.order.fileId || p.order.skipped))) p.order = { fileId: files[0].id, driveId: files[0].driveId, fileName: files[0].name, webUrl: files[0].webUrl, auto: true };
    saveProjects(); return p.orderFiles; }); }
var SITE = null;
function siteDrive() { if (SITE) return Promise.resolve(SITE); var u = new URL(CFG.SP_SITE_URL);
  return graph('GET', '/sites/' + u.hostname + ':' + u.pathname + '?$select=id').then(function (s) { return graph('GET', '/sites/' + s.id + '/drive?$select=id'); }).then(function (d) { SITE = d.id; return SITE; }); }
function uploadOrder(p, file) {
  if (CL.on) return clUpload(p, file);
  if (useFiles()) return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.readAsDataURL(file); })
    .then(function (b64) { return fcall('upload', { name: file.name, mime: file.type, base64: b64, company: p.company.name }); });
  return uploadOrderSP(p, file); }
function uploadOrderSP(p, file) { /* saves the attached document in SharePoint: <ORDER_FOLDER>/<company>/<file> */
  var safe = function (s) { return String(s).replace(/["*:<>?\/\\|#%]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var path = ORDER_FOLDER + '/' + safe(p.company.name) + '/' + safe(file.name);
  return siteDrive().then(function (drive) { return msToken().then(function (tk) {
    return fetch('https://graph.microsoft.com/v1.0/drives/' + drive + '/root:/' + path.split('/').map(encodeURIComponent).join('/') + ':/content?@microsoft.graph.conflictBehavior=rename', { method: 'PUT', headers: { Authorization: 'Bearer ' + tk }, body: file })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('Upload failed ' + r.status + ': ' + t.slice(0, 120)); }); return r.json(); }); }); }); }
function wOrder(p) {
  var of = p.orderFiles, o = p.order || {}, tname = TYPES[p.orderType][0], isPO = p.orderType === 'po';
  if (!of && spOn() && !W.busy) { W.busy = true; findOrderFiles(p).catch(function (e) { toast(e.message, true); p.orderFiles = { list: [], nums: [], err: e.message }; }).then(function () { W.busy = false; if (p.stage === 'order') render(); }); }
  var chosen = o.fileName ? '<div class="card bar" style="--c:var(--office)"><h3>' + (o.auto ? 'Found – please confirm' : 'Chosen') + '</h3><div class="meta" style="word-break:break-word"><b>' + esc(o.fileName) + '</b>' + (o.number ? ' · No. ' + esc(o.number) : '') + (o.attached ? ' · attached by you' + (o.uploaded ? ' · saved' : ' · on this phone') : '') + '</div>' +
      '<div class="cf">' + (o.webUrl ? '<a class="btn ghost sm" href="' + esc(o.webUrl) + '" target="_blank" rel="noopener">Open</a>' : '') + (o.auto ? '<button class="btn sm" id="oConf">Yes, this one</button>' : '') + '<button class="btn ghost sm" id="oClr">Choose another</button></div></div>' : '';
  $('#wm').innerHTML = '<div class="card bar"><h3>' + esc(p.company.name) + '</h3><div class="meta">' + esc(tname) + (p.depts.length ? ' · ' + esc(p.depts.join(', ')) : '') + '</div></div>' + chosen +
    (!spOn() ? '<div class="note warnbox">SharePoint is not connected yet, so the ' + esc(tname) + ' can\'t be found on the share. ' + (isPO ? 'You can attach it below.' : 'You can skip this for now.') + '</div>'
      : !of ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Looking on SharePoint for the ' + esc(tname) + ' of this company…</b></div>'
      : (of.err ? '<div class="note warnbox">' + esc(of.err) + '</div>' : '') +
        (o.fileName && !o.auto ? '' : '<div class="sec" style="margin-top:4px"><h2>On SharePoint</h2><small>' + of.list.length + ' files</small></div>' +
        (of.list.length ? '<div class="list">' + of.list.map(function (f, i) { var on = o.fileId === f.id;
          return '<div class="row' + (on ? ' sel' : '') + '"><button class="check" data-f="' + i + '" style="' + (on ? 'background:var(--blue);border-color:var(--blue)' : '') + '">' + (on ? '✓' : '') + '</button><span class="t" data-f2="' + i + '"><b>' + esc(f.name) + '</b><small>' + esc([f.number && 'No. ' + f.number, f.folder, fmtDate(f.mod)].filter(Boolean).join(' · ')) + '</small></span><a class="btn ghost sm" href="' + esc(f.webUrl) + '" target="_blank" rel="noopener" style="flex:none">Open</a></div>'; }).join('') + '</div>'
          : '<div class="empty"><b>No ' + esc(tname) + ' found on SharePoint</b>' + (isPO ? 'Attach it below.' : 'You can skip this for now.') + '</div>'))) +
    (isPO || p.orderType === 'offer' ? '<div class="sec"><h2>Not on SharePoint?</h2></div><div class="cf" style="margin-top:0"><button class="btn ghost" id="oAtt">Attach the ' + (isPO ? 'PO' : 'document') + ' (PDF or photo)</button></div>' +
      '<div class="small" style="margin-top:6px">It will be saved on SharePoint in <b>' + esc(ORDER_FOLDER + '/' + p.company.name) + '</b>.</div>' : '') +
    (spOn() && of ? '<div class="cf"><button class="btn ghost sm" id="reF" style="flex:none">Search again</button></div>' : '');
  var setO = function (x) { p.order = x; saveProjects(); wOrder(p); okNext(); };
  var pickF = function (i) { var f = of.list[i]; if (o.fileId === f.id && !o.auto) return setO(null); setO({ fileId: f.id, driveId: f.driveId, fileName: f.name, webUrl: f.webUrl, number: f.number, value: f.value, date: f.date }); };
  $$('[data-f]').forEach(function (b) { b.onclick = function () { pickF(+b.dataset.f); }; }); $$('[data-f2]').forEach(function (b) { b.onclick = function () { pickF(+b.dataset.f2); }; });
  var cf = $('#oConf'); if (cf) cf.onclick = function () { o.auto = false; setO(o); };
  var cl = $('#oClr'); if (cl) cl.onclick = function () { setO(null); };
  var rf = $('#reF'); if (rf) rf.onclick = function () { p.orderFiles = null; if (p.order && p.order.auto) p.order = null; W.busy = false; wOrder(p); };
  var at = $('#oAtt'); if (at) at.onclick = function () { pickFiles('application/pdf,image/*').then(function (fs) { if (!fs.length) return; var f = fs[0];
    var keep = (/^image\//.test(f.type) ? shrink(f, 2000, 0.85) : new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.readAsDataURL(f); }));
    keep.then(function (d) { var key = 'order-' + p.id; return IDB.put(key, d).then(function () { return key; }); }).then(function (key) {
      var rec = { attached: true, photo: key, fileName: f.name, number: '' };
      if (!spOn()) { setO(rec); return toast('Attached – it will be saved on SharePoint once it is connected'); }
      toast('Saving…'); return uploadOrder(p, f).then(function (it) { rec.uploaded = true; rec.webUrl = it.webUrl; rec.fileId = it.id; setO(rec); toast('Saved'); })
        .catch(function (e) { setO(rec); toast(e.message + ' – kept on this phone', true); }); }); }); };
  var must = isPO; /* a PO is needed; contract / offer / approval / visit can be skipped for now */
  var has = function () { var x = p.order || {}; return !!(x.fileName && !x.auto); };
  foot(p, 'Next', has() || !must, function () { if (!has() && p.order && p.order.auto) { p.order.auto = false; } if (!has() && !(p.order && p.order.fileName)) p.order = { skipped: true }; go(p, 'items'); }, must ? '' : '<button class="btn ghost" id="wSkip">Skip</button>');
  var sk = $('#wSkip'); if (sk) sk.onclick = function () { p.order = { skipped: true }; go(p, 'items'); };
  function okNext() { var b = $('#wn'); if (b) b.disabled = !(has() || !must); }
}

/* ---- auto-load last year's certificate for every new item ---- */
var AQ = { busy: false, q: [] };
function rngNums(t) { var m = tidy(t).match(/(-?\d+(?:\.\d+)?)\s*(?::|to|~)\s*(-?\d+(?:\.\d+)?)\s*\)?\s*([^\d\s()][^()]*)?$/i), mx = !m && tidy(t).match(/max\.?\s*(-?\d+(?:\.\d+)?)\s*(\S+)?/i);
  return m ? { lo: m[1], hi: m[2], u: unitKey((m[3] || '').trim()) } : mx ? { lo: '0', hi: mx[1], u: unitKey(mx[2] || '') } : null; }
function fillEmpty(it) { var f = (it.old || {}).fields || {}; if (!f) return;
  ['description', 'manufacturer', 'model', 'serial'].forEach(function (k) { if (!it[k] && f[k]) it[k] = f[k]; });
  var r = rngNums(f.range || ''), c = rngNums(f.calRange || ''); if (!r && c) r = c;
  if (r && !isNum(it.rMin) && !isNum(it.rMax)) { it.rMin = r.lo; it.rMax = r.hi; if (!it.unit && r.u) it.unit = r.u; }
  if (c && r && (c.lo !== r.lo || c.hi !== r.hi) && !isNum(it.cMin)) { it.cMin = c.lo; it.cMax = c.hi; }
  var rs = tidy(f.resolution || '').match(/(\d*\.?\d+)\s*(\S+)?/); if (rs && !isNum(it.res)) { it.res = rs[1]; it.resUnit = unitKey(rs[2] || it.unit || ''); }
  if (it.unit) it.unit = unitKey(it.unit); }
function queueOld(p) { if (!spOn()) return; p.items.forEach(function (it) { if ((!it.old || it.old.status === 'searching') && (it.code || it.prevCert) && AQ.q.indexOf(it) < 0) AQ.q.push(it); }); runQ(p); }
function runQ(p) { if (AQ.busy) return; var it = AQ.q.shift(); if (!it) return; AQ.busy = true; it.old = { status: 'searching' }; if (!sheetFn) render();
  findOldCert(p, it).catch(function (e) { return { status: 'error', note: e.message }; }).then(function (r) { it.old = r; if (r.status === 'found') fillEmpty(it); saveProjects(); AQ.busy = false; if (!sheetFn) render(); runQ(p); }); }

/* ---- 5. items: photo / Excel / unit or machine ---- */
var UNITS = ['°C', '°F', '%RH', 'bar', 'mbar', 'psi', 'kPa', 'MPa', 'Pa', 'inH2O', 'mmH2O', 'mmHg', 'g', 'mg', 'kg', 'rpm', 's', 'min', 'h', 'lux', 'm/s', 'm³/h', 'CFM', 'V', 'mV', 'A', 'mA', 'Ω', 'mm', 'µm', 'L', 'mL', 'µL', 'pH', 'µS/cm', '%'];
function newItem(o) { return Object.assign({ id: uid(), kind: 'unit', machineId: '', code: '', description: '', manufacturer: '', model: '', serial: '', rMin: '', rMax: '', unit: '', cMin: '', cMax: '', res: '', resUnit: '', dept: '', photo: '', ocr: '', src: 'form' }, o); }
var isNum = function (v) { return v !== '' && v != null && /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(String(v).trim().replace(',', '.')); };
var numv = function (v) { return parseFloat(String(v).trim().replace(',', '.')); };
function hasData(it) { return !!(it.description || it.code || it.rMin || it.rMax || it.res); }
function itemIssues(it) { /* empty list = complete */
  if (!hasData(it)) return it.photo ? ['Photo only – add the data later'] : ['No data'];
  var e = [];
  if (!String(it.description).trim()) e.push('Description');
  if (!isNum(it.rMin) || !isNum(it.rMax)) e.push('Range (numbers)'); else if (numv(it.rMin) >= numv(it.rMax)) e.push('Range: min must be less than max');
  if (!it.unit) e.push('Range unit');
  if (it.cMin !== '' || it.cMax !== '') { if (!isNum(it.cMin) || !isNum(it.cMax)) e.push('Calibration range (numbers)');
    else if (isNum(it.rMin) && isNum(it.rMax) && (numv(it.cMin) < numv(it.rMin) || numv(it.cMax) > numv(it.rMax) || numv(it.cMin) >= numv(it.cMax))) e.push('Calibration range must be inside the range'); }
  if (!isNum(it.res) || numv(it.res) <= 0) e.push('Resolution (number)');
  if (!(it.resUnit || it.unit)) e.push('Resolution unit');
  return e; }
function rangeText(it) { if (!isNum(it.rMin) || !isNum(it.rMax)) return ''; return '(' + it.rMin + ' : ' + it.rMax + ') ' + (it.unit || ''); }
function calText(it) { if (isNum(it.cMin) && isNum(it.cMax)) return '(' + it.cMin + ' : ' + it.cMax + ') ' + (it.unit || ''); return rangeText(it) ? 'Full range' : ''; }
function wItems(p) {
  p.items = p.items || []; p.machines = p.machines || []; setTimeout(function () { queueOld(p); }, 0);
  var loose = p.items.filter(function (i) { return !i.machineId; }), need = p.items.filter(function (i) { return itemIssues(i).length; }).length;
  var irow = function (it) { var iss = itemIssues(it); return '<button class="row" data-it="' + it.id + '">' + (it.photo ? '<img class="thumb" data-ph="' + it.photo + '" alt="">' : '') + '<span class="t"><b>' + esc(it.description || it.code || 'Photo') + '</b><small>' + esc([it.code && it.description ? it.code : '', rangeText(it), it.res && 'res ' + it.res + ' ' + (it.resUnit || it.unit)].filter(Boolean).join(' · ') || 'Tap to add the data') + '</small></span>' +
    (it.old && it.old.status === 'searching' ? '<span class="pill" style="--s-fg:var(--blue);--s-bg:var(--blue-soft)"><span class="spin dark" style="width:12px;height:12px;border-width:2px"></span> Last year…</span>'
      : it.old && it.old.status === 'found' ? '<span class="pill" style="--s-fg:var(--office);--s-bg:var(--office-soft)">' + ((it.old.file && it.old.file.year) || '') + ' cert ✓</span>'
      : it.old && (it.old.status === 'missing' || it.old.status === 'error') && (it.code || it.prevCert) ? '<span class="pill" style="--s-fg:var(--danger);--s-bg:var(--danger-soft)">No old cert</span>'
      : iss.length ? '<span class="pill" style="--s-fg:var(--service);--s-bg:var(--service-soft)">' + (hasData(it) ? 'Missing data' : 'Photo only') + '</span>' : '') + '</button>'; };
  $('#wm').innerHTML = '<div class="cats one" style="margin-bottom:8px"><button data-a="last">' + I.visit + '<b>Same as last year</b><small>Copy the items of the same month last year from the receipt letters, then edit</small></button></div><div class="cats">' +
    '<button data-a="find"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' + '<b>Find a code</b><small>Like Find in Excel – codes calibrated before</small></button>' +
    '<button data-a="photo">' + I.cam + '<b>Photo</b><small>Nameplates or a code list</small></button>' +
    '<button data-a="excel">' + I.xls + '<b>Excel</b><small>Fixed template</small></button>' +
    '<button data-a="add">' + I.plus.replace(/22/g, '28') + '<b>Add an item</b><small>Unit or machine, typed in</small></button></div>' +
    '<div class="sec"><h2>Items</h2><small>' + p.items.length + (need ? ' · ' + need + ' need data' : '') + '</small></div>' +
    (p.machines.map(function (m) { var its = p.items.filter(function (i) { return i.machineId === m.id; });
      return '<div class="mach"><div class="mach-h"><span class="kind m">Machine</span><b>' + esc(m.name) + (m.code ? ' · ' + esc(m.code) : '') + '</b><button class="btn ghost sm" data-m="' + m.id + '">Open</button></div>' + (its.length ? its.map(irow).join('') : '<div class="row"><span class="t"><small>No instruments yet</small></span></div>') + '</div>'; }).join('')) +
    (loose.length ? '<div class="list">' + loose.map(irow).join('') + '</div>' : (!p.machines.length ? '<div class="empty"><b>No items yet</b>Use one of the three ways above.</div>' : '')) +
    (need ? '<div class="small" style="margin-top:10px">Items with “Photo only” or “Missing data” can be completed later – before the readings.</div>' : '');
  $$('[data-ph]').forEach(function (im) { IDB.get(im.dataset.ph).then(function (d) { if (d) im.src = d; }); });
  $$('[data-a]').forEach(function (b) { b.onclick = function () { ({ find: function (pp) { if (!spOn()) return toast('SharePoint is not connected', true); findSheet(pp); }, photo: photoChoice, excel: excelSheet, add: addChoice, last: function (pp) { if (!spOn()) return toast('SharePoint is not connected', true); lastYearSheet(pp); } })[b.dataset.a](p); }; });
  $$('[data-it]').forEach(function (b) { b.onclick = function () { itemSheet(p, b.dataset.it); }; });
  $$('[data-m]').forEach(function (b) { b.onclick = function () { machineSheet(p, b.dataset.m); }; });
  foot(p, 'Next: Old certificates', p.items.length > 0, function () { p.stage = 'done'; p.tab = 'certs'; p.reached = Math.max(p.reached || 0, FIDX.certs); saveProjects(); render(); window.scrollTo(0, 0); });
}
function addChoice(p) {
  $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>What are you calibrating?</h3><p>Choose the type.</p><div class="cats one">' +
    '<button id="chU">' + I.unit + '<b>Unit</b><small>One instrument – e.g. a thermometer or a pressure gauge</small></button>' +
    '<button id="chM">' + I.mach + '<b>Machine</b><small>Has several instruments – e.g. an autoclave. You write the machine, then add what is under it.</small></button></div>' +
    '<div class="cf"><button class="btn ghost" id="chX">Cancel</button></div></div></div>';
  $('#chX').onclick = function () { $('#dlg-root').innerHTML = ''; };
  $('#chU').onclick = function () { $('#dlg-root').innerHTML = ''; itemSheet(p, null, newItem({ dept: p.depts[0] || '' })); };
  $('#chM').onclick = function () { $('#dlg-root').innerHTML = ''; machineSheet(p, null, { id: uid(), name: '', code: '', dept: p.depts[0] || '' }); };
}
function deptField(p, val, attr) { if (!p.depts.length) return '';
  return '<label class="f"><span>Department</span><div class="seg">' + p.depts.map(function (d) { return '<button ' + attr + '="' + esc(d) + '" class="' + (val === d ? 'on' : '') + '">' + esc(d) + '</button>'; }).join('') + '</div></label>'; }
function unitSelect(id, val, ph) { var known = UNITS.indexOf(val) >= 0 || !val;
  return '<select class="inp" id="' + id + '"><option value="">' + (ph || 'Unit') + '</option>' + UNITS.map(function (u) { return '<option' + (u === val ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '<option value="__other"' + (!known ? ' selected' : '') + '>Other…</option></select>' +
    (!known ? '<input class="inp" id="' + id + 'O" value="' + esc(val) + '" placeholder="Type the unit" style="margin-top:6px">' : ''); }
function itemSheet(p, id, fresh) {
  var it = fresh || p.items.filter(function (x) { return x.id === id; })[0]; if (!it) return; var isNew = !!fresh, tried = false;
  var m = it.machineId ? p.machines.filter(function (x) { return x.id === it.machineId; })[0] : null;
  openSheet(function () { var iss = tried ? itemIssues(it) : [], bad = function (k) { return iss.some(function (x) { return x.indexOf(k) === 0; }) ? ' bad' : ''; };
    var F = function (k, l, ph, cls, mode) { return '<label class="f"><span>' + l + '</span><input class="inp' + (cls || '') + '" data-k="' + k + '" value="' + esc(it[k]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + (mode ? ' inputmode="' + mode + '"' : '') + '></label>'; };
    return { title: isNew ? (m ? 'Add instrument' : 'Add a unit') : 'Item', body:
      (m ? '<div class="note">Under machine <b>' + esc(m.name) + '</b></div>' : '') +
      (it.photo ? '<img id="itImg" alt="" style="width:100%;border-radius:14px;margin-bottom:12px;background:#ddd;min-height:80px">' : '') +
      '<div class="cf" style="margin:0 0 14px"><button class="btn ghost" id="itPh">' + I.cam.replace(/28/g, '20') + (it.photo ? ' Change photo' : ' Photo of the nameplate') + '</button></div>' +
      (iss.length ? '<div class="note warnbox"><b>Missing:</b> ' + esc(iss.join(' · ')) + (it.photo ? '<br>Or save it as photo only and fill the data later.' : '') + '</div>' : '') +
      F('description', 'Description', 'e.g. Pressure gauge, Temperature sensor', bad('Description')) + F('code', 'Code', 'Equipment code on the sticker') +
      '<div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' + F('manufacturer', 'Manufacturer') + F('model', 'Model') + '</div>' + F('serial', 'Serial no.') +
      '<div class="sec" style="margin:4px 0 8px"><h2 style="font-size:16px">Range</h2><small>numbers + unit</small></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' + '<input class="inp' + bad('Range') + '" data-k="rMin" inputmode="decimal" placeholder="From" value="' + esc(it.rMin) + '"><input class="inp' + bad('Range') + '" data-k="rMax" inputmode="decimal" placeholder="To" value="' + esc(it.rMax) + '"><div>' + unitSelect('uSel', it.unit) + '</div></div>' +
      '<div class="sec" style="margin:14px 0 8px"><h2 style="font-size:16px">Calibration range</h2><small>empty = full range</small></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center">' + '<input class="inp' + bad('Calibration') + '" data-k="cMin" inputmode="decimal" placeholder="' + esc(it.rMin || 'From') + '" value="' + esc(it.cMin) + '"><input class="inp' + bad('Calibration') + '" data-k="cMax" inputmode="decimal" placeholder="' + esc(it.rMax || 'To') + '" value="' + esc(it.cMax) + '"><span class="small">' + esc(it.unit || '') + '</span></div>' +
      '<div class="sec" style="margin:14px 0 8px"><h2 style="font-size:16px">Resolution</h2><small>required</small></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' + '<input class="inp' + bad('Resolution (') + '" data-k="res" inputmode="decimal" placeholder="e.g. 0.1" value="' + esc(it.res) + '"><div>' + unitSelect('ruSel', it.resUnit || it.unit, 'Same unit') + '</div></div>' +
      '<div style="height:14px"></div>' + (m ? '' : deptField(p, it.dept, 'data-dp')) +
      '<label class="f"><span>Calibration date – only if different from the project (' + dmy((p.info || {}).cal) + ')</span><input class="inp" type="date" data-k="calDate" value="' + esc(it.calDate || '') + '"></label>',
      foot: (isNew ? '' : '<button class="btn danger" id="itDel">Delete</button>') + (it.photo && !hasData(it) ? '<button class="btn ghost" id="itPhOnly">Photo only</button>' : '') + '<button class="btn" id="itOk">' + (isNew ? 'Add' : 'Save') + '</button>',
      mount: function () {
        if (it.photo) IDB.get(it.photo).then(function (d) { var im = $('#itImg'); if (im && d) im.src = d; });
        $$('[data-k]').forEach(function (e) { e.oninput = function () { it[e.dataset.k] = e.value.trim(); }; });
        var us = function (sel, key) { var s = $('#' + sel); s.onchange = function () { if (s.value === '__other') { it[key] = ' '; renderSheet(); var o = $('#' + sel + 'O'); if (o) { o.value = ''; o.focus(); } } else { it[key] = s.value; if (key === 'unit' && !it.resUnit) {} renderSheet(); } };
          var o = $('#' + sel + 'O'); if (o) o.oninput = function () { it[key] = o.value.trim() || ' '; }; };
        us('uSel', 'unit'); us('ruSel', 'resUnit');
        $$('[data-dp]').forEach(function (b) { b.onclick = function () { it.dept = b.dataset.dp; renderSheet(); }; });
        $('#itPh').onclick = function () { pickFiles('image/*').then(function (fs) { if (!fs.length) return; shrink(fs[0], 1400, 0.8).then(function (d) { if (!d) return; it.photo = it.photo || 'it-' + it.id; IDB.put(it.photo, d).then(function () { if (isNew && p.items.indexOf(it) < 0) { /* keep it until saved */ } renderSheet(); }); }); }); };
        var del = $('#itDel'); if (del) del.onclick = function () { p.items = p.items.filter(function (x) { return x.id !== it.id; }); saveProjects(); back(); };
        var po = $('#itPhOnly'); if (po) po.onclick = function () { if (isNew) p.items.push(it); saveProjects(); back(); };
        $('#itOk').onclick = function () { it.unit = String(it.unit || '').trim(); it.resUnit = String(it.resUnit || '').trim();
          if (it.photo && !hasData(it)) { if (isNew) p.items.push(it); saveProjects(); return back(); }
          var e = itemIssues(it); if (e.length && !(isNew && it.code && !it.rMin && !it.res && spOn())) { tried = true; renderSheet(); return toast('Missing: ' + e[0], true); }
          if (isNew && it.code && e.length) { p.items.push(it); saveProjects(); back(); toast('Added – loading last year\'s certificate'); queueOld(p); return; }
          if (!it.resUnit) it.resUnit = it.unit; if (isNew) p.items.push(it); saveProjects(); back(); }; } }; });
  function backQ() {}
  function back() { if (m) machineSheet(p, m.id); else closeSheet(); }
}
function machineSheet(p, id, fresh) {
  var m = fresh || p.machines.filter(function (x) { return x.id === id; })[0]; if (!m) return; var isNew = !!fresh;
  openSheet(function () { var its = p.items.filter(function (i) { return i.machineId === m.id; });
    return { title: isNew ? 'Add a machine' : esc(m.name || 'Machine'), body:
      '<label class="f"><span>Machine</span><input class="inp" id="mn" value="' + esc(m.name) + '" placeholder="e.g. Autoclave Fedegari"></label>' +
      '<label class="f"><span>Machine code</span><input class="inp" id="mc" value="' + esc(m.code) + '"></label>' + deptField(p, m.dept, 'data-md') +
      '<div class="sec"><h2>Instruments under it</h2><small>' + its.length + '</small></div>' +
      (its.length ? '<div class="list">' + its.map(function (it) { return '<button class="row" data-mi="' + it.id + '"><span class="t"><b>' + esc(it.description || '(no description)') + '</b><small>' + esc([it.code, rangeText(it), it.res && 'res ' + it.res].filter(Boolean).join(' · ') || 'Tap to add the data') + '</small></span>' + (itemIssues(it).length ? '<span class="pill" style="--s-fg:var(--service);--s-bg:var(--service-soft)">' + (hasData(it) ? 'Missing data' : 'Photo only') + '</span>' : '') + '<small style="display:none">' + '</small></span></button>'; }).join('') + '</div>' : '<div class="empty">Add the gauges, sensors, timers… of this machine.</div>') +
      '<div class="cf"><button class="btn ghost" id="mAdd">' + I.plus + ' Add instrument</button></div>',
      foot: (isNew ? '' : '<button class="btn danger" id="mDel">Delete</button>') + '<button class="btn" id="mOk">Done</button>',
      mount: function () { $('#mn').oninput = function (e) { m.name = e.target.value; }; $('#mc').oninput = function (e) { m.code = e.target.value; };
        $$('[data-md]').forEach(function (b) { b.onclick = function () { m.dept = b.dataset.md; renderSheet(); }; });
        var ensure = function () { if (!m.name.trim()) { toast('Write the machine name first', true); return false; } if (isNew) { p.machines.push(m); isNew = false; } saveProjects(); return true; };
        $('#mAdd').onclick = function () { if (!ensure()) return; itemSheet(p, null, newItem({ machineId: m.id, dept: m.dept })); };
        $$('[data-mi]').forEach(function (b) { b.onclick = function () { itemSheet(p, b.dataset.mi); }; });
        var del = $('#mDel'); if (del) del.onclick = function () { dialog('Delete the machine?', 'Its instruments will be deleted too.', 'Delete').then(function (y) { if (!y) return; p.machines = p.machines.filter(function (x) { return x.id !== m.id; }); p.items = p.items.filter(function (i) { return i.machineId !== m.id; }); saveProjects(); closeSheet(); }); };
        $('#mOk').onclick = function () { if (!ensure()) return; closeSheet(); }; } }; }); }

/* photos: code list (read the codes) or nameplates (one item per photo) */
function photoChoice(p) {
  $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>What is in the photo?</h3><div class="cats one">' +
    '<button id="phL">' + I.doc + '<b>List of codes</b><small>A paper with the codes that were calibrated</small></button>' +
    '<button id="phN">' + I.cam + '<b>Nameplates</b><small>Photos of the instruments\' labels – one item per photo, many at once</small></button></div>' +
    '<div class="cf"><button class="btn ghost" id="phX">Cancel</button></div></div></div>';
  $('#phX').onclick = function () { $('#dlg-root').innerHTML = ''; };
  $('#phL').onclick = function () { $('#dlg-root').innerHTML = ''; pickFiles('image/*', true).then(function (fs) { if (fs.length) codesFromPhotos(p, fs); }); };
  $('#phN').onclick = function () { $('#dlg-root').innerHTML = ''; pickFiles('image/*', true).then(function (fs) { if (fs.length) nameplates(p, fs); }); };
}
var OCR = null;
function ocrText(dataUrl) {
  if (CL.on) return clOcr(dataUrl);
  var ready = window.Tesseract ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  return ready.then(function () { if (!OCR) OCR = Tesseract.createWorker('eng'); return OCR; }).then(function (w) { return w.recognize(dataUrl); }).then(function (r) { return r.data.text || ''; }); }
function codesFromPhotos(p, files) {
  var found = [], busy = true, errs = 0;
  openSheet(function () { return { title: 'Codes from the photo', body: busy ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Reading ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…</b>The first time takes a little longer.</div>'
      : (found.length ? '<div class="note">Check every code and fix what the phone misread. Untick what is not a code.</div><div class="list">' + found.map(function (c, i) { return '<div class="row' + (c.on ? ' sel' : '') + '"><button class="check" data-ck="' + i + '" style="' + (c.on ? 'background:var(--blue);border-color:var(--blue)' : '') + '">' + (c.on ? '✓' : '') + '</button><span class="t"><input class="inp" data-cv="' + i + '" value="' + esc(c.code) + '" style="height:42px"></span></div>'; }).join('') + '</div>'
        : '<div class="empty"><b>No codes found</b>' + (errs ? 'The reader did not load – check the internet.' : 'Try a clearer, straight photo.') + '</div>'),
    foot: !busy && found.length ? '<button class="btn" id="cAdd">Add ' + found.filter(function (c) { return c.on; }).length + ' items</button>' : '',
    mount: function () { $$('[data-ck]').forEach(function (b) { b.onclick = function () { found[+b.dataset.ck].on = !found[+b.dataset.ck].on; renderSheet(); }; });
      $$('[data-cv]').forEach(function (e) { e.oninput = function () { found[+e.dataset.cv].code = e.value; }; });
      var a = $('#cAdd'); if (a) a.onclick = function () { var have = {}; p.items.forEach(function (i) { have[norm(i.code)] = 1; }); var n = 0;
        found.forEach(function (c) { if (!c.on || !c.code.trim() || have[norm(c.code)]) return; have[norm(c.code)] = 1; p.items.push(newItem({ code: c.code.trim(), src: 'photo', check: true, dept: p.depts[0] || '' })); n++; });
        saveProjects(); closeSheet(); toast(n + ' items added – loading last year\'s certificates'); queueOld(p); }; } }; });
  var seq = Promise.resolve();
  files.forEach(function (f) { seq = seq.then(function () { return shrink(f, 2000, 0.9).then(ocrText).then(function (t) {
    t.split(/\n/).forEach(function (line) { line.split(/\s{2,}|\t|,|;|\|/).forEach(function (tok) { tok = tok.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
      if (tok.length >= 3 && tok.length <= 22 && /[0-9]/.test(tok) && /[A-Za-z]/.test(tok) && !found.some(function (x) { return norm(x.code) === norm(tok); })) found.push({ code: tok, on: true }); }); });
  }).catch(function () { errs++; }); }); });
  seq.then(function () { busy = false; if (sheetFn) renderSheet(); });
}
function nameplates(p, files) {
  var made = files.map(function (f) { var it = newItem({ src: 'nameplate', check: true, dept: p.depts[0] || '' }); it.photo = 'it-' + it.id; p.items.push(it); return { f: f, it: it }; });
  saveProjects(); render(); toast('Saving ' + files.length + ' photos…');
  var seq = Promise.resolve();
  made.forEach(function (x) { seq = seq.then(function () { return shrink(x.f, 1400, 0.8).then(function (d) { return IDB.put(x.it.photo, d).then(function () { return ocrText(d).catch(function () { return ''; }); }); })
    .then(function (t) { x.it.ocr = String(t || '').trim(); var mm = x.it.ocr.match(/(?:s\/?n|serial(?:\s*no)?)\s*[:.#]?\s*([A-Z0-9\-\/]{4,})/i); if (mm) x.it.serial = mm[1];
      var md = x.it.ocr.match(/model\s*[:.#]?\s*([A-Z0-9\-\/ ]{2,20})/i); if (md) x.it.model = md[1].trim(); saveProjects(); }); }); });
  seq.then(function () { if (p.stage === 'items' && !sheetFn) render(); toast('Photos saved – open each item to check the details'); });
}

/* Excel: fixed template (proposal – we can change the columns together) */
var XL_COLS = ['Type (Unit / Machine item)', 'Machine', 'Machine code', 'Code', 'Description', 'Manufacturer', 'Model', 'Serial no.', 'Range from', 'Range to', 'Unit', 'Cal. range from', 'Cal. range to', 'Resolution', 'Resolution unit', 'Department'];
function excelSheet(p) {
  openSheet(function () { return { title: 'Items from Excel', body:
    '<div class="note">1. Download the template. 2. One row per instrument. For a machine, write its name in <b>Machine</b> on every instrument under it. 3. Upload it here.</div>' +
    '<div class="box" style="margin-top:0"><h4>Rules</h4><div class="small">Range from / to and Resolution are <b>numbers</b>, with their unit. Leave Cal. range empty to use the full range. Rows with missing data are added as “Missing data” so you can finish them in the app.</div>' +
    '<div class="small" style="margin-top:8px">Columns: ' + XL_COLS.map(esc).join(' · ') + '</div></div>' +
    '<div class="cf"><button class="btn ghost" id="xT">Download template</button></div><div class="cf"><button class="btn" id="xU">Upload filled Excel</button></div><div id="xMsg" style="margin-top:12px"></div>',
    mount: function () { $('#xT').onclick = function () { xlTemplate(p); }; $('#xU').onclick = function () { pickFiles('.xlsx').then(function (fs) { if (fs.length) xlImport(p, fs[0]); }); }; } }; }); }
function needExcel() { return window.ExcelJS ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'); }
function xlTemplate(p) { needExcel().then(function () { var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Items', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(XL_COLS).eachCell(function (c) { c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13294B' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  var d0 = p.depts[0] || '';
  [['Unit', '', '', 'TH-05', 'Digital thermometer', 'Testo', '110', '45012', -50, 150, '°C', 0, 100, 0.1, '°C', d0],
   ['Machine item', 'Autoclave Fedegari', 'AC-01', 'AC-01-PG1', 'Pressure gauge', 'Wika', '', '', 0, 4, 'bar', '', '', 0.05, 'bar', d0],
   ['Machine item', 'Autoclave Fedegari', 'AC-01', 'AC-01-T1', 'Chamber temperature sensor', 'Fedegari', '', '', 0, 150, '°C', 100, 135, 0.1, '°C', d0]]
    .forEach(function (r) { ws.addRow(r).eachCell(function (c) { c.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF7D8796' } }; }); });
  var list = function (col, vals) { for (var r = 2; r <= 400; r++) ws.getCell(col + r).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + vals.join(',').replace(/"/g, '') + '"'] }; };
  var nums = function (col) { for (var r = 2; r <= 400; r++) ws.getCell(col + r).dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-1e9, 1e9], showErrorMessage: true, errorTitle: 'Number only', error: 'Type a number (the unit goes in its own column)' }; };
  list('A', ['Unit', 'Machine item']); list('K', UNITS); list('O', UNITS); if (p.depts.length) list('P', p.depts); ['I', 'J', 'L', 'M', 'N'].forEach(nums);
  [16, 22, 12, 14, 26, 14, 12, 12, 10, 10, 9, 12, 12, 11, 11, 14].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
  ws.addRow([]); ws.addRow(['(Grey rows are examples – delete them)']).getCell(1).font = { italic: true, color: { argb: 'FFB26F12' } };
  return wb.xlsx.writeBuffer(); }).then(function (buf) { dlBlob(buf, 'Items template - ' + (p.company ? p.company.name : 'project') + '.xlsx'); })
  .catch(function (e) { toast(e.message, true); }); }
function cellStr(v) { if (v == null) return ''; if (typeof v === 'object') { if (v.richText) return v.richText.map(function (t) { return t.text; }).join(''); if ('result' in v) return String(v.result == null ? '' : v.result); if (v.text) return v.text; } return String(v); }
function xlImport(p, file) { needExcel().then(function () { return file.arrayBuffer(); }).then(function (buf) { var wb = new ExcelJS.Workbook(); return wb.xlsx.load(buf).then(function () { return wb; }); }).then(function (wb) {
  var ws = wb.getWorksheet('Items') || wb.worksheets[0], hd = ws.getRow(1).values.map(function (v) { return cellStr(v).trim().toLowerCase(); });
  var col = function (re) { for (var i = 1; i < hd.length; i++) if (re.test(hd[i] || '')) return i; return -1; };
  var c = { mach: col(/^machine$/), mcode: col(/machine code/), code: col(/^code/), desc: col(/desc/), man: col(/manuf/), model: col(/model/), ser: col(/serial/), rMin: col(/^range from/), rMax: col(/^range to/), unit: col(/^unit$/), cMin: col(/cal.*from/), cMax: col(/cal.*to/), res: col(/^resolution$/), resUnit: col(/resolution unit/), dept: col(/dep/) };
  if (c.code < 0 && c.desc < 0) throw new Error('This is not the items template (no Code / Description column)');
  var get = function (row, k) { return c[k] > 0 ? cellStr(row.getCell(c[k]).value).trim() : ''; }, n = 0, skipped = 0, incomplete = 0, have = {};
  p.items.forEach(function (i) { if (i.code) have[norm(i.code)] = 1; });
  ws.eachRow(function (row, r) { if (r === 1) return; var code = get(row, 'code'), desc = get(row, 'desc'); if (!code && !desc) return;
    if (/^(TH-05|AC-01-PG1|AC-01-T1)$/.test(code) && row.getCell(c.code).font && row.getCell(c.code).font.italic) return; /* template examples */
    if (code && have[norm(code)]) { skipped++; return; } if (code) have[norm(code)] = 1;
    var mname = get(row, 'mach'), mid = '';
    if (mname) { var m = p.machines.filter(function (x) { return norm(x.name) === norm(mname); })[0]; if (!m) { m = { id: uid(), name: mname, code: get(row, 'mcode'), dept: get(row, 'dept') }; p.machines.push(m); } mid = m.id; }
    var it = newItem({ machineId: mid, kind: mid ? 'machine-item' : 'unit', code: code, description: desc, manufacturer: get(row, 'man'), model: get(row, 'model'), serial: get(row, 'ser'),
      rMin: get(row, 'rMin'), rMax: get(row, 'rMax'), unit: get(row, 'unit'), cMin: get(row, 'cMin'), cMax: get(row, 'cMax'), res: get(row, 'res'), resUnit: get(row, 'resUnit') || get(row, 'unit'), dept: get(row, 'dept') || p.depts[0] || '', src: 'excel' });
    if (itemIssues(it).length) incomplete++; p.items.push(it); n++; });
  saveProjects(); queueOld(p); $('#xMsg').innerHTML = '<div class="note okbox">' + n + ' items added' + (skipped ? ' · ' + skipped + ' duplicate codes skipped' : '') + '.</div>' + (incomplete ? '<div class="note amber">' + incomplete + ' of them have missing or wrong data (range, unit or resolution) – they are marked “Missing data”.</div>' : '');
}).catch(function (e) { var x = $('#xMsg'); if (x) x.innerHTML = '<div class="note warnbox">' + esc(e.message || e) + '</div>'; }); }

/* ================= project (after setup): Overview · Old certs · Readings · Details ================= */
var PT = { tab: 'over' };
var NAVI = {
  over: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  certs: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h4"/></svg>',
  read: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-3M12 5V3"/></svg>',
  gen: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/></svg>',
  det: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'
};
function ensureInfo(p) { p.info = p.info || { cal: '', wo: '', iss: '', rec: '', due: '', woPre: (String((p.company || {}).code || '').match(/^\d+/) || [''])[0], tech: '', techId: '', eT: '21', eH: '55', eLoc: 'On Site', refs: [], refRes: {} }; p.info.refRes = p.info.refRes || {}; return p.info; }
function renderOverview(p) {
  ensureInfo(p);
  if (!p.tab || p.tab === 'over') p.tab = 'certs'; PT.tab = p.tab;
  var titles = { certs: ['Old certificates', 'Last year\'s certificate of every item'], refs: ['References', 'A reference for every item'], det: ['Details', 'Technician, dates and conditions'], read: ['Readings', 'New readings next to last year\'s'], gen: ['Certificates', 'Covers, certificates and the receipt letter'] }[p.tab];
  $('#app').innerHTML = '<div class="shell" style="padding-bottom:110px">' + top(esc(titles[0]), esc(p.company.name + ' · ' + titles[1]), stepBar(p)) + '<main id="pm"></main></div>' + projFoot(p);
  bindStepBar(p); bindHome(); bindProjFoot(p);
  ({ certs: tCerts, refs: tRefs, read: tRead, det: tDet, gen: tGen })[p.tab](p);
}
function bindHome() { var h = $('#goHome'); if (h) h.onclick = function () { S.cur = null; render(); window.scrollTo(0, 0); }; }
function certCounts(p) { var c = { found: 0, similar: 0, missing: 0, todo: 0 }; p.items.forEach(function (it) { var s = (it.old || {}).status; if (s === 'found') c.found++; else if (s === 'similar') c.similar++; else if (s === 'missing' || s === 'error') c.missing++; else c.todo++; }); return c; }

/* ---- overview ---- */
function tOver(p) {
  var o = p.order || {}, inf = p.info, c = certCounts(p), pr = readProgress(p), warn = dateWarns(inf).concat(refWarns(p)).concat(refResWarn(p) ? [refResWarn(p) + ' chosen reference(s) without a resolution'] : []);
  var step = function (n, done, title, sub, btn, tab) { return '<div class="card"><div style="display:flex;gap:12px;align-items:center"><span style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-family:var(--cond);font-weight:700;font-size:18px;flex:none;' + (done ? 'background:var(--office);color:#fff' : 'background:var(--blue-soft);color:var(--navy)') + '">' + (done ? '✓' : n) + '</span><div style="flex:1;min-width:0"><h3>' + title + '</h3><div class="meta">' + sub + '</div></div></div><div class="cf"><button class="btn ' + (done ? 'ghost' : '') + '" data-go="' + tab + '">' + btn + '</button></div></div>'; };
  $('#pm').innerHTML = warn.map(function (w) { return '<div class="note warnbox">' + esc(w) + '</div>'; }).join('') +
    '<div class="card bar"><h3>Order</h3><dl class="kv" style="margin-top:8px"><dt>Type</dt><dd>' + esc(TYPES[p.orderType][0]) + '</dd>' + (o.number ? '<dt>Number</dt><dd>' + esc(o.number) + '</dd>' : '') +
      (o.fileName ? '<dt>File</dt><dd>' + (o.webUrl ? '<a href="' + esc(o.webUrl) + '" target="_blank" rel="noopener">' + esc(o.fileName) + '</a>' : esc(o.fileName)) + (o.attached && !o.uploaded ? ' · on this phone' : '') + '</dd>' : '') + (o.skipped ? '<dt>Document</dt><dd>Skipped for now</dd>' : '') +
      '<dt>Items</dt><dd>' + p.items.length + (p.machines.length ? ' · ' + p.machines.length + ' machines' : '') + '</dd></dl>' +
      '<div class="cf"><button class="btn ghost sm" data-g="company">Company</button><button class="btn ghost sm" data-g="dept">Department</button><button class="btn ghost sm" data-g="order">Order</button><button class="btn ghost sm" data-g="items">Items</button></div></div>' +
    '<div class="sec"><h2>Steps</h2></div>' +
    step(1, !!(inf.cal && inf.tech), 'Project details', inf.cal ? 'Calibration ' + dmy(inf.cal) + ' · ' + esc(inf.tech || 'no technician yet') : 'Dates, technician, references', 'Details', 'det') +
    step(2, p.items.length && !c.todo, 'Old certificates', (c.found + c.similar) + ' of ' + p.items.length + ' have last year\'s data', 'Old certificates', 'certs') +
    step(3, pr.tot && pr.fil === pr.tot, 'New readings', pr.tot ? pr.fil + ' of ' + pr.tot + ' points' + (pr.out ? ' · <span class="warn">' + pr.out + ' OUT</span>' : '') : 'After the old certificates', 'Readings', 'read') +
    step(4, false, 'Certificates', 'Covers, certificates and the receipt letter – Word and PDF', 'Certificates', 'gen') +
    '<div class="cf"><button class="btn ghost" id="home">All projects</button><button class="btn danger" id="delP">Delete project</button></div>';
  $$('[data-g]').forEach(function (b) { b.onclick = function () { go(p, b.dataset.g); }; });
  $$('[data-go]').forEach(function (b) { b.onclick = function () { PT.tab = b.dataset.go; render(); window.scrollTo(0, 0); }; });
  $('#home').onclick = function () { S.cur = null; PT.tab = 'over'; render(); };
  $('#delP').onclick = function () { dialog('Delete this project?', 'Only this project on this phone is deleted.', 'Delete').then(function (y) { if (!y) return; S.projects = S.projects.filter(function (x) { return x.id !== p.id; }); saveProjects(); S.cur = null; render(); }); };
}

/* ---- details: dates, technician, references, conditions ---- */
function d2s(d) { if (!d) return ''; var z = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
function s2d(s) { if (!s) return null; var a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
var isWork = function (d) { return d.getDay() <= 4; }; /* Sun–Thu */
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function prevWork(d) { var x = new Date(d); while (!isWork(x)) x = addDays(x, -1); return x; }
function addWork(d, n) { var x = new Date(d), c = 0; while (c < n) { x = addDays(x, 1); if (isWork(x)) c++; } return x; }
function dmy(s) { var d = s2d(s); if (!d) return '—'; var z = function (n) { return String(n).padStart(2, '0'); }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear(); }
function calcDates(inf) { var c = s2d(inf.cal); if (!c) return; inf.wo = d2s(prevWork(addDays(c, -7)));
  var iss = addWork(c, 3); if (iss.getMonth() !== c.getMonth()) { iss = prevWork(new Date(c.getFullYear(), c.getMonth() + 1, 0)); if (iss < c) iss = c; }
  inf.iss = d2s(iss); inf.rec = d2s(prevWork(addDays(iss, -7))); var du = new Date(c); du.setFullYear(du.getFullYear() + 1); inf.due = d2s(du); }
function woNo(inf) { return inf.wo ? (inf.woPre ? inf.woPre + '/' : '') + dmy(inf.wo) : ''; }
function dateWarns(inf) { var w = [], yr = new Date().getFullYear(), nm = { wo: 'Work order', iss: 'Date of issue', rec: 'Date received', cal: 'Calibration date' };
  ['wo', 'iss', 'rec', 'cal'].forEach(function (k) { var d = s2d(inf[k]); if (d && d.getFullYear() < yr) w.push(nm[k] + ' is from an old year (' + d.getFullYear() + ')'); if (d && !isWork(d) && k !== 'cal') w.push(nm[k] + ' is not a working day'); });
  var c = s2d(inf.cal), i = s2d(inf.iss); if (c && i && i.getMonth() !== c.getMonth()) w.push('Date of issue is not in the calibration month'); if (c && i && i < c) w.push('Date of issue is before the calibration date'); return w; }
function labDevices() { return ((S.data && S.data.devices) || []).filter(function (d) { return d.active !== false; }); }
function refExpired(d, inf) { if (!d.calDue) return null; return s2d(String(d.calDue).slice(0, 10)) < (s2d(inf.cal) || new Date()); }
function refWarns(p) { var inf = p.info, ds = labDevices(); return (inf.refs || []).map(function (id) { var d = ds.filter(function (x) { return x.id === id; })[0]; return d && refExpired(d, inf) ? 'Reference ' + d.manufacturer + ' ' + d.description + ' (S/N ' + d.serial + ') certificate expired on ' + dmy(String(d.calDue).slice(0, 10)) : ''; }).filter(Boolean); }
var UCAT = { '°C': ['Temperature', 'T', 1, 0], '°F': ['Temperature', 'T', 5 / 9, -32 * 5 / 9], '%RH': ['RH', 'RH', 1, 0], 'bar': ['Pressure', 'P', 1e5, 0], 'mbar': ['Pressure', 'P', 100, 0], 'psi': ['Pressure', 'P', 6894.757, 0], 'kPa': ['Pressure', 'P', 1e3, 0], 'MPa': ['Pressure', 'P', 1e6, 0], 'Pa': ['Pressure', 'P', 1, 0], 'inH2O': ['Pressure', 'P', 249.089, 0], 'mmH2O': ['Pressure', 'P', 9.80665, 0], 'mmHg': ['Pressure', 'P', 133.322, 0],
  'g': ['Weight', 'M', 1, 0], 'mg': ['Weight', 'M', 1e-3, 0], 'kg': ['Weight', 'M', 1e3, 0], 'rpm': ['RPM', 'R', 1, 0], 's': ['Timer', 'S', 1, 0], 'min': ['Timer', 'S', 60, 0], 'h': ['Timer', 'S', 3600, 0], 'lux': ['Light', 'L', 1, 0], 'm/s': ['HVAC', 'V', 1, 0], 'm³/h': ['HVAC', 'Q', 1, 0], 'CFM': ['HVAC', 'Q', 1.699, 0] };
function unitKey(u) { u = String(u || '').trim().replace(/^o\s*c$/i, '°C').replace(/^deg\.?\s*c$/i, '°C').replace(/^c$/i, '°C').replace(/^%\s*rh$/i, '%RH').replace(/^r\.?h\.?%?$/i, '%RH'); for (var k in UCAT) if (k.toLowerCase() === u.toLowerCase()) return k; return u; }
function toBase(v, u) { var c = UCAT[unitKey(u)]; return c ? v * c[2] + (c[3] || 0) : v; }
function devRange(d) { var t = String(d.range || '').replace(/amb\.?/i, '20').replace(/\s+/g, ' '), m = t.match(/\(?\s*(-?\d+(?:\.\d+)?)\s*(?::|to|~)\s*(-?\d+(?:\.\d+)?)\s*\)?\s*([^\d\s()][^()]*)?/i);
  if (!m) return null; var u = unitKey((m[3] || '').trim().split(/[\s,;&]/)[0]); return { lo: Math.min(+m[1], +m[2]), hi: Math.max(+m[1], +m[2]), unit: u }; }
function suggestRefs(p) { var out = {}; labDevices().forEach(function (d) { var r = devRange(d); if (!r || !UCAT[r.unit]) return;
    p.items.forEach(function (it) { var u = unitKey(it.unit); if (!UCAT[u] || UCAT[u][1] !== UCAT[r.unit][1]) return;
      var lo = isNum(it.cMin) ? numv(it.cMin) : (isNum(it.rMin) ? numv(it.rMin) : null), hi = isNum(it.cMax) ? numv(it.cMax) : (isNum(it.rMax) ? numv(it.rMax) : null); if (lo == null || hi == null) return;
      if (toBase(r.lo, r.unit) <= toBase(lo, u) + 1e-9 && toBase(r.hi, r.unit) >= toBase(hi, u) - 1e-9) (out[d.id] = out[d.id] || []).push(it.code || it.description); }); });
  return out; }
function refResWarn(p) { return (p.info.refs || []).filter(function (id) { return !isNum(p.info.refRes[id]); }).length; }
function tDet(p) {
  var inf = p.info, people = (S.people || []).filter(function (u) { return u.role === 'engineer' || u.role === 'admin'; }), ds = labDevices(), q = norm(PT.rq || '');
  var cats = {}; ds.forEach(function (d) { (cats[d.category || 'Other'] = cats[d.category || 'Other'] || []).push(d); });
  $('#pm').innerHTML = '<div class="sec" style="margin-top:4px"><h2>Calibrated by</h2></div><div class="chips">' + people.map(function (u) { return '<button class="chip' + (inf.techId === u.id ? ' on' : '') + '" data-tech="' + u.id + '">' + esc(u.name) + '</button>'; }).join('') + '</div>' +
    '<div class="sec"><h2>Dates</h2><button class="btn ghost sm" id="chD">Change</button></div><dl class="kv"><dt>Calibration</dt><dd>' + dmy(inf.cal) + '</dd><dt>Work order</dt><dd>' + esc(woNo(inf) || '—') + '</dd><dt>Date of issue</dt><dd>' + dmy(inf.iss) + '</dd><dt>Date received</dt><dd>' + dmy(inf.rec) + '</dd></dl>' +
    '<div class="sec"><h2>Environmental conditions</h2>' + (PT.envEdit ? '<small>editing</small>' : '<button class="btn ghost sm" id="envE">Edit</button>') + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px"><label class="f"><span>Temperature (°C)</span><input class="inp" inputmode="decimal" data-i="eT" value="' + esc(inf.eT) + '"' + (PT.envEdit ? '' : ' readonly') + '></label><label class="f"><span>Humidity (%RH)</span><input class="inp" inputmode="decimal" data-i="eH" value="' + esc(inf.eH) + '"' + (PT.envEdit ? '' : ' readonly') + '></label></div>' +
    '<label class="f"><span>Location</span><input class="inp" data-i="eLoc" value="' + esc(inf.eLoc) + '"></label>' +
    '';
  var cd = $('#chD'); if (cd) cd.onclick = function () { gotoStep(p, 'date'); };
  var ee = $('#envE'); if (ee) ee.onclick = function () { PT.envEdit = true; tDet(p); };
  $$('[data-tech]').forEach(function (b) { b.onclick = function () { var u = people.filter(function (x) { return x.id === b.dataset.tech; })[0]; inf.techId = u.id; inf.tech = u.name; saveProjects(); tDet(p); }; });
  $$('[data-i]').forEach(function (e) { e.oninput = function () { inf[e.dataset.i] = e.value; if (e.dataset.i === 'cal') { calcDates(inf); ['wo', 'iss', 'rec', 'due'].forEach(function (k) { $('[data-i="' + k + '"]').value = inf[k]; }); }
    saveProjects(); }; });
  var memo = LS.get('refRes', {});
  $$('[data-rr]').forEach(function (e) { e.onchange = function () { var v = e.value.trim(); if (!isNum(v)) { toast('Resolution must be a number', true); return; } inf.refRes[e.dataset.rr] = v; memo[e.dataset.rr] = v; LS.set('refRes', memo); saveProjects(); tDet(p); }; });
  $$('[data-rre]').forEach(function (b) { b.onclick = function () { var id = b.dataset.rre, was = inf.refRes[id];
    $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>Reference resolution</h3><p>Now: <b>' + esc(was) + '</b></p><input class="inp" id="rrv" inputmode="decimal" value="' + esc(was) + '"><div class="cf"><button class="btn ghost" id="rrc">Cancel</button><button class="btn" id="rrs">Save</button></div></div></div>';
    $('#rrc').onclick = function () { $('#dlg-root').innerHTML = ''; };
    $('#rrs').onclick = function () { var v = $('#rrv').value.trim(); $('#dlg-root').innerHTML = ''; if (!isNum(v)) return toast('Resolution must be a number', true); if (numv(v) === numv(was)) return;
      dialog('Are you sure?', 'The reference resolution changes from <b>' + esc(was) + '</b> to <b>' + esc(v) + '</b>.', 'Yes, I\'m sure').then(function (y) { if (!y) return; inf.refRes[id] = v; memo[id] = v; LS.set('refRes', memo); saveProjects(); tDet(p); }); }; }; });
  var rq = $('#rq'); if (rq) rq.oninput = function () { PT.rq = rq.value; var pos = rq.selectionStart; tDet(p); var n = $('#rq'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-ref]').forEach(function (b) { b.onclick = function () { var id = b.dataset.ref, a = inf.refs || (inf.refs = []), i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else { a.push(id); if (!inf.refRes[id] && LS.get('refRes', {})[id]) inf.refRes[id] = LS.get('refRes', {})[id]; var d = ds.filter(function (x) { return x.id === id; })[0]; if (d && refExpired(d, inf)) toast('This reference\'s certificate is expired!', true); } saveProjects(); tDet(p); }; });
}

/* ---- old certificates: find last year's certificate on SharePoint and read it ---- */
var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function needPdf() { return window.pdfjsLib ? Promise.resolve() : loadScript(PDFJS + 'pdf.min.js').then(function () { pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; }); }
function pdfPages(driveId, id) { /* SharePoint converts the Word file to PDF; we read its text line by line */
  if (CL.on) return clPages(id);
  if (useFiles()) return fcall('text', { id: id }).then(function (r) { return r.pages || []; });
  return Promise.all([needPdf(), msToken()]).then(function (r) { return fetch('https://graph.microsoft.com/v1.0/drives/' + driveId + '/items/' + id + '/content?format=pdf', { headers: { Authorization: 'Bearer ' + r[1] } }); })
    .then(function (res) { if (!res.ok) throw new Error('Could not open the file (' + res.status + ')'); return res.arrayBuffer(); })
    .then(function (buf) { return pdfjsLib.getDocument({ data: buf }).promise; })
    .then(function (doc) { var out = [], chain = Promise.resolve();
      for (var i = 1; i <= Math.min(doc.numPages, 150); i++) (function (n) { chain = chain.then(function () { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
        var rows = []; tc.items.forEach(function (t) { if (!t.str || !t.str.trim()) return; var x = t.transform[4], y = t.transform[5], row = rows.filter(function (r) { return Math.abs(r.y - y) < 3; })[0]; if (!row) { row = { y: y, it: [] }; rows.push(row); } row.it.push({ x: x, w: t.width, s: t.str }); });
        rows.sort(function (a, b) { return b.y - a.y; });
        out.push(rows.map(function (r) { r.it.sort(function (a, b) { return a.x - b.x; }); var s = '', end = null; r.it.forEach(function (t) { if (end != null) s += (t.x - end > 6 ? ' | ' : (t.x - end > 1 ? ' ' : '')); s += t.s; end = t.x + t.w; }); return s.replace(/\s+/g, ' ').trim(); })); }); }); })(i);
      return chain.then(function () { return out; }); }); }
var LABELS = ['Manufacturer', 'Calibration Date', 'Description', 'Calibration interval', 'Code', 'Calibration Due Date', 'Range', 'Environmental Condition', 'Temperature & Humidity', 'Cal. Range', 'Resolution', 'Procedure No.', 'Accepted Limits', 'Received status', 'Data Sheet Ref.', 'Delivered status', 'Model', 'Serial No.', 'Serial', 'Location', 'Type', 'Accuracy'];
function tidy(s) { return String(s || '').replace(/\*+/g, '').replace(/^[\s:|]+|[\s:|]+$/g, '').replace(/\s*\|\s*/g, ' ').replace(/(\d)\s+(\d)/g, '$1$2').replace(/-\s+(\d)/g, '-$1').replace(/(\d)\s+\.\s*(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim(); }
function parseFields(text) { /* "Data of item" table → fields */
  var t = text.replace(/\s+/g, ' '), found = [];
  LABELS.forEach(function (l) { var re = new RegExp('(^|[\\s|])' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*') + '(?=[\\s|:*])', 'gi'), m; while ((m = re.exec(t))) found.push({ l: l, i: m.index + m[1].length, e: m.index + m[0].length }); });
  found.sort(function (a, b) { return a.i - b.i || b.e - a.e; }); var f = {};
  found = found.filter(function (x, k) { return !found.some(function (y, j) { return j !== k && y.i <= x.i && y.e >= x.e && (y.e - y.i) > (x.e - x.i); }); });
  found.forEach(function (x, k) { var nx = found[k + 1]; var v = tidy(t.slice(x.e, nx ? nx.i : x.e + 80)); var key = x.l.toLowerCase(); if (!(key in f) && v && v.length < 120) f[key] = v; });
  var cn = t.match(/CERTI\s*FICATE\s*NO\.?\s*:?\s*([0-9A-Z][0-9A-Z \/\-]{2,30}?\d{4})/i);
  return { certNo: cn ? tidy(cn[1]).replace(/\s/g, '') : '', manufacturer: f.manufacturer || '', description: f.description || '', code: f.code || '', range: f.range || '', calRange: f['cal. range'] || '', resolution: f.resolution || '', limits: f['accepted limits'] || '', calDate: f['calibration date'] || '', dataSheetRef: f['data sheet ref.'] || '', model: f.model || '', serial: f['serial no.'] || f.serial || '', procedure: f['procedure no.'] || '' }; }
var NUM = /^[-+±]?\d+(?:\.\d+)?$/;
function parseResults(lines) { /* rows of numbers after the results header → points */
  var start = lines.findIndex(function (l) { return /result|reading|deviation|standard|nominal|set ?point|load/i.test(l) && !/data of item/i.test(l); }); if (start < 0) return { points: [], dirs: 1 };
  var head = lines.slice(start, start + 4).join(' '), dirs = /ascend|descend|\bup\b.*\bdown\b/i.test(head) || (head.match(/reading/gi) || []).length >= 2 ? 2 : 1, pts = [];
  for (var i = start + 1; i < lines.length; i++) { var l = lines[i]; if (/not be duplicated|remarks|calibrated by|repeatab|eccentric|uncertainty|page \d/i.test(l)) break;
    var toks = l.replace(/±\s*/g, '±').replace(/-\s+(\d)/g, '-$1').split(/[|\s]+/).filter(Boolean), nums = toks.filter(function (x) { return NUM.test(x); }); if (nums.length < 2) continue;
    var lim = nums.filter(function (x) { return x[0] === '±'; }).pop() || ''; var v = nums.filter(function (x) { return x[0] !== '±'; });
    var pt = { point: v[0], ref: v[0], reading: v[1] || '', deviation: v[2] || '', reading2: dirs === 2 ? (v[3] || '') : '', deviation2: dirs === 2 ? (v[4] || '') : '', limit: lim };
    if (dirs === 1 && v.length >= 4) { pt.ref = v[1]; pt.reading = v[2]; pt.deviation = v[3]; } /* point | standard | UUT | deviation */
    pts.push(pt); }
  return { points: pts, dirs: dirs }; }
function certSection(pages, code) { var nc = norm(code), at = -1;
  for (var i = 0; i < pages.length; i++) { var j = norm(pages[i].join(' ')); if (j.indexOf(nc) >= 0 && /dataofitem/.test(j)) { at = i; break; } }
  if (at < 0) for (var k = 0; k < pages.length; k++) if (norm(pages[k].join(' ')).indexOf(nc) >= 0) { at = k; break; }
  if (at < 0) return null; var sec = [pages[at]];
  for (var n = at + 1; n < pages.length && sec.length < 5; n++) { var t = pages[n].join(' '); if (/data\s*of\s*item/i.test(t)) break; if (/continue/i.test(t)) sec.push(pages[n]); else break; }
  return sec; }
var yearOf = function (f) { var m = pathOf(f).match(/Cert\s*(20\d\d)/i) || f.name.match(/-(20\d\d)/); return m ? +m[1] : 0; };
function readSec(sec, hint) { if (CL.on) return clExtract(sec, hint);
  var rs = parseResults([].concat.apply([], sec)); return Promise.resolve({ fields: parseFields(sec.map(function (pg) { return pg.join(' | '); }).join(' | ')), points: rs.points, dirs: rs.dirs }); }
function findOldCert(p, it) {
  var key = it.code || it.prevCert; if (!key) return Promise.resolve({ status: 'missing', note: 'No code – use a similar device' });
  var mine = (p.deptSug && p.deptSug.certFolders) || [];
  return spSearch('"' + (it.prevCert || it.code) + '"', 30).then(function (fs) {
    fs = fs.filter(function (f) { return /cal\.?\s*cert/i.test(f.name) && !/cover/i.test(f.name) && /\.(docx?|pdf)$/i.test(f.name); });
    fs.forEach(function (f) { f.yr = yearOf(f); f.mine = mine.some(function (m) { return pathOf(f).indexOf(m) >= 0; }) ? 1 : 0; });
    fs.sort(function (a, b) { return b.mine - a.mine || b.yr - a.yr || String(b.mod).localeCompare(String(a.mod)); });
    if (!fs.length) return { status: 'missing', note: 'No certificate with this code on SharePoint' };
    var tryN = function (k) { if (k >= Math.min(3, fs.length)) return { status: 'missing', note: 'Files found, but the code is not clearly inside them', files: fs.slice(0, 6).map(fileRef) };
      var f = fs[k]; return pdfPages(f.driveId, f.id).then(function (pages) { var sec = (it.prevCert && certSection(pages, it.prevCert)) || (it.code && certSection(pages, it.code)); if (!sec) return tryN(k + 1);
        return readSec(sec, 'The certificate is for equipment code "' + it.code + '".').then(function (x) { return { status: 'found', file: fileRef(f), fields: x.fields, points: x.points, dirs: x.dirs, files: fs.slice(0, 6).map(fileRef), at: Date.now() }; }); }); };
    return tryN(0); }); }
function fileRef(f) { return { id: f.id, driveId: f.driveId, name: f.name, webUrl: f.webUrl, year: f.yr || yearOf(f), folder: pathOf(f).replace(/^.*\/Certificates\//i, '').split('/').slice(0, 2).join(' / ') }; }
function findSimilar(p, it) { var q = [it.description, it.manufacturer, it.model].filter(Boolean).join(' ');
  if (!q) return Promise.reject(new Error('Write the description first'));
  return spSearch(q, 30).then(function (fs) { return fs.filter(function (f) { return /cal\.?\s*cert/i.test(f.name) && !/cover/i.test(f.name); }).slice(0, 6).map(function (f) { var r = fileRef(f); r.snip = f.summary; return r; }); }); }
var CRUN = { on: false, stop: false, d: 0, n: 0 };
function runCerts(p, only) { if (CRUN.on) return; if (!spOn()) return toast('Connect SharePoint first (home screen)', true);
  var list = only ? [only] : p.items.filter(function (i) { return !i.old || i.old.status === 'error'; }); if (!list.length) return toast('All items were searched');
  CRUN = { on: true, stop: false, d: 0, n: list.length }; render(); var i = 0;
  var next = function () { if (CRUN.stop || i >= list.length) { CRUN.on = false; saveProjects(); render(); toast(CRUN.stop ? 'Stopped' : 'Search finished'); return; }
    var it = list[i++]; it.old = { status: 'searching' }; if (!sheetFn) render();
    findOldCert(p, it).catch(function (e) { return { status: 'error', note: e.message }; }).then(function (r) { it.old = r; CRUN.d++; saveProjects(); if (!sheetFn) render(); next(); }); };
  next(); }
var OST = { found: ['Found', 'var(--office)', 'var(--office-soft)'], similar: ['Similar', 'var(--pending)', 'var(--pending-soft)'], missing: ['Missing', 'var(--danger)', 'var(--danger-soft)'], error: ['Error', 'var(--danger)', 'var(--danger-soft)'], searching: ['Searching…', 'var(--blue)', 'var(--blue-soft)'] };
function opill(it) { var s = OST[(it.old || {}).status] || ['To search', 'var(--oos)', 'var(--oos-soft)']; return '<span class="pill" style="--s-fg:' + s[1] + ';--s-bg:' + s[2] + '">' + s[0] + '</span>'; }
function tCerts(p) {
  $('#pm').innerHTML = (!spOn() ? '<div class="note warnbox">SharePoint is not connected – connect it on the home screen to find the old certificates.</div>' : '') +
    (CRUN.on ? '<div class="card"><div style="display:flex;gap:10px;align-items:center"><span class="spin dark"></span><b style="flex:1">Searching SharePoint… ' + CRUN.d + ' of ' + CRUN.n + '</b><button class="btn ghost sm" id="cStop">Stop</button></div></div>' : '') +
    '<div class="list">' + p.items.map(function (it) { var o = it.old || {}, f = o.fields || {};
      return '<button class="row" data-oc="' + it.id + '"><span class="t"><b>' + esc(it.code || '(no code)') + ' · ' + esc(it.description || f.description || '') + '</b><small>' + esc(o.status === 'found' || o.status === 'similar' ? [f.certNo, o.file && o.file.folder, (o.points || []).length + ((o.points || []).length === 1 ? ' point' : ' points')].filter(Boolean).join(' · ') : (o.note || '')) + '</small></span>' + (o.status === 'searching' ? '<span class="spin dark"></span>' : opill(it)) + '</button>'; }).join('') + '</div>' +
    (!CRUN.on && spOn() && p.items.some(function (i) { return !i.old || i.old.status === 'error'; }) ? '' : '');
  var st = $('#cStop'); if (st) st.onclick = function () { CRUN.stop = true; };
  $$('[data-oc]').forEach(function (b) { b.onclick = function () { oldSheet(p, b.dataset.oc); }; });
  var fab = document.createElement('button'); fab.className = 'btn fab'; fab.innerHTML = I.search + ' Search SharePoint'; fab.style.bottom = '96px';
  if (!CRUN.on && p.items.some(function (i) { return !i.old || i.old.status === 'error'; })) { fab.onclick = function () { runCerts(p); }; $('#app').appendChild(fab); }
}
function oldSheet(p, id) { var it = p.items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
  openSheet(function () { var o = it.old || {}, f = o.fields || {}, pts = o.points || [];
    var kv = [['Old cert no.', f.certNo], ['Manufacturer', f.manufacturer], ['Description', f.description], ['Model', f.model], ['Serial', f.serial], ['Range', f.range], ['Cal. range', f.calRange], ['Resolution', f.resolution], ['Accepted limits', f.limits], ['Calibration date', f.calDate], ['Data sheet ref.', f.dataSheetRef]].filter(function (x) { return x[1]; });
    return { title: esc(it.code || it.description || 'Item'), body:
      '<div class="hero"><h3 style="margin-top:0">' + esc(it.description || f.description || '—') + '</h3><div class="sub">' + opill(it) + '</div>' + (o.note ? '<div class="small" style="margin-top:8px">' + esc(o.note) + '</div>' : '') + '</div>' +
      (o.status === 'similar' ? '<div class="note" style="margin-top:12px;background:var(--pending-soft);color:var(--pending)">Old readings are from a <b>similar device</b>: ' + esc(f.certNo || o.file.name) + ' – ' + esc(o.file.folder) + '</div>' : '') +
      (kv.length ? '<div class="box"><h4>Last year\'s certificate</h4><dl class="kv">' + kv.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' + (o.file && o.file.webUrl ? '<div class="cf"><a class="btn ghost" href="' + esc(o.file.webUrl) + '" target="_blank" rel="noopener">Open the Word file</a></div>' : '') + '</div>' : '') +
      (pts.length ? '<div class="box"><h4>Readings (' + pts.length + ' points)</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">' +
        '<tr>' + ['Point', 'Ref', 'Reading', 'Dev'].concat(o.dirs === 2 ? ['Reading ↓', 'Dev ↓'] : []).concat(['Limit']).map(function (x) { return '<th style="text-align:center;padding:6px;border-bottom:1px solid var(--line);color:var(--muted);font-size:12px">' + x + '</th>'; }).join('') + '</tr>' +
        pts.map(function (q, i) { return '<tr>' + ['point', 'ref', 'reading', 'deviation'].concat(o.dirs === 2 ? ['reading2', 'deviation2'] : []).concat(['limit']).map(function (k) { return '<td style="padding:2px;border-bottom:1px solid var(--line)"><input class="inp" data-pt="' + i + '|' + k + '" value="' + esc(q[k]) + '" style="height:36px;text-align:center;padding:0 4px;min-width:64px"></td>'; }).join('') + '</tr>'; }).join('') + '</table></div>' +
        '<div class="small" style="margin-top:8px">Read automatically from the Word file – check them against the file and fix anything wrong.</div></div>' : '') +
      (o.status === 'found' || o.status === 'similar' ? fillFromOld(it) : '') +
      (o.status === 'missing' || o.status === 'error' || o.status === 'similar' ? '<div class="box"><h4>Use a similar device</h4><button class="btn wide" id="simB">' + (it.simBusy ? '<span class="spin"></span> Searching…' : 'Suggest a similar device') + '</button>' +
        (it.simList ? (it.simList.length ? '<div class="list" style="margin-top:12px">' + it.simList.map(function (s, i) { return '<button class="row" data-sim="' + i + '"><span class="t"><b>' + esc(s.name) + '</b><small>' + esc(s.folder) + '</small><small>' + esc(s.snip || '') + '</small></span></button>'; }).join('') + '</div>' : '<div class="small" style="margin-top:8px">Nothing similar found.</div>') : '') + '</div>' : '') +
      (o.files && o.files.length > 1 ? '<details class="box"><summary>Other files with this code (' + o.files.length + ')</summary><div class="list" style="margin-top:10px">' + o.files.map(function (x, i) { return '<button class="row" data-use="' + i + '"><span class="t"><b>' + esc(x.name) + '</b><small>' + esc(x.folder) + '</small></span></button>'; }).join('') + '</div></details>' : ''),
      foot: '<button class="btn ghost" id="again">Search again</button><button class="btn" id="okS">Done</button>',
      mount: function () { $('#okS').onclick = function () { saveProjects(); closeSheet(); }; $('#again').onclick = function () { closeSheet(); runCerts(p, it); };
        $$('[data-pt]').forEach(function (e) { e.oninput = function () { var a = e.dataset.pt.split('|'); pts[+a[0]][a[1]] = e.value.trim(); saveProjects(); }; });
        var fb = $('#fillB'); if (fb) fb.onclick = function () { applyOld(it); };
        var sb = $('#simB'); if (sb) sb.onclick = function () { it.simBusy = true; renderSheet(); findSimilar(p, it).then(function (l) { it.simList = l; }).catch(function (e) { toast(e.message, true); }).then(function () { it.simBusy = false; renderSheet(); }); };
        $$('[data-sim]').forEach(function (b) { b.onclick = function () { var s = it.simList[+b.dataset.sim];
          dialog('Compare with this one?', 'Last year\'s readings for <b>' + esc(it.code || it.description) + '</b> will come from<br><b>' + esc(s.name) + '</b><br>' + esc(s.folder), 'Yes, use it').then(function (y) { if (!y) return;
            pdfPages(s.driveId, s.id).then(function (pages) { var toks = String(it.description + ' ' + it.manufacturer).toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; }), best = 0, bs = -1;
              pages.forEach(function (pg, i) { var t = pg.join(' ').toLowerCase(); if (!/data\s*of\s*item/.test(t)) return; var sc = toks.reduce(function (a, w) { return a + (t.indexOf(w) >= 0 ? 1 : 0); }, 0); if (sc > bs) { bs = sc; best = i; } });
              var sec = [pages[best]]; for (var n = best + 1; n < pages.length && sec.length < 5 && /continue/i.test(pages[n].join(' ')); n++) sec.push(pages[n]);
              return readSec(sec, 'Use the certificate whose description best matches "' + it.description + ' ' + it.manufacturer + '".').then(function (x) { it.old = { status: 'similar', file: s, fields: x.fields, points: x.points, dirs: x.dirs, at: Date.now() }; saveProjects(); renderSheet(); }); })
              .catch(function (e) { toast(e.message, true); }); }); }; });
        $$('[data-use]').forEach(function (b) { b.onclick = function () { var x = o.files[+b.dataset.use]; pdfPages(x.driveId, x.id).then(function (pages) { var sec = certSection(pages, it.code); if (!sec) return toast('The code is not inside this file', true);
          return readSec(sec, 'The certificate is for equipment code "' + it.code + '".').then(function (r2) { it.old = { status: 'found', file: x, files: o.files, fields: r2.fields, points: r2.points, dirs: r2.dirs, at: Date.now() }; saveProjects(); renderSheet(); }); }).catch(function (e) { toast(e.message, true); }); }; }); } }; }); }
/* fill the item's missing range / resolution from the old certificate */
function oldNums(f) { var rg = tidy(f.calRange || f.range).match(/(-?\d+(?:\.\d+)?)\s*(?::|to|~|-)\s*(-?\d+(?:\.\d+)?)\s*\)?\s*([^\d\s()][^()]*)?$/i), mx = !rg && tidy(f.range).match(/max\.?\s*(-?\d+(?:\.\d+)?)\s*(\S+)?/i), rs = tidy(f.resolution).match(/(\d*\.?\d+)\s*(\S+)?/);
  return { rMin: rg ? rg[1] : (mx ? '0' : ''), rMax: rg ? rg[2] : (mx ? mx[1] : ''), unit: rg && rg[3] ? rg[3].trim() : (mx && mx[2] ? mx[2] : ''), res: rs ? rs[1] : '', resUnit: rs && rs[2] ? rs[2] : '' }; }
function fillFromOld(it) { var n = oldNums((it.old || {}).fields || {}), diff = [];
  if (n.rMin && (it.rMin !== n.rMin || it.rMax !== n.rMax)) diff.push('Range ' + n.rMin + ' : ' + n.rMax + ' ' + n.unit); if (n.res && it.res !== n.res) diff.push('Resolution ' + n.res + ' ' + n.resUnit);
  if (!diff.length) return ''; return '<div class="box"><h4>Use last year\'s data for this item?</h4><div class="small">' + esc(diff.join(' · ')) + (hasData(it) ? '<br>Your item has: ' + esc([rangeText(it), it.res && 'res ' + it.res + ' ' + (it.resUnit || it.unit)].filter(Boolean).join(' · ') || '—') : '') + '</div><div class="cf"><button class="btn" id="fillB">Use it</button></div></div>'; }
function applyOld(it) { var n = oldNums(it.old.fields || {}), was = hasData(it) && (it.rMin || it.res);
  var doIt = function () { if (n.rMin) { it.rMin = n.rMin; it.rMax = n.rMax; if (n.unit) it.unit = n.unit; } if (n.res) { it.res = n.res; it.resUnit = n.resUnit || it.unit; } var f = it.old.fields; if (!it.description) it.description = f.description; if (!it.manufacturer) it.manufacturer = f.manufacturer; if (!it.model) it.model = f.model; if (!it.serial) it.serial = f.serial; saveProjects(); renderSheet(); toast('Item updated from last year'); };
  if (!was) return doIt(); dialog('Are you sure?', 'This changes the item\'s range / resolution to last year\'s values.', 'Yes, I\'m sure').then(function (y) { if (y) doIt(); }); }

/* ---- readings ---- */
function decOf(s) { var c = String(s == null ? '' : s).replace(',', '.').match(/-?\d*\.?\d+/); if (!c) return 0; var q = c[0].split('.'); return q[1] ? q[1].length : 0; }
function limitVal(lim, ref, rd) { var l = String(lim || '').replace(/\s+/g, ''); if (!l) return null; var pm = l.match(/(\d*\.?\d+)%/); if (pm) return parseFloat(pm[1]) / 100 * Math.abs(/rdg|reading/i.test(lim) ? (rd != null ? rd : ref) : (ref != null ? ref : rd)); var m = l.match(/(\d*\.?\d+)/); return m ? parseFloat(m[1]) : null; }
function ptLimit(it, q) { return q.limit || ((it.old || {}).fields || {}).limits || ''; }
function resDec(it) { return isNum(it.res) ? decOf(it.res) : (it.old && it.old.fields && it.old.fields.resolution ? decOf(it.old.fields.resolution) : null); }
function evalPt(it, i, dir) { var q = it.old.points[i], v = (it.nv || {})[i + (dir === 2 ? 'd' : '')] || {}, d = resDec(it);
  var ref = isNum(v.ref) ? numv(v.ref) : null, rd = isNum(v.reading) ? numv(v.reading) : null, o = { ref: ref, rd: rd, dev: null, lim: null, res: '', warn: [] };
  if (ref == null || rd == null) return o; o.dev = +(rd - ref).toFixed(Math.max(d == null ? 6 : d, decOf(v.ref), decOf(v.reading))); o.lim = limitVal(ptLimit(it, q), ref, rd);
  if (o.lim != null) o.res = Math.abs(o.dev) <= o.lim + 1e-12 ? 'OK' : 'OUT';
  if (d != null && decOf(v.reading) !== d) o.warn.push('Reading should have ' + d + ' decimal' + (d === 1 ? '' : 's') + ' (resolution ' + (it.res || it.old.fields.resolution) + ')');
  var lo = isNum(it.cMin) ? numv(it.cMin) : (isNum(it.rMin) ? numv(it.rMin) : null), hi = isNum(it.cMax) ? numv(it.cMax) : (isNum(it.rMax) ? numv(it.rMax) : null);
  if (lo != null && hi != null && (ref < lo - 1e-9 || ref > hi + 1e-9)) o.warn.push('Point is outside the calibration range (' + lo + ' : ' + hi + ')');
  return o; }
function withPts(p) { return p.items.filter(function (it) { return it.old && (it.old.points || []).length; }); }
function itemProg(it) { var t = 0, f = 0, out = 0; it.old.points.forEach(function (q, i) { [1].concat(it.old.dirs === 2 ? [2] : []).forEach(function (dr) { t++; var r = evalPt(it, i, dr); if (r.rd != null && r.ref != null) f++; if (r.res === 'OUT') out++; }); }); return { tot: t, fil: f, out: out }; }
function readProgress(p) { var a = { tot: 0, fil: 0, out: 0 }; withPts(p).forEach(function (it) { var x = itemProg(it); a.tot += x.tot; a.fil += x.fil; a.out += x.out; }); return a; }
function tRead(p) { var L = withPts(p), pr = readProgress(p);
  $('#pm').innerHTML = '<div class="cf" style="margin-top:0"><button class="btn ghost" id="xd">Download Excel</button><button class="btn ghost" id="xu">Upload Excel</button></div>' +
    '<div class="small" style="margin:8px 2px 0">The Excel has last year\'s readings filled in – fill the yellow cells and upload it back. Or enter them here.</div><div id="upMsg" style="margin-top:12px"></div>' +
    (pr.out ? '<div class="note warnbox"><b>' + pr.out + ' points OUT.</b> Their certificates will use last year\'s readings as placeholders until re-measured, and must be replaced before going to the customer. <a href="#" id="outR" style="color:inherit;font-weight:700">See the report</a></div>' : '') +
    '<div class="sec"><h2>Items</h2><small>' + L.length + '</small></div>' +
    (L.length ? '<div class="list">' + L.map(function (it) { var x = itemProg(it); return '<button class="row" data-r="' + it.id + '"><span class="t"><b>' + esc((it.code ? it.code + ' · ' : '') + (it.description || it.old.fields.description)) + '</b><small>Resolution ' + esc((it.res ? it.res + ' ' + (it.resUnit || it.unit) : it.old.fields.resolution) || '—') + ' · ' + x.tot + ' points</small></span>' +
      (x.out ? '<span class="pill" style="--s-fg:var(--danger);--s-bg:var(--danger-soft)">' + x.out + ' OUT</span>' : x.fil === x.tot ? '<span class="pill">Done</span>' : '<span class="pill" style="--s-fg:var(--muted);--s-bg:var(--oos-soft)">' + x.fil + '/' + x.tot + '</span>') + '</button>'; }).join('') + '</div>'
      : '<div class="empty"><b>No items with old readings yet</b>Find the old certificates first.</div>');
  $('#xd').onclick = function () { xlReadings(p); }; $('#xu').onclick = function () { pickFiles('.xlsx').then(function (fs) { if (fs.length) xlReadUp(p, fs[0]); }); };
  var o = $('#outR'); if (o) o.onclick = function (e) { e.preventDefault(); outSheet(p); };
  $$('[data-r]').forEach(function (b) { b.onclick = function () { readSheet(p, b.dataset.r); }; }); }
function readSheet(p, id) { var it = p.items.filter(function (x) { return x.id === id; })[0]; it.nv = it.nv || {};
  openSheet(function () { var o = it.old, f = o.fields || {}, d = resDec(it);
    var card = function (q, i, dr) { var k = i + (dr === 2 ? 'd' : ''), v = it.nv[k] || {}, oldR = dr === 2 ? q.reading2 : q.reading, oldD = dr === 2 ? q.deviation2 : q.deviation;
      return '<div class="box" data-pt="' + i + '|' + dr + '" style="margin-top:8px;padding:10px 12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-family:var(--cond);font-size:18px;color:var(--navy)">' + esc(q.point) + (o.dirs === 2 ? (dr === 2 ? ' ↓' : ' ↑') : '') + '</b><small class="small">Limit ' + esc(ptLimit(it, q) || '—') + '</small><b data-rs style="font-family:var(--cond)"></b></div>' +
        '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:6px 8px;align-items:center;font-size:14px"><span></span><span class="small" style="text-align:center;font-weight:600">LAST YEAR</span><span class="small" style="text-align:center;font-weight:600">NEW</span>' +
        '<span class="small">Ref</span><span style="background:var(--oos-soft);border-radius:8px;padding:9px;text-align:center;font-family:var(--cond);font-size:17px">' + esc(q.ref || '—') + '</span><input class="inp" inputmode="decimal" data-k="ref" value="' + esc(v.ref || '') + '" placeholder="' + esc(q.ref) + '" style="height:42px;text-align:center;background:#FFF6CF;border-color:#E7D27A;font-family:var(--cond);font-size:17px">' +
        '<span class="small">Reading</span><span style="background:var(--oos-soft);border-radius:8px;padding:9px;text-align:center;font-family:var(--cond);font-size:17px">' + esc(oldR || '—') + '</span><input class="inp" inputmode="decimal" data-k="reading" value="' + esc(v.reading || '') + '" style="height:42px;text-align:center;background:#FFF6CF;border-color:#E7D27A;font-family:var(--cond);font-size:17px">' +
        '<span class="small">Dev</span><span style="background:var(--oos-soft);border-radius:8px;padding:9px;text-align:center;font-family:var(--cond);font-size:17px">' + esc(oldD || '—') + '</span><span data-dv style="background:#FFF6CF;border-radius:8px;padding:9px;text-align:center;font-family:var(--cond);font-size:17px;min-height:40px"></span></div><div data-wn></div></div>'; };
    return { title: esc(it.code || it.description), body:
      '<div class="hero"><h3 style="margin-top:0">' + esc(it.description || f.description) + '</h3><div class="sub">' + esc([it.manufacturer || f.manufacturer, it.model || f.model].filter(Boolean).join(' · ')) + '</div>' +
      '<dl class="kv" style="margin-top:12px"><dt>Range</dt><dd>' + esc(rangeText(it) || f.range || '—') + '</dd><dt>Cal. range</dt><dd>' + esc(calText(it) || f.calRange || '—') + '</dd><dt>Resolution</dt><dd><b>' + esc(it.res ? it.res + ' ' + (it.resUnit || it.unit) : f.resolution || '—') + '</b></dd><dt>Limits</dt><dd>' + esc(f.limits || '—') + '</dd></dl>' +
      '<div class="cf"><button class="btn ghost sm" id="eRes">Edit resolution</button>' + (f.manufacturer || it.manufacturer ? '<a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + encodeURIComponent([it.manufacturer || f.manufacturer, it.model || f.model, 'datasheet'].filter(Boolean).join(' ')) + '">Check online</a>' : '') + '</div>' +
      (o.status === 'similar' ? '<div class="note" style="margin:12px 0 0;background:var(--pending-soft);color:var(--pending)">Last year\'s values are from a similar device.</div>' : '') + '</div>' +
      o.points.map(function (q, i) { return card(q, i, 1) + (o.dirs === 2 ? card(q, i, 2) : ''); }).join(''),
      foot: '<button class="btn" id="rOk">Done</button>',
      mount: function () { $('#rOk').onclick = closeSheet;
        $('#eRes').onclick = function () { var was = it.res || f.resolution || '';
          $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>Edit resolution</h3><p>Last year\'s certificate: <b>' + esc(f.resolution || '—') + '</b></p><input class="inp" id="nr" inputmode="decimal" value="' + esc(it.res || '') + '"><div class="cf"><button class="btn ghost" id="nc">Cancel</button><button class="btn" id="ns">Save</button></div></div></div>';
          $('#nc').onclick = function () { $('#dlg-root').innerHTML = ''; };
          $('#ns').onclick = function () { var v = $('#nr').value.trim(); $('#dlg-root').innerHTML = ''; if (!isNum(v)) return toast('Resolution must be a number', true);
            var old = oldNums(f).res; var save = function () { it.res = v; if (!it.resUnit) it.resUnit = oldNums(f).resUnit || it.unit; saveProjects(); renderSheet(); };
            if (old && numv(old) !== numv(v)) dialog('Are you sure?', 'The resolution will be <b>' + esc(v) + '</b> – last year it was <b>' + esc(f.resolution) + '</b>.', 'Yes, I\'m sure').then(function (y) { if (y) save(); }); else save(); }; };
        var upd = function (el) { var a = el.dataset.pt.split('|').map(Number), r = evalPt(it, a[0], a[1]); el.querySelector('[data-dv]').textContent = r.dev == null ? '' : (d == null ? String(r.dev) : r.dev.toFixed(d));
          var rs = el.querySelector('[data-rs]'); rs.textContent = r.res; rs.style.color = r.res === 'OUT' ? 'var(--danger)' : 'var(--office)'; el.style.borderColor = r.res === 'OUT' ? '#E9A39C' : ''; el.style.background = r.res === 'OUT' ? '#FFF8F7' : '';
          el.querySelector('[data-wn]').innerHTML = r.warn.map(function (w) { return '<div class="small" style="color:var(--danger);margin-top:6px">' + esc(w) + '</div>'; }).join(''); return r; };
        $$('[data-pt]').forEach(function (el) { upd(el); el.querySelectorAll('input').forEach(function (inp) { inp.oninput = function () { var a = el.dataset.pt.split('|'), k = a[0] + (a[1] === '2' ? 'd' : ''); (it.nv[k] = it.nv[k] || {})[inp.dataset.k] = inp.value.trim(); saveProjects(); var r = upd(el); if (r.res === 'OUT' && inp.dataset.k === 'reading') toast('OUT – deviation ' + r.dev + ' is beyond ±' + r.lim, true); }; }); }); } }; }); }
function outList(p) { var L = []; withPts(p).forEach(function (it) { it.old.points.forEach(function (q, i) { [1].concat(it.old.dirs === 2 ? [2] : []).forEach(function (dr) { var r = evalPt(it, i, dr); if (r.res === 'OUT') L.push({ code: it.code, cert: (it.old.fields || {}).certNo, point: q.point + (it.old.dirs === 2 ? (dr === 2 ? ' ↓' : ' ↑') : ''), reading: r.rd, dev: r.dev, lim: r.lim, ex: +(Math.abs(r.dev) - r.lim).toFixed(6) }); }); }); }); return L; }
function outSheet(p) { openSheet(function () { var L = outList(p); return { title: 'OUT report', body: '<div class="note warnbox">Re-measure these with the technician. Their certificates use last year\'s readings as placeholders and must be replaced before going to the customer.</div>' +
  '<div class="list">' + (L.map(function (x) { return '<div class="row"><span class="t"><b>' + esc(x.code) + ' · point ' + esc(x.point) + '</b><small>Old cert ' + esc(x.cert || '—') + ' · reading ' + x.reading + ' · limit ±' + x.lim + '</small></span><span class="pill" style="--s-fg:var(--danger);--s-bg:var(--danger-soft)">+' + x.ex + '</span></div>'; }).join('') || '<div class="row">No OUT points</div>') + '</div>', foot: '<button class="btn" id="oc">Done</button>', mount: function () { $('#oc').onclick = closeSheet; } }; }); }
function dlBlob(buf, name) { if (CL.on) { clSave(new Blob([buf]), name).then(function () { toast('Downloaded'); }).catch(function (e) { if (!e || e.code !== 'declined') toast((e && e.message) || 'Not downloaded', true); }); return; } var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
var RHDR = ['#', 'Department', 'Equipment', 'Code', 'Old cert no.', 'Direction', 'Resolution', 'Limit', 'Point', 'Old Ref', 'New Ref', 'Old Reading', 'New Reading', 'Old Dev', 'New Dev', 'Result', 'Remarks', 'Key'];
function xlReadings(p) { var L = withPts(p); if (!L.length) return toast('No items with old readings yet', true);
  needExcel().then(function () { var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Readings', { views: [{ state: 'frozen', ySplit: 1 }] });
    var GR = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E9EC' } }, YL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2B3' } }, thin = { style: 'thin', color: { argb: 'FFBFC5CE' } };
    ws.addRow(RHDR).eachCell(function (c) { c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13294B' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    var n = 0, fmt = function (d) { return d > 0 ? '0.' + '0'.repeat(d) : '0'; }, nv = function (s) { return isNum(s) ? numv(s) : (s || ''); };
    L.forEach(function (it) { n++; var o = it.old, f = o.fields || {}, d = resDec(it), first = true;
      o.points.forEach(function (q, i) { [1].concat(o.dirs === 2 ? [2] : []).forEach(function (dr) { var v = it.nv && it.nv[i + (dr === 2 ? 'd' : '')] || {}, lt = ptLimit(it, q);
        var row = ws.addRow([first ? n : '', first ? it.dept : '', first ? (it.description || f.description) : '', first ? it.code : '', first ? (f.certNo || '') + (o.status === 'similar' ? ' (similar)' : '') : '', o.dirs === 2 ? (dr === 2 ? 'Down' : 'Up') : '', first ? (it.res ? it.res + ' ' + (it.resUnit || it.unit) : f.resolution) : '', lt, nv(q.point), nv(q.ref), v.ref ? nv(v.ref) : null, nv(dr === 2 ? q.reading2 : q.reading), v.reading ? nv(v.reading) : null, nv(dr === 2 ? q.deviation2 : q.deviation), null, null, '', it.id + '|' + i + '|' + dr]);
        var r = row.number, lim = limitVal(lt, numv(q.ref), null), pct = String(lt).replace(/\s/g, '').match(/(\d*\.?\d+)%/);
        row.getCell(15).value = { formula: 'IF(OR(K' + r + '="",M' + r + '=""),"",M' + r + '-K' + r + ')' };
        row.getCell(16).value = pct ? { formula: 'IF(O' + r + '="","",IF(ABS(O' + r + ')<=' + parseFloat(pct[1]) / 100 + '*ABS(' + (/rdg|reading/i.test(lt) ? 'M' : 'K') + r + '),"OK","OUT"))' } : lim != null ? { formula: 'IF(O' + r + '="","",IF(ABS(O' + r + ')<=' + lim + ',"OK","OUT"))' } : '';
        [10, 12, 14].forEach(function (c) { var cell = row.getCell(c); cell.fill = GR; if (typeof cell.value === 'number') cell.numFmt = fmt(decOf(c === 10 ? q.ref : c === 12 ? (dr === 2 ? q.reading2 : q.reading) : (dr === 2 ? q.deviation2 : q.deviation))); });
        [11, 13, 15].forEach(function (c) { var cell = row.getCell(c); cell.fill = YL; cell.numFmt = fmt(d == null ? decOf(q.reading) : d); if (c !== 15) cell.dataValidation = { type: 'decimal', operator: 'between', formulae: [-1e9, 1e9], showErrorMessage: true, errorTitle: 'Number only', error: 'Type a number' }; });
        row.eachCell({ includeEmpty: true }, function (c, ci) { if (ci > 18) return; c.font = { name: 'Arial', size: 10 }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: ci === 3 }; c.border = { top: first ? { style: 'medium', color: { argb: 'FF13294B' } } : thin, bottom: thin, left: thin, right: thin }; });
        first = false; }); }); });
    ws.addConditionalFormatting({ ref: 'P2:P' + ws.rowCount, rules: [{ type: 'containsText', operator: 'containsText', text: 'OUT', style: { font: { color: { argb: 'FFC2362B' }, bold: true }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFBE6E3' } } } }] });
    [5, 12, 24, 14, 18, 9, 11, 14, 10, 11, 11, 12, 12, 10, 10, 8, 16, 4].forEach(function (w, i) { ws.getColumn(i + 1).width = w; }); ws.getColumn(18).hidden = true;
    var ix = wb.addWorksheet('Index'); ix.addRow(['Code', 'Equipment', 'Note']).font = { bold: true, name: 'Arial' };
    p.items.filter(function (i) { return L.indexOf(i) < 0; }).forEach(function (i) { ix.addRow([i.code, i.description, (i.old && i.old.note) || 'No old readings']); }); ix.columns.forEach(function (c) { c.width = 28; });
    return wb.xlsx.writeBuffer(); }).then(function (b) { dlBlob(b, 'Readings - ' + p.company.name + '.xlsx'); }).catch(function (e) { toast(e.message, true); }); }
function cellRaw(c) { var v = c.value; if (v == null || v === '') return ''; if (typeof v === 'number') { var m = (c.numFmt || '').match(/0\.(0+)/); return m ? v.toFixed(m[1].length) : String(v); } if (typeof v === 'object' && 'result' in v) return v.result == null ? '' : String(v.result); return cellStr(v).trim(); }
function xlReadUp(p, file) { needExcel().then(function () { return file.arrayBuffer(); }).then(function (buf) { var wb = new ExcelJS.Workbook(); return wb.xlsx.load(buf).then(function () { return wb; }); }).then(function (wb) {
  var ws = wb.getWorksheet('Readings') || wb.worksheets[0], H = ws.getRow(1).values.map(function (v) { return cellStr(v).trim(); }), cK = H.indexOf('Key'), cR = H.indexOf('New Ref'), cN = H.indexOf('New Reading');
  if (cK < 0 || cN < 0) throw new Error('This is not the readings file downloaded from the app'); var cnt = 0, probs = [], touched = {};
  ws.eachRow(function (row, i) { if (i === 1) return; var key = cellStr(row.getCell(cK).value); if (!key) return; var a = key.split('|'), it = p.items.filter(function (x) { return x.id === a[0]; })[0]; if (!it || !it.old) return;
    var ref = cellRaw(row.getCell(cR)), rd = cellRaw(row.getCell(cN)); if (ref === '' && rd === '') return; it.nv = it.nv || {}; var k = a[1] + (a[2] === '2' ? 'd' : '');
    it.nv[k] = Object.assign(it.nv[k] || {}, ref !== '' ? { ref: ref } : {}, rd !== '' ? { reading: rd } : {}); cnt++; touched[it.id] = 1;
    var r = evalPt(it, +a[1], +a[2]), pt = it.old.points[+a[1]].point; r.warn.forEach(function (w) { probs.push(it.code + ' · ' + pt + ': ' + w); }); if (r.res === 'OUT') probs.push(it.code + ' · ' + pt + ': OUT (dev ' + r.dev + ', limit ±' + r.lim + ')'); });
  saveProjects(); render(); $('#upMsg').innerHTML = '<div class="note" style="background:var(--office-soft);color:#14603C">' + cnt + ' readings loaded for ' + Object.keys(touched).length + ' items.</div>' + (probs.length ? '<div class="note warnbox"><b>Please check:</b><br>' + probs.slice(0, 40).map(esc).join('<br>') + '</div>' : '');
}).catch(function (e) { toast(e.message || String(e), true); }); }

/* ================= certificates, covers and receipt letter (Word + print/PDF) ================= */
/* --- tiny zip (stored) + Word writer: no library needed --- */
var CRC_T = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipFiles(files) { /* files: [{name, data: string|Uint8Array}] → Uint8Array */
  var te = new TextEncoder(), parts = [], cen = [], off = 0;
  files.forEach(function (f) { var nm = te.encode(f.name), d = typeof f.data === 'string' ? te.encode(f.data) : f.data, crc = crc32(d);
    var h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + d.length; });
  var cs = cen.reduce(function (a, b) { return a + b.length; }, 0), e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  var all = parts.concat(cen, [new Uint8Array(e.buffer)]), len = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(len), p = 0; all.forEach(function (b) { out.set(b, p); p += b.length; }); return out; }
var X = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var W = { /* WordprocessingML pieces – Arial everywhere */
  r: function (t, o) { o = o || {}; return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' + (o.b ? '<w:b/><w:bCs/>' : '') + (o.i ? '<w:i/>' : '') + (o.c ? '<w:color w:val="' + o.c + '"/>' : '') + '<w:sz w:val="' + (o.sz || 18) + '"/><w:szCs w:val="' + (o.sz || 18) + '"/>' + (o.rtl ? '<w:rtl/>' : '') + '</w:rPr><w:t xml:space="preserve">' + X(t) + '</w:t></w:r>'; },
  p: function (runs, o) { o = o || {}; return '<w:p><w:pPr>' + (o.pb ? '<w:pageBreakBefore/>' : '') + (o.keep ? '<w:keepNext/><w:keepLines/>' : '') + (o.bidi ? '<w:bidi/>' : '') + '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 40 : o.after) + '" w:line="240" w:lineRule="auto"/><w:jc w:val="' + (o.jc || 'left') + '"/></w:pPr>' + (Array.isArray(runs) ? runs.join('') : runs) + '</w:p>'; },
  fld: function (instr, o) { o = o || {}; return '<w:fldSimple w:instr=" ' + instr + ' "><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="' + (o.sz || 16) + '"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>'; },
  tbl: function (rows, widths, o) { o = o || {}; var tw = widths.reduce(function (a, b) { return a + b; }, 0), bd = '<w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/>';
    return '<w:tbl><w:tblPr><w:tblW w:w="' + tw + '" w:type="dxa"/>' + (o.bidi ? '<w:bidiVisual/>' : '') + '<w:jc w:val="center"/><w:tblBorders>' + bd + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' +
      rows.map(function (row, ri) { var ci = 0; return '<w:tr><w:trPr><w:cantSplit/>' + (o.h ? '<w:trHeight w:val="' + o.h + '"/>' : '') + (ri === 0 && o.head ? '<w:tblHeader/>' : '') + '</w:trPr>' + row.map(function (c) { c = typeof c === 'object' ? c : { t: c }; var span = c.span || 1, w = widths.slice(ci, ci + span).reduce(function (a, b) { return a + b; }, 0); ci += span;
        var lines = String(c.t == null ? '' : c.t).split('\n');
        return '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + (span > 1 ? '<w:gridSpan w:val="' + span + '"/>' : '') + (c.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + c.shade + '"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr>' +
          lines.map(function (ln) { return W.p(W.r(ln, { b: c.b, sz: c.sz || o.sz || 16, rtl: o.bidi }), { jc: c.jc || o.jc || 'center', after: 0, keep: true, bidi: o.bidi }); }).join('') + '</w:tc>'; }).join('') + '</w:tr>'; }).join('') + '</w:tbl>'; },
  doc: function (body, o) { o = o || {}; /* o: header, footer, pgStart */
    var ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    var sect = '<w:sectPr>' + (o.header ? '<w:headerReference w:type="default" r:id="rIdH"/>' : '') + (o.footer ? '<w:footerReference w:type="default" r:id="rIdF"/>' : '') + '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="850" w:bottom="900" w:left="850" w:header="400" w:footer="400" w:gutter="0"/>' + (o.pgStart ? '<w:pgNumType w:start="' + o.pgStart + '"/>' : '') + (o.bidi ? '<w:bidi/>' : '') + '</w:sectPr>';
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' + (o.header ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') + (o.footer ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + (o.header ? '<Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : '') + (o.footer ? '<Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : '') + '</Relationships>' },
      { name: 'word/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + ns + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>' },
      { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + ns + '><w:body>' + body + sect + '</w:body></w:document>' } ];
    if (o.header) files.push({ name: 'word/header1.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + ns + '>' + o.header + '</w:hdr>' });
    if (o.footer) files.push({ name: 'word/footer1.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + ns + '>' + o.footer + '</w:ftr>' });
    return zipFiles(files); } };

/* --- data for the documents --- */
var LAB = { name: 'AKHNATON', sub: 'Trading and Representation', lab: 'CALIBRATION LAB.', addr: '113 Tomanbay St. El-Zeitoun, Cairo', tel: 'Phone: 24515197   Fax: 24514690', mail: 'E-Mail: Calibration@akhnatontrade.com' };
var MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
function monYear(s, add) { var d = s2d(s); if (!d) return ''; return MON[d.getMonth()] + ' ' + (d.getFullYear() + (add || 0)); }
function genDefaults(p) { var g = p.gen = p.gen || {}, first = p.items.filter(function (i) { return i.old && i.old.fields && i.old.fields.certNo; })[0], yr = s2d(p.info && p.info.cal) ? s2d(p.info.cal).getFullYear() : new Date().getFullYear();
  if (g.prefix == null) { var m = first && String(first.old.fields.certNo).match(/^(.*?)(\d+)-(\d{4})$/); g.prefix = m ? m[1] : (/^\d+$/.test(p.company.code || '') ? p.company.code + '-' : (String(p.company.code || '').replace(/^(\d+)([A-Z]+)$/i, '$1/$2-') || '')); g.pad = m ? m[2].length : 3; }
  g.year = yr; if (g.start == null) g.start = ''; if (g.approver == null) g.approver = 'Eng. Ayman Wasfy'; if (g.approverPos == null) g.approverPos = 'Technical Manager';
  if (g.techPos == null) g.techPos = 'Calibration Engineer'; if (g.interval == null) g.interval = 'One Year'; if (g.signer == null) g.signer = 'م/ ميــنا إبراهــيم'; if (g.signerPos == null) g.signerPos = 'مدير قســمي الصيانة والمعايرة';
  g.addr = g.addr || ''; g.tel = g.tel || ''; g.fax = g.fax || ''; g.loc = g.loc || ''; g.prices = g.prices || {}; g.dsr = g.dsr || {}; return g; }
function certNo(g, n) { var s = String(n); while (s.length < (g.pad || 3)) s = '0' + s; return g.prefix + s + '-' + g.year; }
function genGroups(p) { /* one cover per machine; units of the same kind share one cover */
  var groups = [], byKey = {};
  var ready = function (i) { return i.old && (i.old.points || []).length; };
  p.machines.forEach(function (m) { var its = p.items.filter(function (i) { return i.machineId === m.id && ready(i); }); if (its.length) groups.push({ machine: m, items: its }); });
  p.items.filter(function (i) { return !i.machineId && ready(i); }).forEach(function (it) { var k = norm((it.description || (it.old && it.old.fields.description) || '') + '|' + (it.manufacturer || '')); if (!byKey[k]) { byKey[k] = { machine: null, items: [] }; groups.push(byKey[k]); } byKey[k].items.push(it); });
  var g = genDefaults(p), n = parseInt(g.start, 10);
  groups.forEach(function (gr) { gr.items.forEach(function (it) { it.certNo = isNaN(n) ? '' : certNo(g, n++); }); gr.from = gr.items[0].certNo; gr.to = gr.items[gr.items.length - 1].certNo; });
  return groups; }
function dsRef(p, it) { var g = genDefaults(p); if (g.dsr[it.id] != null) return g.dsr[it.id]; var o = it.old && it.old.fields && it.old.fields.dataSheetRef; if (!o) return '';
  var yy = String(g.year).slice(2); return String(o).replace(/\s+/g, '').replace(/^(\d+)-(\d{2})$/, '$1-' + yy); }
function ptRows(p, it) { /* new readings; if missing or OUT → last year's readings as placeholder */
  var o = it.old, rows = [], ph = [];
  (o.points || []).forEach(function (q, i) { var dirs = o.dirs === 2 ? [1, 2] : [1], row = { point: q.point, limit: ptLimit(it, q), cells: [] }, out = false;
    dirs.forEach(function (dr) { var r = evalPt(it, i, dr), v = (it.nv || {})[i + (dr === 2 ? 'd' : '')] || {};
      var ok = r.ref != null && r.rd != null && r.res !== 'OUT', d = resDec(it);
      if (!ok) { ph.push({ point: q.point + (o.dirs === 2 ? (dr === 2 ? ' ↓' : ' ↑') : ''), why: r.res === 'OUT' ? 'OUT' : 'no new reading', reading: r.rd, dev: r.dev, lim: r.lim }); if (r.res === 'OUT') out = true; }
      row.ref = ok ? v.ref : q.ref;
      row.cells.push(ok ? v.reading : (dr === 2 ? q.reading2 : q.reading), ok ? (d == null ? String(r.dev) : r.dev.toFixed(d)) : (dr === 2 ? q.deviation2 : q.deviation)); });
    rows.push(row); });
  return { rows: rows, ph: ph }; }
function genIssues(p) { var inf = p.info || {}, g = genDefaults(p), L = [];
  if (!inf.cal) L.push('Calibration date'); if (!inf.iss) L.push('Date of issue'); if (!inf.wo) L.push('Work order date'); if (!inf.tech) L.push('Calibrated by');
  var noRef = p.items.filter(function (it) { return !(it.refs || []).length; }).length; if (noRef) L.push(noRef + ' item(s) without a reference'); if (refResWarn(p)) L.push('Resolution of the references'); if (!String(g.start).trim()) L.push('First certificate number');
  if (!g.addr) L.push('Customer address'); p.items.forEach(function (it) { if (!it.old || !(it.old.points || []).length) L.push((it.code || it.description) + ': no old certificate / readings'); });
  return L.concat(dateWarns(inf)).concat(refWarns(p)); }
function phList(p) { var L = []; p.items.forEach(function (it) { if (!it.old || !(it.old.points || []).length) return; ptRows(p, it).ph.forEach(function (x) { L.push(Object.assign({ code: it.code, cert: it.certNo }, x)); }); }); return L; }
function refsUsed(p, items) { var ds = labDevices(), ids = p.info.refs || []; if (items) { var u = {}; items.forEach(function (it) { (it.refs || []).forEach(function (id) { u[id] = 1; }); }); if (Object.keys(u).length) ids = Object.keys(u); } return ids.map(function (id) { return ds.filter(function (d) { return d.id === id; })[0]; }).filter(Boolean); }
function envDevice() { return labDevices().filter(function (d) { return /hygro|thermo-?hygro|rh\b/i.test(d.description + ' ' + d.category); })[0]; }
function dueText(d) { var s = String(d.calDue || '').slice(0, 10), x = s2d(s); return x ? x.getDate() + '-' + MON[x.getMonth()].replace('.', '') + '-' + x.getFullYear() : s; }

/* --- Word: header, cover, certificate, letter --- */
function wHeader(title) { return W.p(W.r(title || 'Calibration Certificate', { b: true, sz: 32, c: '13294B' }), { jc: 'center', after: 20 }) +
  W.p([W.r('ISSUED BY  ', { sz: 14 }), W.r(LAB.name + ' ', { b: true, sz: 16 }), W.r(LAB.sub + '   ' + LAB.lab, { sz: 14 })], { jc: 'center', after: 0 }) + W.p(W.r(LAB.addr + '   ' + LAB.tel + '   ' + LAB.mail, { sz: 13 }), { jc: 'center', after: 60 }); }
function wFooter(form, pageOfN) { return W.p(W.r('This report shall not be duplicated except in full or with written approval from this laboratory', { sz: 13, i: true }), { jc: 'center', after: 0 }) +
  W.p([W.r(form + '      Page ', { sz: 14 }), W.fld('PAGE', { sz: 14 }), W.r(' of ' + pageOfN + ' Page(s)', { sz: 14 })], { jc: 'right', after: 0 }); }
function kvRow(a, b, c, d) { return [{ t: a, b: true, jc: 'left' }, { t: b, jc: 'left' }, { t: c, b: true, jc: 'left' }, { t: d, jc: 'left' }]; }
var COVER_FORM = 'F-7.2.2  ISSUE (1) 15/05/2019', ROWS_PER_PAGE = 18;
function pagesOf(it) { var n = (it.old.points || []).length; return Math.max(1, Math.ceil(n / ROWS_PER_PAGE)); }
function topBlock(p, no, cont) { var inf = p.info; return W.tbl([kvRow('DATE OF ISSUE:', dmy(inf.iss), cont ? 'CONTINUE CERTIFICATE NO.:' : 'CERTIFICATE NO.:', no), kvRow('CUSTOMER:', (p.company.official || p.company.name), 'CUSTOMER ID:', p.company.code || '')], [1800, 3300, 1900, 3100], { sz: 16 }); }
function coverDoc(p, gr, total) { var inf = p.info, g = genDefaults(p), its = gr.items, body = '';
  body += W.tbl([kvRow('DATE OF ISSUE:', dmy(inf.iss), 'CERTIFICATE NO.:', its.length > 1 ? 'From ' + gr.from + ' to ' + gr.to : gr.from), kvRow('CUSTOMER:', p.company.official || p.company.name, 'CUSTOMER ID:', p.company.code || ''), kvRow('ADDRESS:', g.addr, 'Tel / Fax:', [g.tel, g.fax].filter(Boolean).join(' / ')), kvRow('DATE RECEIVED:', dmy(inf.rec), 'WORK ORDER No.:', woNo(inf))], [1800, 3600, 1700, 3000], { sz: 16 });
  body += W.p(W.r('Unit under Test', { b: true, sz: 18 }), { before: 120, keep: true });
  var uut = gr.machine ? [['1', its[0].manufacturer || (its[0].old && its[0].old.fields.manufacturer) || 'N/A', gr.machine.name, 'N/A', 'N/A', gr.machine.code || 'N/A', g.loc || 'N/A']]
    : its.map(function (it, i) { var f = (it.old || {}).fields || {}; return [String(i + 1), it.manufacturer || f.manufacturer || 'N/A', it.description || f.description || 'N/A', it.model || f.model || 'N/A', it.serial || f.serial || 'N/A', it.code || 'N/A', g.loc || 'N/A']; });
  body += W.tbl([[{ t: 'Item No.', b: true, shade: 'E7ECF2' }, { t: 'Manufacturer', b: true, shade: 'E7ECF2' }, { t: 'Description', b: true, shade: 'E7ECF2' }, { t: 'Model', b: true, shade: 'E7ECF2' }, { t: 'S/N', b: true, shade: 'E7ECF2' }, { t: 'Code', b: true, shade: 'E7ECF2' }, { t: 'Location', b: true, shade: 'E7ECF2' }]].concat(uut), [700, 1500, 2300, 1300, 1400, 1500, 1500], { head: true });
  body += W.p(W.r('Item to be calibrated', { b: true, sz: 18 }), { before: 120, keep: true });
  body += W.tbl([[{ t: 'Item No.', b: true, shade: 'E7ECF2' }, { t: 'Manufacturer', b: true, shade: 'E7ECF2' }, { t: 'Description', b: true, shade: 'E7ECF2' }, { t: 'Code', b: true, shade: 'E7ECF2' }, { t: 'Cal. Range', b: true, shade: 'E7ECF2' }, { t: 'Accepted Limit', b: true, shade: 'E7ECF2' }]].concat(its.map(function (it, i) { var f = (it.old || {}).fields || {};
    return [String(i + 1), it.manufacturer || f.manufacturer || 'N/A', it.description || f.description || '', it.code || '', calRangeText(it) || f.calRange || f.range || '', f.limits || (it.old.points[0] || {}).limit || '']; })), [700, 1600, 2700, 1700, 1900, 1600], { head: true });
  body += W.p(W.r('Calibration Standard(s) Utilized', { b: true, sz: 18 }), { before: 120, keep: true });
  body += W.tbl([[{ t: 'Item No.', b: true, shade: 'E7ECF2' }, { t: 'Manufacturer', b: true, shade: 'E7ECF2' }, { t: 'Description', b: true, shade: 'E7ECF2' }, { t: 'Model', b: true, shade: 'E7ECF2' }, { t: 'Serial Number', b: true, shade: 'E7ECF2' }, { t: 'Range', b: true, shade: 'E7ECF2' }, { t: 'Calibration Due Date', b: true, shade: 'E7ECF2' }]].concat(refsUsed(p, its).map(function (d, i) { return [String(i + 1), d.manufacturer, d.description, d.model || '', d.serial || '', d.range || '', dueText(d)]; })), [700, 1500, 2300, 1300, 1500, 1500, 1400], { head: true });
  var ev = envDevice(); if (ev) { body += W.p(W.r('Environmental Conditions Measured by', { b: true, sz: 18 }), { before: 120, keep: true });
    body += W.tbl([[{ t: 'Item No.', b: true, shade: 'E7ECF2' }, { t: 'Manufacturer', b: true, shade: 'E7ECF2' }, { t: 'Description', b: true, shade: 'E7ECF2' }, { t: 'Model', b: true, shade: 'E7ECF2' }, { t: 'Serial Number', b: true, shade: 'E7ECF2' }, { t: 'Range', b: true, shade: 'E7ECF2' }, { t: 'Calibration Due Date', b: true, shade: 'E7ECF2' }], ['1', ev.manufacturer, ev.description, ev.model || '', ev.serial || '', ev.range || '', dueText(ev)]], [700, 1500, 2300, 1300, 1500, 1500, 1400], { head: true }); }
  body += W.p(W.r('This Certificate is issued in accordance with the laboratory accreditation requirements of the ISO 17025 and the policies and procedures employed by AKHNATON ENGINEERING. It provides traceability of measurement to National Institute for Standards (NIS) & SI units. This certificate may not be reproduced other than in full, except with the prior written approval of the issuing laboratory.', { sz: 14 }), { before: 160, jc: 'both' });
  return W.doc(body, { header: wHeader(), footer: wFooter(COVER_FORM, total) }); }
function calRangeText(it) { if (isNum(it.cMin) && isNum(it.cMax)) return '(' + it.cMin + ' : ' + it.cMax + ') ' + (it.unit || ''); if (isNum(it.rMin) && isNum(it.rMax)) return '(' + it.rMin + ' : ' + it.rMax + ') ' + (it.unit || ''); return ''; }
function certBody(p, it, first) { var inf = p.info, g = genDefaults(p), f = it.old.fields || {}, pr = ptRows(p, it), out = pr.ph.some(function (x) { return x.why === 'OUT'; }), body = '', dirs = it.old.dirs === 2;
  var head = function (pb, cont) { return W.p(W.r(' ', { sz: 4 }), { pb: pb, after: 0 }) + topBlock(p, it.certNo, cont); };
  body += head(!first, false);
  body += W.p(W.r('Data of item to be calibrated', { b: true, sz: 18 }), { before: 100, keep: true });
  body += W.tbl([kvRow('Manufacturer', it.manufacturer || f.manufacturer || 'N/A', 'Calibration Date', monYear(it.calDate || inf.cal)), kvRow('Description', it.description || f.description || '', 'Calibration interval**', g.interval), kvRow('Code', it.code || '', 'Calibration Due Date', monYear(it.calDate || inf.cal, 1)),
    kvRow('Range', rangeText(it) || f.range || '', 'Environmental Condition', (inf.eLoc ? inf.eLoc + '  ' : '') + inf.eT + ' °C & ' + inf.eH + ' %R.H.'), kvRow('Cal. Range', calRangeText(it) || f.calRange || f.range || '', 'Model / S/N', [it.model || f.model, it.serial || f.serial].filter(Boolean).join(' / ') || 'N/A'),
    kvRow('Resolution', it.res ? it.res + ' ' + (it.resUnit || it.unit) : (f.resolution || ''), 'Procedure No.', f.procedure || ''), kvRow('Accepted Limits', f.limits || '', 'Received status', 'In A Good Condition'), kvRow('Data Sheet Ref.', dsRef(p, it), 'Delivered status', out ? 'Out of Tolerance' : 'In Tolerance')], [1900, 3150, 2100, 2950], { sz: 16 });
  var hdr = dirs ? [[{ t: 'Point', b: true, shade: 'E7ECF2' }, { t: 'Reference', b: true, shade: 'E7ECF2' }, { t: 'Reading ↑', b: true, shade: 'E7ECF2' }, { t: 'Deviation ↑', b: true, shade: 'E7ECF2' }, { t: 'Reading ↓', b: true, shade: 'E7ECF2' }, { t: 'Deviation ↓', b: true, shade: 'E7ECF2' }, { t: 'Accepted Limits', b: true, shade: 'E7ECF2' }]]
    : [[{ t: 'Point', b: true, shade: 'E7ECF2' }, { t: 'Reference', b: true, shade: 'E7ECF2' }, { t: 'UUT Reading', b: true, shade: 'E7ECF2' }, { t: 'Deviation', b: true, shade: 'E7ECF2' }, { t: 'Accepted Limits', b: true, shade: 'E7ECF2' }, { t: 'Status', b: true, shade: 'E7ECF2' }]];
  var wd = dirs ? [1200, 1500, 1500, 1400, 1500, 1400, 1600] : [1500, 1900, 1900, 1700, 1700, 1400];
  for (var k = 0; k < pr.rows.length; k += ROWS_PER_PAGE) { if (k > 0) body += head(true, true);
    body += W.p(W.r((k ? '' : '1 - ') + 'Calibration Results' + (f.unit ? '' : '') + (it.unit ? '  (' + it.unit + ')' : ''), { b: true, sz: 18 }), { before: 100, keep: true });
    body += W.tbl(hdr.concat(pr.rows.slice(k, k + ROWS_PER_PAGE).map(function (r) { return dirs ? [r.point, r.ref, r.cells[0], r.cells[1], r.cells[2], r.cells[3], r.limit] : [r.point, r.ref, r.cells[0], r.cells[1], r.limit, 'Accepted']; })), wd, { head: true, h: 300 }); }
  body += W.p(W.r('Remarks', { b: true, sz: 18 }), { before: 120, keep: true });
  body += W.tbl([[{ t: 'Calibrated By:', b: true, jc: 'left' }, { t: '', jc: 'left' }, { t: 'Approved By:', b: true, jc: 'left' }, { t: '', jc: 'left' }], kvRow('Date:', dmy(inf.iss), 'Position:', g.approverPos), kvRow('Position:', g.techPos, 'Name:', g.approver), kvRow('Name:', 'Eng. ' + String(inf.tech).replace(/^Eng\.\s*/i, ''), 'Signature:', '_____________________'), kvRow('Signature:', '_____________________', '', '')], [1500, 3550, 1500, 3550], { sz: 16 });
  body += W.p(W.r('** The recalibration date & accepted limits have been included in response to the customer\'s request. The customer has specified the calibration interval & acceptance criteria.', { sz: 13 }), { before: 80, jc: 'both' });
  body += W.p(W.r('This Certificate and Readings refers only to the particular item under calibration. The reported uncertainty is based on a standard uncertainty multiplied by a coverage factor k = 2, providing a level of confidence of approximately 95 %. The uncertainty evaluation has been carried out in accordance with ISO 17025 requirements.', { sz: 13 }), { jc: 'both' });
  return body; }
function certDoc(p, gr, total) { var body = gr.items.map(function (it, i) { return certBody(p, it, i === 0); }).join(''), f0 = (gr.items[0].old.fields || {}).procedure || 'SOP';
  return W.doc(body, { header: wHeader(), footer: wFooter(f0 + '  Rev. (0) 15/05/2019', total), pgStart: 2 }); }
function letterDoc(p, groups) { var inf = p.info, g = genDefaults(p), o = p.order || {}, rows = [], tot = 0, n = 0;
  var cal = s2d(inf.cal), mm = cal ? MON[cal.getMonth()] + ' ' + String(cal.getFullYear()).slice(2) : '', dd = cal ? MON[cal.getMonth()] + ' ' + String(cal.getFullYear() + 1).slice(2) : '';
  groups.forEach(function (gr) { gr.items.forEach(function (it) { n++; var pr = g.prices[it.id] || ''; if (isNum(pr)) tot += numv(pr);
    rows.push([String(n), (gr.machine ? gr.machine.name + ' – ' : '') + (it.description || (it.old && it.old.fields.description) || ''), it.code || it.serial || '', mm, dd, it.certNo, pr || 'Lump sum']); }); });
  var hd = [[{ t: 'No.', b: true, shade: 'E7ECF2' }, { t: 'Item To be Calibrated', b: true, shade: 'E7ECF2' }, { t: 'Code or Serial', b: true, shade: 'E7ECF2' }, { t: 'Cal. Date', b: true, shade: 'E7ECF2' }, { t: 'Due Date', b: true, shade: 'E7ECF2' }, { t: 'Cert. No.', b: true, shade: 'E7ECF2' }, { t: 'Unit Price', b: true, shade: 'E7ECF2' }]];
  var ar = function (t, o2) { return W.p(W.r(t, Object.assign({ sz: 20, rtl: true }, o2 || {})), { jc: 'right', bidi: true, after: 60 }); };
  var body = ar('أخناتون تريدنج أند ربريسنتاشن', { b: true, sz: 24 }) + ar('المركز الرئيسي: 13 ش الموسيقار علي اسماعيل – الدقي    الفرع: 9 شارع الشركات – عابدين', { sz: 16 }) + ar('المكتب الفني: 113 ش طومان باي - الزيتون    التليفون: 24515197    الفاكس: 24514690', { sz: 16 }) +
    ar('التاريخ: ' + dmy(inf.iss).replace(/\//g, ' - ')) + ar('السادة/ ' + (p.company.official || p.company.name), { b: true }) + ar('تحية طيبة وبعد ....') +
    (o.number ? W.p(W.r('P.O   ' + o.number, { b: true, sz: 20 }), { jc: 'left' }) : '') +
    ar('موضح لسيادتكم أدناه بيان بتقارير أعمال المعايرة المنتهية طرفكم؛ برجاء التكرم باستلام التقارير الآتية:-') +
    W.tbl(hd.concat(rows), [500, 3300, 1500, 900, 900, 1700, 1200], { head: true, sz: 16, h: 320 }) +
    (tot ? W.p(W.r('Price without VAT:  ' + tot.toLocaleString('en') + ' EGP', { b: true, sz: 18 }), { before: 120 }) : '') +
    ar('مع جزيل الشكر وتفضلوا بقبول فائق الاحترام،', { before: 200 }) + ar(g.signerPos, { b: true }) + ar(g.signer, { b: true });
  return W.doc(body, {}); }
function fileBase(g, gr) { var pre = String(g.prefix).replace(/[\/\\]/g, ''), a = gr.from.slice(g.prefix.length).split('-')[0], b = gr.to.slice(g.prefix.length).split('-')[0]; return pre + a + (b !== a ? ',' + b : '') + '-' + g.year; }
function buildAll(p) { var groups = genGroups(p), g = genDefaults(p), files = [];
  groups.forEach(function (gr) { var total = 1 + gr.items.reduce(function (a, it) { return a + pagesOf(it); }, 0), base = fileBase(g, gr);
    files.push({ name: base + ' cover page.docx', data: coverDoc(p, gr, total) }, { name: base + ' cal. cert.docx', data: certDoc(p, gr, total) }); });
  files.push({ name: 'Letter - ' + p.company.name + ' - ' + monYear(p.info.cal) + '.docx', data: letterDoc(p, groups) });
  return { files: files, groups: groups }; }

/* --- print view (PDF): every cover followed by its certificates --- */
function htmlTbl(rows, head) { return '<table class="pt">' + rows.map(function (r, i) { return '<tr>' + r.map(function (c) { c = typeof c === 'object' && c !== null ? c : { t: c }; return (i === 0 && head ? '<th' : '<td') + (c.span ? ' colspan="' + c.span + '"' : '') + (c.b ? ' class="b"' : '') + '>' + esc(c.t == null ? '' : c.t).replace(/\n/g, '<br>') + (i === 0 && head ? '</th>' : '</td>'); }).join('') + '</tr>'; }).join('') + '</table>'; }
function printView(p) { var all = buildAll(p), g = genDefaults(p), inf = p.info, pages = [];
  var hdr = '<div class="ph"><div class="t">Calibration Certificate</div><div class="s">ISSUED BY <b>AKHNATON</b> Trading and Representation · CALIBRATION LAB. · ' + esc(LAB.addr) + ' · ' + esc(LAB.tel) + '</div></div>';
  var ftr = function (form, i, n) { return '<div class="pf"><i>This report shall not be duplicated except in full or with written approval from this laboratory</i><span>' + esc(form) + ' &nbsp; Page ' + i + ' of ' + n + ' Page(s)</span></div>'; };
  all.groups.forEach(function (gr) { var total = 1 + gr.items.reduce(function (a, it) { return a + pagesOf(it); }, 0), pg = 1, its = gr.items;
    var kv = function (a, b, c, d) { return [{ t: a, b: 1 }, b, { t: c, b: 1 }, d]; };
    pages.push('<section class="pg">' + hdr + htmlTbl([kv('DATE OF ISSUE:', dmy(inf.iss), 'CERTIFICATE NO.:', its.length > 1 ? 'From ' + gr.from + ' to ' + gr.to : gr.from), kv('CUSTOMER:', p.company.official || p.company.name, 'CUSTOMER ID:', p.company.code), kv('ADDRESS:', g.addr, 'Tel / Fax:', [g.tel, g.fax].filter(Boolean).join(' / ')), kv('DATE RECEIVED:', dmy(inf.rec), 'WORK ORDER No.:', woNo(inf))]) +
      '<h4>Unit under Test</h4>' + htmlTbl([['Item No.', 'Manufacturer', 'Description', 'Model', 'S/N', 'Code', 'Location']].concat(gr.machine ? [['1', its[0].manufacturer || 'N/A', gr.machine.name, 'N/A', 'N/A', gr.machine.code || 'N/A', g.loc || 'N/A']] : its.map(function (it, i) { var f = it.old.fields || {}; return [i + 1, it.manufacturer || f.manufacturer || 'N/A', it.description || f.description, it.model || f.model || 'N/A', it.serial || f.serial || 'N/A', it.code, g.loc || 'N/A']; })), true) +
      '<h4>Item to be calibrated</h4>' + htmlTbl([['Item No.', 'Manufacturer', 'Description', 'Code', 'Cal. Range', 'Accepted Limit']].concat(its.map(function (it, i) { var f = it.old.fields || {}; return [i + 1, it.manufacturer || f.manufacturer || 'N/A', it.description || f.description, it.code, calRangeText(it) || f.calRange || f.range, f.limits || (it.old.points[0] || {}).limit || '']; })), true) +
      '<h4>Calibration Standard(s) Utilized</h4>' + htmlTbl([['Item No.', 'Manufacturer', 'Description', 'Model', 'Serial Number', 'Range', 'Calibration Due Date']].concat(refsUsed(p, its).map(function (d, i) { return [i + 1, d.manufacturer, d.description, d.model, d.serial, d.range, dueText(d)]; })), true) +
      ftr(COVER_FORM, pg++, total) + '</section>');
    its.forEach(function (it) { var f = it.old.fields || {}, pr = ptRows(p, it), dirs = it.old.dirs === 2, out = pr.ph.some(function (x) { return x.why === 'OUT'; }), form = (f.procedure || 'SOP') + ' Rev. (0) 15/05/2019';
      var top = function (cont) { return htmlTbl([kv('DATE OF ISSUE:', dmy(inf.iss), (cont ? 'CONTINUE ' : '') + 'CERTIFICATE NO.:', it.certNo), kv('CUSTOMER:', p.company.official || p.company.name, 'CUSTOMER ID:', p.company.code)]); };
      for (var k = 0; k < pr.rows.length || k === 0; k += ROWS_PER_PAGE) {
        var h = '<section class="pg">' + hdr + top(k > 0);
        if (!k) h += '<h4>Data of item to be calibrated</h4>' + htmlTbl([kv('Manufacturer', it.manufacturer || f.manufacturer || 'N/A', 'Calibration Date', monYear(it.calDate || inf.cal)), kv('Description', it.description || f.description, 'Calibration interval**', g.interval), kv('Code', it.code, 'Calibration Due Date', monYear(it.calDate || inf.cal, 1)), kv('Range', rangeText(it) || f.range, 'Environmental Condition', (inf.eLoc ? inf.eLoc + ' ' : '') + inf.eT + ' °C & ' + inf.eH + ' %R.H.'), kv('Cal. Range', calRangeText(it) || f.calRange || f.range, 'Model / S/N', [it.model || f.model, it.serial || f.serial].filter(Boolean).join(' / ') || 'N/A'), kv('Resolution', it.res ? it.res + ' ' + (it.resUnit || it.unit) : f.resolution, 'Procedure No.', f.procedure), kv('Accepted Limits', f.limits, 'Received status', 'In A Good Condition'), kv('Data Sheet Ref.', dsRef(p, it), 'Delivered status', out ? 'Out of Tolerance' : 'In Tolerance')]);
        h += '<h4>' + (k ? '' : '1 - ') + 'Calibration Results' + (it.unit ? ' (' + esc(it.unit) + ')' : '') + '</h4>' + htmlTbl([dirs ? ['Point', 'Reference', 'Reading ↑', 'Deviation ↑', 'Reading ↓', 'Deviation ↓', 'Accepted Limits'] : ['Point', 'Reference', 'UUT Reading', 'Deviation', 'Accepted Limits', 'Status']].concat(pr.rows.slice(k, k + ROWS_PER_PAGE).map(function (r) { return dirs ? [r.point, r.ref, r.cells[0], r.cells[1], r.cells[2], r.cells[3], r.limit] : [r.point, r.ref, r.cells[0], r.cells[1], r.limit, 'Accepted']; })), true);
        if (k + ROWS_PER_PAGE >= pr.rows.length) h += '<h4>Remarks</h4>' + htmlTbl([[{ t: 'Calibrated By:', b: 1 }, '', { t: 'Approved By:', b: 1 }, ''], kv('Date:', dmy(inf.iss), 'Position:', g.approverPos), kv('Position:', g.techPos, 'Name:', g.approver), kv('Name:', 'Eng. ' + String(inf.tech).replace(/^Eng\.\s*/i, ''), 'Signature:', '____________'), kv('Signature:', '____________', '', '')]) +
          '<p class="nt">** The recalibration date & accepted limits have been included in response to the customer\'s request. The customer has specified the calibration interval & acceptance criteria.</p><p class="nt">This Certificate and Readings refers only to the particular item under calibration. The reported uncertainty is based on a standard uncertainty multiplied by a coverage factor k = 2, providing a level of confidence of approximately 95 %.</p>';
        pages.push(h + ftr(form, pg++, total) + '</section>'); } }); });
  var css = '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#000;background:#fff}.pg{page-break-after:always;break-after:page;min-height:270mm;position:relative;padding-bottom:16mm}.pg:last-child{page-break-after:auto}.ph{text-align:center;margin-bottom:8px}.ph .t{font-size:16pt;font-weight:bold;color:#13294B}.ph .s{font-size:7pt}h4{font-size:9pt;margin:8px 0 4px}table.pt{width:100%;border-collapse:collapse;font-size:8pt;table-layout:fixed;page-break-inside:avoid}table.pt td,table.pt th{border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:middle;word-break:normal;overflow-wrap:anywhere}table.pt th,.b{font-weight:bold;background:#E7ECF2}.nt{font-size:6.5pt;text-align:justify;margin:4px 0}.pf{position:absolute;bottom:0;left:0;right:0;font-size:7pt;display:flex;justify-content:space-between;border-top:1px solid #999;padding-top:3px}';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(p.company.name) + ' – certificates</title><style>' + css + '</style></head><body>' + pages.join('') + '</body></html>'; }

/* --- the Certificates tab --- */
function tGen(p) { var g = genDefaults(p), groups = genGroups(p), iss = genIssues(p), ph = phList(p), inf = p.info || {};
  if (!g.addr && !p.genAddrTried && spOn()) { p.genAddrTried = true; findAddress(p).then(function () { if (PT.tab === 'gen' && !sheetFn) tGen(p); }); }
  var F = function (k, l, ph2) { return '<label class="f"><span>' + l + '</span><input class="inp" data-g="' + k + '" value="' + esc(g[k]) + '"' + (ph2 ? ' placeholder="' + esc(ph2) + '"' : '') + '></label>'; };
  $('#pm').innerHTML = (iss.length ? '<div class="note warnbox"><b>Before the final PDF:</b><br>' + iss.map(esc).join('<br>') + '</div>' : '<div class="note" style="background:var(--office-soft);color:#14603C">Everything needed is filled in.</div>') +
    (ph.length ? '<div class="note" style="background:var(--service-soft);color:#6A4300"><b>' + ph.length + ' points use last year\'s readings as placeholders</b> (missing or OUT). Those certificates must be replaced before going to the customer. <a href="#" id="phR" style="color:inherit;font-weight:700">See the list</a></div>' : '') +
    (function () { var noRef = p.items.filter(function (it) { return !(it.refs || []).length; }).length, sug = p.items.filter(function (it) { return it.refAuto; }).length;
      return '<div class="card bar" style="--c:' + (noRef ? 'var(--danger)' : 'var(--office)') + '"><h3>References for all ' + p.items.length + ' certificates</h3><div class="meta">' + (noRef ? noRef + ' without a reference' : 'Every item has a reference') + (sug ? ' · ' + sug + ' suggested, not confirmed yet' : '') + '</div><div class="cf">' + (noRef ? '<button class="btn sm" id="gAuto">Suggest for all missing</button>' : '') + '<button class="btn ghost sm" id="gRefs">Review</button></div></div>'; })() +
    '<div class="sec" style="margin-top:4px"><h2>Certificate numbers</h2></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' + F('prefix', 'Prefix', 'e.g. 10/EP- or 62-') + F('start', 'First number', 'e.g. 940') + '</div>' +
    '<div class="small" style="margin:-6px 0 10px">Example: <b>' + esc(String(g.start).trim() ? certNo(g, parseInt(g.start, 10)) : certNo(g, 1).replace(/\d+(?=-\d{4}$)/, 'NNN')) + '</b></div>' +
    '<div class="sec"><h2>Customer</h2>' + (spOn() ? '<button class="btn ghost sm" id="adr">From last cover</button>' : '') + '</div>' + F('addr', 'ADDRESS') + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' + F('tel', 'Tel No.') + F('fax', 'Fax No.') + '</div>' + F('loc', 'Location (on the cover)', 'e.g. QC LAB.') +
    '<div class="sec"><h2>Signatures</h2></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' + F('techPos', 'Calibrated by – position') + F('interval', 'Calibration interval') + F('approver', 'Approved by') + F('approverPos', 'Approved by – position') + '</div>' +
    '<div class="sec"><h2>Covers and certificates</h2><small>' + groups.length + ' covers · ' + p.items.length + ' certificates</small></div>' +
    groups.map(function (gr) { return '<div class="mach"><div class="mach-h"><b>' + esc(gr.machine ? gr.machine.name : (gr.items[0].description || 'Units')) + '</b><span class="small">' + esc(gr.from ? (gr.items.length > 1 ? gr.from + ' → ' + gr.to : gr.from) : 'no number yet') + '</span></div>' +
      gr.items.map(function (it) { return '<div class="row"><span class="t"><b>' + esc(it.certNo || '—') + ' · ' + esc(it.code || it.description) + '</b><small>Data sheet ref. <input class="inp" data-ds="' + it.id + '" value="' + esc(dsRef(p, it)) + '" style="height:32px;width:110px;display:inline-block;padding:0 6px"> · Price <input class="inp" data-pr="' + it.id + '" value="' + esc(g.prices[it.id] || '') + '" inputmode="decimal" placeholder="Lump sum" style="height:32px;width:100px;display:inline-block;padding:0 6px"></small></span></div>'; }).join('') + '</div>'; }).join('') +
    '<div class="sec"><h2>Receipt letter</h2></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">' + F('signer', 'Signed by') + F('signerPos', 'Position') + '</div>' +
    '<div class="cf"><button class="btn" id="gW">Word files (.zip)</button><button class="btn blue" id="gP">' + (iss.length || ph.length ? 'Preview / print (draft)' : 'Print / PDF') + '</button></div>' +
    '<div class="small" style="margin-top:8px">Word: for every cover a “… cover page.docx” and a “… cal. cert.docx”, plus the receipt letter. One font (Arial), all borders, page X of N. ' + (iss.length || ph.length ? 'The final PDF waits until nothing is missing.' : '') + '</div>';
  $$('[data-g]').forEach(function (e) { e.onchange = function () { g[e.dataset.g] = e.value.trim(); saveProjects(); tGen(p); }; });
  var ga = $('#gAuto'); if (ga) ga.onclick = function () { var n = autoRefs(p, true); toast(n + ' references suggested – review them'); tGen(p); };
  var gr2 = $('#gRefs'); if (gr2) gr2.onclick = function () { gotoStep(p, 'refs'); };
  $$('[data-ds]').forEach(function (e) { e.onchange = function () { g.dsr[e.dataset.ds] = e.value.trim(); saveProjects(); }; });
  $$('[data-pr]').forEach(function (e) { e.onchange = function () { g.prices[e.dataset.pr] = e.value.trim(); saveProjects(); }; });
  var ad = $('#adr'); if (ad) ad.onclick = function () { ad.disabled = true; ad.innerHTML = '<span class="spin dark"></span>'; findAddress(p, true).then(function () { tGen(p); }); };
  var r = $('#phR'); if (r) r.onclick = function (e) { e.preventDefault(); phSheet(p); };
  $('#gW').onclick = function () { if (!String(g.start).trim()) return toast('Write the first certificate number', true); var b = buildAll(p); dlZip(b.files, (p.company.name + ' ' + monYear(inf.cal) + ' certificates').trim() + '.zip'); };
  $('#gP').onclick = function () { if (!String(g.start).trim()) return toast('Write the first certificate number', true); openPrint(p, iss.length || ph.length); };
}
function dlZip(files, name) { var z = zipFiles(files.map(function (f) { return { name: f.name, data: f.data }; }));
  if (CL.on) return clSave(new Blob([z], { type: 'application/zip' }), name).then(function () { toast('Downloaded'); }).catch(function (e) { if (!e || e.code !== 'declined') toast((e && e.message) || 'Not downloaded', true); });
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([z], { type: 'application/zip' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function openPrint(p, draft) { var html = printView(p);
  if (CL.on) return clSave(new Blob([html], { type: 'text/html' }), p.company.name + ' certificates – print.html').then(function () { toast('Open the file in Chrome and print it as PDF'); }).catch(function (e) { if (!e || e.code !== 'declined') toast((e && e.message) || 'Not saved', true); });
  if (draft) toast('Draft – the final PDF waits until nothing is missing', true);
  var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
  fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close(); setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast('Printing is not allowed here', true); } setTimeout(function () { fr.remove(); }, 4000); }, 400); }
function phSheet(p) { openSheet(function () { var L = phList(p); return { title: 'Placeholder report', body: '<div class="note warnbox">These points use last year\'s readings in the certificate. Re-measure with the technician; when the new reading is in, the certificate is made again. They must be replaced before going to the customer.</div>' +
  '<div class="list">' + L.map(function (x) { return '<div class="row"><span class="t"><b>' + esc(x.cert || '—') + ' · ' + esc(x.code) + ' · point ' + esc(x.point) + '</b><small>' + (x.why === 'OUT' ? 'OUT · reading ' + x.reading + ' · limit ±' + x.lim + ' · beyond by ' + (+(Math.abs(x.dev) - x.lim).toFixed(6)) : 'No new reading yet') + '</small></span></div>'; }).join('') + '</div>', foot: '<button class="btn" id="phc">Done</button>', mount: function () { $('#phc').onclick = closeSheet; } }; }); }
function findAddress(p, loud) { var g = genDefaults(p), code = p.company.code || '';
  var q = (g.prefix ? g.prefix.replace(/[\/-]+$/, '') : code) + ' cover page';
  return spSearch(q, 15).then(function (fs) { fs = fs.filter(function (f) { return /cover/i.test(f.name); }).sort(function (a, b) { return String(b.mod).localeCompare(String(a.mod)); });
    if (!fs.length) { if (loud) toast('No old cover page found', true); return; }
    return pdfPages(fs[0].driveId, fs[0].id).then(function (pages) { var t = pages.map(function (pg) { return pg.join(' '); }).join(' ').replace(/\s+/g, ' ');
      var m = t.match(/ADDRESS\s*:?\s*(.+?)\s*(Tel|DATE RECEIVED|Fax)/i), tl = t.match(/Tel\.?\s*No\.?\s*:?\s*([0-9 +\-–]{6,})/i), fx = t.match(/Fax\.?\s*No\.?\s*:?\s*([0-9 +\-–]{6,})/i);
      if (m && !g.addr) g.addr = tidy(m[1]).replace(/\s*-\s*/g, ' - '); if (tl && !g.tel) g.tel = tl[1].trim(); if (fx && !g.fax) g.fax = fx[1].trim(); saveProjects(); if (loud) toast(g.addr ? 'Address taken from ' + fs[0].name : 'Address not found in the cover', !g.addr); }); }).catch(function (e) { if (loud) toast(e.message, true); }); }

/* ================= assistant: last year's work (from the receipt letters in Certificates/Reports <year>) ================= */
var LY_CACHE = LS.get('lyCache', {}); /* fileId|mod → rows */
function lyYear(off) { return new Date().getFullYear() + (off || 0); }
function lyLetterFiles(p) { /* the customer's letters file(s) in Reports <last year> and <this year> */
  var terms = p ? companyTerms(p.company).slice(0, 2) : ['Reports'];
  return Promise.all(terms.map(function (t) { return spSearch(t, 40).catch(function () { return []; }); })).then(function (rs) {
    var seen = {}, out = [];
    [].concat.apply([], rs).forEach(function (f) { if (seen[f.id] || !/\.docx?$/i.test(f.name)) return; var pa = pathOf(f), m = pa.match(/\/Reports\s*(20\d\d)\//i); if (!m) return; seen[f.id] = 1; f.year = +m[1]; out.push(f); });
    return out.sort(function (a, b) { return b.year - a.year; }); }); }
function lyRowsFromText(txt) { /* web mode: one row per line that has a certificate number */
  var rows = [];
  txt.split(/\n+/).forEach(function (l) { var c = l.match(/(\d{1,3}\s*\/?\s*[A-Z]{0,4}\s*-\s*\d{2,5}\s*-\s*20\d\d)/), d = l.match(/\b(Jan|Feb|Mar|Apr|May|Jun|June|Jul|July|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*-?\s*(\d{2,4})\b/gi);
    if (!c || !d) return; var parts = l.split(/\s*\|\s*/);
    rows.push({ item: parts[1] || '', code: parts[2] || '', cal: d[0], due: d[1] || '', certNo: c[1].replace(/\s+/g, ''), price: parts[parts.length - 1] || '' }); });
  return rows; }
function lyExtract(f) { /* rows of all letters in one file */
  var key = f.id + '|' + f.mod; if (LY_CACHE[key]) return Promise.resolve(LY_CACHE[key]);
  return pdfPages(f.driveId, f.id).then(function (pages) { var txt = pages.map(function (pg) { return pg.join('\n'); }).join('\n');
    if (!CL.on) return lyRowsFromText(txt);
    return CL.ready.then(function () { if (!CL.sample) return lyRowsFromText(txt);
      var chunks = [], step = 18000; for (var i = 0; i < txt.length; i += step) chunks.push(txt.slice(i, i + step));
      return chunks.reduce(function (pr, ch) { return pr.then(function (acc) { return CL.sample.json('This text comes from receipt letters (خطاب استلام) of a calibration lab. Each letter has a date (التاريخ), maybe a P.O number, and a table: No. | Item To be Calibrated | Code or Serial | Cal. Date | Due Date | Cert. No. | Unit Price.\n' +
        'Return every table row as JSON. "machine" = the machine/system name if the item text starts with one (e.g. "Water station", "Autoclave …"), else "". "item" = the instrument. Copy codes, dates, certificate numbers and prices exactly (only remove spaces inside a certificate number: "260 - 001 - 2026" → "260-001-2026"). Do not invent rows.\n' +
        'JSON only: {"rows":[{"letterDate":"","po":"","machine":"","item":"","code":"","cal":"","due":"","certNo":"","price":""}]}\n\nTEXT:\n"""\n' + ch + '\n"""', { modelTier: 'default' }).then(function (j) { return acc.concat((j && j.rows) || []); }); }); }, Promise.resolve([])); }); })
    .then(function (rows) { LY_CACHE[key] = rows; try { LS.set('lyCache', LY_CACHE); } catch (e) {} return rows; }); }
var MIDX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
function lyMonth(s) { var m = String(s || '').match(/([A-Za-z]{3,5})\.?\s*-?\s*(\d{2,4})/); if (!m) return null; var k = MIDX[m[1].toLowerCase()]; if (k == null) return null; var y = +m[2]; if (y < 100) y += 2000; return { m: k, y: y, key: y + '-' + String(k + 1).padStart(2, '0'), label: MON[k] + ' ' + y }; }
/* items step: "From last year" */
function lastYearSheet(p) { var st = { busy: true, rows: [], files: [], err: '', sel: null, on: {} };
  openSheet(function () { var groups = {}; st.rows.forEach(function (r, i) { var mm = lyMonth(r.cal); var k = mm ? mm.key : 'other'; (groups[k] = groups[k] || { label: mm ? mm.label : 'No date', rows: [], pos: {} }).rows.push(i); if (r.po) groups[k].pos[r.po] = 1; });
    var keys = Object.keys(groups).sort().reverse(), g = null;
    var prevKey = function (k) { var a = k.split('-').map(Number), d = new Date(a[0], a[1] - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    if (st.sel && groups[st.sel]) { var pk = prevKey(st.sel), pg = st.withPrev !== false ? groups[pk] : null, seenC = {}, rowsAll = [];
      groups[st.sel].rows.forEach(function (i) { var c = norm(st.rows[i].code); if (c) seenC[c] = 1; rowsAll.push({ i: i, prev: false }); });
      if (pg) pg.rows.forEach(function (i) { var c = norm(st.rows[i].code); if (c && seenC[c]) return; rowsAll.push({ i: i, prev: true }); });
      g = { label: groups[st.sel].label, prevLabel: groups[pk] ? groups[pk].label : '', hasPrev: !!groups[pk], list: rowsAll, nMain: groups[st.sel].rows.length, nPrev: rowsAll.length - groups[st.sel].rows.length }; }
    return { title: 'From last year', body: st.busy ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Reading the receipt letters of ' + esc(p.company.name) + '…</b>Certificates / Reports ' + lyYear(-1) + ' and ' + lyYear() + '</div>'
      : st.err ? '<div class="note warnbox">' + esc(st.err) + '</div>'
      : !st.rows.length ? '<div class="empty"><b>No receipt letters found for this company</b>Use photo, Excel or Add item.</div>'
      : (!g ? '<div class="note">Choose the month to copy – you can edit the list after.</div><div class="list">' + keys.map(function (k) { var x = groups[k]; return '<button class="row" data-mo="' + k + '"><span class="t"><b>' + esc(x.label) + '</b><small>' + x.rows.length + (x.rows.length === 1 ? ' item' : ' items') + (Object.keys(x.pos).length ? ' · PO ' + esc(Object.keys(x.pos).join(', ')) : '') + '</small></span><span class="pill">Due ' + esc(dueOf(x.label)) + '</span></button>'; }).join('') + '</div>'
        : '<div class="note"><b>' + esc(g.label) + '</b> – untick what is not in this year\'s order. The old certificate number of each item is kept, so its certificate is found right away.</div>' +
          (g.hasPrev ? '<button class="row' + (st.withPrev !== false ? ' sel' : '') + '" id="lyP" style="border:1px solid var(--line);border-radius:12px;margin-bottom:10px;background:var(--surface)"><span class="check">' + (st.withPrev !== false ? '✓' : '') + '</span><span class="t"><b>Also look in the month before (' + esc(g.prevLabel) + ')</b><small>Some companies do it one month earlier</small></span></button>' : '') +
          (g.nPrev ? '<div class="note" style="background:var(--service-soft);color:#6A4300">Take care: <b>' + g.nMain + '</b> item' + (g.nMain === 1 ? ' was' : 's were') + ' done in <b>' + esc(g.label) + '</b> and <b>' + g.nPrev + '</b> in <b>' + esc(g.prevLabel) + '</b> (marked in orange).</div>' : '') +
          '<div class="list">' + g.list.map(function (x) { var i = x.i, r = st.rows[i], on = st.on[i] !== false;
          return '<button class="row' + (on ? ' sel' : '') + '" data-ly="' + i + '"><span class="check">' + (on ? '✓' : '') + '</span><span class="t"><b>' + esc([r.machine, r.item].filter(Boolean).join(' – ')) + '</b><small>' + esc([r.code, r.certNo, r.price].filter(Boolean).join(' · ')) + '</small></span><span class="pill" style="--s-fg:' + (x.prev ? 'var(--service)' : 'var(--client)') + ';--s-bg:' + (x.prev ? 'var(--service-soft)' : 'var(--client-soft)') + '">' + esc(x.prev ? g.prevLabel : g.label) + '</span></button>'; }).join('') + '</div>'),
      foot: g ? '<button class="btn ghost" id="lyB">Other month</button><button class="btn" id="lyA">Add ' + g.list.filter(function (x) { return st.on[x.i] !== false; }).length + ' items</button>' : '',
      mount: function () { $$('[data-mo]').forEach(function (b) { b.onclick = function () { st.sel = b.dataset.mo; renderSheet(); }; });
        $$('[data-ly]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.ly; st.on[i] = st.on[i] === false; renderSheet(); }; });
        var bb = $('#lyB'); if (bb) bb.onclick = function () { st.sel = null; renderSheet(); };
        var lp = $('#lyP'); if (lp) lp.onclick = function () { st.withPrev = st.withPrev === false; renderSheet(); };
        var ba = $('#lyA'); if (ba) ba.onclick = function () { var have = {}; p.items.forEach(function (i) { if (i.code) have[norm(i.code)] = 1; }); var n = 0;
          var gg = sheetFn && g; (g ? g.list : []).forEach(function (x) { var i = x.i; if (st.on[i] === false) return; var r = st.rows[i]; if (r.code && have[norm(r.code)]) return; if (r.code) have[norm(r.code)] = 1;
            var mid = ''; if (r.machine) { var m = p.machines.filter(function (x) { return norm(x.name) === norm(r.machine); })[0]; if (!m) { m = { id: uid(), name: r.machine, code: '', dept: p.depts[0] || '' }; p.machines.push(m); } mid = m.id; }
            p.items.push(newItem({ machineId: mid, code: r.code, description: r.item, prevCert: r.certNo, src: 'last year', dept: p.depts[0] || '' })); n++; });
          saveProjects(); closeSheet(); toast(n + ' items copied from ' + groups[st.sel].label); queueOld(p); }; } }; });
  lyLetterFiles(p).then(function (fs) { st.files = fs; if (!fs.length) return [];
    var use = fs.filter(function (f) { return f.year >= lyYear(-1); }).slice(0, 3); return Promise.all(use.map(function (f) { return lyExtract(f).catch(function () { return []; }); })); })
    .then(function (rs) { st.rows = [].concat.apply([], rs || []); st.busy = false; if (sheetFn) renderSheet(); })
    .catch(function (e) { st.busy = false; st.err = e.message; if (sheetFn) renderSheet(); }); }
function dueOf(label) { var mm = lyMonth(label); return mm ? MON[mm.m] + ' ' + (mm.y + 1) : ''; }
/* home: what is due soon (from all receipt letters of last year) */
var DUE = LS.get('dueScan', null);
function dueScan() { var lastY = lyYear(-1); DUE = { busy: true, at: Date.now(), list: [], done: 0, n: 0 }; render();
  return spSearch('Reports ' + lastY, 50).then(function (fs) { fs = fs.filter(function (f) { return /\.docx?$/i.test(f.name) && new RegExp('/Reports\\s*' + lastY + '/', 'i').test(pathOf(f)); }); DUE.n = fs.length;
    return fs.reduce(function (pr, f) { return pr.then(function () { return lyExtract(f).then(function (rows) { var by = {};
      rows.forEach(function (r) { var mm = lyMonth(r.due) || (lyMonth(r.cal) ? { m: lyMonth(r.cal).m, y: lyMonth(r.cal).y + 1 } : null); if (!mm) return; var k = mm.y + '-' + String(mm.m + 1).padStart(2, '0'); (by[k] = by[k] || []).push(r); });
      Object.keys(by).forEach(function (k) { DUE.list.push({ file: f.name.replace(/\.docx?$/i, ''), fileId: f.id, month: k, count: by[k].length }); }); }).catch(function () {}).then(function () { DUE.done++; render(); }); }); }, Promise.resolve()); })
    .then(function () { DUE.busy = false; LS.set('dueScan', DUE); render(); }).catch(function (e) { DUE = { err: e.message }; render(); }); }
function dueCard() { if (!spOn()) return '';
  var now = new Date(), k0 = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'), n1 = new Date(now.getFullYear(), now.getMonth() + 1, 1), k1 = n1.getFullYear() + '-' + String(n1.getMonth() + 1).padStart(2, '0');
  if (!DUE || (!DUE.busy && !DUE.list)) return '<div class="card"><h3>What is due?</h3><div class="meta">Checks last year\'s receipt letters and tells you which customers are due this month and next month.</div><div class="cf"><button class="btn ghost" id="dueGo">Check now</button></div>' + (DUE && DUE.err ? '<div class="note warnbox" style="margin:10px 0 0">' + esc(DUE.err) + '</div>' : '') + '</div>';
  if (DUE.busy) return '<div class="card"><div class="okline"><span class="spin dark"></span> Reading last year\'s letters… ' + DUE.done + ' / ' + (DUE.n || '?') + '</div></div>';
  var soon = DUE.list.filter(function (x) { return x.month === k0 || x.month === k1; }).sort(function (a, b) { return a.month.localeCompare(b.month) || b.count - a.count; });
  var ml = function (k) { var a = k.split('-'); return MON[+a[1] - 1] + ' ' + a[0]; };
  return '<div class="card bar" style="--c:var(--service)"><h3>Due this month and next</h3><div class="meta">From last year\'s receipt letters · checked ' + fmtDate(DUE.at) + '</div>' +
    (soon.length ? '<div class="list" style="margin-top:10px">' + soon.map(function (x) { return '<div class="row"><span class="t"><b>' + esc(x.file) + '</b><small>' + x.count + ' items due ' + ml(x.month) + '</small></span></div>'; }).join('') + '</div>' : '<div class="small" style="margin-top:8px">Nothing due this month or next.</div>') +
    '<div class="cf"><button class="btn ghost sm" id="dueGo">Check again</button></div></div>'; }
/* ================= one flow: step bar from the company to the certificates ================= */
var FLOW = [['company', 'Company'], ['date', 'Cal. date'], ['dept', 'Department'], ['type', 'Order type'], ['order', 'Order'], ['items', 'Items'], ['certs', 'Old certs'], ['refs', 'References'], ['det', 'Details'], ['read', 'Readings'], ['gen', 'Certificates']];
var FIDX = {}; FLOW.forEach(function (f, i) { FIDX[f[0]] = i; });
function curStep(p) { return p.stage !== 'done' ? p.stage : (p.tab || 'certs'); }
function reach(p) { var i = FIDX[curStep(p)]; if (!(p.reached >= i)) p.reached = i; return p.reached; }
function stepBar(p) { var cur = FIDX[curStep(p)], r = reach(p);
  return '<div class="stepbar" id="stepbar"><button id="goHome" class="ok"><i>⌂</i><span>Projects</span></button>' + FLOW.map(function (f, i) { var cls = i === cur ? 'on' : (i <= r ? 'ok' : '');
    return '<button class="' + cls + '" data-step="' + f[0] + '"' + (i > r ? ' disabled' : '') + '><i>' + (i !== cur && i <= r ? '✓' : i + 1) + '</i><span>' + f[1] + '</span></button>'; }).join('') + '</div>'; }
function bindStepBar(p) { var sb = $('#stepbar'); if (!sb) return; var on = sb.querySelector('.on'); if (on) sb.scrollLeft = on.offsetLeft - 40;
  $$('[data-step]').forEach(function (b) { b.onclick = function () { gotoStep(p, b.dataset.step); }; }); }
function gotoStep(p, s) { if (FIDX[s] > reach(p)) return; if (FIDX[s] <= FIDX.items) { p.stage = s; } else { p.stage = 'done'; p.tab = s; } p.reached = Math.max(p.reached || 0, FIDX[s]); saveProjects(); W.q = ''; W.busy = false; render(); window.scrollTo(0, 0); }
function projFoot(p) { var k = FIDX[curStep(p)], nx = FLOW[k + 1];
  return '<div class="wiz-foot"><div><button class="btn ghost" id="pBack">Back</button>' + (nx ? '<button class="btn blue" id="pNext">Next: ' + nx[1] + '</button>' : '') + '</div></div>'; }
function bindProjFoot(p) { var k = FIDX[curStep(p)];
  $('#pBack').onclick = function () { gotoStep(p, FLOW[k - 1][0]); };
  var n = $('#pNext'); if (n) n.onclick = function () { var nx = FLOW[k + 1]; if (nx) { p.reached = Math.max(p.reached || 0, k + 1); gotoStep(p, nx[0]); } }; }

/* ================= items: find a code that was calibrated before ================= */
function findSheet(p) { var st = { q: '', busy: false, res: [], err: '' }, timer = null;
  var many = function () { return st.q.split(/[\n,;]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 2; }); };
  var runMany = function (list) { st.busy = true; st.multi = []; renderSheet(); var i = 0;
    var next = function () { if (i >= list.length) { st.busy = false; renderSheet(); return; } var c = list[i++];
      spSearch('"' + c + '"', 25).then(function (fs) { fs = fs.filter(function (f) { return /cal\.?\s*cert/i.test(f.name) && !/cover/i.test(f.name); }).sort(function (a, b) { return yearOf(b) - yearOf(a); }); var f = fs[0];
        var txt = f ? (f.summary || '') : '', cn = (txt.match(/CERTI\s*FICATE\s*NO\.?\s*:?\s*([0-9A-Z][0-9A-Z \/\-]{2,24}?\d{4})/i) || [])[1];
        st.multi.push({ code: c, found: !!f, certNo: cn ? cn.replace(/\s+/g, '') : '', folder: f ? pathOf(f).replace(/^.*\/Certificates\//i, '').split('/').slice(0, 2).join(' / ') : '', on: !!f }); })
        .catch(function () { st.multi.push({ code: c, found: false, on: false }); }).then(function () { st.done = i; renderSheet(); next(); }); };
    next(); };
  var run = function () { var q = st.q.trim(); if (/[\n,;]/.test(q)) { st.res = []; return runMany(many()); } st.multi = null; if (q.length < 2) { st.res = []; renderSheet(); return; } st.busy = true; renderSheet();
    var terms = companyTerms(p.company), toks = terms.map(function (t) { return t.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).filter(function (w) { return w.length > 2 && !/pharma|company|egypt|for|the|and/.test(w); }); });
    spSearch(q.indexOf(' ') > 0 ? '"' + q + '"' : q + '*', 40).then(function (fs) { var seen = {}, out = [];
      fs.filter(function (f) { return /cal\.?\s*cert/i.test(f.name) && !/cover/i.test(f.name); }).forEach(function (f) {
        var pa = pathOf(f).toLowerCase(), mine = toks.some(function (ws) { return ws.some(function (w) { return pa.indexOf(w) >= 0; }); }) || (p.company.code && f.name.indexOf(String(p.company.code).replace(/[A-Z]+$/i, '')) === 0);
        var txt = (f.summary || '') + ' ', codes = [], m, re = /Code\s*:?\s*([A-Z0-9][A-Za-z0-9\-\/ ]{1,18}?)(?=\s+(?:Calibration|Range|Cal\.|Model|Serial|Description|Manufacturer|$))/g;
        while ((m = re.exec(txt))) codes.push(m[1].trim());
        var cn = (txt.match(/CERTI\s*FICATE\s*NO\.?\s*:?\s*([0-9A-Z][0-9A-Z \/\-]{2,24}?\d{4})/i) || [])[1], ds = (txt.match(/Description\s+(.+?)\s+(?:Calibration|Code)/i) || [])[1], mf = (txt.match(/Manufacturer\s+(.+?)\s+(?:Calibration|Description)/i) || [])[1];
        var nq = norm(q), hit = codes.filter(function (c) { return norm(c).indexOf(nq) >= 0; });
        (hit.length ? hit : [q.toUpperCase()]).forEach(function (c) { var k = norm(c) + '|' + f.id; if (seen[k]) return; seen[k] = 1;
          out.push({ code: c, certNo: cn ? cn.replace(/\s+/g, '') : '', desc: ds || '', man: mf || '', file: f.name, folder: pathOf(f).replace(/^.*\/Certificates\//i, '').split('/').slice(0, 2).join(' / '), mine: mine ? 1 : 0, exact: hit.length ? 1 : 0, yr: yearOf(f) }); }); });
      out.sort(function (a, b) { return (b.mine - a.mine) || (b.exact - a.exact) || (b.yr - a.yr); }); st.res = out.slice(0, 30); st.busy = false; st.err = ''; renderSheet(); })
      .catch(function (e) { st.busy = false; st.err = e.message; renderSheet(); }); };
  openSheet(function () { return { title: 'Find a code', body:
    '<textarea class="inp" id="fq" rows="2" style="height:auto;min-height:52px" placeholder="Type a code or part of it (e.g. QIII). Several codes: separate them with commas or new lines">' + esc(st.q) + '</textarea>' +
    (st.multi ? (st.busy ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Searching ' + (st.done || 0) + ' of ' + many().length + '…</b></div>' : '') +
      '<div class="list" style="margin-top:10px">' + st.multi.map(function (r, i) { return '<button class="row' + (r.on ? ' sel' : '') + '" data-mm="' + i + '"' + (r.found ? '' : ' disabled') + '><span class="check">' + (r.on ? '✓' : '') + '</span><span class="t"><b>' + esc(r.code) + '</b><small>' + esc(r.found ? [r.certNo, r.folder].filter(Boolean).join(' · ') : 'No old certificate found') + '</small></span></button>'; }).join('') + '</div>' +
      (!st.busy && st.multi.some(function (r) { return r.on; }) ? '<div class="cf"><button class="btn" id="mmAdd">Add ' + st.multi.filter(function (r) { return r.on; }).length + ' codes</button></div>' : '') : '') +
    (st.multi ? '' :
    (!spOn() ? '<div class="note warnbox">SharePoint is not connected.</div>' : st.err ? '<div class="note warnbox">' + esc(st.err) + '</div>' : st.busy ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Searching the old certificates…</b></div>'
      : st.q.trim().length < 2 ? '<div class="small">Searches all old certificates on SharePoint. This company\'s come first.</div>'
      : st.res.length ? '<div class="list">' + st.res.map(function (r, i) { var have = p.items.some(function (x) { return norm(x.code) === norm(r.code); });
          return '<button class="row" data-fr="' + i + '"' + (have ? ' disabled style="opacity:.5"' : '') + '><span class="t"><b>' + esc(r.code) + (r.desc ? ' · ' + esc(r.desc) : '') + '</b><small>' + esc([r.certNo, r.folder].filter(Boolean).join(' · ')) + '</small></span>' + (have ? '<span class="pill">Added</span>' : r.mine ? '<span class="pill" style="--s-fg:var(--office);--s-bg:var(--office-soft)">This company</span>' : '<span class="pill" style="--s-fg:var(--muted);--s-bg:var(--oos-soft)">Other company</span>') + '</button>'; }).join('') + '</div>'
      : '<div class="empty"><b>Not found</b>Try fewer letters, or add it with “Add an item”.</div>')),
    foot: '<button class="btn ghost" id="fGo">Search</button><button class="btn" id="fDone">Done</button>',
    mount: function () { $('#fGo').onclick = function () { st.q = $('#fq').value; run(); }; var i = $('#fq'); if (!st.busy) i.focus(); var pos = st.q.length; try { i.setSelectionRange(pos, pos); } catch (e) {}
      i.oninput = function () { st.q = i.value; clearTimeout(timer); if (/[\n,;]/.test(st.q)) return; timer = setTimeout(run, 450); };
      i.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && /[\n,;]/.test(st.q + '\n') && st.q.indexOf(',') + st.q.indexOf(';') + st.q.indexOf('\n') > -3) { } };
      i.onblur = function () { if (/[\n,;]/.test(st.q) && !st.busy && !(st.multi && st.multi.length)) run(); };
      $$('[data-mm]').forEach(function (b) { b.onclick = function () { var r = st.multi[+b.dataset.mm]; r.on = !r.on; renderSheet(); }; });
      var ma = $('#mmAdd'); if (ma) ma.onclick = function () { var have = {}, n = 0; p.items.forEach(function (x) { have[norm(x.code)] = 1; });
        st.multi.forEach(function (r) { if (!r.on || have[norm(r.code)]) return; have[norm(r.code)] = 1; p.items.push(newItem({ code: r.code, prevCert: r.certNo, src: 'find', dept: p.depts[0] || '' })); n++; });
        saveProjects(); closeSheet(); toast(n + ' codes added – loading their certificates'); queueOld(p); };
      $$('[data-fr]').forEach(function (b) { b.onclick = function () { var r = st.res[+b.dataset.fr];
        p.items.push(newItem({ code: r.code, description: r.desc, manufacturer: r.man, prevCert: r.certNo, src: 'find', dept: p.depts[0] || '' })); saveProjects(); toast(r.code + ' added'); renderSheet(); queueOld(p); }; });
      $('#fDone').onclick = closeSheet; } }; }); }

/* ================= references: a suggestion for every item ================= */
function itemSpan(it) { var f = (it.old && it.old.fields) || {}, n = oldNums(f);
  var u = unitKey(it.unit || n.unit), lo = isNum(it.cMin) ? numv(it.cMin) : isNum(it.rMin) ? numv(it.rMin) : isNum(n.rMin) ? numv(n.rMin) : null, hi = isNum(it.cMax) ? numv(it.cMax) : isNum(it.rMax) ? numv(it.rMax) : isNum(n.rMax) ? numv(n.rMax) : null;
  return { u: u, lo: lo, hi: hi }; }
function refOptions(p, it) { var s = itemSpan(it), inf = p.info || {}; if (!UCAT[s.u] || s.lo == null || s.hi == null) return [];
  return labDevices().map(function (d) { var r = devRange(d); if (!r || !UCAT[r.unit] || UCAT[r.unit][1] !== UCAT[s.u][1]) return null;
    var dl = toBase(r.lo, r.unit), dh = toBase(r.hi, r.unit), il = toBase(s.lo, s.u), ih = toBase(s.hi, s.u); if (dl > il + 1e-9 || dh < ih - 1e-9) return null;
    return { d: d, ex: refExpired(d, inf) ? 1 : 0, span: dh - dl }; }).filter(Boolean).sort(function (a, b) { return (a.ex - b.ex) || (a.span - b.span); }); }
function syncRefs(p) { var all = {}; p.items.forEach(function (it) { (it.refs || []).forEach(function (id) { all[id] = 1; }); }); p.info.refs = Object.keys(all); p.info.refRes = p.info.refRes || {};
  var memo = LS.get('refRes', {}); p.info.refs.forEach(function (id) { if (!p.info.refRes[id] && memo[id]) p.info.refRes[id] = memo[id]; }); saveProjects(); }
function autoRefs(p, onlyMissing) { var n = 0; p.items.forEach(function (it) { if (onlyMissing && (it.refs || []).length) return; var o = refOptions(p, it)[0]; if (o) { it.refs = [o.d.id]; it.refAuto = true; n++; } }); syncRefs(p); return n; }
function tRefs(p) { p.info = p.info || {}; var ds = labDevices(), byId = {}; ds.forEach(function (d) { byId[d.id] = d; });
  p.items.forEach(function (it) { if (it.refs == null) { var o = refOptions(p, it)[0]; it.refs = o ? [o.d.id] : []; it.refAuto = !!o; } }); syncRefs(p);
  var miss = p.items.filter(function (it) { return !(it.refs || []).length; }).length, auto = p.items.filter(function (it) { return it.refAuto && (it.refs || []).length; }).length;
  $('#pm').innerHTML = '<div class="note">For every item the app suggests the reference whose range and unit cover the item\'s calibration range (valid certificates first). Tap another one to change it.</div>' +
    (auto ? '<div class="cf" style="margin-top:0"><button class="btn" id="rAll">Confirm all ' + auto + ' suggestions</button></div>' : '') +
    (miss ? '<div class="note warnbox">' + miss + ' item' + (miss > 1 ? 's have' : ' has') + ' no matching reference – check its range and unit, or pick one with “Other…”.</div>' : '') +
    p.items.map(function (it) { var opts = refOptions(p, it), s = itemSpan(it), cur = it.refs || [];
      return '<div class="card" style="padding:12px 14px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div style="min-width:0"><b>' + esc(it.code || '—') + ' · ' + esc(it.description || ((it.old || {}).fields || {}).description || '') + '</b><div class="meta">' + (s.lo != null && s.hi != null ? '(' + s.lo + ' : ' + s.hi + ') ' + esc(s.u) : 'No range / unit yet') + '</div></div>' +
        (it.refAuto && cur.length ? '<span class="pill" style="--s-fg:var(--service);--s-bg:var(--service-soft)">Suggested</span>' : cur.length ? '<span class="pill" style="--s-fg:var(--office);--s-bg:var(--office-soft)">OK</span>' : '<span class="pill" style="--s-fg:var(--danger);--s-bg:var(--danger-soft)">None</span>') + '</div>' +
        '<div class="chips">' + opts.slice(0, 6).map(function (o) { var on = cur.indexOf(o.d.id) >= 0;
          return '<button class="chip' + (on ? ' on' : '') + '" data-rf="' + it.id + '|' + o.d.id + '"' + (o.ex ? ' style="border-color:var(--danger);' + (on ? 'background:var(--danger)' : 'color:var(--danger)') + '"' : '') + '>' + esc(o.d.manufacturer + ' ' + o.d.model) + ' · ' + esc(String(o.d.serial).slice(-6)) + (o.ex ? ' · expired' : '') + '</button>'; }).join('') +
          cur.filter(function (id) { return !opts.some(function (o) { return o.d.id === id; }); }).map(function (id) { var d = byId[id]; return d ? '<button class="chip on" data-rf="' + it.id + '|' + id + '">' + esc(d.manufacturer + ' ' + d.model) + '</button>' : ''; }).join('') +
          '<button class="chip" data-ra="' + it.id + '">Other…</button></div>' +
        (cur.length && opts.length ? '<div class="cf" style="margin-top:8px"><button class="btn ghost sm" data-same="' + it.id + '" style="flex:none">Use for all items like this</button></div>' : '') + '</div>'; }).join('') +
    (p.info.refs.length ? '<div class="sec"><h2>Resolution of each reference</h2><small>required</small></div><div class="list">' + p.info.refs.map(function (id) { var d = byId[id]; if (!d) return ''; var rv = p.info.refRes[id] || '';
      return '<div class="row"><span class="t"><b>' + esc(d.manufacturer + ' ' + d.description) + '</b><small>' + esc([d.model, 'S/N ' + d.serial, d.range].filter(Boolean).join(' · ')) + '</small></span><input class="inp' + (isNum(rv) ? '' : ' bad') + '" data-rr="' + id + '" value="' + esc(rv) + '" inputmode="decimal" placeholder="Resolution" style="width:110px;height:42px;text-align:center"' + (isNum(rv) ? ' readonly' : '') + '>' + (isNum(rv) ? '<button class="icon-btn" data-rre="' + id + '" style="color:var(--muted)">' + I.edit + '</button>' : '') + '</div>'; }).join('') + '</div>' : '');
  var redo = function () { syncRefs(p); tRefs(p); };
  var ra = $('#rAll'); if (ra) ra.onclick = function () { p.items.forEach(function (it) { it.refAuto = false; }); redo(); toast('References confirmed'); };
  $$('[data-rf]').forEach(function (b) { b.onclick = function () { var a = b.dataset.rf.split('|'), it = p.items.filter(function (x) { return x.id === a[0]; })[0], i = (it.refs || []).indexOf(a[1]);
    if (i >= 0) it.refs.splice(i, 1); else { it.refs = (it.refs || []).concat(a[1]); var d = byId[a[1]]; if (d && refExpired(d, p.info)) toast('This reference\'s certificate is expired!', true); } it.refAuto = false; redo(); }; });
  $$('[data-same]').forEach(function (b) { b.onclick = function () { var src = p.items.filter(function (x) { return x.id === b.dataset.same; })[0], k = UCAT[itemSpan(src).u], n = 0;
    p.items.forEach(function (it) { if (it === src) return; var opts = refOptions(p, it), u = UCAT[itemSpan(it).u]; if (!u || !k || u[1] !== k[1]) return; if (src.refs.every(function (id) { return opts.some(function (o) { return o.d.id === id; }); })) { it.refs = src.refs.slice(); it.refAuto = false; n++; } });
    redo(); toast(n + ' items updated'); }; });
  $$('[data-ra]').forEach(function (b) { b.onclick = function () { var it = p.items.filter(function (x) { return x.id === b.dataset.ra; })[0]; pickRef(p, it, redo); }; });
  var memo = LS.get('refRes', {});
  $$('[data-rr]').forEach(function (e) { e.onchange = function () { var v = e.value.trim(); if (!isNum(v)) return toast('Resolution must be a number', true); p.info.refRes[e.dataset.rr] = v; memo[e.dataset.rr] = v; LS.set('refRes', memo); saveProjects(); tRefs(p); }; });
  $$('[data-rre]').forEach(function (b) { b.onclick = function () { var id = b.dataset.rre, was = p.info.refRes[id];
    $('#dlg-root').innerHTML = '<div class="dlg"><div><h3>Reference resolution</h3><p>Now: <b>' + esc(was) + '</b></p><input class="inp" id="rrv" inputmode="decimal" value="' + esc(was) + '"><div class="cf"><button class="btn ghost" id="rrc">Cancel</button><button class="btn" id="rrs">Save</button></div></div></div>';
    $('#rrc').onclick = function () { $('#dlg-root').innerHTML = ''; };
    $('#rrs').onclick = function () { var v = $('#rrv').value.trim(); $('#dlg-root').innerHTML = ''; if (!isNum(v)) return toast('Resolution must be a number', true); if (numv(v) === numv(was)) return;
      dialog('Are you sure?', 'The reference resolution changes from <b>' + esc(was) + '</b> to <b>' + esc(v) + '</b>.', 'Yes, I\'m sure').then(function (y) { if (!y) return; p.info.refRes[id] = v; memo[id] = v; LS.set('refRes', memo); saveProjects(); tRefs(p); }); }; }; });
}
function pickRef(p, it, done) { var q = '';
  openSheet(function () { var L = labDevices().filter(function (d) { return !q || norm(d.manufacturer + d.description + d.model + d.serial + d.category).indexOf(norm(q)) >= 0; });
    return { title: 'Reference for ' + esc(it.code || it.description), body: '<div class="search">' + I.search + '<input id="pq" placeholder="Search lab devices" value="' + esc(q) + '"></div><div class="list">' + L.slice(0, 80).map(function (d) { var on = (it.refs || []).indexOf(d.id) >= 0, ex = refExpired(d, p.info);
      return '<button class="row' + (on ? ' sel' : '') + '" data-pk="' + d.id + '"><span class="check">' + (on ? '✓' : '') + '</span><span class="t"><b>' + esc(d.manufacturer + ' ' + d.description) + '</b><small>' + esc([d.model, 'S/N ' + d.serial, d.range].filter(Boolean).join(' · ')) + '</small></span>' + (ex ? '<span class="pill" style="--s-fg:var(--danger);--s-bg:var(--danger-soft)">Expired</span>' : '') + '</button>'; }).join('') + '</div>',
      foot: '<button class="btn" id="pkD">Done</button>',
      mount: function () { var i = $('#pq'); i.oninput = function () { q = i.value; var pos = i.selectionStart; renderSheet(); var n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); };
        $$('[data-pk]').forEach(function (b) { b.onclick = function () { var id = b.dataset.pk, a = it.refs || (it.refs = []), k = a.indexOf(id); if (k >= 0) a.splice(k, 1); else a.push(id); it.refAuto = false; saveProjects(); renderSheet(); }; });
        $('#pkD').onclick = function () { closeSheet(); done(); }; } }; }); }
/* ================= start ================= */
window.addEventListener('popstate', function () { if (sheetFn) { sheetFn = null; renderSheet(); } });
Promise.all([MS.ready, CL.ready]).then(function () { if (S.session) boot(); else renderLogin(); });
})();
