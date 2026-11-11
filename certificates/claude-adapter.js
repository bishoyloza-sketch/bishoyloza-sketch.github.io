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
  return Promise.all([clCall(GDRIVE, 'download_file_content', { fileId: DATA_SHEET_ID, exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), needExcel()]).then(function (r) {
    var o = r[0].payload && r[0].payload.content ? r[0].payload : clObjs(r[0])[0]; if (!o || !o.content) throw new Error('Could not read the Akhnaton Devices data sheet');
    var bin = atob(o.content), buf = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    var wb = new ExcelJS.Workbook(); return wb.xlsx.load(buf.buffer).then(function () {
      var tab = function (name) { var ws = wb.getWorksheet(name); if (!ws) return []; var rows = []; ws.eachRow({ includeEmpty: false }, function (row) { rows.push(row.values.slice(1).map(function (v) { return v instanceof Date ? v.toISOString().slice(0, 10) : cellStr(v); })); });
        var h = rows.shift() || []; return rows.filter(function (x) { return x[0]; }).map(function (x) { var ob = {}; h.forEach(function (k, j) { ob[k] = x[j] == null ? '' : x[j]; }); return ob; }); };
      var tf = function (v) { return String(v).toLowerCase() !== 'false'; };
      CL_DB = { users: tab('Users').map(function (u) { return { id: u.id, name: u.name, role: u.role, active: tf(u.active) }; }).filter(function (u) { return u.active; }),
        companies: tab('Companies').map(function (c) { return { id: c.id, name: c.name, official: c.official, code: String(c.code || ''), group: c.group, active: tf(c.active), lastUsed: c.lastUsed }; }),
        devices: tab('Devices').map(function (d) { return { id: d.id, category: d.category, manufacturer: d.manufacturer, description: d.description, model: d.model, serial: d.serial, range: d.range, accuracy: d.accuracy, calDue: d.calDue, active: tf(d.active) }; }) };
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
