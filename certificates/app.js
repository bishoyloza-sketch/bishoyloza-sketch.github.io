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
var IDB = {
  db: null,
  open: function () { var self = this; if (self.db) return Promise.resolve(self.db);
    return new Promise(function (res, rej) { var r = indexedDB.open('akhc', 1); r.onupgradeneeded = function () { r.result.createObjectStore('img'); }; r.onsuccess = function () { self.db = r.result; res(self.db); }; r.onerror = function () { rej(r.error); }; }); },
  put: function (k, v) { return this.open().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction('img', 'readwrite'); t.objectStore('img').put(v, k); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); },
  get: function (k) { return this.open().then(function (db) { return new Promise(function (res) { var q = db.transaction('img').objectStore('img').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
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

/* ================= server (same as Akhnaton Devices) ================= */
var Api = { call: function (req) {
  if (!CFG.API_URL) return Promise.reject(new Error('Server address is missing in config.js'));
  return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' })
    .then(function (r) { if (!r.ok) throw new Error('The server did not answer (' + r.status + '). Check the internet and try again.'); return r.json(); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || 'Something went wrong.'); return j.data; });
} };
var S = { session: LS.get('session', null), me: null, people: LS.get('people', null), data: LS.get('cache', null), projects: LS.get('projects', []), cur: null, view: 'home' };
function req(action, payload) { return Api.call({ action: action, userId: S.session && S.session.userId, pin: S.session && S.session.pin, payload: payload || {} }); }
function refresh() { return req('state').then(function (d) { S.data = { companies: d.companies, users: d.users, at: Date.now() }; LS.set('cache', S.data);
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
var spOn = function () { return !!(MS.app && MS.account); };
/* search files in SharePoint / OneDrive */
function spSearch(q, size) {
  return graph('POST', '/search/query', { requests: [{ entityTypes: ['driveItem'], query: { queryString: q }, from: 0, size: size || 25 }] }).then(function (r) {
    var out = []; ((r.value || [])[0] || { hitsContainers: [] }).hitsContainers.forEach(function (c) { (c.hits || []).forEach(function (h) { var x = h.resource || {};
      if (!x.name || x.folder) return;
      out.push({ id: x.id, name: x.name, webUrl: x.webUrl || '', driveId: x.parentReference && x.parentReference.driveId, mod: x.lastModifiedDateTime, by: x.lastModifiedBy && x.lastModifiedBy.user && x.lastModifiedBy.user.displayName, summary: String(h.summary || '').replace(/<[^>]+>/g, '') }); }); });
    return out; }); }
function pathOf(f) { try { return decodeURIComponent(f.webUrl || ''); } catch (e) { return f.webUrl || ''; } }
var ORDERS_CACHE = null;
function calibrationOrders() { /* rows of "Calibration Orders.xlsx" → Main Dashboard */
  if (ORDERS_CACHE) return Promise.resolve(ORDERS_CACHE);
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
      (!pick ? '<div class="sec" style="margin-top:4px"><h2>Who are you?</h2><small>Same PIN as Akhnaton Devices</small></div>' +
        (people.length ? '<div class="people">' + people.map(function (p) { return '<button data-u="' + p.id + '"><b>' + esc(p.name) + '</b><small>' + (roleName[p.role] || p.role) + '</small></button>'; }).join('') + '</div>'
          : '<div class="empty"><b>Loading names…</b>Check the internet connection.</div>')
      : '<div class="sec" style="margin-top:4px"><h2>' + esc(pick.name) + '</h2><button class="btn ghost sm" data-back>Change</button></div><p style="text-align:center;margin:8px 0 0;color:var(--muted)">Enter your 4-digit PIN</p>' +
        '<div class="pin" id="pin">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < pin.length ? 'f' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) { return k ? '<button data-k="' + k + '">' + k + '</button>' : '<span></span>'; }).join('') + '</div>') +
      '</div></div></div>';
    $$('[data-u]').forEach(function (b) { b.onclick = function () { pick = people.filter(function (p) { return p.id === b.dataset.u; })[0]; pin = ''; draw(); }; });
    var bk = $('[data-back]'); if (bk) bk.onclick = function () { pick = null; draw(); };
    $$('[data-k]').forEach(function (b) { b.onclick = function () { var k = b.dataset.k; if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k; draw(); if (pin.length === 4) tryLogin(); }; });
  }
  function tryLogin() { Api.call({ action: 'login', userId: pick.id, pin: pin }).then(function (r) {
      if (r.mustChange) { pin = ''; draw(); return dialog('Choose your PIN first', 'Open <b>Akhnaton Devices</b> once and choose your own PIN, then sign in here with it.', 'OK', 'Close'); }
      S.session = { userId: pick.id, pin: pin }; LS.set('session', S.session); S.me = r.user; boot();
    }).catch(function (e) { pin = ''; draw(); var p = $('#pin'); if (p) p.classList.add('shake'); toast(e.message, true); }); }
  draw();
  Api.call({ action: 'people' }).then(function (p) { S.people = p; LS.set('people', p); if (!pick) draw(); }).catch(function () { if (!S.people) toast('Cannot reach the server. Check the internet.', true); });
}
function signOut() { S.session = null; S.me = null; LS.del('session'); renderLogin(); }

/* ================= app shell ================= */
function top(title, sub, extra) {
  return '<div class="top"><div class="top-row"><div class="brand"><img src="logo-en-light.png" alt="Akhnaton"><span class="bdiv"></span><span class="bname"><small>Akhnaton</small><b>Certificates</b></span></div>' +
    '<span class="sync' + (spOn() ? '' : ' off') + '" title="SharePoint"><i></i>' + (spOn() ? 'SharePoint' : 'Offline') + '</span></div>' +
    (title ? '<div class="ptitle">' + title + '</div>' : '') + (sub ? '<div class="hello" style="margin-top:4px">' + sub + '</div>' : '') + (extra || '') + '</div>'; }
function render() {
  if (!S.session) return renderLogin();
  var p = S.cur ? S.projects.filter(function (x) { return x.id === S.cur; })[0] : null;
  if (!p) { S.cur = null; return renderHome(); }
  if (p.stage !== 'done') return renderWizard(p);
  return renderOverview(p);
}
function boot() { render(); refresh().then(function () { if (!sheetFn) render(); }).catch(function (e) { if (/PIN|sign in/i.test(e.message)) return signOut(); toast(e.message, true); }); }

/* ================= home ================= */
function msCard() {
  if (spOn()) return '<div class="okline">' + I.ms + ' SharePoint connected · ' + esc(MS.account.username) + '</div>';
  if (MS.error === 'not-configured') return '<div class="note warnbox">SharePoint is not set up yet. Bishoy needs to add the Microsoft app ID to <b>config.js</b> (one time).</div>';
  return '<div class="card"><h3>Connect SharePoint</h3><div class="meta">To find old certificates, POs and contracts, sign in with your work account.</div>' + (MS.error ? '<div class="note warnbox" style="margin:10px 0 0">' + esc(MS.error) + '</div>' : '') +
    '<div class="cf"><button class="btn" id="msIn">' + I.ms + ' Sign in with Microsoft</button></div></div>'; }
function projTitle(p) { return p.company ? p.company.name : 'New project'; }
var TYPES = { contract: ['Contract', I.doc], po: ['Purchase order (PO)', I.po], offer: ['Price offer', I.offer], approval: ['General approval', I.ok], visit: ['One visit', I.visit] };
function renderHome() {
  var mine = S.projects.slice().sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
  $('#app').innerHTML = '<div class="shell">' + top('', '<span>Hello</span><strong>' + esc(S.me ? S.me.name : (S.session && S.session.userId)) + '</strong>') + '<main>' + msCard() +
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
  $('#out').onclick = signOut; var mi = $('#msIn'); if (mi) mi.onclick = msSignIn;
}

/* ================= wizard ================= */
var STAGES = ['company', 'dept', 'type', 'order', 'items'];
var STAGE_T = { company: ['Company', 'Which company is this work for?'], dept: ['Department', 'Which department(s)?'], type: ['Order type', 'What is the work based on?'], order: ['Order document', 'Choose it from SharePoint'], items: ['Items', 'What will be calibrated?'] };
var W = { q: '' };
function go(p, stage) { p.stage = stage; saveProjects(); W.q = ''; W.busy = false; render(); window.scrollTo(0, 0); }
function renderWizard(p) {
  var k = STAGES.indexOf(p.stage), t = STAGE_T[p.stage];
  var dots = '<div class="wiz-step">Step ' + (k + 1) + ' of ' + STAGES.length + '</div><div class="wiz-dots">' + STAGES.map(function (s, i) { return '<i class="' + (i < k ? 'dn' : i === k ? 'on' : '') + '"></i>'; }).join('') + '</div>';
  $('#app').innerHTML = '<div class="shell" style="padding-bottom:110px">' + top(t[0], esc(t[1]), dots) + '<main id="wm"></main></div><div class="wiz-foot"><div id="wf"></div></div>';
  ({ company: wCompany, dept: wDept, type: wType, order: wOrder, items: wItems })[p.stage](p);
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
    p.company = { id: c.id, name: c.name, official: c.official || '', code: c.code || '', group: c.group || '' }; saveProjects(); go(p, 'dept'); }; });
  var ac = $('#addCo'); if (ac) ac.onclick = function () { companySheet(p); };
  foot(p, 'Next', !!p.company, function () { go(p, 'dept'); });
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
          sheetFn = null; renderSheet(); toast('Company saved'); if (c) go(p, 'dept'); else render();
        }).catch(function (e) { b.disabled = false; toast(e.message, true); }); }; } }; }); }

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
var ORDER_FOLDER = 'General/Certificates/Orders'; /* where an attached PO / document is saved on SharePoint (can be changed) */
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
function uploadOrder(p, file) { /* saves the attached document in SharePoint: <ORDER_FOLDER>/<company>/<file> */
  var safe = function (s) { return String(s).replace(/["*:<>?\/\\|#%]/g, ' ').replace(/\s+/g, ' ').trim(); };
  var path = ORDER_FOLDER + '/' + safe(p.company.name) + '/' + safe(file.name);
  return siteDrive().then(function (drive) { return msToken().then(function (tk) {
    return fetch('https://graph.microsoft.com/v1.0/drives/' + drive + '/root:/' + path.split('/').map(encodeURIComponent).join('/') + ':/content?@microsoft.graph.conflictBehavior=rename', { method: 'PUT', headers: { Authorization: 'Bearer ' + tk }, body: file })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('Upload failed ' + r.status + ': ' + t.slice(0, 120)); }); return r.json(); }); }); }); }
function wOrder(p) {
  var of = p.orderFiles, o = p.order || {}, tname = TYPES[p.orderType][0], isPO = p.orderType === 'po';
  if (!of && spOn() && !W.busy) { W.busy = true; findOrderFiles(p).catch(function (e) { toast(e.message, true); p.orderFiles = { list: [], nums: [], err: e.message }; }).then(function () { W.busy = false; if (p.stage === 'order') render(); }); }
  var chosen = o.fileName ? '<div class="card bar" style="--c:var(--office)"><h3>' + (o.auto ? 'Found – please confirm' : 'Chosen') + '</h3><div class="meta" style="word-break:break-word"><b>' + esc(o.fileName) + '</b>' + (o.number ? ' · No. ' + esc(o.number) : '') + (o.attached ? ' · attached by you' + (o.uploaded ? ' · saved on SharePoint' : ' · on this phone') : '') + '</div>' +
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
      toast('Saving on SharePoint…'); return uploadOrder(p, f).then(function (it) { rec.uploaded = true; rec.webUrl = it.webUrl; rec.fileId = it.id; setO(rec); toast('Saved on SharePoint'); })
        .catch(function (e) { setO(rec); toast(e.message + ' – kept on this phone', true); }); }); }); };
  var must = isPO; /* a PO is needed; contract / offer / approval / visit can be skipped for now */
  var has = function () { var x = p.order || {}; return !!(x.fileName && !x.auto); };
  foot(p, 'Next', has() || !must, function () { if (!has() && p.order && p.order.auto) { p.order.auto = false; } if (!has() && !(p.order && p.order.fileName)) p.order = { skipped: true }; go(p, 'items'); }, must ? '' : '<button class="btn ghost" id="wSkip">Skip</button>');
  var sk = $('#wSkip'); if (sk) sk.onclick = function () { p.order = { skipped: true }; go(p, 'items'); };
  function okNext() { var b = $('#wn'); if (b) b.disabled = !(has() || !must); }
}

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
  p.items = p.items || []; p.machines = p.machines || [];
  var loose = p.items.filter(function (i) { return !i.machineId; }), need = p.items.filter(function (i) { return itemIssues(i).length; }).length;
  var irow = function (it) { var iss = itemIssues(it); return '<button class="row" data-it="' + it.id + '">' + (it.photo ? '<img class="thumb" data-ph="' + it.photo + '" alt="">' : '') + '<span class="t"><b>' + esc(it.description || it.code || 'Photo') + '</b><small>' + esc([it.code && it.description ? it.code : '', rangeText(it), it.res && 'res ' + it.res + ' ' + (it.resUnit || it.unit)].filter(Boolean).join(' · ') || 'Tap to add the data') + '</small></span>' +
    (iss.length ? '<span class="pill" style="--s-fg:var(--service);--s-bg:var(--service-soft)">' + (hasData(it) ? 'Missing data' : 'Photo only') + '</span>' : '') + '</button>'; };
  $('#wm').innerHTML = '<div class="cats">' +
    '<button data-a="photo">' + I.cam + '<b>Photo</b><small>Nameplates or a code list</small></button>' +
    '<button data-a="excel">' + I.xls + '<b>Excel</b><small>Fixed template</small></button></div>' +
    '<div class="cats one" style="margin-top:8px"><button data-a="add">' + I.plus.replace(/22/g, '28') + '<b>Add an item</b><small>A unit (one instrument) or a machine with instruments under it</small></button></div>' +
    '<div class="sec"><h2>Items</h2><small>' + p.items.length + (need ? ' · ' + need + ' need data' : '') + '</small></div>' +
    (p.machines.map(function (m) { var its = p.items.filter(function (i) { return i.machineId === m.id; });
      return '<div class="mach"><div class="mach-h"><span class="kind m">Machine</span><b>' + esc(m.name) + (m.code ? ' · ' + esc(m.code) : '') + '</b><button class="btn ghost sm" data-m="' + m.id + '">Open</button></div>' + (its.length ? its.map(irow).join('') : '<div class="row"><span class="t"><small>No instruments yet</small></span></div>') + '</div>'; }).join('')) +
    (loose.length ? '<div class="list">' + loose.map(irow).join('') + '</div>' : (!p.machines.length ? '<div class="empty"><b>No items yet</b>Use one of the three ways above.</div>' : '')) +
    (need ? '<div class="small" style="margin-top:10px">Items with “Photo only” or “Missing data” can be completed later – before the readings.</div>' : '');
  $$('[data-ph]').forEach(function (im) { IDB.get(im.dataset.ph).then(function (d) { if (d) im.src = d; }); });
  $$('[data-a]').forEach(function (b) { b.onclick = function () { ({ photo: photoChoice, excel: excelSheet, add: addChoice })[b.dataset.a](p); }; });
  $$('[data-it]').forEach(function (b) { b.onclick = function () { itemSheet(p, b.dataset.it); }; });
  $$('[data-m]').forEach(function (b) { b.onclick = function () { machineSheet(p, b.dataset.m); }; });
  foot(p, 'Finish setup', p.items.length > 0, function () { p.stage = 'done'; saveProjects(); render(); window.scrollTo(0, 0); });
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
      '<div style="height:14px"></div>' + (m ? '' : deptField(p, it.dept, 'data-dp')),
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
          var e = itemIssues(it); if (e.length) { tried = true; renderSheet(); return toast('Missing: ' + e[0], true); }
          if (!it.resUnit) it.resUnit = it.unit; if (isNew) p.items.push(it); saveProjects(); back(); }; } }; });
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
        saveProjects(); closeSheet(); toast(n + ' items added – open each one to add its description'); }; } }; });
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
  return wb.xlsx.writeBuffer(); }).then(function (buf) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = 'Items template - ' + (p.company ? p.company.name : 'project') + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); })
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
  saveProjects(); $('#xMsg').innerHTML = '<div class="note okbox">' + n + ' items added' + (skipped ? ' · ' + skipped + ' duplicate codes skipped' : '') + '.</div>' + (incomplete ? '<div class="note amber">' + incomplete + ' of them have missing or wrong data (range, unit or resolution) – they are marked “Missing data”.</div>' : '');
}).catch(function (e) { var x = $('#xMsg'); if (x) x.innerHTML = '<div class="note warnbox">' + esc(e.message || e) + '</div>'; }); }

/* ================= project overview ================= */
function renderOverview(p) {
  var o = p.order || {};
  $('#app').innerHTML = '<div class="shell">' + top(esc(p.company.name), esc([p.depts.join(', '), TYPES[p.orderType][0]].filter(Boolean).join(' · '))) + '<main>' +
    '<div class="card bar"><h3>Order</h3><dl class="kv" style="margin-top:8px"><dt>Type</dt><dd>' + esc(TYPES[p.orderType][0]) + '</dd>' + (o.number ? '<dt>Number</dt><dd>' + esc(o.number) + '</dd>' : '') + (o.value ? '<dt>Value</dt><dd>EGP ' + esc(o.value) + '</dd>' : '') +
      (o.fileName ? '<dt>File</dt><dd><a href="' + esc(o.webUrl) + '" target="_blank" rel="noopener">' + esc(o.fileName) + '</a></dd>' : '') + (o.attached && !o.uploaded ? '<dt>Attached</dt><dd>On this phone – not on SharePoint yet</dd>' : '') + (o.skipped ? '<dt>Document</dt><dd>Skipped for now</dd>' : '') + '</dl>' +
      '<div class="cf"><button class="btn ghost sm" data-g="company">Company</button><button class="btn ghost sm" data-g="dept">Department</button><button class="btn ghost sm" data-g="order">Order</button></div></div>' +
    '<div class="sec"><h2>Items</h2><small>' + p.items.length + (p.machines.length ? ' · ' + p.machines.length + ' machines' : '') + '</small></div>' +
    '<div class="list">' + p.items.slice(0, 12).map(function (it) { var m = it.machineId ? p.machines.filter(function (x) { return x.id === it.machineId; })[0] : null;
      return '<div class="row"><span class="t"><b>' + esc(it.description || it.code) + '</b><small>' + esc([it.code, m && m.name, it.manufacturer].filter(Boolean).join(' · ')) + '</small></span></div>'; }).join('') + (p.items.length > 12 ? '<div class="row"><span class="t"><small>+ ' + (p.items.length - 12) + ' more</small></span></div>' : '') + '</div>' +
    '<div class="cf"><button class="btn ghost" data-g="items">Edit items</button></div>' +
    '<div class="card" style="margin-top:18px"><h3>Next: old certificates & readings</h3><div class="meta">Finding last year\'s certificate of every item, the readings next to last year\'s, the prices and the certificates come in the next versions.</div></div>' +
    '<div class="cf"><button class="btn ghost" id="home">All projects</button><button class="btn danger" id="delP">Delete project</button></div></main></div>';
  $$('[data-g]').forEach(function (b) { b.onclick = function () { go(p, b.dataset.g); }; });
  $('#home').onclick = function () { S.cur = null; render(); };
  $('#delP').onclick = function () { dialog('Delete this project?', 'Only this project on this phone is deleted.', 'Delete').then(function (y) { if (!y) return; S.projects = S.projects.filter(function (x) { return x.id !== p.id; }); saveProjects(); S.cur = null; render(); }); };
}

/* ================= start ================= */
window.addEventListener('popstate', function () { if (sheetFn) { sheetFn = null; renderSheet(); } });
MS.ready.then(function () { if (S.session) boot(); else renderLogin(); });
})();
