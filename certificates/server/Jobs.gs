/* Akhnaton Certificates – shared jobs server (Google Apps Script)
   Every job is kept as a JSON file in one Drive folder; the "Jobs" sheet is the index, "History" keeps who did what.
   Deploy: Deploy > New deployment > Web app · Execute as: Me · Who has access: Anyone. Put the /exec link in config.js (JOBS_URL). */
var KEY = 'akhnaton-jobs-2026';
var KEEP_DELETED_DAYS = 30;

function doGet() { return out({ ok: true, app: 'akhnaton-jobs' }); }
function doPost(e) {
  var b = {}; try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return out({ error: 'bad request' }); }
  if (b.key !== KEY) return out({ error: 'key' });
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { return out(handle(b)); } catch (x) { return out({ error: String(x && x.message || x) }); } finally { lock.releaseLock(); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function book() { var P = PropertiesService.getScriptProperties(), id = P.getProperty('SS'); if (id) { try { return SpreadsheetApp.openById(id); } catch (x) {} }
  var s = SpreadsheetApp.create('Akhnaton Certificates – Jobs'); P.setProperty('SS', s.getId());
  var j = s.getSheets()[0]; j.setName('Jobs'); j.appendRow(['id', 'company', 'rev', 'updated', 'byUser', 'byName', 'done', 'total', 'finished', 'deleted', 'fileId', 'created', 'createdBy']);
  s.insertSheet('History').appendRow(['time', 'user', 'name', 'jobId', 'company', 'action', 'detail']);
  s.insertSheet('Settings').appendRow(['Who sees the activity panel (one name per row). Leave empty = everyone.']);
  return s; }
function dir() { var P = PropertiesService.getScriptProperties(), id = P.getProperty('DIR'); if (id) { try { return DriveApp.getFolderById(id); } catch (x) {} }
  var f = DriveApp.createFolder('Akhnaton Certificates – Jobs'); P.setProperty('DIR', f.getId()); return f; }
function rows(sh) { var v = sh.getDataRange().getValues(); return v.slice(1); }
function findRow(sh, id) { var v = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues(); for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 1; return 0; }
function viewers(s) { return rows(s.getSheetByName('Settings')).map(function (r) { return String(r[0] || '').trim(); }).filter(Boolean); }
function log(s, b, a) { s.getSheetByName('History').appendRow([new Date(), b.user || '', b.name || '', a.jobId || '', a.company || '', a.action || '', a.detail || '']); }
function pres() { var c = CacheService.getScriptCache().get('pres'); var m = {}; try { m = c ? JSON.parse(c) : {}; } catch (x) {} var now = Date.now(); Object.keys(m).forEach(function (k) { m[k] = (m[k] || []).filter(function (p) { return now - p.t < 150000; }); if (!m[k].length) delete m[k]; }); return m; }

function handle(b) { var s = book(), J = s.getSheetByName('Jobs'), op = b.op;
  if (op === 'list') { var since = +b.since || 0, list = [], now = Date.now();
    rows(J).forEach(function (r, i) { var upd = +r[3] || 0, del = +r[9] || 0;
      if (del && now - del > KEEP_DELETED_DAYS * 864e5) return;
      if (upd <= since && del <= since) return;
      var json = null; if (!del && r[10]) { try { json = DriveApp.getFileById(r[10]).getBlob().getDataAsString(); } catch (x) {} }
      list.push({ id: String(r[0]), company: r[1], rev: +r[2] || 0, updated: upd, byUser: r[4], byName: r[5], done: r[6], total: r[7], finished: !!r[8], deleted: del, json: json }); });
    var vw = viewers(s); return { ok: true, now: now, jobs: list, pres: pres(), viewers: vw }; }
  if (op === 'save') { var m = b.meta || {}, id = String(m.id), rn = findRow(J, id), now2 = Date.now();
    if (rn) { var r0 = J.getRange(rn, 1, 1, 13).getValues()[0], rev0 = +r0[2] || 0;
      if (b.baseRev != null && +b.baseRev !== rev0 && !+r0[9]) { var cur = null; try { cur = DriveApp.getFileById(r0[10]).getBlob().getDataAsString(); } catch (x) {} return { conflict: true, rev: rev0, json: cur, byName: r0[5] }; }
      var fid = r0[10], f = null; try { f = DriveApp.getFileById(fid); f.setContent(b.json); } catch (x) { f = dir().createFile(id + '.json', b.json, 'application/json'); fid = f.getId(); }
      J.getRange(rn, 1, 1, 13).setValues([[id, m.company || '', rev0 + 1, now2, b.user || '', b.name || '', m.done || 0, m.total || 0, m.finished ? 1 : '', '', fid, r0[11] || '', r0[12] || '']]);
      return { ok: true, rev: rev0 + 1, updated: now2 }; }
    var nf = dir().createFile(id + '.json', b.json, 'application/json');
    J.appendRow([id, m.company || '', 1, now2, b.user || '', b.name || '', m.done || 0, m.total || 0, m.finished ? 1 : '', '', nf.getId(), m.created || new Date().toISOString(), b.name || '']);
    log(s, b, { jobId: id, company: m.company, action: 'job', detail: 'Started the job' });
    return { ok: true, rev: 1, updated: now2 }; }
  if (op === 'del' || op === 'restore') { var rn2 = findRow(J, b.id); if (!rn2) return { ok: true }; var t = Date.now();
    J.getRange(rn2, 10).setValue(op === 'del' ? t : ''); J.getRange(rn2, 4).setValue(t); log(s, b, { jobId: b.id, company: J.getRange(rn2, 2).getValue(), action: op, detail: op === 'del' ? 'Deleted the job' : 'Restored the job' }); return { ok: true }; }
  if (op === 'log') { (b.entries || []).slice(0, 50).forEach(function (a) { log(s, b, a); }); return { ok: true }; }
  if (op === 'ping') { var c = CacheService.getScriptCache(), m2 = pres(); Object.keys(m2).forEach(function (k) { m2[k] = m2[k].filter(function (p) { return p.user !== b.user; }); if (!m2[k].length) delete m2[k]; });
    if (b.jobId) (m2[b.jobId] = m2[b.jobId] || []).push({ user: b.user, name: b.name, t: Date.now() }); c.put('pres', JSON.stringify(m2), 600); return { ok: true, pres: m2 }; }
  if (op === 'hist') { var H = s.getSheetByName('History'), n = H.getLastRow(), from = Math.max(2, n - 3000), v = n >= 2 ? H.getRange(from, 1, n - from + 1, 7).getValues() : [];
    var d0 = b.from ? new Date(+b.from) : null, d1 = b.to ? new Date(+b.to) : null;
    var L = v.filter(function (r) { var t = new Date(r[0]); return (!b.jobId || String(r[3]) === String(b.jobId)) && (!d0 || t >= d0) && (!d1 || t < d1); })
      .map(function (r) { return { t: new Date(r[0]).getTime(), user: r[1], name: r[2], jobId: String(r[3]), company: r[4], action: r[5], detail: r[6] }; });
    return { ok: true, items: L.slice(-400), viewers: viewers(s) }; }
  return { error: 'unknown op' }; }
