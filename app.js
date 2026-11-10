/* Akhnaton Device Tracker — app */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var DEMO = !CFG.API_URL;
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('akh.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('akh.' + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem('akh.' + k); } catch (e) {} }
  };

  /* ================= data layer ================= */
  var Api = {
    call: function (req) {
      if (DEMO) return Demo.call(req);
      return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' })
        .then(function (r) { if (!r.ok) throw new Error('The server did not answer (' + r.status + '). Check the internet and try again.'); return r.json(); })
        .then(function (j) { if (!j.ok) { var e = new Error(j.error || 'Something went wrong.'); e.userFacing = true; throw e; } return j.data; });
    }
  };
  var Demo = {
    db: null,
    load: function () {
      var saved = LS.get('demoDb', null);
      if (saved) { this.db = saved; return; }
      var s = JSON.parse(JSON.stringify(window.SEED));
      s.users.forEach(function (u) { u.pinHash = Core.pinHash(u.id, '1234'); u.mustChange = false; });
      this.db = s; this.save();
    },
    save: function () { LS.set('demoDb', this.db); },
    call: function (req) {
      var self = this;
      return new Promise(function (res, rej) {
        setTimeout(function () {
          try {
            if (!self.db) self.load();
            if (req.action === 'state') { Core.verify(self.db, req.userId, req.pin); res(Core.snapshot(self.db, { now: Date.now() })); return; }
            if (req.action === 'history') { Core.verify(self.db, req.userId, req.pin); res(self.db.movements.filter(function (m) { return m.deviceId === req.payload.deviceId; }).slice(-80)); return; }
            if (req.action === 'people') { res(self.db.users.filter(function (u) { return u.active !== false; }).map(Core.publicUser)); return; }
            var out = Core.apply(self.db, req, Date.now()); self.save(); res(out.result);
          } catch (e) { rej(e); }
        }, 180);
      });
    }
  };

  /* ================= state ================= */
  var S = {
    me: null, session: LS.get('session', null), data: null, lastSync: 0, online: true,
    view: 'home', filter: 'all', q: '', sort: LS.get('sort2', 'type'), devGrp: null, dv: LS.get('dv', 'tiles'), people: LS.get('people', null)
  };
  function req(action, payload) {
    return Api.call({ action: action, userId: S.session && S.session.userId, pin: S.session && S.session.pin, payload: payload || {} });
  }
  function refresh(silent) {
    return req('state').then(function (d) {
      S.data = d; S.lastSync = Date.now(); S.online = true; index(); LS.set('cache', d);
      S.me = d.users.filter(function (u) { return u.id === S.session.userId; })[0] || S.me;
      pushLink();
      if (!S.me || S.me.active === false) { signOut(); return; }
      render();
    }).catch(function (e) {
      S.online = false; render();
      if (!silent) toast(e.message, true);
      if (e.userFacing && /PIN|not active/.test(e.message)) signOut();
    });
  }

  var IDX = {};
  function index() {
    var d = S.data; IDX = { dev: {}, co: {}, user: {}, co_by: {} };
    d.devices.forEach(function (x) { IDX.dev[x.id] = x; });
    d.companies.forEach(function (x) { IDX.co[x.id] = x; });
    d.users.forEach(function (x) { IDX.user[x.id] = x; });
  }

  /* ================= helpers ================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg, bad) {
    var t = $('#toast'); t.textContent = msg; t.className = 'on' + (bad ? ' bad' : '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, 3200);
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function d0(x) { var d = new Date(x); d.setHours(0, 0, 0, 0); return d; }
  function fmtDate(x) { if (!x) return ''; var d = new Date(x); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtTime(x) { var d = new Date(x), h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm'); }
  function when(x) {
    if (!x) return ''; var d = new Date(x), t = d0(new Date()), dd = d0(d), diff = Math.round((t - dd) / 864e5);
    if (diff === 0) return 'today, ' + fmtTime(d);
    if (diff === 1) return 'yesterday, ' + fmtTime(d);
    if (diff < 7 && diff > 0) return DAY[d.getDay()] + ', ' + fmtTime(d);
    return fmtDate(d);
  }
  function daysSince(x) { return Math.round((d0(new Date()) - d0(x)) / 864e5); }
  function daysUntil(x) { return Math.round((d0(x) - d0(new Date())) / 864e5); }
  function isoDay(d) { d = new Date(d); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  var ST = {
    'In Office': { c: 'var(--office)', bg: 'var(--office-soft)', short: 'In office' },
    'At Client': { c: 'var(--client)', bg: 'var(--client-soft)', short: 'At client' },
    'Maintenance': { c: 'var(--service)', bg: 'var(--service-soft)', short: 'Maintenance' },
    'External Calibration': { c: 'var(--service)', bg: 'var(--service-soft)', short: 'Ext. calibration' },
    'Other': { c: 'var(--service)', bg: 'var(--service-soft)', short: 'Other' },
    'Out of Service': { c: 'var(--oos)', bg: 'var(--oos-soft)', short: 'Out of service' }
  };
  var ROLE_NAME = { superadmin: 'Super admin', admin: 'Admin', keeper: 'Lab keeper', supervisor: 'Site supervisor', engineer: 'Engineer' };
  /* ---------- jobs & receipts ---------- */
  function jobsList() { return (S.data && S.data.jobs) || []; }
  function jobById(id) { return jobsList().filter(function (j) { return j.id === id; })[0] || null; }
  var BASIS = [['PO', 'PO', 'PO number'], ['Contract', 'Contract', 'Contract number'], ['Approval', 'Approval', 'Approval / quotation number'], ['One-day visit', 'One-day visit', 'Note (optional)'], ['Other', 'Something else', 'What is it? (required)']];
  function jobBasis(j) { if (!j || !j.basis) return ''; return (j.basis === 'Other' ? (j.ref || 'Other') : j.basis + (j.ref ? ' ' + j.ref : '')); }
  var CAL_LABS = ['NIS', 'MECC', 'Mehy', 'Shebab', 'Internal Cal'];
  function jobName(j) { return j ? coName(j.companyId) + (j.title ? ' · ' + j.title : '') : ''; }
  function jobReceipts(j) { return S.data.checkouts.filter(function (c) { return c.jobId === j.id && c.status !== 'Declined' && c.status !== 'Cancelled'; }); }
  /* what of one receipt is still outside right now */
  function rcptOut(c) {
    var dv = S.data.devices.filter(function (d) { return d.checkoutId === c.id && d.status === 'At Client'; });
    var hs = holdings().filter(function (h) { return h.checkoutId === c.id && +h.qty > 0; });
    return { devs: dv, items: hs, n: dv.length + hs.reduce(function (a, h) { return a + (+h.qty || 0); }, 0) };
  }
  function dsBack(c) { return c.dataSheet === 'Yes'; }
  /* places where devices / items are past their expected return date */
  function overdueList() {
    var by = {}, coById = {};
    S.data.checkouts.forEach(function (c) { coById[c.id] = c; });
    function slot(k) { return by[k] = by[k] || { coId: k, devs: [], items: [], exp: '', people: {} }; }
    function seen(o, exp, holders) { if (!o.exp || exp < o.exp) o.exp = exp; (holders || []).forEach(function (p) { o.people[p.name] = 1; }); }
    S.data.devices.forEach(function (d) {
      if (d.status !== 'At Client' || !d.expectedReturn || daysUntil(d.expectedReturn) >= 0) return;
      var o = slot(d.companyId); o.devs.push(d); seen(o, d.expectedReturn, d.holders);
    });
    holdings().forEach(function (h) {
      var c = coById[h.checkoutId]; if (!c || !c.expectedReturn || +h.qty <= 0 || daysUntil(c.expectedReturn) >= 0) return;
      var o = slot(h.companyId); o.items.push(h); seen(o, c.expectedReturn, h.holders);
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.exp.localeCompare(b.exp); });
  }
  /* ---------- quantity items (loggers, sensors, connections, tools) ---------- */
  function stockList() { return (S.data && S.data.stock) || []; }
  function holdings() { return (S.data && S.data.holdings) || []; }
  function stockOut(sid) { var n = 0; holdings().forEach(function (h) { if (h.stockId === sid) n += +h.qty || 0; }); return n; }
  function stockFree(st) { return st.total === '' || st.total == null ? null : Math.max(0, (+st.total || 0) - stockOut(st.id)); }
  function itemsText(items) { return (items || []).map(function (i) { return i.qty + ' × ' + i.name; }).join(', '); }
  function itemChips(items) { return (items || []).map(function (i) { return '<span class="dchip qchip"><span class="qn">' + i.qty + '×</span><em>' + esc(i.name) + '</em></span>'; }).join(''); }
  function holdingsAt(coId) { return holdings().filter(function (h) { return h.companyId === coId && (+h.qty || 0) > 0; }); }
  function countLabel(nd, items) {
    var ni = (items || []).reduce(function (a, i) { return a + (+i.qty || 0); }, 0);
    return [nd ? nd + ' device' + (nd === 1 ? '' : 's') : '', ni ? ni + ' item' + (ni === 1 ? '' : 's') : ''].filter(Boolean).join(' + ') || 'nothing';
  }
  /* − n + stepper rows for quantity items. list: [{key, name, sub, max, qty}] ; onSet(key, qty) */
  function qtyRows(list, onSet) {
    var html = '<div class="list">' + list.map(function (r) {
      return '<div class="row qrow' + (r.qty ? ' sel' : '') + '"><span class="t"><b>' + esc(r.name) + '</b>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span>' +
        '<span class="stepper"><button data-qm="' + esc(r.key) + '" aria-label="Less">−</button><input inputmode="numeric" data-qi="' + esc(r.key) + '" value="' + (r.qty || 0) + '" aria-label="Quantity"><button data-qp="' + esc(r.key) + '" aria-label="More">+</button></span></div>';
    }).join('') + '</div>';
    function wire(root) {
      var by = {}; list.forEach(function (r) { by[r.key] = r; });
      function set(k, v) { var r = by[k]; v = Math.max(0, parseInt(v, 10) || 0); if (r.max != null) v = Math.min(v, r.max); r.qty = v; onSet(k, v); }
      $$('[data-qm]', root).forEach(function (b) { b.onclick = function () { set(b.dataset.qm, (by[b.dataset.qm].qty || 0) - 1); }; });
      $$('[data-qp]', root).forEach(function (b) { b.onclick = function () { set(b.dataset.qp, (by[b.dataset.qp].qty || 0) + 1); }; });
      $$('[data-qi]', root).forEach(function (i) { i.onchange = function () { set(i.dataset.qi, i.value); }; i.onfocus = function () { i.select(); }; });
    }
    return { html: html, wire: wire };
  }
  function isReq(d) { return String(d.pending || '').indexOf('CO-') === 0; }
  function reqOf(d) { return isReq(d) ? S.data.checkouts.filter(function (c) { return c.id === d.pending; })[0] : null; }
  function stOf(d) { return d.pending ? { c: 'var(--pending)', bg: 'var(--pending-soft)', short: isReq(d) ? 'Waiting approval' : 'Transfer waiting' } : (ST[d.status] || ST['Other']); }
  function cert(d) {
    if (d.certStatus === 'none') return { kind: 'none', text: 'No certificate needed' };
    if (!d.calDue) return { kind: 'missing', text: 'No calibration date' };
    var n = daysUntil(d.calDue);
    if (n < 0) return { kind: 'expired', days: n, text: 'Calibration expired ' + fmtDate(d.calDue) };
    if (n <= 30) return { kind: 'soon', days: n, text: 'Calibration due in ' + n + ' day' + (n === 1 ? '' : 's') };
    return { kind: 'ok', days: n, text: 'Valid until ' + fmtDate(d.calDue) };
  }
  function tag(d, size) {
    var s = stOf(d);
    return '<span class="tag' + (size ? ' ' + size : '') + '" style="--c:' + s.c + '" aria-label="Serial ending ' + esc(d.serialTail) + '"><i></i><span>' + esc(d.serialTail) + '</span></span>';
  }
  function devTitle(d) { return d.description; }
  function devName(d) { return esc(d.description) + (d.range ? ' <span class="rng">' + esc(d.range) + '</span>' : ''); }
  /* a set shows under one category even if its parts were filed under different ones */
  function setCat(d) {
    if (!d.sub) return d.category;
    var c = {}; S.data.devices.forEach(function (x) { if (x.sub === d.sub && x.active !== false) c[x.category] = (c[x.category] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); })[0] || d.category;
  }
  function partsOf(d) { return S.data.devices.filter(function (x) { return x.parentId === d.id && x.active !== false; }); }
  function devSub(d, inSet) { var n = partsOf(d).length, par = d.parentId && IDX.dev[d.parentId]; return (d.sub && !inSet ? d.sub + ' · ' : par ? '↳ part of ' + par.description + ' …' + par.serialTail + ' · ' : '') + (d.site ? '📍 ' + d.site + ' · ' : '') + [d.manufacturer, d.model && d.model !== 'N/A' ? d.model : ''].filter(Boolean).join(' ') + ' · S/N ' + d.serial + (n ? ' · + ' + n + ' part' + (n === 1 ? '' : 's') : ''); }
  function coName(id) { return id && !IDX.co[id] ? 'Removed company' : (IDX.co[id] || {}).name || '—'; }
  function names(list) { return (list || []).map(function (h) { return h.name; }).join(', '); }
  function can(what) {
    var r = S.me && S.me.role;
    if (what === 'super') return r === 'superadmin';
    if (what === 'keep') return r === 'admin' || r === 'keeper' || r === 'superadmin';
    if (what === 'admin') return r === 'admin' || r === 'superadmin';
    if (what === 'job') return r === 'admin' || r === 'supervisor' || r === 'superadmin';
    if (what === 'report') return r === 'admin' || r === 'supervisor' || r === 'keeper' || r === 'superadmin';
    return true;
  }
  function matches(d, q) {
    if (!q) return true; q = q.toLowerCase().trim();
    var hay = [d.description, d.manufacturer, d.model, d.serial, d.category, d.range].join(' ').toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0 || String(d.serial).toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(w) >= 0; });
  }
  var ICON = {
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    close: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    out: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h12M13 6l6 6-6 6"/></svg>',
    tick: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    bigtick: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    refresh: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    devices: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><circle cx="8" cy="10" r="2"/><path d="M13 9h5M13 12h3"/></svg>',
    activity: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
    more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    pdf: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 14h6M9 17h4"/></svg>',
    jobs: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V3h6v1M8 10h8M8 14h8M8 18h5"/></svg>',
    kits: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M4 12h16M10 12v2h4v-2"/></svg>',
    link: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>'
  };

  /* ================= login ================= */
  function loadPeople() {
    return Api.call({ action: 'people' }).then(function (p) { S.people = p; LS.set('people', p); return p; });
  }
  function renderLogin() {
    var pick = null, pin = '';
    var app = $('#app');
    function draw() {
      var people = (S.people || []).slice();
      var order = { superadmin: -1, admin: 0, keeper: 1, supervisor: 2, engineer: 3 };
      people.sort(function (a, b) { return order[a.role] - order[b.role] || a.name.localeCompare(b.name); });
      var roleName = ROLE_NAME;
      app.innerHTML =
        (DEMO ? '<div class="demo">Preview with sample data — every PIN is 1234</div>' : '') +
        '<div class="login"><div class="login-top"><img src="logo-en-light.png" alt="Akhnaton Trading and Representation">' +
        '<h1><small>Akhnaton</small>Lab Devices</h1><p>Where every device is, with whom, and since when.</p></div>' +
        '<div class="login-card"><div>' +
        (!pick ?
          '<div class="sec" style="margin-top:4px"><h2>Who are you?</h2></div>' +
          (people.length ? '<div class="people">' + people.map(function (p) {
            return '<button data-u="' + p.id + '"><b>' + esc(p.name) + '</b><small>' + roleName[p.role] + '</small></button>';
          }).join('') + '</div>' : '<div class="empty"><b>Loading names…</b>Check the internet connection.</div>')
          :
          '<div class="sec" style="margin-top:4px"><h2>' + esc(pick.name) + '</h2><button class="btn ghost sm" data-back>Change</button></div>' +
          '<p style="text-align:center;margin:8px 0 0;color:var(--muted)">Enter your 4-digit PIN</p>' +
          '<div class="pin" id="pin">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < pin.length ? 'f' : '') + '"></i>'; }).join('') + '</div>' +
          '<div class="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) {
            return k ? '<button data-k="' + k + '" aria-label="' + (k === '⌫' ? 'Delete' : k) + '">' + k + '</button>' : '<span></span>';
          }).join('') + '</div>') +
        '</div></div></div>';
      $$('[data-u]').forEach(function (b) { b.onclick = function () { pick = people.filter(function (p) { return p.id === b.dataset.u; })[0]; pin = ''; draw(); }; });
      var bk = $('[data-back]'); if (bk) bk.onclick = function () { pick = null; draw(); };
      $$('[data-k]').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.k;
          if (k === '⌫') pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
          draw();
          if (pin.length === 4) tryLogin();
        };
      });
    }
    function tryLogin() {
      Api.call({ action: 'login', userId: pick.id, pin: pin }).then(function (r) {
        S.session = { userId: pick.id, pin: pin }; LS.set('session', S.session); S.me = r.user;
        if (r.mustChange) return askNewPin(true);
        boot();
      }).catch(function (e) {
        pin = ''; draw(); var p = $('#pin'); if (p) p.classList.add('shake'); toast(e.message, true);
      });
    }
    draw();
    if (!S.people) loadPeople().then(draw).catch(function () { toast('Cannot reach the server. Check the internet.', true); });
    else loadPeople().then(function () { if (!pick) draw(); }).catch(function () {});
  }

  function askNewPin(first) {
    var a = '', b = '', stage = 1;
    openSheet(function (body, setFoot, setTitle) {
      setTitle(first ? 'Choose your own PIN' : 'Change PIN');
      function draw() {
        var cur = stage === 1 ? a : b;
        body.innerHTML = (first ? '<div class="note">This is your first sign-in. Pick a 4-digit PIN only you know.</div>' : '') +
          '<p style="text-align:center;margin:10px 0 0;font-weight:600">' + (stage === 1 ? 'New PIN' : 'Type it again') + '</p>' +
          '<div class="pin" id="pin2">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < cur.length ? 'f' : '') + '"></i>'; }).join('') + '</div>' +
          '<div class="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(function (k) {
            return k ? '<button data-k="' + k + '">' + k + '</button>' : '<span></span>';
          }).join('') + '</div>';
        $$('[data-k]', body).forEach(function (btn) {
          btn.onclick = function () {
            var k = btn.dataset.k;
            if (stage === 1) { a = k === '⌫' ? a.slice(0, -1) : (a + k).slice(0, 4); if (a.length === 4) stage = 2; }
            else { b = k === '⌫' ? b.slice(0, -1) : (b + k).slice(0, 4); }
            draw();
            if (stage === 2 && b.length === 4) {
              if (a !== b) { a = ''; b = ''; stage = 1; draw(); $('#pin2').classList.add('shake'); toast('The two PINs did not match. Start again.', true); return; }
              req('changePin', { newPin: a }).then(function () {
                S.session.pin = a; LS.set('session', S.session); closeSheet(); toast('PIN saved'); if (first) boot();
              }).catch(function (e) { toast(e.message, true); });
            }
          };
        });
      }
      draw(); setFoot('');
    }, { noClose: first });
  }

  /* ---------- push notifications (OneSignal) ---------- */
  function os(fn) { if (DEMO || !window.OneSignalDeferred) return; window.OneSignalDeferred.push(function (O) { try { return fn(O); } catch (e) {} }); }
  var pushLinked = null, pushOpted = null;
  function pushLink() {
    if (!S.me || pushLinked === S.me.id) return; pushLinked = S.me.id;
    os(function (O) {
      return O.login(S.me.id).then(function () {
        O.User.addTags({ role: S.me.role, name: S.me.name });
        var sub = O.User.PushSubscription;
        pushOpted = !!sub.optedIn;
        sub.addEventListener('change', function (e) { pushOpted = !!(e.current && e.current.optedIn); S._keepScroll = true; render(); });
        /* permission already given (e.g. by Android for the app) but not subscribed yet: subscribe now */
        if (!sub.optedIn && 'Notification' in window && Notification.permission === 'granted') return sub.optIn();
        S._keepScroll = true; render();
      });
    });
  }
  function pushState() {
    if (DEMO || !('Notification' in window) || !window.OneSignalDeferred) return 'na';
    if (Notification.permission === 'denied') return 'denied';
    if (pushOpted === true) return 'granted';
    return 'default';
  }
  function askPush() {
    os(function (O) {
      var sub = O.User.PushSubscription;
      return O.Notifications.requestPermission().then(function () { return sub.optIn(); }).then(function () {
        pushOpted = !!sub.optedIn; S._keepScroll = true; render();
        toast(pushOpted ? 'Notifications are on' : 'Notifications were not allowed', !pushOpted);
      });
    });
  }
  function signOut() { os(function (O) { return O.logout(); }); pushLinked = null; LS.del('session'); LS.del('cache'); S.session = null; S.me = null; S.data = null; closeSheet(); renderLogin(); }

  /* ================= shell ================= */
  function render() {
    if (!S.session) return renderLogin();
    if (!S.data) { $('#app').innerHTML = splashHtml(); return; }
    var v = S.view, pend = myPending().length;
    var html = (DEMO ? '<div class="demo">Preview with sample data — changes stay on this phone only</div>' : '') + '<div class="shell">';
    if (v === 'home') html += viewHome();
    else if (v === 'devices') html += viewDevices();
    else if (v === 'activity') html += viewActivity();
    else if (v === 'kits') html += viewKits();
    else if (v === 'jobs') html += viewJobs();
    else html += viewMore();
    html += '</div>';
    if (v === 'home' || v === 'devices' || v === 'kits' || v === 'jobs') html += '<button class="btn fab" id="fab">' + ICON.out + (can('keep') ? 'Check out' : 'Request devices') + '</button>';
    html += '<nav class="nav" aria-label="Main"><div>' + [
      ['home', 'Today', ICON.home], ['jobs', 'Jobs', ICON.jobs], ['devices', 'Devices', ICON.devices], ['kits', 'Loggers', ICON.kits], ['activity', 'Activity', ICON.activity], ['more', 'Me', ICON.more]
    ].map(function (n) {
      return '<a href="#' + n[0] + '" class="' + (v === n[0] ? 'on' : '') + '"' + (v === n[0] ? ' aria-current="page"' : '') + '>' + n[2] + n[1] +
        (n[0] === 'home' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</a>';
    }).join('') + '</div></nav>';
    var y = window.scrollY;
    $('#app').innerHTML = html;
    window.scrollTo(0, S._keepScroll ? y : 0); S._keepScroll = false;
    wire();
  }
  function splashHtml() {
    return '<div class="loading"><div class="lz"><div class="lz-eye">AKHNATON</div><div class="lz-t">Lab Devices</div>' +
      '<div class="lz-rule"><i></i><b></b><i></i></div><img src="logo-en-light.png" alt="Akhnaton Trading and Representation"><div class="spin" style="margin-top:34px"></div></div></div>';
  }
  function header(title) {
    var off = !S.online;
    return '<header class="top"><div class="top-row"><div class="brand"><img src="logo-en-light.png" alt="Akhnaton Trading and Representation"><span class="bdiv"></span>' +
      '<span class="bname"><small>Akhnaton</small><b>Lab Devices</b></span></div>' +
      '<span class="sync' + (off ? ' off' : '') + '" title="' + (off ? 'Offline' : 'Live') + '"><i></i><em>' + (off ? 'Offline' : 'Live') + '</em></span>' +
      '<button class="icon-btn" data-refresh aria-label="Refresh">' + ICON.refresh + '</button></div>' +
      (title && title !== 'Me' ? '<h1 class="ptitle">' + esc(title) + '</h1>' : '');
  }

  function counts() {
    var c = { office: 0, client: 0, service: 0, oos: 0, expired: 0 };
    S.data.devices.forEach(function (d) {
      if (d.status === 'In Office') c.office++; else if (d.status === 'At Client') c.client++;
      else if (d.status === 'Out of Service') c.oos++; else c.service++;
      if (cert(d).kind === 'expired') c.expired++;
    });
    return c;
  }
  function myPending() {
    if (!S.data || !S.me) return [];
    return S.data.transfers.filter(function (t) { return t.status === 'Pending' && (t.toEngineer.id === S.me.id || can('keep')); })
      .concat(myRequests());
  }
  /* Check-out requests: lab keepers see all, others see their own */
  function myRequests() {
    if (!S.data || !S.me) return [];
    return S.data.checkouts.filter(function (c) { return c.status === 'Pending' && (can('keep') || c.byId === S.me.id || (c.engineers || []).some(function (e) { return e.id === S.me.id; })); });
  }
  function isOut(c) { return !c.status || c.status === 'Approved'; }

  /* ---------- Today ---------- */
  function viewHome() {
    var c = counts(), tot = S.data.devices.length || 1;
    var first = (S.me.name || '').split(' ')[0];
    var h = header() +
      '<p class="hello">' + greet() + '<strong>' + esc(first) + '</strong></p>' +
      '<div class="strip" aria-hidden="true">' +
      '<span style="width:' + (c.office / tot * 100) + '%;background:#3FBF7F"></span>' +
      '<span style="width:' + (c.client / tot * 100) + '%;background:#4FA8EC"></span>' +
      '<span style="width:' + (c.service / tot * 100) + '%;background:#E2A13C"></span>' +
      '<span style="width:' + (c.oos / tot * 100) + '%;background:#8C97A8"></span></div>' +
      '<div class="legend">' +
      leg('office', c.office, 'In office', '#3FBF7F') + leg('client', c.client, 'At clients', '#4FA8EC') +
      leg('service', c.service, 'In service', '#E2A13C') + leg('expired', c.expired, 'Expired', '#F07468') +
      '</div></header><main>';

    var ps = pushState();
    if (ps === 'default') h += '<div class="pushbar"><div><b>Turn on notifications</b><small>' + (can('keep') ? 'Get an alert when someone requests devices.' : 'Get an alert when your request is approved or devices are handed to you.') + '</small></div><button class="btn sm blue" data-push>Turn on</button></div>';
    else if (ps === 'denied') h += '<div class="pushbar off"><div><b>Notifications are blocked</b><small>Allow them for this app in your phone settings to get alerts.</small></div></div>';
    var L = kitData('Data Loggers');
    h += '<button class="kitcard" data-gokits="Data Loggers"><div class="kc-h"><b>Data loggers</b><span>Who has them ›</span></div>' +
      '<div class="kc-n"><div><b>' + (L.total == null ? '—' : L.total) + '</b><small>total</small></div><div class="ot" data-kwhere="Data Loggers" role="button"><b>' + L.out + '</b><small>outside ›</small></div><div class="in"><b>' + (L.inLab == null ? '—' : L.inLab) + '</b><small>in the lab</small></div></div>' +
      (L.types.length ? '<div class="kc-t">' + L.types.map(function (t) { return '<span' + (t.out ? ' class="o"' : '') + '>' + esc(t.st.name.replace(/ ?(Temp\/RH )?data logger/i, '')) + ' <b>' + t.out + '</b>/' + (t.total == null ? '—' : t.total) + '</span>'; }).join('') + '</div>' : '') + '</button>';
    var od = overdueList();
    if (od.length) {
      h += '<div class="sec"><h2 style="color:var(--danger)">Overdue — should be back</h2><small>' + od.length + '</small></div><div class="list">';
      od.forEach(function (o) {
        var late = -daysUntil(o.exp);
        h += '<button class="row odrow" data-goco="' + esc(o.coId) + '"><span class="t"><b>' + esc(coName(o.coId)) + '</b><small>With ' + esc(Object.keys(o.people).join(', ') || '—') + ' · ' + countLabel(o.devs.length, o.items) + '</small>' +
          '<small style="color:var(--danger);font-weight:600">Was due ' + fmtDate(o.exp) + ' · ' + late + ' day' + (late === 1 ? '' : 's') + ' late</small></span></button>';
      });
      h += '</div>';
    }
    var reqs = myRequests();
    if (reqs.length) {
      h += '<div class="sec"><h2>' + (can('keep') ? 'Check-out requests to approve' : 'Your requests') + '</h2><small>' + reqs.length + '</small></div>';
      reqs.forEach(function (c) {
        var mine = c.byId === S.me.id;
        var jb = jobById(c.jobId);
        h += '<div class="site" style="--c:var(--pending)"><div class="site-h"><div><h3>' + esc(coName(c.companyId)) + '</h3>' +
          (jb ? '<div class="meta">' + esc(jb.id) + (jb.title ? ' · ' + esc(jb.title) : '') + '</div>' : '') +
          '<div class="meta">Requested by <b>' + esc(c.byName) + '</b> · ' + when(c.requestedTs || c.ts) + '</div>' +
          '<div class="meta">Team: <b>' + esc(names(c.engineers)) + '</b>' + (c.expectedReturn ? ' · back ' + fmtDate(c.expectedReturn) : '') + '</div>' +
          (c.note ? '<div class="meta">Note: ' + esc(c.note) + '</div>' : '') + (c.editedTs ? '<div class="meta">Edited by ' + esc(c.editedByName) + ' · ' + when(c.editedTs) + '</div>' : '') + '</div>' +
          '<span class="cnt">' + countLabel(c.deviceIds.length, c.items) + '</span></div>' +
          '<div class="chips">' + c.deviceIds.map(function (id) { var d = IDX.dev[id]; return d ? '<button class="dchip" data-dev="' + id + '">' + tag(d, 'sm') + '<em>' + esc(devTitle(d)) + '</em></button>' : ''; }).join('') + itemChips(c.items) + '</div>' +
          '<div class="site-f">' + (can('keep')
            ? '<button class="btn sm blue" data-rq-ok="' + c.id + '">Approve</button><button class="btn sm ghost" data-rq-review="' + c.id + '">Review / edit</button><button class="btn sm ghost" data-rq-no="' + c.id + '">Decline</button>'
            : '<span class="meta" style="flex:1;align-self:center">⏳ Waiting for a lab keeper</span>' + (mine ? '<button class="btn sm ghost" data-rq-review="' + c.id + '">Edit</button><button class="btn sm ghost" data-rq-no="' + c.id + '">Cancel</button>' : '')) +
          '</div></div>';
      });
    }
    var pend = myPending().filter(function (t) { return t.toEngineer; });
    if (pend.length) {
      h += '<div class="sec"><h2>Waiting for you</h2></div>';
      pend.forEach(function (t) {
        h += '<div class="site" style="--c:var(--pending)"><div class="site-h"><div><h3>' + esc(t.requestedByName) + ' is handing over ' + t.deviceIds.length + ' device' + (t.deviceIds.length > 1 ? 's' : '') + '</h3>' +
          '<div class="meta">To <b>' + esc(t.toEngineer.name) + '</b> at <b>' + esc(coName(t.toCompanyId)) + '</b> · from ' + esc(coName(t.fromCompanyId)) + ' · ' + when(t.ts) + '</div></div></div>' +
          '<div class="chips">' + t.deviceIds.map(function (id) { var d = IDX.dev[id]; return d ? '<button class="dchip" data-dev="' + id + '">' + tag(d, 'sm') + '<em>' + esc(devTitle(d)) + '</em></button>' : ''; }).join('') + '</div>' +
          '<div class="site-f"><button class="btn sm blue" data-tr-ok="' + t.id + '">Confirm I have them</button><button class="btn sm ghost" data-tr-no="' + t.id + '">Decline</button></div></div>';
      });
    }

    var groups = {};
    S.data.devices.forEach(function (d) { if (d.status === 'At Client') (groups[d.companyId] = groups[d.companyId] || []).push(d); });
    holdings().forEach(function (hh) { if (+hh.qty > 0 && !groups[hh.companyId]) groups[hh.companyId] = []; });
    var keys = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length || coName(a).localeCompare(coName(b)); });
    h += '<div class="sec"><h2>At clients today</h2><small>' + keys.length + ' compan' + (keys.length === 1 ? 'y' : 'ies') + '</small></div>';
    if (!keys.length) h += '<div class="empty"><b>Every device is home.</b>' + (can('keep') ? 'Tap “Check out” when a team leaves with devices.' : 'Nothing is out at a client right now.') + '</div>';
    keys.forEach(function (k) { h += siteCard(k, groups[k]); });

    var serv = S.data.devices.filter(function (d) { return Core.SERVICE.indexOf(d.status) >= 0; });
    if (serv.length) {
      h += '<div class="sec"><h2>Maintenance &amp; calibration</h2><small>' + serv.length + '</small></div><div class="list">' + serv.map(devRow).join('') + '</div>';
    }
    var soon = S.data.devices.filter(function (d) { var k = cert(d).kind; return k === 'soon'; });
    if (soon.length) h += '<div class="sec"><h2>Calibration due within 30 days</h2><small>' + soon.length + '</small></div><div class="list">' + soon.map(devRow).join('') + '</div>';
    return h + '<div style="height:24px"></div></main>';
  }
  function leg(f, n, l, col) { return '<button data-goto-filter="' + f + '"><div class="n">' + n + '</div><div class="l"><span class="dot" style="background:' + col + '"></span>' + l + '</div></button>'; }
  function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

  function siteCard(coId, devs) {
    var engs = {}, since = null, exp = '', coIds = {}, hs = holdingsAt(coId);
    hs.forEach(function (h) { (h.holders || []).forEach(function (p) { engs[p.name] = 1; }); if (!since || h.since < since) since = h.since; if (h.checkoutId) coIds[h.checkoutId] = 1; });
    devs.forEach(function (d) { (d.holders || []).forEach(function (p) { engs[p.name] = 1; }); if (!since || d.since < since) since = d.since; if (d.expectedReturn && (!exp || d.expectedReturn < exp)) exp = d.expectedReturn; if (d.checkoutId) coIds[d.checkoutId] = 1; });
    var late = exp && daysUntil(exp) < 0;
    var days = since ? daysSince(since) : 0;
    return '<div class="site"><div class="site-h"><div><h3>' + esc(coName(coId)) + '</h3>' +
      '<div class="meta">With <b>' + esc(Object.keys(engs).join(', ') || '—') + '</b></div>' +
      '<div class="meta">Out since ' + when(since) + (days > 0 ? ' · ' + days + ' day' + (days > 1 ? 's' : '') : '') +
      (exp ? ' · back <span class="' + (late ? 'late' : '') + '">' + (late ? 'overdue, was ' : '') + fmtDate(exp) + '</span>' : '') + '</div></div>' +
      '<span class="cnt">' + countLabel(devs.length, hs) + '</span></div>' +
      '<div class="chips">' + devs.map(function (d) { return '<button class="dchip" data-dev="' + d.id + '">' + tag(d, 'sm') + '<em>' + esc(devTitle(d)) + '</em></button>'; }).join('') + itemChips(hs) + '</div>' +
      '<div class="site-f">' + (can('keep') ? '<button class="btn sm" data-checkin="' + coId + '">Check in</button>' : '') +
      '<button class="btn sm ghost" data-transfer-co="' + coId + '">Move to…</button>' +
      (Object.keys(coIds).length === 1 ? '<button class="btn sm ghost" data-pdf="' + Object.keys(coIds)[0] + '" aria-label="Receipt PDF">' + ICON.pdf + '</button>' : '') +
      '</div></div>';
  }

  function devRow(d, grouped, inSet) {
    var s = stOf(d), c = cert(d), place = '';
    if (isReq(d)) { var rq = reqOf(d); place = 'Waiting approval' + (rq ? ' · ' + rq.byName + ' → ' + coName(rq.companyId) : ''); }
    else if (d.pending) place = 'Transfer waiting';
    else if (d.status === 'At Client') place = grouped ? 'With ' + names(d.holders) : coName(d.companyId) + ' · ' + names(d.holders);
    else if (d.status === 'In Office') place = 'In office';
    else place = s.short + (d.note ? ' · ' + d.note : '') + (d.holders && d.holders.length ? ' · ' + names(d.holders) : '');
    return '<button class="row" data-dev="' + d.id + '">' + tag(d) + '<span class="t"><b>' + devName(d) + '</b><small>' + esc(devSub(d, inSet)) + '</small>' +
      '<small style="color:' + s.c + ';font-weight:600">' + esc(place) + '</small></span>' +
      (d.status === 'At Client' && d.expectedReturn && daysUntil(d.expectedReturn) < 0 ? '<span class="warn">Overdue</span>' : c.kind === 'expired' ? '<span class="warn" title="' + esc(c.text) + '">Cal. expired</span>' : c.kind === 'soon' ? '<span class="warn" style="color:var(--service)">Due ' + c.days + 'd</span>' : '') + '</button>';
  }

  function devCard(d) {
    var s = stOf(d), c = cert(d), od = d.status === 'At Client' && d.expectedReturn && daysUntil(d.expectedReturn) < 0;
    var place = isReq(d) ? 'Waiting approval' : d.pending ? 'Transfer waiting' : d.status === 'In Office' ? 'In office' : d.status === 'At Client' ? coName(d.companyId) : s.short;
    return '<button class="dcard" data-dev="' + d.id + '" style="--st:' + s.c + '">' + tag(d) + '<b>' + devName(d) + '</b>' +
      '<small>' + esc([d.manufacturer, d.model && d.model !== 'N/A' ? d.model : ''].filter(Boolean).join(' ')) + '</small>' +
      '<span class="dst">' + esc(place) + '</span>' + (od ? '<span class="warn">Overdue</span>' : c.kind === 'expired' ? '<span class="warn">Cal. expired</span>' : '') + '</button>';
  }
  /* ---------- Sets: devices with the same sub category fold into one row; tap to open / close ---------- */
  var OPEN_SETS = {};
  function setGroups(list, rowFn, o) {
    o = o || {};
    var bySub = {}, done = {}, out = '';
    list.forEach(function (d) { if (d.sub) (bySub[d.sub] = bySub[d.sub] || []).push(d); });
    list.forEach(function (d) {
      var m = d.sub && bySub[d.sub];
      if (!m || m.length < 2) { out += rowFn(d, false); return; }
      if (done[d.sub]) return; done[d.sub] = 1;
      var key = (o.scope || 'list') + '|' + d.sub, open = !!o.forceOpen || !!OPEN_SETS[key];
      var inN = m.filter(function (x) { return x.status === 'In Office' && !x.pending; }).length, away = m.length - inN;
      var warn = m.some(function (x) { var c = cert(x); return c.kind === 'expired' || (x.status === 'At Client' && x.expectedReturn && daysUntil(x.expectedReturn) < 0); });
      var info = o.info ? o.info(m) : (inN + ' in office' + (away ? ' · ' + away + ' out' : ''));
      out += '<div class="set' + (open ? ' open' : '') + '"><div class="sethd"><button class="setbtn" data-tset="' + esc(key) + '" aria-expanded="' + open + '">' +
        '<span class="setico">' + m.length + '</span><span class="t"><b>' + esc(d.sub) + '</b><small>' + m.length + ' items · ' + esc(info) + '</small></span>' +
        (warn ? '<span class="warn">!</span>' : '') + '<span class="chev" aria-hidden="true">›</span></button>' + (o.extra ? o.extra(m, d.sub) : '') + '</div>' +
        '<div class="setbody">' + m.map(function (x) { return rowFn(x, true); }).join('') + '</div></div>';
    });
    return out;
  }
  function wireSets(root) {
    $$('[data-tset]', root).forEach(function (b) { b.onclick = function () {
      var k = b.dataset.tset, box = b.closest('.set'), open = !box.classList.contains('open');
      OPEN_SETS[k] = open; box.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
    }; });
  }

  /* ---------- Devices ---------- */
  var DEV_FILTERS = [['all', 'All'], ['office', 'In office'], ['out', 'Outside now'], ['client', 'At clients'], ['service', 'In service'], ['expired', 'Cal. expired'], ['oos', 'Out of service'], ['zaitoun', 'Zaitoun office']];
  /* ---------- Loggers & kits tab: each group with in / out and who has what ---------- */
  var KIT_TABS = [['Data Loggers', 'Loggers'], ['Validator Sensors', 'Validation'], ['Connections', 'Connections'], ['Tools & Accessories', 'Tools'], ['Consumables', 'Consumables']];
  function kitGroup() { return S.kgrp || 'Data Loggers'; }
  function kitData(g) {
    var types = stockList().filter(function (x) { return x.group === g; }).map(function (st) {
      var out = stockOut(st.id), free = stockFree(st);
      return { st: st, out: out, free: free, total: st.total === '' ? null : +st.total };
    });
    var hs = holdings().filter(function (h) { return h.group === g && +h.qty > 0; });
    var byCo = {};
    hs.forEach(function (h) { (byCo[h.companyId] = byCo[h.companyId] || []).push(h); });
    var sites = Object.keys(byCo).map(function (k) {
      var list = byCo[k], people = {}, since = '';
      list.forEach(function (h) { (h.holders || []).forEach(function (p) { people[p.name] = 1; }); if (!since || h.since < since) since = h.since; });
      return { coId: k, name: coName(k), list: list, qty: list.reduce(function (a, h) { return a + (+h.qty); }, 0), people: Object.keys(people), since: since };
    }).sort(function (a, b) { return b.qty - a.qty; });
    var out = hs.reduce(function (a, h) { return a + (+h.qty); }, 0);
    var known = types.filter(function (t) { return t.total != null; });
    var inLab = known.reduce(function (a, t) { return a + t.free; }, 0);
    var total = known.reduce(function (a, t) { return a + t.total; }, 0);
    return { types: types, sites: sites, out: out, inLab: known.length ? inLab : null, total: known.length ? total : null };
  }
  function viewKits() {
    var g = kitGroup(), K = kitData(g);
    var h = header('Loggers & kits') + '</header><main>' +
      '<div class="filters" role="tablist">' + KIT_TABS.map(function (t) { return '<button class="fbtn' + (g === t[0] ? ' on' : '') + '" data-kgrp="' + esc(t[0]) + '">' + esc(t[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="placesum"><div class="ks"><b>' + (K.inLab == null ? '—' : K.inLab) + '</b><span>in the lab</span></div><button class="ks out" data-kwhere="' + esc(g) + '"><b>' + K.out + '</b><span>outside ›</span></button><div class="ks"><b>' + (K.total == null ? '—' : K.total) + '</b><span>total</span></div></div>' +
      '<div class="sortbar" style="margin-top:12px"><span>' + esc(g) + '</span><button class="printbtn" data-kpdf>' + ICON.pdf + 'PDF</button><button class="printbtn xl" data-kxls>' + ICON.pdf + 'Excel</button></div>' +
      '<div class="sec"><h2>In the lab / outside</h2></div><div class="list">' +
      (K.types.length ? K.types.map(function (t) {
        var pct = t.total ? Math.round(t.out / t.total * 100) : 0;
        return '<div class="row kitrow"><span class="t"><b>' + esc(t.st.name) + '</b>' + (t.st.contents ? '<small dir="auto">' + esc(t.st.contents) + '</small>' : '') +
          '<span class="kitnums"><em class="in">' + (t.free == null ? '—' : t.free) + ' in</em>' + (t.out ? '<button class="ot" data-kwst="' + esc(t.st.id) + '" data-g="' + esc(g) + '">' + t.out + ' out ›</button>' : '<em class="ot">0 out</em>') + '<em>' + (t.total == null ? 'total not set' : t.total + ' total') + '</em></span>' +
          (t.total ? '<span class="kbar"><i style="width:' + Math.min(100, pct) + '%"></i></span>' : '') + '</span></div>';
      }).join('') : '<div class="row"><span class="t"><small>No types yet — the admin adds them from Me › Loggers, sensors &amp; kits.</small></span></div>') + '</div>' +
      '<div class="sec"><h2>Who has them</h2><small>' + K.out + ' outside</small></div>';
    if (g === 'Consumables') {
      var used = ((S.data && S.data.movements) || []).filter(function (m) { return m.action === 'Used'; }).slice().reverse().slice(0, 40);
      h = h.replace(/<div class="sec"><h2>Who has them<\/h2>[\s\S]*$/, '') + '<div class="note">These are used up: when someone takes some, they come off the stock and do not come back. The admin adds new stock from Me › Loggers, sensors &amp; kits.</div>' +
        '<div class="sec"><h2>Used recently</h2><small>' + used.length + '</small></div>' +
        (used.length ? '<div class="box" style="margin-top:0"><ul class="tl">' + used.map(function (m) { return '<li style="--c:var(--service)"><b dir="auto">' + esc(m.note) + '</b><small>' + esc(coName(m.companyId)) + ' · ' + esc(names(m.holders)) + '</small><small>' + esc(when(m.ts)) + ' · ' + esc(m.checkoutId) + '</small></li>'; }).join('') + '</ul></div>' : '<div class="empty">Nothing used yet.</div>');
      return h + '<div style="height:24px"></div></main>';
    }
    if (!K.sites.length) h += '<div class="empty"><b>Everything is in the lab.</b>Nothing from this group is outside right now.</div>';
    K.sites.forEach(function (st) {
      h += '<div class="site" style="--c:var(--client)"><div class="site-h"><div><h3>' + esc(st.name) + '</h3>' +
        '<div class="meta">With <b>' + esc(st.people.join(', ')) + '</b>' + (st.since ? ' · since ' + esc(when(st.since)) : '') + '</div></div><span class="cnt">' + st.qty + ' out</span></div>' +
        '<div class="chips">' + itemChips(st.list) + '</div>' +
        (can('keep') ? '<div class="site-f"><button class="btn sm" data-checkin="' + esc(st.coId) + '">Check in</button></div>' : '') + '</div>';
    });
    return h + '<div style="height:24px"></div></main>';
  }
  /* Tap "outside" anywhere: where exactly, by company, and with whom */
  function kitWhere(g, stockId) {
    var st = stockId ? stockList().filter(function (x) { return x.id === stockId; })[0] : null;
    var hs = holdings().filter(function (h) { return +h.qty > 0 && (stockId ? h.stockId === stockId : h.group === g); });
    var byCo = {}, order = [], sum = function (l) { return l.reduce(function (n, h) { return n + (+h.qty); }, 0); };
    hs.forEach(function (h) { if (!byCo[h.companyId]) { byCo[h.companyId] = []; order.push(h.companyId); } byCo[h.companyId].push(h); });
    order.sort(function (a, b) { return sum(byCo[b]) - sum(byCo[a]); });
    var total = sum(hs);
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Outside now', (st ? st.name : g) + ' · ' + total);
      body.innerHTML = !order.length ? '<div class="empty"><b>Nothing outside.</b>Everything is in the lab.</div>' :
        '<div class="note">' + total + ' outside at ' + order.length + ' compan' + (order.length === 1 ? 'y' : 'ies') + '.</div>' +
        order.map(function (co) {
          var list = byCo[co];
          return '<div class="site" style="--c:var(--client)"><div class="site-h"><div><h3>' + esc(coName(co)) + '</h3></div><span class="cnt">' + sum(list) + ' out</span></div>' +
            '<div class="list" style="margin-top:8px">' + list.map(function (h) {
              return '<div class="row"><span class="qn big">' + h.qty + '×</span><span class="t"><b dir="auto">' + esc(h.name) + '</b><small>With ' + esc(names(h.holders)) + '</small>' +
                '<small>Since ' + esc(when(h.since)) + (h.checkoutId ? ' · receipt ' + esc(h.checkoutId) : '') + '</small></span>' +
                (h.checkoutId ? '<button class="btn sm ghost" data-pdf="' + esc(h.checkoutId) + '" aria-label="Receipt PDF">' + ICON.pdf + '</button>' : '') + '</div>';
            }).join('') + '</div></div>';
        }).join('');
      $$('[data-pdf]', body).forEach(function (b) { b.onclick = function () { receiptPdf(b.dataset.pdf); }; });
      setFoot('');
    });
  }
  function kitsXls() {
    var now = new Date(); toast('Preparing Excel…');
    loadXlsx().then(function (X) {
      var wb = X.utils.book_new();
      KIT_TABS.forEach(function (t) {
        var K = kitData(t[0]);
        var aoa = [[t[0] + ' — as of ' + fmtDate(now) + ' ' + fmtTime(now)], [], ['Type', 'English name', 'Total', 'In the lab', 'Outside']]
          .concat(K.types.map(function (x) { return [x.st.name, x.st.note || '', x.total == null ? '' : x.total, x.free == null ? '' : x.free, x.out]; }))
          .concat([[], ['OUTSIDE NOW'], ['Company', 'Type', 'Qty', 'With', 'Since']]);
        K.sites.forEach(function (st) { st.list.forEach(function (h) { aoa.push([st.name, h.name, +h.qty, names(h.holders), fmtDate(h.since)]); }); });
        var ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = [30, 26, 10, 26, 12].map(function (w) { return { wch: w }; });
        X.utils.book_append_sheet(wb, ws, t[1].slice(0, 30));
      });
      var kset = {}; wb.SheetNames.forEach(function (n) { kset[n] = { o: 'portrait', head: 3 }; });
      var blob = xlsxA4(X, wb, kset);
      var stamp = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
      pdfSheet(blob, 'Loggers and kits ' + stamp + '.xlsx', 'Loggers & kits', 'Loggers & kits', 'One sheet per group · in / out / who has them', 'Akhnaton loggers & kits', 'xlsx');
    }).catch(function (e) { toast(e.message, true); });
  }
  function kitsPdf() {
    if (!window.jspdf) return toast('The PDF tool is still loading. Try again in a second.', true);
    var g = kitGroup(), K = kitData(g), now = new Date();
    loadLogo().then(function (logo) {
      function lat(t) { return pdfTxt(t); }
      function nm(stockId, name) { var st = stockList().filter(function (x) { return x.id === stockId; })[0]; return lat(name) || (st && st.note) || 'Other item'; }
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' }), W = 210, M = 14, y = 14;
      var FN = useFont(doc);
      if (logo) { var lw = 46, lh = lw * logo.h / logo.w; doc.addImage(logo.data, 'JPEG', M, y, lw, lh); }
      doc.setFont(FN, 'bold'); doc.setFontSize(15); doc.setTextColor(19, 41, 75); doc.text(g + ' — in / out', W - M, y + 6, { align: 'right' });
      doc.setFont(FN, 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 104, 121);
      doc.text('As of ' + fmtDate(now) + ', ' + fmtTime(now) + '  ·  by ' + lat(S.me && S.me.name), W - M, y + 12, { align: 'right' });
      y += 22; doc.setDrawColor(11, 118, 197); doc.setLineWidth(0.7); doc.line(M, y, W - M, y); y += 8;
      doc.setFontSize(11); doc.setTextColor(19, 41, 75); doc.setFont(FN, 'bold');
      doc.text('In the lab: ' + (K.inLab == null ? '-' : K.inLab) + '     Outside: ' + K.out + '     Total: ' + (K.total == null ? '-' : K.total), M, y); y += 8;
      function table(head, widths, rows) {
        doc.setFillColor(19, 41, 75); doc.rect(M, y, W - 2 * M, 7, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(9.5); doc.setFont(FN, 'bold');
        var x = M + 2; head.forEach(function (t, i) { doc.text(t, x, y + 4.8); x += widths[i]; }); y += 7; doc.setFont(FN, 'normal'); doc.setTextColor(23, 34, 51);
        rows.forEach(function (r, ri) {
          var wr = r.map(function (t, i) { return doc.splitTextToSize(String(t), widths[i] - 2.5); }), hh = Math.max.apply(null, wr.map(function (w) { return w.length; })) * 4.3 + 3;
          if (y + hh > 282) { doc.addPage(); y = 16; }
          if (ri % 2) { doc.setFillColor(237, 241, 245); doc.rect(M, y, W - 2 * M, hh, 'F'); }
          var x2 = M + 2; wr.forEach(function (w, i) { doc.text(w, x2, y + 4.6); x2 += widths[i]; }); y += hh;
        });
        y += 6;
      }
      table(['Type', 'Total', 'In the lab', 'Outside'], [92, 30, 30, 30], K.types.map(function (t) { return [nm(t.st.id, t.st.name), t.total == null ? '-' : t.total, t.free == null ? '-' : t.free, t.out]; }));
      doc.setFont(FN, 'bold'); doc.setFontSize(11); doc.setTextColor(19, 41, 75); doc.text('Outside now', M, y); y += 4;
      var rows = []; K.sites.forEach(function (st) { st.list.forEach(function (h) { rows.push([lat(st.name), nm(h.stockId, h.name), h.qty, lat(names(h.holders)), fmtDate(h.since)]); }); });
      if (rows.length) table(['Company', 'Type', 'Qty', 'With', 'Since'], [52, 46, 14, 46, 24], rows); else { doc.setFont(FN, 'normal'); doc.setFontSize(10); doc.text('Nothing outside.', M, y + 5); }
      var stamp = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
      pdfSheet(doc.output('blob'), g.replace(/[^\w ]+/g, '').trim() + ' in-out ' + stamp + '.pdf', 'Loggers & kits', g, K.out + ' outside', 'Akhnaton ' + g);
    });
  }
  function kitsView() {
    var h = '';
    Core.STOCK_GROUPS.forEach(function (g) {
      var sts = stockList().filter(function (x) { return x.group === g; });
      var extra = holdings().filter(function (x) { return !x.stockId && x.group === g && +x.qty > 0; });
      if (!sts.length && !extra.length) return;
      h += '<div class="sec"><h2>' + esc(g) + '</h2></div><div class="list">';
      sts.forEach(function (st) {
        var out = stockOut(st.id), free = stockFree(st), hs = holdings().filter(function (x) { return x.stockId === st.id && +x.qty > 0; });
        h += '<div class="row kitrow"><span class="t"><b>' + esc(st.name) + '</b><small>' + (st.total === '' ? 'Total not set' : st.total + ' total · ' + free + ' in the lab') + ' · <span style="color:' + (out ? 'var(--client)' : 'var(--muted)') + ';font-weight:600">' + out + ' out</span></small>' +
          hs.map(function (x) { return '<small class="kitwhere">' + x.qty + ' at ' + esc(coName(x.companyId)) + ' · ' + esc(names(x.holders)) + ' · since ' + esc(when(x.since)) + '</small>'; }).join('') + '</span></div>';
      });
      extra.forEach(function (x) { h += '<div class="row kitrow"><span class="t"><b>' + esc(x.name) + '</b><small class="kitwhere">' + x.qty + ' at ' + esc(coName(x.companyId)) + ' · ' + esc(names(x.holders)) + '</small></span></div>'; });
      h += '</div>';
    });
    return h || '<div class="empty"><b>Nothing here yet.</b>The admin adds loggers and kits from Me › Loggers, sensors &amp; kits.</div>';
  }
  function bySerial(a, b) { return a.description.localeCompare(b.description) || a.serial.localeCompare(b.serial); }
  function filteredDevices() {
    if (S.filter === 'kits') S.filter = 'all';
    var f = S.filter, q = S.q;
    return S.data.devices.filter(function (d) {
      if (d.active === false) return false;
      if (f === 'office' && d.status !== 'In Office') return false;
      if (f === 'out' && ((d.status === 'In Office' && (!d.pending || isReq(d))) || d.status === 'Out of Service')) return false;
      if (f === 'client' && d.status !== 'At Client') return false;
      if (f === 'service' && (Core.SERVICE.indexOf(d.status) < 0)) return false;
      if (f === 'oos' && d.status !== 'Out of Service') return false;
      if (f === 'zaitoun' && d.site !== 'Zaitoun office') return false;
      if (f === 'expired' && cert(d).kind !== 'expired') return false;
      return matches(d, q);
    });
  }
  /* Where a device is right now, as a group key + title + sort rank */
  function placeOf(d) {
    if (isReq(d)) return { k: 'request', title: 'In office · waiting approval', rank: 0.5 };
    if (d.pending) return { k: 'pending', title: 'Transfer waiting', rank: 2 };
    if (d.status === 'In Office' && d.site) return { k: 'office:' + d.site, title: 'In ' + d.site, rank: 0.2 };
    if (d.status === 'In Office') return { k: 'office', title: 'In office', rank: 0 };
    if (d.status === 'At Client') return { k: 'co:' + d.companyId, title: coName(d.companyId), rank: 1 };
    if (d.status === 'Out of Service') return { k: 'oos', title: 'Out of service', rank: 6 };
    if (d.status === 'Other') return { k: 'other:' + (d.note || ''), title: 'Other' + (d.note ? ' · ' + d.note : ''), rank: 5 };
    return { k: 'st:' + d.status, title: d.status, rank: d.status === 'Maintenance' ? 3 : 4 };
  }
  function groupByPlace(list) {
    var groups = {}, meta = {};
    list.forEach(function (d) {
      var pl = placeOf(d), k = pl.k;
      (groups[k] = groups[k] || []).push(d);
      if (!meta[k]) meta[k] = { title: pl.title, rank: pl.rank, people: {}, since: d.since || '' };
      (d.holders || []).forEach(function (p) { meta[k].people[p.name || p.id] = 1; });
      if (d.since && (!meta[k].since || d.since < meta[k].since)) meta[k].since = d.since;
    });
    var keys = Object.keys(groups).sort(function (a, b) { return meta[a].rank - meta[b].rank || groups[b].length - groups[a].length || meta[a].title.localeCompare(meta[b].title); });
    keys.forEach(function (k) { groups[k].sort(bySerial); });
    return { keys: keys, groups: groups, meta: meta };
  }
  function viewDevices() {
    var f = S.filter, q = S.q;
    var list = filteredDevices();
    var byPlace = S.sort === 'place';
    var fl = DEV_FILTERS;
    var h = header('Devices') + '</header><main>' +
      '<div class="search">' + ICON.search + '<input id="q" type="search" placeholder="Name or last digits of serial" value="' + esc(q) + '" autocomplete="off" aria-label="Search devices"></div>' +
      '<div class="filters" role="tablist">' + fl.map(function (x) { return '<button class="fbtn' + (f === x[0] ? ' on' : '') + '" data-filter="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="sortbar"><span>' + list.length + ' device' + (list.length === 1 ? '' : 's') + '</span>' +
        (list.length ? '<button class="printbtn" data-listpdf aria-label="Save this list as PDF">' + ICON.pdf + 'PDF</button><button class="printbtn xl" data-listxls aria-label="Save this list as Excel">' + ICON.pdf + 'Excel</button>' : '') + '<div class="sortseg" role="radiogroup" aria-label="Group devices">' +
        '<button data-sort="place" class="' + (byPlace ? 'on' : '') + '" role="radio" aria-checked="' + byPlace + '">Location</button>' +
        '<button data-sort="type" class="' + (byPlace ? '' : 'on') + '" role="radio" aria-checked="' + !byPlace + '">Category</button></div></div>';
    if (f === 'kits') return h.replace(/<div class="sortbar">[\s\S]*$/, '') + kitsView() + '<div style="height:24px"></div></main>';
    if (!list.length) h += '<div class="empty"><b>' + (q ? 'No device matches “' + esc(q) + '”.' : 'No devices here right now.') + '</b>' + (q ? 'Try the last 2–3 digits of the serial, or a word like “tachometer”.' : '') + '</div>';
    else if (byPlace) {
      var G = groupByPlace(list), groups = G.groups, meta = G.meta, keys = G.keys;
      var inN = list.filter(function (d) { return d.status === 'In Office'; }).length;
      var outsideN = list.filter(function (d) { return d.status !== 'In Office' && d.status !== 'Out of Service'; }).length;
      var sites = keys.filter(function (k) { return k.indexOf('co:') === 0; }).length;
      if (f === 'all') h += '<div class="placesum"><button data-filter="office"><b>' + inN + '</b><span>in office</span></button><button data-filter="out"><b>' + outsideN + '</b><span>outside</span></button><button data-filter="client"><b>' + sites + '</b><span>client site' + (sites === 1 ? '' : 's') + '</span></button></div>';
      keys.forEach(function (k) {
        var m = meta[k], ppl = Object.keys(m.people);
        h += '<div class="sec place"><h2>' + esc(m.title) + ' <span class="cnt">' + groups[k].length + '</span></h2>' +
          (k !== 'office' && (ppl.length || m.since) ? '<small>' + esc(ppl.join(', ')) + (ppl.length && m.since ? ' · ' : '') + (m.since ? 'since ' + esc(when(m.since)) : '') + '</small>' : '') + '</div>' +
          '<div class="list">' + setGroups(groups[k], function (d, inSet) { return devRow(d, true, inSet); }, { scope: 'p:' + k, forceOpen: !!q }) + '</div>';
      });
    } else {
      var DG = devGroups(), grpOf = function (d) { var c = setCat(d), g = DG.filter(function (x) { return x[1].indexOf(c) >= 0; })[0]; return g ? g[0] : 'Other devices'; };
      var dv = S.dv || 'tiles';
      h += '<div class="viewbar" role="radiogroup" aria-label="View">' + [['tiles', '▦', 'Tiles'], ['grid', '⊞', 'Grid'], ['list', '☰', 'Details']].map(function (v) {
        return '<button data-dv="' + v[0] + '" class="' + (dv === v[0] ? 'on' : '') + '" role="radio" aria-checked="' + (dv === v[0]) + '"><i>' + v[1] + '</i>' + v[2] + '</button>'; }).join('') + '</div>';
      if (dv === 'tiles' && !q && !S.devGrp) {
        /* category tiles first, like the check-out screen */
        h += '<div class="cats devcats">' + DG.map(function (g) {
          var all = list.filter(function (d) { return grpOf(d) === g[0]; });
          if (!all.length) return '';
          var inN = all.filter(function (d) { return d.status === 'In Office' && !d.pending; }).length, out = all.length - inN;
          var warn = all.filter(function (d) { return cert(d).kind === 'expired'; }).length;
          return '<button data-dgrp="' + esc(g[0]) + '"><span class="tcnt">' + all.length + '</span><b>' + esc(g[0]) + '</b>' +
            '<span class="cmini"><em class="in">' + inN + ' in</em>' + (out ? '<em class="out">' + out + ' out</em>' : '') + (warn ? '<em class="bad">' + warn + ' expired</em>' : '') + '</span></button>';
        }).join('') + '</div>';
        return h + '<div style="height:24px"></div></main>';
      }
      if (dv === 'tiles' && !q) { list = list.filter(function (d) { return grpOf(d) === S.devGrp; }); h += '<button class="backcat" data-dgrpback>‹ Categories <span>' + esc(S.devGrp) + '</span></button>'; }
      if (!list.length) h += '<div class="empty"><b>No devices here with this filter.</b></div>';
      var cards = dv !== 'list';
      var cats = [], byCat = {};
      list.sort(function (a, b) { return setCat(a).localeCompare(setCat(b)) || bySerial(a, b); });
      list.forEach(function (d) { var k = setCat(d); if (!byCat[k]) { byCat[k] = []; cats.push(k); } byCat[k].push(d); });
      cats.forEach(function (cat) {
        h += '<div class="sec cat"><h2>' + esc(cat) + ' <span class="cnt">' + byCat[cat].length + '</span></h2></div>' +
          (cards ? '<div class="dgrid">' + setGroups(byCat[cat], function (d) { return devCard(d); }, { scope: 'g:' + cat, forceOpen: !!q }) + '</div>'
                 : '<div class="list">' + setGroups(byCat[cat], function (d, inSet) { return devRow(d, false, inSet); }, { scope: 't:' + cat, forceOpen: !!q }) + '</div>');
      });
    }
    return h + '<div style="height:24px"></div></main>';
  }

  /* ---------- Jobs: one per client visit, every request inside it; data-sheet follow-up ---------- */
  function jobStats(j) {
    var rs = jobReceipts(j), out = 0, ds = 0, pend = 0;
    rs.forEach(function (c) { if (c.status === 'Pending') { pend++; return; } out += rcptOut(c).n; if (!dsBack(c)) ds++; });
    return { rs: rs, out: out, dsMissing: ds, pending: pend };
  }
  function dsChip(c) {
    if (c.status === 'Pending') return '<span class="dsb wait">Waiting approval</span>';
    return dsBack(c) ? '<span class="dsb yes">Data sheet ✓</span>' : '<span class="dsb no">Data sheet ✗</span>';
  }
  function dsButtons(c) {
    if (!can('keep') || c.status === 'Pending') return '';
    var y = dsBack(c);
    return '<div class="dsrow"><span>Data sheet back in the office?</span><div class="sortseg"><button class="' + (y ? 'on' : '') + '" data-ds="' + c.id + '" data-v="Yes">Yes</button><button class="' + (!y ? 'on no' : '') + '" data-ds="' + c.id + '" data-v="No">No</button></div></div>';
  }
  function viewJobs() {
    var f = S.jf || 'open', rep = can('report');
    var tabs = [['open', 'Open jobs'], ['closed', 'Closed']].concat(rep ? [['ds', 'Data sheets']] : []);
    var h = header('Jobs') + '</header><main>' +
      '<div class="filters" role="tablist">' + tabs.map(function (t) { return '<button class="fbtn' + (f === t[0] ? ' on' : '') + '" data-jf="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (rep && f !== 'ds') {
      var allJ = jobsList(), openN = allJ.filter(function (x) { return x.status !== 'Closed'; }).length, m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
      var closedM = allJ.filter(function (x) { return x.status === 'Closed' && x.closedTs && new Date(x.closedTs) >= m0; }).length;
      h += '<div class="placesum"><button data-jf="open"><b>' + openN + '</b><span>open jobs</span></button><button data-jf="closed"><b>' + (allJ.length - openN) + '</b><span>closed</span></button><div class="ks"><b>' + closedM + '</b><span>closed this month</span></div></div>' +
        '<div class="sortbar" style="margin-top:12px"><span>Jobs summary</span><button class="printbtn" data-jobspdf>' + ICON.pdf + 'PDF</button><button class="printbtn xl" data-dsxls>' + ICON.pdf + 'Excel</button></div>';
    }
    if (can('job') && f !== 'ds') h += '<button class="btn blue wide" data-newjob style="margin:4px 0 6px">＋ Open a new job</button>';
    if (f === 'ds') return h + dsReport() + '<div style="height:24px"></div></main>';
    var list = jobsList().filter(function (j) { return f === 'closed' ? j.status === 'Closed' : j.status !== 'Closed'; })
      .sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
    if (!list.length) h += '<div class="empty"><b>' + (f === 'closed' ? 'No closed jobs yet.' : 'No open jobs.') + '</b>' + (f === 'closed' ? '' : can('job') ? 'Open a job for each client visit, then add requests inside it.' : 'The site supervisor opens a job for each client visit.') + '</div>';
    list.forEach(function (j) {
      var k = jobStats(j);
      h += '<div class="site job" data-job="' + j.id + '" style="--c:' + (j.status === 'Closed' ? 'var(--muted)' : 'var(--blue)') + '"><div class="site-h"><div><h3>' + esc(coName(j.companyId)) + '</h3>' +
        '<div class="meta"><b>' + esc(j.id) + '</b>' + (j.title ? ' · ' + esc(j.title) : '') + '</div>' +
        (j.basis ? '<div class="meta"><span class="jbadge">' + esc(jobBasis(j)) + '</span></div>' : '') +
        '<div class="meta">Opened by ' + esc(j.byName) + ' · ' + esc(when(j.ts)) + (j.status === 'Closed' ? ' · closed ' + esc(fmtDate(j.closedTs)) : '') + '</div></div>' +
        '<span class="cnt">' + k.rs.length + ' req.</span></div>' +
        '<div class="jobnums"><span' + (k.out ? ' class="o"' : '') + '><b>' + k.out + '</b> still out</span><span' + (k.dsMissing ? ' class="r"' : '') + '><b>' + k.dsMissing + '</b> data sheet' + (k.dsMissing === 1 ? '' : 's') + ' missing</span>' + (k.pending ? '<span class="p"><b>' + k.pending + '</b> waiting</span>' : '') + (j.status !== 'Closed' && k.rs.length && !k.out && !k.pending ? '<span class="ok">✓ All back' + (can('job') ? ' — ready to close' : '') + '</span>' : '') + '</div>' +
        (j.status !== 'Closed' ? '<div class="site-f"><button class="btn sm" data-jobreq="' + j.id + '">＋ ' + (can('keep') ? 'Check out' : 'Request') + ' in this job</button></div>' : '') + '</div>';
    });
    return h + '<div style="height:24px"></div></main>';
  }
  /* All approved receipts: what came back and whether the data sheet is in the office */
  function dsRows() {
    return S.data.checkouts.filter(function (c) { return c.status === 'Approved' || !c.status; }).slice().reverse().map(function (c) {
      return { c: c, job: jobById(c.jobId), out: rcptOut(c) };
    });
  }
  function dsReport() {
    var rows = dsRows(), miss = rows.filter(function (r) { return !dsBack(r.c); }), ok = rows.filter(function (r) { return dsBack(r.c); });
    var outMiss = miss.filter(function (r) { return r.out.n; }).length;
    var h = '<div class="placesum"><div class="ks out"><b>' + miss.length + '</b><span>data sheets missing</span></div><div class="ks"><b>' + ok.length + '</b><span>back in office</span></div><div class="ks"><b>' + outMiss + '</b><span>still outside</span></div></div>' +
      '<div class="sortbar" style="margin-top:12px"><span>Data sheet report</span><button class="printbtn" data-dspdf>' + ICON.pdf + 'PDF</button><button class="printbtn xl" data-dsxls>' + ICON.pdf + 'Excel</button></div>';
    function card(r) {
      var c = r.c;
      return '<div class="site" style="--c:' + (dsBack(c) ? 'var(--office)' : 'var(--danger)') + '"><div class="site-h"><div><h3>' + esc(coName(c.companyId)) + '</h3>' +
        '<div class="meta"><b>' + esc(c.id) + '</b>' + (r.job ? ' · ' + esc(r.job.id) + (r.job.title ? ' · ' + esc(r.job.title) : '') : '') + '</div>' +
        '<div class="meta">With <b>' + esc(names(c.engineers)) + '</b> · ' + esc(fmtDate(c.ts)) + '</div>' +
        '<div class="meta">' + (r.out.n ? '<span class="late">' + r.out.n + ' still outside</span>' : 'Everything came back ✓') + (dsBack(c) ? ' · marked by ' + esc(c.dataSheetByName) + ' ' + esc(fmtDate(c.dataSheetTs)) : '') + '</div></div>' +
        dsChip(c) + '</div>' + dsButtons(c) + '</div>';
    }
    h += '<div class="sec"><h2 style="color:var(--danger)">Data sheet not back</h2><small>' + miss.length + '</small></div>' + (miss.length ? miss.map(card).join('') : '<div class="empty"><b>All data sheets are in the office.</b></div>');
    h += '<div class="sec"><h2>Data sheet back</h2><small>' + ok.length + '</small></div>' + (ok.length ? ok.slice(0, 60).map(card).join('') : '<div class="empty">None marked yet.</div>');
    return h;
  }
  function setDS(coId, v) {
    busy(true);
    req('setDataSheet', { checkoutId: coId, value: v }).then(function () { S._keepScroll = true; return refresh(true); })
      .then(function () { toast(v === 'Yes' ? 'Data sheet marked as back' : 'Marked as not back'); var top = sheetStack[sheetStack.length - 1]; if (top && top._redraw) top._redraw(); })
      .catch(function (e) { toast(e.message, true); }).then(function () { busy(false); });
  }
  function openJob(id) {
    var j = jobById(id); if (!j) return;
    openSheet(function (body, setFoot, setTitle, wrap) {
      setTitle(j.id);
      wrap._redraw = function () { j = jobById(id) || j; draw(); };
      draw();
      function draw() {
      var k = jobStats(j);
      var h = '<div class="hero" style="padding-bottom:6px"><h3>' + esc(coName(j.companyId)) + '</h3><div class="sub">' + esc(j.title || 'Job') + ' · ' + (j.status === 'Closed' ? 'Closed ' + esc(fmtDate(j.closedTs)) : 'Open') + '</div></div>' +
        '<div class="box" style="margin-top:0"><dl class="kv">' + (j.basis ? '<dt>Under</dt><dd>' + esc(jobBasis(j)) + '</dd>' : '') + '<dt>Opened by</dt><dd>' + esc(j.byName) + ' · ' + esc(fmtDate(j.ts)) + '</dd>' + (j.note ? '<dt>Note</dt><dd>' + esc(j.note) + '</dd>' : '') +
        '<dt>Requests</dt><dd>' + k.rs.length + '</dd><dt>Still outside</dt><dd>' + k.out + '</dd><dt>Data sheets missing</dt><dd>' + k.dsMissing + '</dd></dl></div>';
      if (!k.rs.length) h += '<div class="empty"><b>No requests in this job yet.</b></div>';
      k.rs.slice().reverse().forEach(function (c) {
        var o = rcptOut(c);
        h += '<div class="site" style="--c:' + (c.status === 'Pending' ? 'var(--pending)' : o.n ? 'var(--client)' : 'var(--office)') + '"><div class="site-h"><div><h3>' + esc(c.id) + '</h3>' +
          '<div class="meta">' + esc(when(c.requestedTs || c.ts)) + ' · by ' + esc(c.byName) + '</div><div class="meta">Team: <b>' + esc(names(c.engineers)) + '</b>' + (c.expectedReturn ? ' · back ' + fmtDate(c.expectedReturn) : '') + '</div>' +
          '<div class="meta">' + (c.status === 'Pending' ? '⏳ waiting for a lab keeper' : o.n ? '<span class="late">' + o.n + ' still outside</span>' : 'Everything came back ✓') + '</div></div>' + dsChip(c) + '</div>' +
          '<div class="chips">' + c.deviceIds.map(function (id) { var d = IDX.dev[id]; return d ? '<button class="dchip" data-dev="' + id + '">' + tag(d, 'sm') + '<em>' + esc(devTitle(d)) + '</em></button>' : ''; }).join('') + itemChips(c.items) + '</div>' +
          dsButtons(c) + (c.status !== 'Pending' ? '<div class="site-f"><button class="btn sm ghost" data-pdf="' + c.id + '">' + ICON.pdf + 'Receipt</button></div>' : '') + '</div>';
      });
      body.innerHTML = h;
      var f = [];
      if (can('job')) f.push('<button class="btn ghost" data-je style="flex:0 0 auto">' + (j.status === 'Closed' ? 'Reopen' : 'Edit / close') + '</button>');
      if (j.status !== 'Closed') f.push('<button class="btn blue" data-jr>＋ ' + (can('keep') ? 'Check out' : 'Request') + '</button>');
      setFoot(f.join(''));
      $$('[data-dev]', body).forEach(function (b) { b.onclick = function () { openDevice(b.dataset.dev); }; });
      $$('[data-pdf]', body).forEach(function (b) { b.onclick = function () { receiptPdf(b.dataset.pdf); }; });
      $$('[data-ds]', body).forEach(function (b) { b.onclick = function () { setDS(b.dataset.ds, b.dataset.v); }; });
      var je = $('[data-je]'); if (je) je.onclick = function () {
        if (j.status === 'Closed') return saveJobReq({ id: j.id, status: 'Open' }, 'Job reopened');
        editJob(j);
      };
      var jr = $('[data-jr]'); if (jr) jr.onclick = function () { checkoutFlow(null, j.id); };
      }
    });
  }
  function saveJobReq(job, msg, after) {
    busy(true);
    return req('saveJob', { job: job }).then(function (r) { return refresh(true).then(function () { return r; }); })
      .then(function (r) { closeAll(); toast(msg); after && after(r.jobId); return r; })
      .catch(function (e) { toast(e.message, true); }).then(function (r) { busy(false); return r; });
  }
  function editJob(j, onCreated) {
    var f = j ? { id: j.id, companyId: j.companyId, title: j.title || '', note: j.note || '', basis: j.basis || '', ref: j.ref || '' } : { companyId: '', title: '', note: '', basis: '', ref: '' };
    openSheet(function (body, setFoot, setTitle) {
      setTitle(j ? 'Edit job' : 'Open a new job', j ? j.id : '');
      function refLabel() { var b = BASIS.filter(function (x) { return x[0] === f.basis; })[0]; return b ? b[2] : ''; }
      body.innerHTML = '<div class="box" style="margin-top:0"><h4>The job is under</h4><div class="seg" id="jb">' + BASIS.map(function (b) { return '<button data-jbasis="' + b[0] + '" class="' + (f.basis === b[0] ? 'on' : '') + '">' + b[1] + '</button>'; }).join('') + '</div>' +
        '<label class="f" id="jrefw" style="margin:12px 0 0;' + (f.basis ? '' : 'display:none') + '"><span id="jrefl">' + esc(refLabel()) + '</span><input class="inp" id="jref" value="' + esc(f.ref) + '"></label></div>' +
        '<label class="f"><span>What is the job? (e.g. Thermal mapping – stores)</span><input class="inp" id="jt" value="' + esc(f.title) + '"></label>' +
        '<label class="f"><span>Note (optional)</span><input class="inp" id="jn" value="' + esc(f.note) + '"></label>' +
        '<div class="sec" style="margin-top:4px"><h2>Company</h2></div><div id="jc"></div>';
      $('#jt', body).oninput = function (e) { f.title = e.target.value; };
      $('#jn', body).oninput = function (e) { f.note = e.target.value; };
      $('#jref', body).oninput = function (e) { f.ref = e.target.value; foot(); };
      $$('[data-jbasis]', body).forEach(function (b) { b.onclick = function () { f.basis = b.dataset.jbasis; $$('[data-jbasis]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); $('#jrefw', body).style.display = ''; $('#jrefl', body).textContent = refLabel(); foot(); }; });
      companyPicker($('#jc', body), f.companyId, function (id) { f.companyId = id; foot(); });
      function foot() {
        setFoot((j ? '<button class="btn ghost" data-close-job style="flex:0 0 auto;color:var(--danger)">Close job</button>' : '') + '<button class="btn blue" data-sj ' + (f.companyId && f.basis && (f.basis !== 'Other' || f.ref.trim()) ? '' : 'disabled') + '>' + (j ? 'Save' : 'Open job') + '</button>');
        var cj = $('[data-close-job]'); if (cj) cj.onclick = function () {
          var k = jobStats(j);
          askConfirm('Close ' + j.id + '?' + (k.out ? ' ' + k.out + ' still outside.' : '') + (k.dsMissing ? ' ' + k.dsMissing + ' data sheet(s) missing.' : ''), 'Close job', function () { saveJobReq({ id: j.id, status: 'Closed' }, 'Job closed'); }, true);
        };
        $('[data-sj]').onclick = function () {
          if (j) return saveJobReq(f, 'Job saved');
          busy(true);
          req('saveJob', { job: f }).then(function (r) { return refresh(true).then(function () { return r; }); })
            .then(function (r) { closeSheet(); toast('Job ' + r.jobId + ' opened'); if (onCreated) onCreated(r.jobId); else openJob(r.jobId); })
            .catch(function (e) { toast(e.message, true); }).then(function () { busy(false); });
        };
      }
      foot();
    });
  }
  function dsXls() {
    var now = new Date(); toast('Preparing Excel…');
    loadXlsx().then(function (X) {
      var wb = X.utils.book_new();
      var head = ['Data sheet', 'Receipt', 'Out on', 'Company', 'Job', 'Job title', 'Engineers', 'Devices', 'Items', 'Still outside', 'Expected back', 'Marked by', 'Marked on'];
      var rows = dsRows().sort(function (a, b) { return dsBack(a.c) - dsBack(b.c); }).map(function (r) {
        var c = r.c;
        return [dsBack(c) ? 'Yes' : 'No', c.id, fmtDate(c.ts), coName(c.companyId), r.job ? r.job.id : '', r.job ? r.job.title || '' : '', names(c.engineers), c.deviceIds.length, itemsText(c.items), r.out.n || 'All back', c.expectedReturn ? fmtDate(c.expectedReturn) : '', c.dataSheetByName || '', c.dataSheetTs ? fmtDate(c.dataSheetTs) : ''];
      });
      var ws = X.utils.aoa_to_sheet([['Data sheet report — as of ' + fmtDate(now) + ' ' + fmtTime(now)], [], head].concat(rows));
      ws['!cols'] = [10, 14, 12, 26, 14, 24, 28, 8, 30, 12, 13, 16, 12].map(function (w) { return { wch: w }; });
      ws['!autofilter'] = { ref: 'A3:M' + (rows.length + 3) };
      X.utils.book_append_sheet(wb, ws, 'Data sheets');
      var jr = jobsList().slice().sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); }).map(function (j) { var k = jobStats(j); return [j.id, coName(j.companyId), j.title || '', j.basis || '', j.basis === 'Other' ? '' : j.ref || '', j.status || 'Open', j.byName, fmtDate(j.ts), j.closedTs ? fmtDate(j.closedTs) : '', k.rs.length, k.out, k.dsMissing]; });
      var ws2 = X.utils.aoa_to_sheet([['Jobs — as of ' + fmtDate(now)], [], ['Job', 'Company', 'Title', 'Under', 'PO / approval no.', 'Status', 'Opened by', 'Opened', 'Closed', 'Requests', 'Still outside', 'Data sheets missing']].concat(jr));
      ws2['!cols'] = [14, 26, 26, 14, 18, 9, 16, 12, 12, 9, 12, 16].map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws2, 'Jobs');
      var blob = xlsxA4(X, wb, { 'Data sheets': { o: 'landscape', head: 3 }, 'Jobs': { o: 'landscape', head: 3 } });
      pdfSheet(blob, 'Data sheet report ' + isoDay(now) + '.xlsx', 'Data sheet report', 'Data sheet report', rows.length + ' receipts · ' + jr.length + ' jobs', 'Akhnaton data sheet report', 'xlsx');
    }).catch(function (e) { toast(e.message, true); });
  }
  function dsPdf() {
    if (!window.jspdf) return toast('The PDF tool is still loading. Try again in a second.', true);
    var now = new Date(), all = dsRows(), miss = all.filter(function (r) { return !dsBack(r.c); }), ok = all.filter(function (r) { return dsBack(r.c); });
    var outN = miss.filter(function (r) { return r.out.n; }).length;
    loadLogo().then(function (logo) {
      function lat(t) { return pdfTxt(t); }
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4', orientation: 'landscape' }), W = 297, H = 210, M = 10, y = 10;
      var FN = useFont(doc);
      /* one line per cell: cut the text with … so nothing wraps */
      function fit(t, w) { t = lat(t); if (doc.getTextWidth(t) <= w) return t; while (t.length > 1 && doc.getTextWidth(t + '…') > w) t = t.slice(0, -1); return t + '…'; }
      if (logo) { var lw = 44, lh = lw * logo.h / logo.w; doc.addImage(logo.data, 'JPEG', M, y, lw, lh); }
      doc.setFont(FN, 'bold'); doc.setFontSize(17); doc.setTextColor(19, 41, 75); doc.text('Data Sheet Report', W - M, y + 6, { align: 'right' });
      doc.setFont(FN, 'normal'); doc.setFontSize(9); doc.setTextColor(90, 104, 121);
      doc.text('As of ' + fmtDate(now) + ', ' + fmtTime(now) + '   ·   by ' + lat(S.me && S.me.name), W - M, y + 11.5, { align: 'right' });
      y += 19;
      /* summary cards */
      [[miss.length, 'Data sheets NOT back', [194, 54, 43], [253, 236, 234]], [ok.length, 'Data sheets back in office', [30, 138, 85], [230, 246, 238]], [outN, 'Not back & devices still outside', [11, 118, 197], [230, 241, 251]], [all.length, 'Receipts in total', [19, 41, 75], [237, 241, 245]]].forEach(function (c, i) {
        var cw = (W - 2 * M - 9) / 4, x = M + i * (cw + 3);
        doc.setFillColor(c[3][0], c[3][1], c[3][2]); doc.roundedRect(x, y, cw, 15, 2, 2, 'F');
        doc.setFillColor(c[2][0], c[2][1], c[2][2]); doc.rect(x, y, 1.6, 15, 'F');
        doc.setFont(FN, 'bold'); doc.setFontSize(16); doc.setTextColor(c[2][0], c[2][1], c[2][2]); doc.text(String(c[0]), x + 5, y + 7.5);
        doc.setFont(FN, 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 72, 88); doc.text(c[1], x + 5, y + 12);
      });
      y += 21;
      var cols = [['#', 8], ['Receipt', 25], ['Out on', 21], ['Company', 48], ['Job', 42], ['Engineers', 48], ['Still out', 18], ['Data sheet', 22], ['Marked by / on', 45]];
      var RH = 6.4;
      function headRow() {
        doc.setFillColor(19, 41, 75); doc.rect(M, y, W - 2 * M, 7, 'F'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255); doc.setFont(FN, 'bold');
        var x = M + 2; cols.forEach(function (c) { doc.text(c[0], x, y + 4.7); x += c[1]; }); doc.setFont(FN, 'normal'); y += 7;
      }
      function section(t, list, col) {
        if (y + 22 > H - 12) { doc.addPage(); y = 12; }
        doc.setFillColor(col[0], col[1], col[2]); doc.rect(M, y, 2, 6, 'F');
        doc.setFont(FN, 'bold'); doc.setFontSize(11); doc.setTextColor(col[0], col[1], col[2]); doc.text(t + '  (' + list.length + ')', M + 4, y + 4.6); y += 8; headRow();
        if (!list.length) { doc.setFontSize(9); doc.setTextColor(90, 104, 121); doc.text('None.', M + 2, y + 4.5); y += RH + 2; return; }
        list.forEach(function (r, i) {
          var c = r.c, yes = dsBack(c);
          if (y + RH > H - 12) { doc.addPage(); y = 12; headRow(); }
          if (i % 2) { doc.setFillColor(244, 246, 249); doc.rect(M, y, W - 2 * M, RH, 'F'); }
          doc.setFontSize(8.5); doc.setTextColor(23, 34, 51); doc.setFont(FN, 'normal');
          var cells = [String(i + 1), c.id, fmtDate(c.ts), coName(c.companyId), r.job ? r.job.id + (r.job.title ? ' · ' + r.job.title : '') : '—', names(c.engineers), r.out.n ? String(r.out.n) : '✓', '', c.dataSheetByName ? c.dataSheetByName + ' · ' + fmtDate(c.dataSheetTs) : ''];
          var x = M + 2;
          cells.forEach(function (t, k) {
            var w = cols[k][1] - 3;
            if (k === 7) {
              doc.setFillColor(yes ? 30 : 194, yes ? 138 : 54, yes ? 85 : 43); doc.roundedRect(x - 0.5, y + 1.1, 13, RH - 2.2, 1.5, 1.5, 'F');
              doc.setFont(FN, 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.text(yes ? 'YES' : 'NO', x + 6, y + 4.4, { align: 'center' });
              doc.setFont(FN, 'normal'); doc.setFontSize(8.5); doc.setTextColor(23, 34, 51);
            } else {
              if (k === 6) { if (r.out.n) { doc.setTextColor(11, 118, 197); doc.setFont(FN, 'bold'); } else doc.setTextColor(30, 138, 85); }
              doc.text(fit(t, w), x, y + 4.4);
              doc.setTextColor(23, 34, 51); doc.setFont(FN, 'normal');
            }
            x += cols[k][1];
          });
          y += RH;
        });
        doc.setDrawColor(214, 221, 230); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 7;
      }
      section('Data sheet NOT back', miss, [194, 54, 43]);
      section('Data sheet back in the office', ok, [30, 138, 85]);
      var pages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(140, 150, 165); doc.text('Akhnaton Trading and Representation · Calibration Lab · Data Sheet Report · ' + fmtDate(now), M, H - 5); doc.text('Page ' + p + ' of ' + pages, W - M, H - 5, { align: 'right' }); }
      pdfSheet(doc.output('blob'), 'Data sheet report ' + isoDay(now) + '.pdf', 'Data sheet report', 'Data sheet report', miss.length + ' missing · ' + ok.length + ' back', 'Akhnaton data sheet report');
    });
  }
  /* Summary of open and closed jobs */
  function jobsPdf() {
    if (!window.jspdf) return toast('The PDF tool is still loading. Try again in a second.', true);
    var now = new Date(), all = jobsList().slice().sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
    var open = all.filter(function (j) { return j.status !== 'Closed'; }), closed = all.filter(function (j) { return j.status === 'Closed'; });
    loadLogo().then(function (logo) {
      function lat(t) { return pdfTxt(t); }
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4', orientation: 'landscape' }), W = 297, H = 210, M = 12, y = 12;
      var FN = useFont(doc);
      if (logo) { var lw = 50, lh = lw * logo.h / logo.w; doc.addImage(logo.data, 'JPEG', M, y, lw, lh); }
      doc.setFont(FN, 'bold'); doc.setFontSize(16); doc.setTextColor(19, 41, 75); doc.text('Jobs Summary', W - M, y + 6, { align: 'right' });
      doc.setFont(FN, 'normal'); doc.setFontSize(10); doc.setTextColor(90, 104, 121);
      doc.text(open.length + ' open  ·  ' + closed.length + ' closed  ·  as of ' + fmtDate(now) + ', ' + fmtTime(now) + '  ·  by ' + lat(S.me && S.me.name), W - M, y + 12, { align: 'right' });
      y += 22; doc.setDrawColor(11, 118, 197); doc.setLineWidth(0.7); doc.line(M, y, W - M, y); y += 6;
      var cols = [['Job', 26], ['Company', 52], ['Title', 50], ['Under', 40], ['Opened', 30], ['Closed', 22], ['Req.', 12], ['Out', 12], ['Data sheets missing', 29]];
      function headRow() {
        doc.setFillColor(19, 41, 75); doc.rect(M, y, W - 2 * M, 7.5, 'F'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255); doc.setFont(FN, 'bold');
        var x = M + 2; cols.forEach(function (c) { doc.text(c[0], x, y + 5.1); x += c[1]; }); doc.setFont(FN, 'normal'); y += 7.5;
      }
      function section(t, list) {
        if (y + 18 > H - 14) { doc.addPage(); y = 14; }
        doc.setFont(FN, 'bold'); doc.setFontSize(11.5); doc.setTextColor(19, 41, 75); doc.text(t + '  (' + list.length + ')', M, y + 4); y += 6.5; headRow();
        list.forEach(function (j, i) {
          var k = jobStats(j), cells = [j.id, lat(coName(j.companyId)), lat(j.title), lat(jobBasis(j)), lat(j.byName) + ' ' + fmtDate(j.ts), j.closedTs ? fmtDate(j.closedTs) : '', String(k.rs.length), String(k.out), String(k.dsMissing)];
          var wr = cells.map(function (t, n) { return doc.splitTextToSize(t, cols[n][1] - 2.5); }), hh = Math.max.apply(null, wr.map(function (w) { return w.length; })) * 4.2 + 3;
          if (y + hh > H - 14) { doc.addPage(); y = 14; headRow(); }
          if (i % 2) { doc.setFillColor(237, 241, 245); doc.rect(M, y, W - 2 * M, hh, 'F'); }
          doc.setFontSize(9.3); doc.setTextColor(23, 34, 51);
          var x = M + 2; wr.forEach(function (w, n) { doc.text(w, x, y + 4.6); x += cols[n][1]; }); y += hh;
        });
        if (!list.length) { doc.setFontSize(10); doc.setTextColor(90, 104, 121); doc.text('None.', M + 2, y + 5); y += 7; }
        y += 6;
      }
      section('Open jobs', open); section('Closed jobs', closed);
      var pages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pages; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(140, 150, 165); doc.text('Akhnaton Trading and Representation · Calibration Lab · Jobs Summary', M, H - 6); doc.text('Page ' + p + ' of ' + pages, W - M, H - 6, { align: 'right' }); }
      pdfSheet(doc.output('blob'), 'Jobs summary ' + isoDay(now) + '.pdf', 'Jobs summary', 'Jobs summary', open.length + ' open · ' + closed.length + ' closed', 'Akhnaton jobs summary');
    });
  }
  /* Admin only: erase trial data — each kind on its own, for a chosen period */
  var ERASE_OPTS = [
    ['moves', 'Audit trail', 'The movement history of every device: check-outs, returns, transfers and consumables used.', 'Records'],
    ['receipts', 'Check-out receipts', 'Closed receipts only. Receipts with devices still outside, or waiting for approval, are kept.', 'Records'],
    ['transfers', 'Transfer records', 'Completed transfers of devices from one client site to another.', 'Records'],
    ['jobs', 'Jobs', 'Jobs that have no receipts left. Jobs that still have receipts are kept.', 'Records'],
    ['datasheets', 'Data sheet status', 'Clears the Yes / No “data sheet received” mark on receipts. The receipts themselves stay.', 'Records'],
    ['places', 'Reset device locations', 'Every device back to In office, every logger and kit back in the lab, waiting requests cancelled. Applies to all devices, whatever the period.', 'Reset & clean-up'],
    ['devices', 'Devices added from the app', 'Removes devices someone added from the app in this period. The official device list is not touched.', 'Reset & clean-up'],
    ['companies', 'Unused companies', 'Removes companies added in this period that have no job or receipt.', 'Reset & clean-up']
  ];
  function eraseHistory() {
    var days = 1, what = {};
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Erase');
      function draw() {
        body.innerHTML = '<div class="note warnbox">Choose exactly what to erase. Nothing is chosen until you tick it. Erasing cannot be undone.</div>' +
          '<div class="box"><h4>Period</h4><div class="seg">' + [[1, 'Last 24 hours'], [3, 'Last 3 days'], [7, 'Last 7 days'], [30, 'Last 30 days'], [0, 'Everything']].map(function (o) { return '<button data-days="' + o[0] + '" class="' + (days === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' +
          '<label class="f" style="margin:12px 0 0"><span>Or the last … days</span><input class="inp" id="edays" inputmode="numeric" value="' + (days || '') + '" placeholder="e.g. 5"></label></div>' +
          ['Records', 'Reset & clean-up'].map(function (sec, si) {
            return '<div class="sec"><h2>' + (si ? 'Reset &amp; clean-up' : 'History records') + '</h2>' + (si ? '' : '<small>' + Object.keys(what).filter(function (k) { return what[k]; }).length + ' chosen</small>') + '</div><div class="list">' +
              ERASE_OPTS.filter(function (o) { return o[3] === sec; }).map(function (o) { var on = !!what[o[0]]; return '<button class="row' + (on ? ' sel' : '') + '" data-ew="' + o[0] + '"><span class="check">' + (on ? ICON.tick : '') + '</span><span class="t"><b>' + o[1] + '</b><small>' + o[2] + '</small></span></button>'; }).join('') + '</div>';
          }).join('');
        $$('[data-days]', body).forEach(function (b) { b.onclick = function () { days = +b.dataset.days; draw(); }; });
        $('#edays', body).oninput = function (e) { days = parseInt(e.target.value, 10) || 0; $$('[data-days]', body).forEach(function (x) { x.classList.toggle('on', +x.dataset.days === days); }); foot(); };
        $$('[data-ew]', body).forEach(function (b) { b.onclick = function () { what[b.dataset.ew] = !what[b.dataset.ew]; S._keepScroll = true; var y = body.scrollTop; draw(); body.scrollTop = y; }; });
        foot();
      }
      function chosen() { return ERASE_OPTS.filter(function (o) { return what[o[0]]; }); }
      function foot() {
        var c = chosen();
        setFoot('<button class="btn danger" data-er ' + (c.length ? '' : 'disabled') + '>Erase ' + (c.length ? c.length + ' item' + (c.length === 1 ? '' : 's') : '…') + '</button>');
        $('[data-er]').onclick = function () {
          var per = days ? 'from the last ' + days + ' day' + (days === 1 ? '' : 's') : 'from ALL time';
          askConfirm('Erase ' + per + ': ' + c.map(function (o) { return o[1]; }).join(', ') + '? This cannot be undone.', 'Erase', function () {
            busy(true);
            req('eraseHistory', { days: days, what: what }).then(function (r) { return refresh(true).then(function () { return r; }); })
              .then(function (r) {
                closeAll();
                var parts = [['moves', 'audit-trail entries'], ['receipts', 'receipts'], ['transfers', 'transfers'], ['jobs', 'jobs'], ['datasheets', 'data sheet marks cleared'], ['places', 'devices / items reset'], ['devices', 'devices removed'], ['companies', 'companies removed']]
                  .filter(function (x) { return what[x[0]]; }).map(function (x) { return (r[x[0]] || 0) + ' ' + x[1]; });
                toast('Erased: ' + parts.join(', '));
              })
              .catch(function (e) { toast(e.message, true); }).then(function () { busy(false); });
          }, true);
        };
      }
      draw();
    });
  }

  /* ---------- Activity ---------- */
  function viewActivity() {
    var mv = S.data.movements.slice().reverse().slice(0, 120);
    var cos = S.data.checkouts.filter(isOut).slice().reverse().slice(0, 30);
    var h = header('Activity') + '</header><main>';
    h += '<div class="sec"><h2>Check-out receipts</h2><small>latest ' + cos.length + '</small></div>';
    if (!cos.length) h += '<div class="empty"><b>No check-outs yet.</b>Each check-out makes a PDF receipt you can share.</div>';
    else h += '<div class="list">' + cos.map(function (c) {
      return '<button class="row" data-pdf="' + c.id + '"><span class="t"><b>' + esc(coName(c.companyId)) + '</b><small>' + c.id + ' · ' + when(c.ts) + ' · ' + c.deviceIds.length + ' device' + (c.deviceIds.length > 1 ? 's' : '') + '</small><small>' + esc(names(c.engineers)) + '</small></span>' + ICON.pdf + '</button>';
    }).join('') + '</div>';
    h += '<div class="sec"><h2>Every move</h2></div>';
    if (!mv.length) h += '<div class="empty"><b>Nothing has moved yet.</b></div>';
    else {
      var day = null, out = '';
      mv.forEach(function (m) {
        var d = IDX.dev[m.deviceId]; if (!d) return;
        var k = fmtDate(m.ts);
        if (k !== day) { if (day) out += '</ul></div>'; day = k; out += '<div class="box"><h4>' + (daysSince(m.ts) === 0 ? 'Today' : daysSince(m.ts) === 1 ? 'Yesterday' : k) + '</h4><ul class="tl">'; }
        out += moveItem(m, true);
      });
      h += out + '</ul></div>';
    }
    return h + '<div style="height:24px"></div></main>';
  }
  function moveItem(m, withDev) {
    var d = IDX.dev[m.deviceId], col = m.action.indexOf('Checked out') === 0 || m.action === 'Transferred' ? 'var(--client)' : m.action.indexOf('Returned') === 0 ? 'var(--office)' : m.action.indexOf('Transfer') === 0 ? 'var(--pending)' : 'var(--service)';
    var where = m.action === 'Checked out' || m.action === 'Transferred' ? ' → ' + coName(m.companyId) + (m.holders && m.holders.length ? ' with ' + names(m.holders) : '') : '';
    return '<li style="--c:' + col + '"><b>' + esc(m.action) + esc(where) + '</b>' +
      (withDev && d ? '<small>' + esc(devTitle(d)) + ' · S/N ' + esc(d.serial) + '</small>' : '') +
      (m.note && m.action !== 'Checked out' ? '<small>' + esc(m.note) + '</small>' : '') +
      '<small>' + fmtTime(m.ts) + (withDev ? '' : ' · ' + fmtDate(m.ts)) + ' · by ' + esc(m.byName) + '</small></li>';
  }

  /* ---------- Me / admin ---------- */
  function viewMore() {
    var role = ROLE_NAME[S.me.role] || 'Engineer';
    var h = header('Me') + '<p class="hello">' + role + '<strong>' + esc(S.me.name) + '</strong></p></header><main>';
    h += '<div class="list" style="margin-top:6px">' +
      '<button class="row" data-act="pin"><span class="t"><b>Change my PIN</b><small>4 digits, only you know it</small></span></button>' +
      '<button class="row" data-act="refresh"><span class="t"><b>Refresh now</b><small>Last update ' + (S.lastSync ? when(S.lastSync) : '—') + ' · updates every 20 seconds</small></span></button>' +
      '</div>';
    if (can('admin')) {
      var site = (location.protocol === 'https:' && !DEMO) ? location.origin + '/' : 'https://bishoyloza-sketch.github.io/';
      h += '<div class="sec"><h2>Website link</h2><small>only the admin sees this</small></div><div class="box linkbox" style="margin-top:0">' +
        '<div class="url">' + esc(site) + '</div><div class="actions" style="grid-template-columns:1fr 1fr 1fr">' +
        '<button class="btn sm" data-link="copy">Copy link</button><button class="btn sm ghost" data-link="share">Share</button><a class="btn sm ghost" href="' + esc(site) + '" target="_blank" rel="noopener" style="text-decoration:none">Open</a></div></div>';
      h += '<div class="sec"><h2>Admin</h2></div><div class="list">' +
        '<button class="row" data-act="people"><span class="t"><b>People &amp; PINs</b><small>' + S.data.users.length + ' people · roles, new staff, reset PIN</small></span></button>' +
        '<button class="row" data-act="companies"><span class="t"><b>Companies</b><small>' + S.data.companies.filter(function (c) { return c.active !== false; }).length + ' active · add, rename or remove</small></span></button>' +
        '<button class="row" data-act="devlist"><span class="t"><b>Devices &amp; certificates</b><small>Add devices, due dates, certificate links</small></span></button>' +
        '<button class="row" data-act="stock"><span class="t"><b>Loggers, sensors &amp; kits</b><small>' + stockList().length + ' types counted by quantity · set how many you have</small></span></button>' +
        '<button class="row" data-act="erase"><span class="t"><b style="color:var(--danger)">Erase</b><small>Choose what to erase: activity, receipts, jobs, data sheet marks, device places…</small></span></button>' +
        '</div>';
    } else if (can('keep')) {
      h += '<div class="sec"><h2>Lab keeper</h2></div><div class="list">' +
        '<button class="row" data-act="devlist"><span class="t"><b>Devices &amp; certificates</b><small>Edit details and calibration dates</small></span></button></div>';
    }
    h += '<div class="sec"><h2>About</h2></div><div class="box" style="margin-top:0"><dl class="kv"><dt>Company</dt><dd>Akhnaton Trading and Representation</dd><dt>Devices</dt><dd>' + S.data.devices.length + '</dd><dt>Version</dt><dd>1.0' + (DEMO ? ' (preview)' : '') + '</dd></dl></div>';
    h += '<button class="btn ghost wide" style="margin-top:18px" data-act="signout">Sign out</button>';
    return h + '<div style="height:24px"></div></main>';
  }

  function fallbackCopy(t) { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

  /* ================= wiring ================= */
  function wire() {
    $$('[data-refresh]').forEach(function (b) { b.onclick = function () { b.disabled = true; refresh().then(function () { toast('Up to date'); }); }; });
    $$('[data-dev]').forEach(function (b) { b.onclick = function () { openDevice(b.dataset.dev); }; });
    wireSets(document);
    $$('[data-goto-filter]').forEach(function (b) { b.onclick = function () { S.filter = b.dataset.gotoFilter; S.q = ''; location.hash = '#devices'; }; });
    $$('[data-filter]').forEach(function (b) { b.onclick = function () { S.filter = b.dataset.filter; S._keepScroll = false; render(); }; });
    $$('[data-listpdf]').forEach(function (b) { b.onclick = listPdf; });
    $$('[data-listxls]').forEach(function (b) { b.onclick = listXls; });
    $$('[data-kwhere]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); kitWhere(b.dataset.kwhere); }; });
    $$('[data-kwst]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); kitWhere(b.dataset.g, b.dataset.kwst); }; });
    $$('[data-gokits]').forEach(function (b) { b.onclick = function () { S.kgrp = b.dataset.gokits; location.hash = '#kits'; }; });
    $$('[data-goco]').forEach(function (b) { b.onclick = function () { S.filter = 'client'; S.q = ''; S.sort = 'place'; location.hash = '#devices'; }; });
    $$('[data-job]').forEach(function (b) { b.onclick = function () { openJob(b.dataset.job); }; });
    $$('[data-jobreq]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); checkoutFlow(null, b.dataset.jobreq); }; });
    $$('[data-newjob]').forEach(function (b) { b.onclick = function () { editJob(null); }; });
    $$('[data-jf]').forEach(function (b) { b.onclick = function () { S.jf = b.dataset.jf; render(); }; });
    $$('[data-ds]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); setDS(b.dataset.ds, b.dataset.v); }; });
    $$('[data-dsxls]').forEach(function (b) { b.onclick = dsXls; });
    $$('[data-dspdf]').forEach(function (b) { b.onclick = dsPdf; });
    $$('[data-jobspdf]').forEach(function (b) { b.onclick = jobsPdf; });
    $$('[data-kgrp]').forEach(function (b) { b.onclick = function () { S.kgrp = b.dataset.kgrp; render(); }; });
    $$('[data-kpdf]').forEach(function (b) { b.onclick = kitsPdf; });
    $$('[data-kxls]').forEach(function (b) { b.onclick = kitsXls; });
    $$('[data-link]').forEach(function (b) {
      b.onclick = function () {
        var url = $('.linkbox .url').textContent;
        if (b.dataset.link === 'share' && navigator.share) { navigator.share({ title: 'Akhnaton Lab Devices', text: 'Akhnaton Lab Devices', url: url }).catch(function () {}); return; }
        var done = function () { toast('Link copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
        else { fallbackCopy(url); done(); }
      };
    });
    $$('[data-dv]').forEach(function (b) { b.onclick = function () { S.dv = b.dataset.dv; S.devGrp = null; LS.set('dv', S.dv); S._keepScroll = false; render(); }; });
    $$('[data-dgrp]').forEach(function (b) { b.onclick = function () { S.devGrp = b.dataset.dgrp; S._keepScroll = false; render(); window.scrollTo(0, 0); }; });
    $$('[data-dgrpback]').forEach(function (b) { b.onclick = function () { S.devGrp = null; S._keepScroll = false; render(); window.scrollTo(0, 0); }; });
    $$('[data-sort]').forEach(function (b) { b.onclick = function () { S.sort = b.dataset.sort; S.devGrp = null; LS.set('sort2', S.sort); S._keepScroll = false; render(); }; });
    var q = $('#q');
    if (q) {
      q.oninput = function () {
        S.q = q.value; var pos = q.selectionStart; render();
        var nq = $('#q'); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {}
      };
    }
    var fab = $('#fab'); if (fab) fab.onclick = function () { checkoutFlow(); };
    $$('[data-checkin]').forEach(function (b) { b.onclick = function () { checkinFlow(b.dataset.checkin); }; });
    $$('[data-transfer-co]').forEach(function (b) { b.onclick = function () { transferFlow(b.dataset.transferCo); }; });
    $$('[data-pdf]').forEach(function (b) { b.onclick = function () { receiptPdf(b.dataset.pdf); }; });
    $$('[data-tr-ok]').forEach(function (b) { b.onclick = function () { decide(b.dataset.trOk, true); }; });
    $$('[data-push]').forEach(function (b) { b.onclick = askPush; });
    $$('[data-rq-ok]').forEach(function (b) { b.onclick = function () { decideRequest(b.dataset.rqOk, true); }; });
    $$('[data-rq-no]').forEach(function (b) { b.onclick = function () { decideRequest(b.dataset.rqNo, false); }; });
    $$('[data-rq-review]').forEach(function (b) { b.onclick = function () { editRequest(b.dataset.rqReview); }; });
    $$('[data-tr-no]').forEach(function (b) { b.onclick = function () { decide(b.dataset.trNo, false); }; });
    $$('[data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'pin') askNewPin(false);
        if (a === 'refresh') refresh().then(function () { toast('Up to date'); });
        if (a === 'signout') askConfirm('Sign out of this phone?', 'Sign out', signOut, true);
        if (a === 'people') adminPeople();
        if (a === 'companies') adminCompanies();
        if (a === 'devlist') adminDevices();
        if (a === 'stock') adminStock();
        if (a === 'erase') eraseHistory();
      };
    });
  }
  function askConfirm(msg, okLabel, cb, danger) {
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Please confirm');
      body.innerHTML = '<div class="done" style="padding-top:40px"><h3 style="font-size:20px;font-weight:600">' + esc(msg) + '</h3></div>';
      setFoot('<button class="btn ghost" data-no>Cancel</button><button class="btn ' + (danger ? 'danger' : '') + '" data-yes>' + esc(okLabel) + '</button>');
      $('[data-no]').onclick = function () { closeSheet(); };
      $('[data-yes]').onclick = function () { closeSheet(); cb(); };
    });
  }
  function decide(id, ok) {
    busy(true);
    req('transferDecide', { transferId: id, accept: ok }).then(function () { toast(ok ? 'Transfer confirmed' : 'Transfer declined'); return refresh(true); })
      .catch(function (e) { toast(e.message, true); }).then(function () { busy(false); });
  }
  function busy(on) { document.body.style.pointerEvents = on ? 'none' : ''; document.body.style.opacity = on ? '.85' : ''; }

  /* ================= sheets ================= */
  var sheetStack = [];
  function openSheet(build, opts) {
    opts = opts || {};
    var root = $('#sheet-root');
    var wrap = document.createElement('div'); wrap.className = 'sheet-bg';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-h">' +
      (opts.noClose ? '<span style="width:12px"></span>' : '<button class="icon-btn" data-x aria-label="Close" style="color:var(--navy)">' + (sheetStack.length ? ICON.back : ICON.close) + '</button>') +
      '<h2></h2><span class="step"></span></div><div class="sheet-b"></div><div class="sheet-f"></div></div>';
    root.appendChild(wrap); sheetStack.push(wrap);
    document.body.style.overflow = 'hidden';
    var body = $('.sheet-b', wrap), foot = $('.sheet-f', wrap);
    var x = $('[data-x]', wrap); if (x) x.onclick = closeSheet;
    try { history.pushState({ sheet: sheetStack.length }, ''); wrap._pushed = true; } catch (e) {}
    build(body,
      function (html) { foot.innerHTML = html; foot.style.display = html ? '' : 'none'; },
      function (t, step) { $('h2', wrap).textContent = t; $('.step', wrap).textContent = step || ''; body.scrollTop = 0; },
      wrap);
    return wrap;
  }
  function closeSheet(fromPop) {
    var w = sheetStack.pop(); if (!w) return;
    w.remove(); if (!sheetStack.length) document.body.style.overflow = '';
    if (fromPop !== true && w._pushed) { S._ignorePop = (S._ignorePop || 0) + 1; try { history.back(); } catch (e) { S._ignorePop--; } }
  }
  function closeAll() { while (sheetStack.length) closeSheet(); }
  window.addEventListener('popstate', function () {
    if (S._ignorePop > 0) { S._ignorePop--; return; }
    if (sheetStack.length) closeSheet(true);
  });

  /* ---------- device detail ---------- */
  function openDevice(id) {
    var d = IDX.dev[id]; if (!d) return;
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Device');
      var s = stOf(d), c = cert(d), where = '';
      if (isReq(d)) {
        var rq = reqOf(d);
        where = '<div class="where" style="color:var(--pending)">In the office · reserved</div><div class="meta">Requested by <b>' + esc(rq ? rq.byName : '') + '</b> for ' + esc(rq ? coName(rq.companyId) : '') + ' · waiting for a lab keeper</div>';
      } else if (d.pending) {
        var t = S.data.transfers.filter(function (x) { return x.id === d.pending; })[0];
        where = '<div class="where" style="color:var(--pending)">Being handed to ' + esc(t ? t.toEngineer.name : '') + '</div><div class="meta">Going to ' + esc(t ? coName(t.toCompanyId) : '') + ' · waiting for confirmation</div>';
      } else if (d.status === 'At Client') {
        where = '<div class="where">' + esc(coName(d.companyId)) + '</div><div class="meta">With <b>' + esc(names(d.holders)) + '</b></div>' +
          '<div class="meta">Since ' + when(d.since) + (d.expectedReturn ? ' · expected back ' + fmtDate(d.expectedReturn) : '') + '</div>' +
          (d.checkoutId ? '<div class="meta">Receipt ' + esc(d.checkoutId) + '</div>' : '');
      } else if (d.status === 'In Office') {
        where = '<div class="where" style="color:var(--office)">In the office</div><div class="meta">Since ' + when(d.since) + '</div>';
      } else {
        where = '<div class="where" style="color:' + s.c + '">' + esc(d.status) + '</div>' + (d.note ? '<div class="meta">' + esc(d.note) + '</div>' : '') +
          (d.holders && d.holders.length ? '<div class="meta">With <b>' + esc(names(d.holders)) + '</b></div>' : '') +
          '<div class="meta">Since ' + when(d.since) + (d.expectedReturn ? ' · expected back ' + fmtDate(d.expectedReturn) : '') + '</div>';
      }
      var cc = c.kind === 'expired' ? 'var(--danger)' : c.kind === 'soon' ? 'var(--service)' : c.kind === 'ok' ? 'var(--office)' : 'var(--muted)';
      body.innerHTML =
        '<div class="hero">' + tag(d, 'xl') + '<h3>' + devName(d) + '</h3><div class="sub">' + esc([d.manufacturer, d.model].filter(function (x) { return x && x !== 'N/A'; }).join(' · ')) + '</div>' +
        '<div style="margin-top:10px"><span class="pill" style="--s-bg:' + s.bg + ';--s-fg:' + s.c + '"><span class="dot" style="background:' + s.c + '"></span>' + s.short + '</span></div></div>' +
        '<div class="box"><h4>Where it is</h4>' + where + '</div>' +
        '<div class="box"><h4>Calibration certificate</h4><div class="cert">' +
        (c.kind === 'ok' || c.kind === 'soon' || c.kind === 'expired' ? '<div class="days" style="color:' + cc + '">' + Math.abs(c.days) + '<small>' + (c.kind === 'expired' ? 'days overdue' : 'days left') + '</small></div>' : '') +
        '<div style="flex:1"><div style="font-weight:600;color:' + cc + '">' + esc(c.text) + '</div>' + (d.calDue && c.kind !== 'ok' ? '<div class="meta">Due date ' + fmtDate(d.calDue) + '</div>' : '') + '</div></div>' +
        (d.certUrl ? '<a class="btn ghost wide" style="margin-top:12px;text-decoration:none" href="' + esc(d.certUrl) + '" target="_blank" rel="noopener">' + ICON.link + 'Open certificate</a>' : (can('admin') ? '<div class="meta" style="margin-top:8px">No certificate link yet — add it from Me › Devices &amp; certificates.</div>' : '')) +
        '</div>' +
        '<div class="box"><h4>Details</h4><dl class="kv">' +
        '<dt>Serial</dt><dd>' + esc(d.serial) + '</dd>' +
        (d.range ? '<dt>Range</dt><dd>' + esc(d.range) + '</dd>' : '') +
        (d.accuracy ? '<dt>Accuracy</dt><dd>' + esc(d.accuracy) + '</dd>' : '') +
        (d.resolution ? '<dt>Resolution</dt><dd>' + esc(d.resolution) + '</dd>' : '') +
        (d.calDate ? '<dt>Calibrated on</dt><dd>' + fmtDate(d.calDate) + '</dd>' : '') +
        (d.certNo ? '<dt>Certificate no.</dt><dd>' + esc(d.certNo) + '</dd>' : '') +
        (d.calLab ? '<dt>Calibrated at</dt><dd>' + esc(d.calLab) + '</dd>' : '') +
        (d.sub ? '<dt>Sub category</dt><dd>' + esc(d.sub) + '</dd>' : '') +
        '<dt>Kept at</dt><dd>' + esc(d.site || 'Main lab') + '</dd>' +
        (d.remarks ? '<dt>Remarks</dt><dd>' + esc(d.remarks) + '</dd>' : '') +
        '<dt>Type</dt><dd>' + esc(d.category) + '</dd></dl></div>' +
        (d.sub && S.data.devices.some(function (x) { return x.id !== d.id && x.sub === d.sub && x.active !== false; }) ? '<div class="box"><h4>Same set · ' + esc(d.sub) + '</h4><div class="list" style="margin:0">' + S.data.devices.filter(function (x) { return x.id !== d.id && x.sub === d.sub && x.active !== false; }).map(function (x) { return devRow(x); }).join('') + '</div><div class="meta" style="margin-top:6px">Each one can go out on its own, or pick the whole set.</div></div>' : '') +
        (partsOf(d).length ? '<div class="box"><h4>Parts of this device</h4><div class="list" style="margin:0">' + partsOf(d).map(function (x) { return devRow(x); }).join('') + '</div><div class="meta" style="margin-top:6px">Each part can also go out on its own.</div></div>' : '') +
        (d.parentId && IDX.dev[d.parentId] ? '<div class="box"><h4>Part of</h4><div class="list" style="margin:0">' + devRow(IDX.dev[d.parentId]) + '</div></div>' : '') +
        '<div class="box"><h4>History</h4><ul class="tl" id="hist"><li><small>Loading…</small></li></ul></div>';
      var btns = [];
      if (can('keep')) {
        if (d.status === 'In Office') btns.push('<button class="btn blue" data-a="out">Check out</button>');
        else btns.push('<button class="btn" data-a="in">Back in office</button>');
        btns.push('<button class="btn ghost" data-a="status">Change status</button>');
      }
      if (d.status === 'At Client' && !d.pending) btns.push('<button class="btn ghost" data-a="move">Move to another company</button>');
      if (can('keep')) btns.push('<button class="btn ghost" data-a="edit">Edit device</button>');
      if (btns.length) body.insertAdjacentHTML('beforeend', '<div class="actions">' + btns.join('') + '</div>');
      setFoot('');
      $$('[data-a]', body).forEach(function (b) {
        b.onclick = function () {
          var a = b.dataset.a;
          if (a === 'out') checkoutFlow([d.id]);
          if (a === 'in') simpleCheckin([d.id]);
          if (a === 'status') statusFlow([d.id]);
          if (a === 'move') transferFlow(d.companyId, [d.id]);
          if (a === 'edit') editDevice(d);
        };
      });
      req('history', { deviceId: d.id }).then(function (list) {
        var el = $('#hist', body); if (!el) return;
        el.innerHTML = list.length ? list.slice().reverse().map(function (m) { return moveItem(m, false); }).join('') : '<li><small>No moves recorded yet.</small></li>';
      }).catch(function () { var el = $('#hist', body); if (el) el.innerHTML = '<li><small>History could not load. Pull to refresh.</small></li>'; });
    });
  }

  /* ---------- reusable pickers ---------- */
  function companyPicker(container, selected, onPick) {
    var q = '', showAll = false;
    function draw() {
      var all = S.data.companies.slice();
      var list = all.filter(function (c) { return (showAll || c.active !== false || c.id === selected) && (!q || (c.name + ' ' + (c.official || '') + ' ' + (c.code || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0); });
      list.sort(function (a, b) { return (b.lastUsed || '').localeCompare(a.lastUsed || '') || (a.group === 'EVA Group' ? -1 : 0) - (b.group === 'EVA Group' ? -1 : 0) || a.name.localeCompare(b.name); });
      var recent = list.filter(function (c) { return c.lastUsed; }).slice(0, 6);
      var rest = list.filter(function (c) { return recent.indexOf(c) < 0; });
      container.innerHTML = '<div class="search">' + ICON.search + '<input id="cq" type="search" placeholder="Search company" value="' + esc(q) + '" autocomplete="off"></div>' +
        (recent.length && !q ? '<div class="sec" style="margin-top:4px"><h2>Recent</h2></div><div class="list">' + recent.map(row).join('') + '</div><div class="sec"><h2>All companies</h2></div>' : '') +
        '<div class="list">' + (rest.length ? rest.slice(0, 150).map(row).join('') : '<div class="empty" style="border:0">No company found.' + (can('admin') ? ' Add it from Me › Companies.' : ' Ask the admin to add it.') + '</div>') + '</div>' +
        (!showAll ? '<button class="btn ghost wide" style="margin-top:12px" data-all>Show older companies too</button>' : '');
      var inp = $('#cq', container); inp.oninput = function () { q = inp.value; var p = inp.selectionStart; draw(); var n = $('#cq', container); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
      $$('[data-co]', container).forEach(function (b) { b.onclick = function () { selected = b.dataset.co; onPick(selected); draw(); }; });
      var al = $('[data-all]', container); if (al) al.onclick = function () { showAll = true; draw(); };
    }
    function row(c) {
      return '<button class="row' + (c.id === selected ? ' sel' : '') + '" data-co="' + c.id + '"><span class="check">' + (c.id === selected ? ICON.tick : '') + '</span><span class="t"><b>' + esc(c.name) + '</b>' +
        (c.official && c.official !== c.name ? '<small>' + esc(c.official.split(' | ')[0]) + '</small>' : '') + '</span>' + (c.code ? '<small style="color:var(--muted)">#' + esc(c.code) + '</small>' : '') + '</button>';
    }
    draw();
  }
  function peoplePicker(container, selected, opts, onChange) {
    opts = opts || {};
    var people = S.data.users.filter(function (u) { return u.active !== false && (!opts.roles || opts.roles.indexOf(u.role) >= 0); });
    people.sort(function (a, b) { var e = { engineer: 0, supervisor: 0 }; return (e[a.role] === 0 ? 0 : 1) - (e[b.role] === 0 ? 0 : 1) || a.name.localeCompare(b.name); });
    function draw() {
      container.innerHTML = '<div class="list">' + people.map(function (u) {
        var on = selected.indexOf(u.id) >= 0;
        return '<button class="row' + (on ? ' sel' : '') + '" data-p="' + u.id + '"><span class="check">' + (on ? ICON.tick : '') + '</span><span class="t"><b>' + esc(u.name) + '</b><small>' + ROLE_NAME[u.role] + '</small></span></button>';
      }).join('') + '</div>';
      $$('[data-p]', container).forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.p, i = selected.indexOf(id);
          if (opts.single) selected.splice(0, selected.length, id); else if (i >= 0) selected.splice(i, 1); else selected.push(id);
          draw(); onChange && onChange();
        };
      });
    }
    draw();
  }
  /* Device groups shown as tiles when picking devices. A category may sit in more than one group (e.g. ΔP is also HVAC). */
  var DEV_GROUPS = [
    ['Temperature', ['Temperature']],
    ['Pressure', ['Pressure']],
    ['Differential Pressure (ΔP)', ['Differential Pressure']],
    ['Rotational Speed (RPM)', ['RPM']],
    ['Humidity (RH)', ['Relative Humidity']],
    ['Timer', ['Time']],
    ['HVAC', ['Air Flow', 'DOP', 'Particle Count', 'Differential Pressure', 'Relative Humidity']],
    ['Thermal Mapping', ['Thermal Mapping', 'Data Logger']],
    ['Weight', ['Weight']],
    ['Lab Solutions', ['pH Solution', 'Conductivity', 'Chlorine', 'Redox', 'Viscosity']]
  ];
  function devGroups() {
    var known = {}, cats = {};
    DEV_GROUPS.forEach(function (g) { g[1].forEach(function (c) { known[c] = 1; }); });
    S.data.devices.forEach(function (d) { if (d.active !== false && !known[d.category]) cats[d.category] = 1; });
    var other = Object.keys(cats).sort();
    return DEV_GROUPS.concat(other.length ? [['Other devices', other]] : []);
  }
  function devicePicker(container, selected, filterFn, onChange, opts) {
    opts = opts || {};
    var items = opts.items || null; /* array of {stockId, name, group, qty} when quantity items can be picked */
    var q = '', grp = (items || S.data.devices.filter(filterFn).length > 10) ? null : '__all', hasTiles = grp === null;
    /* Inside a category (or a search) the main button returns to the category tiles, so several categories can be picked in one go */
    var api = {
      browsing: function () { return hasTiles && (grp !== null || !!q); },
      back: function () { grp = null; q = ''; draw(); container.scrollTop = 0; onChange && onChange(); }
    };
    function draw() {
      var groups = devGroups();
      var inGroup = grp === null ? null : groups.filter(function (g) { return g[0] === grp; })[0];
      var list = S.data.devices.filter(function (d) { return filterFn(d) && matches(d, q) && (q || !inGroup || inGroup[1].indexOf(d.category) >= 0); });
      list.sort(function (a, b) { return a.description.localeCompare(b.description) || a.serial.localeCompare(b.serial); });
      list.sort(function (a, b) { return (a.sub ? 0 : 1) - (b.sub ? 0 : 1) || (a.sub || '').localeCompare(b.sub || '') || a.description.localeCompare(b.description) || a.serial.localeCompare(b.serial); });
      var picked = selected.map(function (id) { return IDX.dev[id]; }).filter(Boolean);
      var isStock = items && grp && grp.indexOf('stock:') === 0;
      var head = '<div class="selbar"><div class="search" style="margin-bottom:8px">' + ICON.search + '<input id="dq" type="search" placeholder="Search all: name or last digits of serial" value="' + esc(q) + '" autocomplete="off"></div>' +
        '<div class="picked">' + picked.map(function (d) { return '<button data-unpick="' + d.id + '" aria-label="Remove">' + esc(d.serialTail) + ' · ' + esc(d.description.split(' ').slice(0, 2).join(' ')) + ' ✕</button>'; }).join('') +
        (items || []).map(function (it, i) { return '<button data-unitem="' + i + '" aria-label="Remove">' + it.qty + ' × ' + esc(it.name.split(' ').slice(0, 2).join(' ')) + ' ✕</button>'; }).join('') + '</div></div>';
      if (!q && grp === null) {
        /* Step A: choose a category, like the people screen */
        container.innerHTML = head + '<div class="sec" style="margin-top:4px"><h2>Choose a category</h2></div><div class="cats">' + groups.map(function (g) {
          var all = S.data.devices.filter(function (d) { return d.active !== false && g[1].indexOf(d.category) >= 0; });
          if (!all.length) return '';
          var free = all.filter(filterFn).length;
          var chosen = all.filter(function (d) { return selected.indexOf(d.id) >= 0; }).length;
          return '<button data-grp="' + esc(g[0]) + '"' + (free ? '' : ' class="none"') + '><b>' + esc(g[0]) + '</b><small>' + free + ' available' + (all.length !== free ? ' of ' + all.length : '') + '</small>' + (chosen ? '<i>' + chosen + ' picked</i>' : '') + '</button>';
        }).join('') + (items ? Core.STOCK_GROUPS.map(function (g) {
          var sts = stockList().filter(function (x) { return x.group === g; });
          var n = items.filter(function (it) { return it.group === g; }).reduce(function (a, it) { return a + it.qty; }, 0);
          return '<button data-grp="stock:' + esc(g) + '" class="qtile"><b>' + esc(g) + '</b><small>' + sts.length + ' type' + (sts.length === 1 ? '' : 's') + (g === 'Consumables' ? ' · used up' : ' · by quantity') + '</small>' + (n ? '<i>' + n + ' picked</i>' : '') + '</button>';
        }).join('') : '') + '<button data-grp="__all"><b>All devices</b><small>' + S.data.devices.filter(filterFn).length + ' available</small></button></div>';
      } else if (isStock && !q) {
        var g = grp.slice(6);
        var rows = stockList().filter(function (x) { return x.group === g; }).map(function (st) {
          var free = stockFree(st), cur = items.filter(function (it) { return it.stockId === st.id; })[0];
          return { key: st.id, name: st.name, sub: (st.contents ? st.contents + ' · ' : '') + (free == null ? 'Count not set' : free + ' in the lab'), max: free, qty: cur ? cur.qty : 0 };
        });
        var others = items.filter(function (it) { return !it.stockId && it.group === g; });
        var qr = qtyRows(rows, function (k, v) {
          var st = stockList().filter(function (x) { return x.id === k; })[0], i;
          for (i = items.length - 1; i >= 0; i--) if (items[i].stockId === k) items.splice(i, 1);
          if (v > 0) items.push({ stockId: k, name: st.name, group: st.group, qty: v });
          draw(); onChange && onChange();
        });
        container.innerHTML = head + '<button class="backcat" data-back="1">‹ Categories <span>' + esc(g) + '</span></button>' + qr.html +
          (others.length ? '<div class="list" style="margin-top:10px">' + others.map(function (it) { return '<div class="row qrow sel"><span class="t"><b>' + esc(it.name) + '</b><small>Other</small></span><span class="qn big">' + it.qty + '×</span><button class="icon-btn" data-unitem="' + items.indexOf(it) + '" aria-label="Remove" style="color:var(--danger)">✕</button></div>'; }).join('') + '</div>' : '') +
          '<div class="box otherbox"><h4>Something else?</h4><div class="orow"><input class="inp" id="oname" placeholder="e.g. Hose 1/4&quot;, spare battery"><input class="inp" id="oqty" inputmode="numeric" value="1" style="width:70px;text-align:center"><button class="btn sm" data-oadd>Add</button></div></div>';
        qr.wire(container);
        var oa = $('[data-oadd]', container); if (oa) oa.onclick = function () {
          var n = $('#oname', container).value.trim(), k = Math.max(1, parseInt($('#oqty', container).value, 10) || 1);
          if (!n) return toast('Write the name first', true);
          items.push({ stockId: '', name: n, group: g, qty: k }); draw(); onChange && onChange();
        };
      } else {
        container.innerHTML = head + (!q ? '<button class="backcat" data-back="1">‹ Categories <span>' + esc(grp === '__all' ? 'All devices' : grp) + '</span></button>' : '') +
        (list.length ? '<div class="list">' + setGroups(list, function (d, inSet) {
          var on = selected.indexOf(d.id) >= 0, c = cert(d);
          return '<button class="row' + (on ? ' sel' : '') + '" data-d="' + d.id + '"><span class="check">' + (on ? ICON.tick : '') + '</span>' + tag(d) + '<span class="t"><b>' + devName(d) + '</b><small>' + esc(devSub(d, inSet)) + '</small>' +
            (c.kind === 'expired' ? '<small style="color:var(--danger);font-weight:600">Calibration expired ' + fmtDate(d.calDue) + '</small>' : '') + '</span></button>';
        }, { scope: 'pick', forceOpen: !!q,
          info: function (m) { var n = m.filter(function (x) { return selected.indexOf(x.id) >= 0; }).length; return n ? n + ' picked' : 'tap to see the parts'; },
          extra: function (m, sub) { var allOn = m.every(function (x) { return selected.indexOf(x.id) >= 0; }); return '<button class="btn sm ' + (allOn ? 'ghost' : 'blue') + ' setall" data-set="' + esc(sub) + '">' + (allOn ? 'Unselect all' : 'Select all') + '</button>'; } }) + '</div>' : '<div class="empty"><b>No device here matches.</b>Only devices that are free for this step are listed.</div>');
      }
      $$('[data-grp]', container).forEach(function (b) { b.onclick = function () { grp = b.dataset.grp; draw(); container.scrollTop = 0; onChange && onChange(); }; });
      $$('[data-back]', container).forEach(function (b) { b.onclick = function () { api.back(); }; });
      var inp = $('#dq', container); inp.oninput = function () { var was = !!q; q = inp.value; var p = inp.selectionStart; draw(); var n = $('#dq', container); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} if (was !== !!q) onChange && onChange(); };
      wireSets(container);
      $$('[data-set]', container).forEach(function (b) { b.onclick = function () {
        var sub = b.dataset.set, mates = list.filter(function (x) { return x.sub === sub; }).map(function (x) { return x.id; });
        var allOn = mates.every(function (id) { return selected.indexOf(id) >= 0; });
        mates.forEach(function (id) { var k = selected.indexOf(id); if (allOn && k >= 0) selected.splice(k, 1); if (!allOn && k < 0) selected.push(id); });
        draw(); onChange && onChange(); }; });
      $$('[data-d]', container).forEach(function (b) { b.onclick = function () {
        var id = b.dataset.d, i = selected.indexOf(id), parts = S.data.devices.filter(function (x) { return x.parentId === id && x.active !== false && filterFn(x); }).map(function (x) { return x.id; });
        if (i >= 0) { selected.splice(i, 1); parts.forEach(function (p) { var k = selected.indexOf(p); if (k >= 0) selected.splice(k, 1); }); }
        else { selected.push(id); parts.forEach(function (p) { if (selected.indexOf(p) < 0) selected.push(p); }); if (parts.length) toast('Added with its ' + parts.length + ' part' + (parts.length > 1 ? 's' : '') + ' — untick any that stay'); }
        draw(); onChange && onChange(); }; });
      $$('[data-unpick]', container).forEach(function (b) { b.onclick = function () { selected.splice(selected.indexOf(b.dataset.unpick), 1); draw(); onChange && onChange(); }; });
      $$('[data-unitem]', container).forEach(function (b) { b.onclick = function () { items.splice(+b.dataset.unitem, 1); draw(); onChange && onChange(); }; });
    }
    draw();
    return api;
  }

  /* ---------- check-out wizard: every request sits inside a job ---------- */
  function jobPicker(container, selected, onPick) {
    var q = '';
    function draw() {
      var list = jobsList().filter(function (j) { return j.status !== 'Closed' && (!q || (j.id + ' ' + jobName(j)).toLowerCase().indexOf(q.toLowerCase()) >= 0); })
        .sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
      container.innerHTML = '<div class="search">' + ICON.search + '<input id="jq" type="search" placeholder="Search job or company" value="' + esc(q) + '" autocomplete="off"></div>' +
        (can('job') ? '<button class="btn ghost wide" data-nj style="margin-bottom:12px">＋ Open a new job</button>' : '') +
        (list.length ? '<div class="list">' + list.map(function (j) {
          var n = jobReceipts(j).length;
          return '<button class="row' + (j.id === selected ? ' sel' : '') + '" data-pj="' + j.id + '"><span class="check">' + (j.id === selected ? ICON.tick : '') + '</span><span class="t"><b>' + esc(coName(j.companyId)) + '</b><small>' + esc(j.id) + (j.title ? ' · ' + esc(j.title) : '') + (j.basis ? ' · ' + esc(jobBasis(j)) : '') + '</small><small>' + n + ' request' + (n === 1 ? '' : 's') + ' so far · opened ' + esc(when(j.ts)) + '</small></span></button>';
        }).join('') + '</div>' : '<div class="empty"><b>No open job' + (q ? ' matches' : '') + '.</b>' + (can('job') ? 'Open a new job for the company first.' : 'Ask the site supervisor to open a job for this visit.') + '</div>');
      var inp = $('#jq', container); inp.oninput = function () { q = inp.value; var p = inp.selectionStart; draw(); var n = $('#jq', container); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
      $$('[data-pj]', container).forEach(function (b) { b.onclick = function () { selected = b.dataset.pj; onPick(selected); draw(); }; });
      var nj = $('[data-nj]', container); if (nj) nj.onclick = function () { editJob(null, function (id) { selected = id; onPick(id); draw(); }); };
    }
    draw();
  }
  function checkoutFlow(preDevices, jobId) {
    var jb0 = jobId ? jobById(jobId) : null;
    var st = { step: jb0 ? 2 : 1, jobId: jb0 ? jb0.id : '', companyId: jb0 ? jb0.companyId : '', engineers: can('keep') ? [] : [S.me.id], devices: (preDevices || []).slice(), items: [], expectedReturn: '', note: '' };
    var first = st.step;
    openSheet(function (body, setFoot, setTitle) {
      function go(n) { st.step = n; draw(); }
      function draw() {
        var total = 4;
        if (st.step === 1) {
          setTitle('Which job?', 'Step 1 of ' + total);
          jobPicker(body, st.jobId, function (id) { st.jobId = id; st.companyId = (jobById(id) || {}).companyId || ''; foot(); });
        } else if (st.step === 2) {
          setTitle('Who is going?', 'Step 2 of ' + total);
          body.innerHTML = '<div class="note"><b>' + esc(jobName(jobById(st.jobId))) + '</b> · ' + esc(st.jobId) + '<br>Pick everyone in the team. Each of them will see the devices under their name.</div><div id="pp"></div>';
          peoplePicker($('#pp', body), st.engineers, {}, foot);
        } else if (st.step === 3) {
          setTitle('Which devices?', 'Step 3 of ' + total);
          st.picker = devicePicker(body, st.devices, function (d) { return (d.status === 'In Office' && (!d.pending || Core.isPortion(d))) || st.devices.indexOf(d.id) >= 0; }, foot, { items: st.items });
        } else {
          setTitle('Check and confirm', 'Step 4 of ' + total);
          var devs = st.devices.map(function (id) { return IDX.dev[id]; });
          var expired = devs.filter(function (d) { return cert(d).kind === 'expired'; });
          var notIn = devs.filter(function (d) { return d.status !== 'In Office'; });
          var portions = devs.filter(function (d) { return Core.isPortion(d); });
          var quick = [1, 2, 3, 7].map(function (n) { var x = new Date(); x.setDate(x.getDate() + n); return { n: n, v: isoDay(x) }; });
          var jb = jobById(st.jobId);
          body.innerHTML =
            (expired.length ? '<div class="note warnbox"><b>' + expired.length + ' device' + (expired.length > 1 ? 's have' : ' has') + ' an expired calibration:</b> ' + expired.map(function (d) { return esc(d.description) + ' …' + esc(d.serialTail); }).join(', ') + '. You can still check out.</div>' : '') +
            (notIn.length ? '<div class="note warnbox">' + notIn.map(function (d) { return esc(d.description) + ' …' + esc(d.serialTail); }).join(', ') + ' is not marked in the office. Checking out will move it here.</div>' : '') +
            '<div class="box" style="margin-top:0"><h4>Going to</h4><div class="where">' + esc(coName(st.companyId)) + '</div><div class="meta">Job <b>' + esc(st.jobId) + '</b>' + (jb && jb.title ? ' · ' + esc(jb.title) : '') + '</div><div class="meta">With <b>' + esc(st.engineers.map(function (id) { return IDX.user[id].name; }).join(', ')) + '</b></div></div>' +
            (devs.length ? '<div class="box"><h4>' + devs.length + ' device' + (devs.length > 1 ? 's' : '') + '</h4><div class="chips" style="margin-top:0">' + devs.map(function (d) { return '<span class="dchip">' + tag(d, 'sm') + '<em>' + esc(d.description) + '</em></span>'; }).join('') + '</div>' +
              (portions.length ? '<div class="meta" style="margin-top:8px">💧 ' + portions.length + ' buffer' + (portions.length > 1 ? 's' : '') + ' — only a portion goes out, the bottle stays in the lab.</div>' : '') + '</div>' : '') +
            (st.items.length ? '<div class="box"><h4>Loggers, sensors &amp; kits</h4><div class="chips" style="margin-top:0">' + itemChips(st.items) + '</div></div>' : '') +
            '<div class="box"><h4>Expected back</h4><div class="seg" style="margin-bottom:10px">' + quick.map(function (q) { return '<button data-rd="' + q.v + '" class="' + (st.expectedReturn === q.v ? 'on' : '') + '">' + (q.n === 1 ? 'Tomorrow' : 'In ' + q.n + ' days') + '</button>'; }).join('') + '</div>' +
            '<input class="inp" type="date" id="rd" value="' + esc(st.expectedReturn) + '" min="' + isoDay(new Date()) + '" aria-label="Expected return date"><div class="meta" style="margin-top:6px">If it is not back by then, the team, the lab keepers and the admin get an alert.</div></div>' +
            '<div class="box"><h4>Note (optional)</h4><textarea class="inp" id="nt" placeholder="e.g. Autoclave mapping, building 3">' + esc(st.note) + '</textarea></div>';
          $$('[data-rd]', body).forEach(function (b) { b.onclick = function () { st.expectedReturn = st.expectedReturn === b.dataset.rd ? '' : b.dataset.rd; draw(); }; });
          $('#rd', body).onchange = function (e) { st.expectedReturn = e.target.value; draw(); };
          $('#nt', body).oninput = function (e) { st.note = e.target.value; };
        }
        foot();
      }
      function foot() {
        var browsing = st.step === 3 && st.picker && st.picker.browsing();
        var nSel = st.devices.length + st.items.length;
        var ok = browsing ? true : st.step === 1 ? !!st.jobId : st.step === 2 ? st.engineers.length > 0 : st.step === 3 ? nSel > 0 : true;
        var label = st.step === 4 ? (can('keep') ? 'Confirm check-out' : 'Send request') : browsing ? '✓ Done · back to categories' + (nSel ? ' (' + nSel + ')' : '') : st.step === 3 ? 'Next · ' + nSel + ' selected' : 'Next';
        setFoot((st.step > first ? '<button class="btn ghost" data-prev style="flex:0 0 auto">Back</button>' : '') + '<button class="btn ' + (st.step === 4 ? 'blue' : '') + '" data-next ' + (ok ? '' : 'disabled') + '>' + label + '</button>');
        var p = $('[data-prev]'); if (p) p.onclick = function () { if (browsing) return st.picker.back(); go(st.step - 1); };
        $('[data-next]').onclick = function () {
          if (browsing) return st.picker.back();
          if (st.step < 4) return go(st.step + 1);
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('checkout', { jobId: st.jobId, companyId: st.companyId, engineerIds: st.engineers, deviceIds: st.devices, items: st.items, expectedReturn: st.expectedReturn, note: st.note })
            .then(function (r) { return refresh(true).then(function () { return r; }); })
            .then(function (r) { if (r.pending) requestSent(body, setFoot, setTitle, r.checkoutId); else doneScreen(body, setFoot, setTitle, r.checkoutId); })
            .catch(function (e) { toast(e.message, true); b.disabled = false; b.textContent = can('keep') ? 'Confirm check-out' : 'Send request'; });
        };
      }
      draw();
    });
  }
  function requestSent(body, setFoot, setTitle, coId) {
    setTitle('Request sent', '');
    var c = S.data.checkouts.filter(function (x) { return x.id === coId; })[0] || { companyId: '', deviceIds: [], engineers: [] };
    body.innerHTML = '<div class="done"><div class="ok" style="background:var(--pending)">' + ICON.bigtick + '</div><h3>Waiting for a lab keeper</h3><p>' +
      countLabel(c.deviceIds.length, c.items) + ' for ' + esc(coName(c.companyId)) + ' — reserved for you.<br>Ahmed, Sara or Mohamed will review and approve the list.</p></div>';
    setFoot('<button class="btn ghost" data-close>Done</button>');
    $('[data-close]').onclick = function () { closeAll(); };
  }
  /* Change a waiting request: the requester edits it until approval; a lab keeper adds / removes, then approves */
  function editRequest(coId) {
    var c = S.data.checkouts.filter(function (x) { return x.id === coId; })[0]; if (!c) return;
    if (c.status !== 'Pending') return toast('This request was already decided.', true);
    var keeper = can('keep'), sel = c.deviceIds.slice(), items = JSON.parse(JSON.stringify(c.items || []));
    var f = { expectedReturn: c.expectedReturn || '', note: c.note || '' }, picker;
    openSheet(function (body, setFoot, setTitle) {
      setTitle(keeper ? 'Review request' : 'Edit request', coId);
      var jb = jobById(c.jobId);
      body.innerHTML = '<div class="box" style="margin-top:0"><h4>Going to</h4><div class="where">' + esc(coName(c.companyId)) + '</div>' +
        (jb ? '<div class="meta">Job <b>' + esc(jb.id) + '</b>' + (jb.title ? ' · ' + esc(jb.title) : '') + '</div>' : '') +
        '<div class="meta">Requested by <b>' + esc(c.byName) + '</b> · ' + when(c.requestedTs || c.ts) + '</div><div class="meta">Team: <b>' + esc(names(c.engineers)) + '</b></div></div>' +
        '<div class="note" style="margin-top:12px">' + (keeper ? 'Tap ✕ on anything that is <b>not</b> leaving, or add more from the categories. Then approve.' : 'Add or remove devices and items. You can change the request until a lab keeper approves it.') + '</div>' +
        '<div id="ep"></div>' +
        '<div class="box"><h4>Expected back</h4><input class="inp" type="date" id="erd" value="' + esc(f.expectedReturn) + '"></div>' +
        '<div class="box"><h4>Note</h4><textarea class="inp" id="ent">' + esc(f.note) + '</textarea></div>';
      $('#erd', body).onchange = function (e) { f.expectedReturn = e.target.value; };
      $('#ent', body).oninput = function (e) { f.note = e.target.value; };
      picker = devicePicker($('#ep', body), sel, function (d) { return (d.status === 'In Office' && (!d.pending || d.pending === c.id || Core.isPortion(d))) || sel.indexOf(d.id) >= 0; }, foot, { items: items });
      function foot() {
        var browsing = picker && picker.browsing(), n = sel.length + items.length;
        if (browsing) { setFoot('<button class="btn" data-bk>✓ Done · back to categories (' + n + ')</button>'); $('[data-bk]').onclick = function () { picker.back(); }; return; }
        if (keeper) setFoot('<button class="btn ghost" data-no style="flex:0 0 auto">Decline</button><button class="btn blue" data-yes ' + (n ? '' : 'disabled') + '>Approve ' + countLabel(sel.length, items) + '</button>');
        else setFoot('<button class="btn blue" data-save ' + (n ? '' : 'disabled') + '>Save changes · ' + countLabel(sel.length, items) + '</button>');
        var no = $('[data-no]'); if (no) no.onclick = function () { closeSheet(); decideRequest(coId, false); };
        var yes = $('[data-yes]'); if (yes) yes.onclick = function () {
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('checkoutEdit', { checkoutId: coId, deviceIds: sel, items: items, expectedReturn: f.expectedReturn, note: f.note })
            .then(function () { closeSheet(); decideRequest(coId, true, sel, items); })
            .catch(function (e) { toast(e.message, true); b.disabled = false; foot(); });
        };
        var sv = $('[data-save]'); if (sv) sv.onclick = function () {
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('checkoutEdit', { checkoutId: coId, deviceIds: sel, items: items, expectedReturn: f.expectedReturn, note: f.note })
            .then(function () { return refresh(true); }).then(function () { closeSheet(); toast('Request updated'); })
            .catch(function (e) { toast(e.message, true); b.disabled = false; foot(); });
        };
      }
      foot();
    });
  }
  function decideRequest(coId, ok, keep, items) {
    var c = S.data.checkouts.filter(function (x) { return x.id === coId; })[0];
    var mine = c && c.byId === S.me.id && !can('keep');
    function go() {
      busy(true);
      req('checkoutDecide', { checkoutId: coId, accept: ok, deviceIds: keep || null, items: items || null })
        .then(function () { toast(ok ? 'Approved — devices checked out' : mine ? 'Request cancelled' : 'Request declined'); return refresh(true); })
        .then(function () { if (ok) openSheet(function (body, setFoot, setTitle) { doneScreen(body, setFoot, setTitle, coId); }); })
        .catch(function (e) { toast(e.message, true); }).then(function () { busy(false); });
    }
    if (ok) go(); else askConfirm(mine ? 'Cancel this request? The devices become free again.' : 'Decline this request? The devices stay in the office.', mine ? 'Cancel request' : 'Decline', go, true);
  }
  function doneScreen(body, setFoot, setTitle, coId) {
    setTitle('Checked out', '');
    var c = S.data.checkouts.filter(function (x) { return x.id === coId; })[0];
    body.innerHTML = '<div class="done"><div class="ok">' + ICON.bigtick + '</div><h3>' + esc(coName(c.companyId)) + '</h3><p>' + countLabel(c.deviceIds.length, c.items) + ' with ' + esc(names(c.engineers)) + '<br>Receipt ' + esc(coId) + '</p>' +
      '<button class="btn blue wide" data-pdf-now>' + ICON.pdf + 'Receipt PDF</button></div>';
    setFoot('<button class="btn ghost" data-close>Done</button>');
    $('[data-pdf-now]', body).onclick = function () { receiptPdf(coId); };
    $('[data-close]').onclick = function () { closeAll(); };
  }

  /* ---------- check-in ---------- */
  function checkinFlow(coId) {
    var devs = S.data.devices.filter(function (d) { return d.status === 'At Client' && d.companyId === coId; });
    var sel = devs.map(function (d) { return d.id; });
    var hs = holdingsAt(coId), back = {}; hs.forEach(function (h) { back[h.id] = +h.qty; });
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Back from ' + coName(coId));
      function draw() {
        body.innerHTML = '<div class="note">Untick anything that is still at the client.</div><div id="dp"></div>' +
          (hs.length ? '<div class="sec"><h2>Loggers, sensors &amp; kits</h2><small>how many came back?</small></div><div id="qp"></div>' : '');
        if (devs.length) devicePicker($('#dp', body), sel, function (d) { return d.status === 'At Client' && d.companyId === coId; }, foot);
        if (hs.length) {
          var qr = qtyRows(hs.map(function (h) { return { key: h.id, name: h.name, sub: h.qty + ' out with ' + names(h.holders), max: +h.qty, qty: back[h.id] }; }), function (k, v) { back[k] = v; draw(); });
          $('#qp', body).innerHTML = qr.html; qr.wire($('#qp', body));
        }
        foot();
      }
      function itemsBack() { return hs.filter(function (h) { return back[h.id] > 0; }).map(function (h) { return { holdingId: h.id, qty: back[h.id] }; }); }
      function foot() {
        var ib = itemsBack(), n = sel.length + ib.length;
        setFoot('<button class="btn" data-ok ' + (n ? '' : 'disabled') + '>Check in ' + countLabel(sel.length, ib) + '</button>');
        $('[data-ok]').onclick = function () { submitCheckin(sel.slice(), this, ib); };
      }
      draw();
    });
  }
  function simpleCheckin(ids) {
    var d = IDX.dev[ids[0]];
    askConfirm('Mark ' + d.description + ' …' + d.serialTail + ' as back in the office?', 'Back in office', function () { submitCheckin(ids); });
  }
  function submitCheckin(ids, btn, items) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    req('checkin', { deviceIds: ids, items: items || [] }).then(function () { return refresh(true); })
      .then(function () { closeAll(); toast(countLabel(ids.length, items) + ' back in the office'); })
      .catch(function (e) { toast(e.message, true); if (btn) { btn.disabled = false; btn.textContent = 'Try again'; } });
  }

  /* ---------- status ---------- */
  function statusFlow(ids) {
    var st = { status: '', note: '', person: '', expectedReturn: '' };
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Change status');
      function draw() {
        var opts = ['In Office', 'Maintenance', 'External Calibration', 'Out of Service', 'Other'];
        var needWhere = st.status === 'Maintenance' || st.status === 'External Calibration';
        body.innerHTML = '<div class="box" style="margin-top:0"><h4>New status</h4><div class="seg">' + opts.map(function (o) { return '<button data-s="' + o + '" class="' + (st.status === o ? 'on' : '') + '">' + o + '</button>'; }).join('') + '</div></div>' +
          (st.status && st.status !== 'In Office' ?
            '<div class="box">' +
            '<label class="f"><span>' + (st.status === 'Other' ? 'What happened? (required)' : needWhere ? 'Where is it? (lab, supplier, agent)' : 'Reason') + '</span><input class="inp" id="nt" value="' + esc(st.note) + '" placeholder="' + (st.status === 'Other' ? 'e.g. Taken by sales for a client demo' : needWhere ? 'e.g. Future Advanced Technology' : 'e.g. Broken display') + '"></label>' +
            '<label class="f"><span>Who has it? (optional)</span><input class="inp" id="ps" value="' + esc(st.person) + '" placeholder="e.g. Hany – Sales team"></label>' +
            (st.status !== 'Out of Service' ? '<label class="f" style="margin:0"><span>Expected back (optional)</span><input class="inp" type="date" id="rd" value="' + esc(st.expectedReturn) + '"></label>' : '') +
            '</div>' : '');
        $$('[data-s]', body).forEach(function (b) { b.onclick = function () { st.status = b.dataset.s; draw(); }; });
        var nt = $('#nt', body); if (nt) nt.oninput = function () { st.note = nt.value; foot(); };
        var ps = $('#ps', body); if (ps) ps.oninput = function () { st.person = ps.value; };
        var rd = $('#rd', body); if (rd) rd.onchange = function () { st.expectedReturn = rd.value; };
        foot();
      }
      function foot() {
        var ok = st.status && (st.status !== 'Other' || st.note.trim());
        setFoot('<button class="btn" data-ok ' + (ok ? '' : 'disabled') + '>Save status</button>');
        $('[data-ok]').onclick = function () {
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('setStatus', { deviceIds: ids, status: st.status, note: st.note.trim(), person: st.person.trim(), expectedReturn: st.expectedReturn })
            .then(function () { return refresh(true); }).then(function () { closeAll(); toast('Status saved: ' + st.status); })
            .catch(function (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Save status'; });
        };
      }
      draw();
    });
  }

  /* ---------- transfer between companies ---------- */
  function transferFlow(fromCo, preIds) {
    var st = { step: preIds ? 2 : 1, devices: (preIds || []).slice(), to: [], companyId: '', note: '', move: {} };
    var hs = preIds ? [] : holdingsAt(fromCo); hs.forEach(function (h) { st.move[h.id] = 0; });
    function allHere() { return S.data.devices.filter(function (d) { return d.status === 'At Client' && d.companyId === fromCo && !d.pending; }).map(function (d) { return d.id; }); }
    function allOn() { return st.devices.length === allHere().length && hs.every(function (h) { return st.move[h.id] === +h.qty; }); }
    function movingItems() { return hs.filter(function (h) { return st.move[h.id] > 0; }).map(function (h) { return { holdingId: h.id, qty: st.move[h.id], name: h.name }; }); }
    openSheet(function (body, setFoot, setTitle) {
      function draw() {
        if (st.step === 1) {
          setTitle('Which devices move?', 'Step 1 of 4');
          body.innerHTML = '<div class="selall"><span id="selN"></span><button class="btn sm ghost" data-selall></button></div><div id="dp"></div>' + (hs.length ? '<div class="sec"><h2>Loggers, sensors &amp; kits</h2><small>how many move?</small></div><div id="qp"></div>' : '');
          devicePicker($('#dp', body), st.devices, function (d) { return d.status === 'At Client' && d.companyId === fromCo && !d.pending; }, foot);
          if (hs.length) {
            var qr = qtyRows(hs.map(function (h) { return { key: h.id, name: h.name, sub: h.qty + ' here', max: +h.qty, qty: st.move[h.id] }; }), function (k, v) { st.move[k] = v; foot(); });
            $('#qp', body).innerHTML = qr.html; qr.wire($('#qp', body));
          }
          $('[data-selall]', body).onclick = function () {
            var on = !allOn();
            st.devices.splice(0, st.devices.length); if (on) allHere().forEach(function (id) { st.devices.push(id); });
            hs.forEach(function (h) { st.move[h.id] = on ? +h.qty : 0; });
            draw();
          };
        } else if (st.step === 2) {
          setTitle('Who takes them?', 'Step 2 of 4');
          body.innerHTML = '<div class="note">This person confirms on their phone that they received the devices.</div><div id="pp"></div>';
          peoplePicker($('#pp', body), st.to, { single: true }, foot);
        } else if (st.step === 3) {
          setTitle('To which company?', 'Step 3 of 4');
          companyPicker(body, st.companyId, function (id) { st.companyId = id; foot(); });
        } else {
          setTitle('Check and send', 'Step 4 of 4');
          var devs = st.devices.map(function (id) { return IDX.dev[id]; });
          body.innerHTML = '<div class="box" style="margin-top:0"><h4>From</h4><div class="where">' + esc(coName(fromCo)) + '</div></div>' +
            '<div class="box"><h4>To</h4><div class="where">' + esc(coName(st.companyId)) + '</div><div class="meta">With <b>' + esc(IDX.user[st.to[0]].name) + '</b></div></div>' +
            '<div class="box"><h4>' + countLabel(devs.length, movingItems()) + '</h4><div class="chips" style="margin-top:0">' + devs.map(function (d) { return '<span class="dchip">' + tag(d, 'sm') + '<em>' + esc(d.description) + '</em></span>'; }).join('') + itemChips(movingItems()) + '</div></div>' +
            '<div class="box"><h4>Note (optional)</h4><textarea class="inp" id="nt">' + esc(st.note) + '</textarea></div>' +
            (st.to[0] === S.me.id ? '<div class="note">You are taking them yourself, so the move is confirmed right away.</div>' : '');
          $('#nt', body).oninput = function (e) { st.note = e.target.value; };
        }
        foot();
      }
      function foot() {
        if (st.step === 1 && $('[data-selall]')) { $('[data-selall]').textContent = allOn() ? 'Select none' : 'Select all'; $('#selN').textContent = countLabel(st.devices.length, movingItems()) + ' selected'; }
        var ok = st.step === 1 ? st.devices.length + movingItems().length : st.step === 2 ? st.to.length : st.step === 3 ? st.companyId : 1;
        var first = preIds ? 2 : 1;
        setFoot((st.step > first ? '<button class="btn ghost" data-prev style="flex:0 0 auto">Back</button>' : '') + '<button class="btn ' + (st.step === 4 ? 'blue' : '') + '" data-next ' + (ok ? '' : 'disabled') + '>' + (st.step === 4 ? 'Send transfer' : 'Next') + '</button>');
        var p = $('[data-prev]'); if (p) p.onclick = function () { st.step--; draw(); };
        $('[data-next]').onclick = function () {
          if (st.step < 4) { st.step++; return draw(); }
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('transferRequest', { deviceIds: st.devices, items: movingItems(), toEngineerId: st.to[0], toCompanyId: st.companyId, note: st.note })
            .then(function (r) { if (st.to[0] === S.me.id) return req('transferDecide', { transferId: r.transferId, accept: true }); })
            .then(function () { return refresh(true); })
            .then(function () { closeAll(); toast(st.to[0] === S.me.id ? 'Moved to ' + coName(st.companyId) : 'Sent — waiting for ' + IDX.user[st.to[0]].name + ' to confirm'); })
            .catch(function (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Send transfer'; });
        };
      }
      draw();
    });
  }

  /* ================= admin ================= */
  function adminPeople() {
    openSheet(function (body, setFoot, setTitle) {
      setTitle('People & PINs');
      function draw() {
        var order = { superadmin: -1, admin: 0, keeper: 1, supervisor: 2, engineer: 3 };
        var list = S.data.users.slice().sort(function (a, b) { return order[a.role] - order[b.role] || a.name.localeCompare(b.name); });
        body.innerHTML = '<div class="list">' + list.map(function (u) {
          return '<button class="row" data-u="' + u.id + '"><span class="t"><b>' + esc(u.name) + (u.active === false ? ' (inactive)' : '') + '</b><small>' + ROLE_NAME[u.role] + '</small></span></button>';
        }).join('') + '</div>';
        $$('[data-u]', body).forEach(function (b) { b.onclick = function () { editUser(IDX.user[b.dataset.u], draw); }; });
      }
      draw();
      setFoot('<button class="btn blue" data-add>Add a person</button>');
      $('[data-add]').onclick = function () { editUser(null, draw); };
    });
  }
  function editUser(u, after) {
    var f = u ? { id: u.id, name: u.name, role: u.role, active: u.active !== false } : { name: '', role: 'engineer', active: true };
    openSheet(function (body, setFoot, setTitle) {
      setTitle(u ? 'Edit person' : 'Add a person');
      body.innerHTML = '<label class="f"><span>Full name</span><input class="inp" id="nm" value="' + esc(f.name) + '"></label>' +
        '<div class="f"><span style="display:block;font-size:14px;color:var(--muted);margin-bottom:6px">Role</span><div class="seg" id="rl">' +
        (function () {
          var rs = [['engineer', 'Engineer'], ['supervisor', 'Site supervisor'], ['keeper', 'Lab keeper'], ['admin', 'Admin']];
          var noSuper = !S.data.users.some(function (x) { return x.role === 'superadmin' && x.active !== false; });
          if (can('super') || noSuper || f.role === 'superadmin') rs.push(['superadmin', 'Super admin']);
          return rs;
        })().map(function (r) { return '<button data-r="' + r[0] + '" class="' + (f.role === r[0] ? 'on' : '') + '">' + r[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="note" style="margin-top:14px">Engineers request devices inside a job and move them between companies. Site supervisors also open jobs and follow data sheets. Lab keepers approve requests, check devices in and out, edit devices and mark data sheets. Admins manage everything. The super admin can do everything an admin does and is the only one who can change the super admin account — keep it for the general manager, to reset the admin PIN if it is forgotten.</div>' +
        (u && u.role === 'superadmin' && !can('super') ? '<div class="note warnbox">Only the super admin can change this account.</div>' : '') +
        (u ? '<div class="seg"><button data-active class="' + (f.active ? '' : 'on') + '">' + (f.active ? 'Deactivate this person' : 'Inactive — tap to reactivate') + '</button><button data-reset>Reset PIN</button></div>' : '');
      $('#nm', body).oninput = function (e) { f.name = e.target.value; };
      $$('[data-r]', body).forEach(function (b) { b.onclick = function () { f.role = b.dataset.r; $$('[data-r]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      var ac = $('[data-active]', body); if (ac) ac.onclick = function () { f.active = !f.active; ac.classList.toggle('on', !f.active); ac.textContent = f.active ? 'Deactivate this person' : 'Inactive — tap to reactivate'; };
      var rs = $('[data-reset]', body); if (rs) rs.onclick = function () {
        askConfirm('Give ' + u.name + ' a new PIN? Their old PIN stops working.', 'Reset PIN', function () {
          req('resetPin', { userId: u.id }).then(function (r) { showPin(u.name, r.pin); }).catch(function (e) { toast(e.message, true); });
        }, true);
      };
      setFoot('<button class="btn" data-save>Save</button>');
      $('[data-save]').onclick = function () {
        req('saveUser', { user: f }).then(function (r) { return refresh(true).then(function () { return r; }); })
          .then(function (r) { closeSheet(); after && after(); if (r.pin) showPin(f.name, r.pin); else toast('Saved'); })
          .catch(function (e) { toast(e.message, true); });
      };
    });
  }
  function showPin(name, pin) {
    openSheet(function (body, setFoot, setTitle) {
      setTitle('First PIN');
      body.innerHTML = '<div class="done"><p>Give this PIN to <b>' + esc(name) + '</b>. They choose their own PIN at first sign-in.</p><div class="tag xl" style="--c:var(--blue)"><i></i><span>' + pin + '</span></div></div>';
      setFoot('<button class="btn" data-x2>Done</button>'); $('[data-x2]').onclick = function () { closeSheet(); };
    });
  }
  function adminCompanies() {
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Companies');
      var q = '';
      function draw() {
        var list = S.data.companies.filter(function (c) { return !q || (c.name + ' ' + c.official + ' ' + c.code).toLowerCase().indexOf(q.toLowerCase()) >= 0; })
          .sort(function (a, b) { return (a.active === false) - (b.active === false) || a.name.localeCompare(b.name); });
        body.innerHTML = '<div class="search">' + ICON.search + '<input id="cq" type="search" placeholder="Search" value="' + esc(q) + '"></div><div class="list">' + list.map(function (c) {
          return '<button class="row" data-c="' + c.id + '"><span class="t"><b>' + esc(c.name) + '</b><small>' + esc((c.code ? '#' + c.code + ' · ' : '') + (c.active === false ? 'Older — hidden from quick lists' : c.group)) + '</small></span></button>';
        }).join('') + '</div>';
        var inp = $('#cq', body); inp.oninput = function () { q = inp.value; var p = inp.selectionStart; draw(); var n = $('#cq', body); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
        $$('[data-c]', body).forEach(function (b) { b.onclick = function () { editCompany(IDX.co[b.dataset.c], draw); }; });
      }
      draw();
      setFoot('<button class="btn blue" data-add>Add a company</button>');
      $('[data-add]').onclick = function () { editCompany(null, draw); };
    });
  }
  function editCompany(c, after) {
    var f = c ? JSON.parse(JSON.stringify(c)) : { name: '', official: '', code: '', group: 'Client', active: true };
    openSheet(function (body, setFoot, setTitle) {
      setTitle(c ? 'Edit company' : 'Add a company');
      body.innerHTML = '<label class="f"><span>Short name (shown in the app)</span><input class="inp" id="a" value="' + esc(f.name) + '"></label>' +
        '<label class="f"><span>Official name (as on invoices)</span><input class="inp" id="b" value="' + esc(f.official) + '"></label>' +
        '<label class="f"><span>Company ID</span><input class="inp" id="c" value="' + esc(f.code) + '"></label>' +
        '<div class="seg"><button data-g class="' + (f.group === 'EVA Group' ? 'on' : '') + '">EVA Group company</button><button data-act class="' + (f.active === false ? 'on' : '') + '">Hide from quick lists</button></div>';
      $('#a', body).oninput = function (e) { f.name = e.target.value; };
      $('#b', body).oninput = function (e) { f.official = e.target.value; };
      $('#c', body).oninput = function (e) { f.code = e.target.value; };
      $('[data-g]', body).onclick = function () { f.group = f.group === 'EVA Group' ? 'Client' : 'EVA Group'; this.classList.toggle('on'); };
      $('[data-act]', body).onclick = function () { f.active = f.active === false; this.classList.toggle('on'); };
      setFoot((c ? '<button class="btn danger" data-del>Remove</button>' : '') + '<button class="btn" data-save>Save</button>');
      var del = $('[data-del]');
      if (del) del.onclick = function () {
        askConfirm('Remove ' + c.name + ' from the app? This cannot be undone.', 'Remove', function () {
          req('deleteCompany', { companyId: c.id }).then(function () { return refresh(true); }).then(function () { closeSheet(); after && after(); toast('Company removed'); }).catch(function (e) { toast(e.message, true); });
        }, true);
      };
      $('[data-save]').onclick = function () {
        req('saveCompany', { company: f }).then(function () { return refresh(true); }).then(function () { closeSheet(); after && after(); toast('Saved'); }).catch(function (e) { toast(e.message, true); });
      };
    });
  }
  function adminDevices() {
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Devices & certificates');
      var q = '';
      function draw() {
        var list = S.data.devices.filter(function (d) { return matches(d, q); }).sort(function (a, b) { return a.description.localeCompare(b.description); });
        body.innerHTML = '<div class="search">' + ICON.search + '<input id="dq" type="search" placeholder="Name or last digits" value="' + esc(q) + '"></div><div class="list">' + list.map(function (d) {
          var c = cert(d);
          return '<button class="row" data-d="' + d.id + '">' + tag(d) + '<span class="t"><b>' + esc(d.description) + '</b><small>' + esc(c.text) + (d.certUrl ? ' · certificate linked' : ' · no certificate link') + '</small></span></button>';
        }).join('') + '</div>';
        var inp = $('#dq', body); inp.oninput = function () { q = inp.value; var p = inp.selectionStart; draw(); var n = $('#dq', body); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
        $$('[data-d]', body).forEach(function (b) { b.onclick = function () { editDevice(IDX.dev[b.dataset.d], draw); }; });
      }
      draw();
      if (can('admin')) { setFoot('<button class="btn blue" data-add>Add a device</button>'); $('[data-add]').onclick = function () { editDevice(null, draw); }; } else setFoot('');
    });
  }
  function adminStock() {
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Loggers, sensors & kits');
      function draw() {
        body.innerHTML = '<div class="note">These are counted by quantity, not by serial. Set the total you own — the app shows how many are in the lab and who has the rest.</div>' +
          Core.STOCK_GROUPS.map(function (g) {
            var sts = stockList().filter(function (x) { return x.group === g; });
            return '<div class="sec"><h2>' + esc(g) + '</h2></div><div class="list">' + sts.map(function (st) {
              return '<button class="row" data-st="' + st.id + '"><span class="t"><b>' + esc(st.name) + '</b>' + (st.contents ? '<small dir="auto">' + esc(st.contents) + '</small>' : '') + '<small>' + (st.total === '' ? 'Total not set' : st.total + ' total') + ' · ' + stockOut(st.id) + ' out</small></span></button>';
            }).join('') + '</div>';
          }).join('');
        $$('[data-st]', body).forEach(function (b) { b.onclick = function () { editStock(stockList().filter(function (x) { return x.id === b.dataset.st; })[0]); }; });
      }
      draw();
      setFoot('<button class="btn blue" data-add>Add a type</button>');
      $('[data-add]').onclick = function () { editStock(null); };
    });
  }
  function editStock(st) {
    var f = st ? JSON.parse(JSON.stringify(st)) : { name: '', group: 'Data Loggers', total: '' };
    openSheet(function (body, setFoot, setTitle) {
      setTitle(st ? 'Edit type' : 'Add a type');
      body.innerHTML = '<label class="f"><span>Name (e.g. Dickson Temp/RH data logger)</span><input class="inp" id="sn" value="' + esc(f.name) + '"></label>' +
        '<div class="box" style="margin:4px 0 14px"><h4>Group</h4><div class="seg">' + Core.STOCK_GROUPS.map(function (g) { return '<button data-g="' + esc(g) + '" class="' + (f.group === g ? 'on' : '') + '">' + esc(g) + '</button>'; }).join('') + '</div></div>' +
        '<label class="f"><span>How many do you own? (leave empty if not counted · a kit counts as 1)</span><input class="inp" id="tt" inputmode="numeric" value="' + esc(f.total) + '"></label>' +
        '<label class="f"><span>What is inside? (for a kit — e.g. 8 وصلات: 1/4 ×4، 1/2 ×4)</span><textarea class="inp" id="kc" dir="auto">' + esc(f.contents || '') + '</textarea></label>' +
        (st ? '<div class="meta">' + stockOut(st.id) + ' are out right now.</div>' : '');
      $('#sn', body).oninput = function (e) { f.name = e.target.value; };
      $('#tt', body).oninput = function (e) { f.total = e.target.value.replace(/[^0-9]/g, ''); };
      $('#kc', body).oninput = function (e) { f.contents = e.target.value; };
      $$('[data-g]', body).forEach(function (b) { b.onclick = function () { f.group = b.dataset.g; $$('[data-g]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      setFoot((st ? '<button class="btn ghost" data-remove style="flex:0 0 auto;color:var(--danger)">Remove</button>' : '') + '<button class="btn" data-save>Save</button>');
      var rm = $('[data-remove]');
      if (rm) rm.onclick = function () {
        askConfirm('Remove “' + st.name + '” from the list?', 'Remove', function () {
          var g = JSON.parse(JSON.stringify(st)); g.active = false;
          req('saveStock', { item: g }).then(function () { return refresh(true); }).then(function () { closeAll(); adminStock(); toast('Removed'); }).catch(function (e) { toast(e.message, true); });
        }, true);
      };
      $('[data-save]').onclick = function () {
        req('saveStock', { item: f }).then(function () { return refresh(true); }).then(function () { closeAll(); adminStock(); toast('Saved'); }).catch(function (e) { toast(e.message, true); });
      };
    });
  }
  function editDevice(d, after) {
    var f = d ? JSON.parse(JSON.stringify(d)) : { category: '', manufacturer: '', description: '', model: '', serial: '', range: '', accuracy: '', resolution: '', calDate: '', calDue: '', certNo: '', certUrl: '', remarks: '', calLab: '', parentId: '', sub: '', site: '', certStatus: 'dated' };
    openSheet(function (body, setFoot, setTitle) {
      setTitle(d ? 'Edit device' : 'Add a device');
      var fields = [['description', 'Name (e.g. Digital Tachometer)'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['serial', 'Serial number'], ['category', 'Type (e.g. Temperature, Pressure)'], ['range', 'Range'], ['resolution', 'Resolution'], ['accuracy', 'Accuracy'], ['remarks', 'Remarks']];
      body.innerHTML = fields.map(function (x) { return '<label class="f"><span>' + x[1] + '</span><input class="inp" data-k="' + x[0] + '" value="' + esc(f[x[0]]) + '"></label>'; }).join('') +
        '<label class="f"><span>Sub category (a set of devices that go together, e.g. Testo 445)</span><input class="inp" data-k="sub" list="sublist" value="' + esc(f.sub || '') + '"><datalist id="sublist">' +
          S.data.devices.map(function (x) { return x.sub; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></label>' +
        '<label class="f"><span>Kept at</span><select class="inp" data-k="site">' + [['', 'Main lab'], ['Zaitoun office', 'Zaitoun office']].map(function (o) { return '<option value="' + o[0] + '"' + ((f.site || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<div class="box" style="margin:4px 0 14px"><h4>Certificate</h4><div class="seg" style="margin-bottom:12px"><button data-cs="dated" class="' + (f.certStatus !== 'none' ? 'on' : '') + '">Has a calibration certificate</button><button data-cs="none" class="' + (f.certStatus === 'none' ? 'on' : '') + '">No certificate needed</button></div>' +
        '<label class="f"><span>Calibration date</span><input class="inp" type="date" data-k="calDate" value="' + esc(f.calDate) + '"></label>' +
        '<label class="f"><span>Calibration due date</span><input class="inp" type="date" data-k="calDue" value="' + esc(f.calDue) + '"></label>' +
        '<label class="f"><span>Certificate number</span><input class="inp" data-k="certNo" value="' + esc(f.certNo) + '"></label>' +
        '<div class="f"><span style="display:block;font-size:14px;color:var(--muted);margin-bottom:6px">Calibrated at</span><div class="seg" id="clab">' + CAL_LABS.concat(['Other']).map(function (l) { var on = l === 'Other' ? (f.calLab && CAL_LABS.indexOf(f.calLab) < 0) : f.calLab === l; return '<button data-clab="' + l + '" class="' + (on ? 'on' : '') + '">' + l + '</button>'; }).join('') + '</div>' +
        '<input class="inp" id="clabo" placeholder="Write the lab name" style="margin-top:8px;' + (f.calLab && CAL_LABS.indexOf(f.calLab) < 0 ? '' : 'display:none') + '" value="' + esc(CAL_LABS.indexOf(f.calLab) < 0 ? f.calLab || '' : '') + '"></div>' +
        '<label class="f" style="margin:0"><span>Certificate link (SharePoint)</span><input class="inp" data-k="certUrl" value="' + esc(f.certUrl) + '" placeholder="https://evapharma.sharepoint.com/…"></label></div>';
      $$('[data-k]', body).forEach(function (i) { i.oninput = i.onchange = function () { f[i.dataset.k] = i.value; }; });
      $$('[data-clab]', body).forEach(function (b) { b.onclick = function () {
        var l = b.dataset.clab, was = b.classList.contains('on');
        $$('[data-clab]', body).forEach(function (x) { x.classList.toggle('on', x === b && !was); });
        var o = $('#clabo', body); o.style.display = l === 'Other' && !was ? '' : 'none';
        f.calLab = was ? '' : (l === 'Other' ? o.value.trim() : l);
      }; });
      $('#clabo', body).oninput = function (e) { f.calLab = e.target.value.trim(); };
      $$('[data-cs]', body).forEach(function (b) { b.onclick = function () { f.certStatus = b.dataset.cs; $$('[data-cs]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      setFoot((d && can('admin') ? '<button class="btn ghost" data-remove style="flex:0 0 auto;color:var(--danger)">Remove</button>' : '') + '<button class="btn" data-save>Save</button>');
      var rm = $('[data-remove]');
      if (rm) rm.onclick = function () {
        if (d.status !== 'In Office' || d.pending) return toast('Check this device in first — it is ' + (d.pending ? 'reserved or being transferred' : d.status.toLowerCase()) + '.', true);
        askConfirm('Remove “' + d.description + ' …' + d.serialTail + '” from the device list? Its history is kept.', 'Remove device', function () {
          var g = JSON.parse(JSON.stringify(d)); g.active = false;
          req('saveDevice', { device: g }).then(function () { return refresh(true); }).then(function () { closeAll(); toast('Device removed'); }).catch(function (e) { toast(e.message, true); });
        }, true);
      };
      $('[data-save]').onclick = function () {
        req('saveDevice', { device: f }).then(function () { return refresh(true); }).then(function () { closeAll(); toast('Device saved'); }).catch(function (e) { toast(e.message, true); });
      };
    });
  }

  /* ================= PDF receipt ================= */
  var LOGO = null;
  /* Arabic-capable font for PDFs (DejaVu Sans, subset). Without it, PDFs fall back to Latin-only text. */
  var PDFF = null, pdfFLoading = null;
  function pdfFont() {
    if (PDFF) return Promise.resolve(PDFF);
    if (!pdfFLoading) pdfFLoading = Promise.all(['dejavu.ttf', 'dejavu-bold.ttf'].map(function (f) {
      return fetch(f).then(function (r) { if (!r.ok) throw new Error('font'); return r.arrayBuffer(); }).then(function (b) {
        var u = new Uint8Array(b), bin = '', i, CH = 0x8000; for (i = 0; i < u.length; i += CH) bin += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(bin);
      });
    })).then(function (a) { PDFF = a; return a; }).catch(function () { pdfFLoading = null; return null; });
    return pdfFLoading;
  }
  function useFont(doc) {
    if (!PDFF) return 'helvetica';
    doc.addFileToVFS('dv.ttf', PDFF[0]); doc.addFont('dv.ttf', 'DV', 'normal');
    doc.addFileToVFS('dvb.ttf', PDFF[1]); doc.addFont('dvb.ttf', 'DV', 'bold');
    return 'DV';
  }
  function pdfTxt2(t) { return String(t || '').split('\n').map(pdfTxt).join('\n'); }
  function pdfTxt(t) {
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
    return PDFF ? t : t.replace(/\u00B5/g, 'u').replace(/[^\x20-\x7E\u00A0-\u024F\u2013\u2014]/g, '').trim();
  }
  function loadLogo() {
    return Promise.all([loadLogo0(), pdfFont()]).then(function (a) { return a[0]; });
  }
  function loadLogo0() {
    if (LOGO) return Promise.resolve(LOGO);
    return new Promise(function (res) {
      var img = new Image(); img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
        LOGO = { data: c.toDataURL('image/jpeg', 0.92), w: c.width, h: c.height }; res(LOGO);
      }; img.onerror = function () { res(null); }; img.src = 'logo.png';
    });
  }
  function receiptPdf(coId) {
    var c = S.data.checkouts.filter(function (x) { return x.id === coId; })[0];
    if (!c) return toast('Receipt not found. Refresh and try again.', true);
    if (!window.jspdf) return toast('The PDF tool is still loading. Try again in a second.', true);
    loadLogo().then(function (logo) {
      function lat(t) { return pdfTxt(t); }
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' });
      var FN = useFont(doc);
      var W = 210, M = 16, y = 16, co = IDX.co[c.companyId] || {};
      if (logo) { var lw = 62, lh = lw * logo.h / logo.w; doc.addImage(logo.data, 'JPEG', M, y, lw, lh); }
      doc.setFont(FN, 'bold'); doc.setFontSize(17); doc.setTextColor(19, 41, 75);
      doc.text('Device Check-out Receipt', W - M, y + 7, { align: 'right' });
      doc.setFont(FN, 'normal'); doc.setFontSize(10.5); doc.setTextColor(90, 104, 121);
      doc.text('Receipt no. ' + c.id, W - M, y + 13, { align: 'right' });
      doc.text('Calibration Lab', W - M, y + 18, { align: 'right' });
      y += 30; doc.setDrawColor(11, 118, 197); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 9;
      function field(label, val, x, w) {
        doc.setFontSize(9); doc.setTextColor(90, 104, 121); doc.text(label, x, y);
        doc.setFontSize(12); doc.setTextColor(23, 34, 51); doc.setFont(FN, 'bold');
        var lines = doc.splitTextToSize(val || '—', w); doc.text(lines, x, y + 5.5); doc.setFont(FN, 'normal');
        return lines.length;
      }
      var d = new Date(c.ts);
      var l1 = field('Company', lat(co.name) + (co.code ? '  (ID ' + co.code + ')' : ''), M, 108);
      field('Date & time of departure', fmtDate(d) + ', ' + fmtTime(d), 130, 64);
      y += 7 + l1 * 5.5;
      var offi = (co.official || '').split(' | ').filter(function (x) { return PDFF || /^[\x20-\x7E]+$/.test(x); })[0];
      if (offi && offi !== co.name) { doc.setFontSize(9.5); doc.setTextColor(90, 104, 121); var ol = doc.splitTextToSize('Official name: ' + offi, 178); doc.text(ol, M, y - 2); y += ol.length * 4.5; }
      var l2 = field('Engineer(s)', names(c.engineers), M, 108);
      field('Expected return', c.expectedReturn ? fmtDate(c.expectedReturn) : 'Not set', 130, 64);
      y += 8 + l2 * 5.5;
      var rj = jobById(c.jobId); if (rj) { var lj = field('Job', rj.id + (lat(rj.title) ? ' - ' + lat(rj.title) : '') + (rj.basis ? '  (' + lat(jobBasis(rj)) + ')' : ''), M, 178); y += 8 + lj * 5.5; }
      if (lat(c.note)) { var l3 = field('Note', lat(c.note), M, 178); y += 8 + l3 * 5.5; }
      // table
      var cols = [{ t: '#', w: 8 }, { t: 'Device', w: 64 }, { t: 'Manufacturer / Model', w: 44 }, { t: 'Serial no.', w: 36 }, { t: 'Cal. due', w: 26 }];
      function headRow() {
        doc.setFillColor(19, 41, 75); doc.rect(M, y, W - 2 * M, 8, 'F');
        doc.setFontSize(9.5); doc.setTextColor(255, 255, 255); doc.setFont(FN, 'bold');
        var x = M + 2; cols.forEach(function (cl) { doc.text(cl.t, x, y + 5.4); x += cl.w; }); doc.setFont(FN, 'normal'); y += 8;
      }
      headRow();
      c.deviceIds.forEach(function (id, i) {
        var dv = IDX.dev[id] || { description: id, manufacturer: '', model: '', serial: '', calDue: '' };
        var cells = [String(i + 1), (dv.parentId && c.deviceIds.indexOf(dv.parentId) >= 0 ? '   ↳ ' : '') + dv.description, [dv.manufacturer, dv.model !== 'N/A' ? dv.model : ''].filter(Boolean).join(' '), dv.serial, dv.certStatus === 'none' ? 'Not required' : (dv.calDue ? fmtDate(dv.calDue) : '—')];
        var wrapped = cells.map(function (t, k) { return doc.splitTextToSize(pdfTxt2(t), cols[k].w - 3); });
        var h = Math.max.apply(null, wrapped.map(function (w) { return w.length; })) * 4.6 + 3.4;
        if (y + h > 262) { doc.addPage(); y = 18; headRow(); }
        if (i % 2) { doc.setFillColor(237, 241, 245); doc.rect(M, y, W - 2 * M, h, 'F'); }
        doc.setFontSize(10); doc.setTextColor(23, 34, 51);
        var x = M + 2; wrapped.forEach(function (w, k) { doc.text(w, x, y + 5); x += cols[k].w; });
        y += h;
      });
      var n0 = c.deviceIds.length;
      (c.items || []).forEach(function (it, j) {
        var stx = it.stockId ? stockList().filter(function (x) { return x.id === it.stockId; })[0] : null;
        var nm = (lat(it.name) || (stx && stx.note) || 'Other item') + (stx && stx.contents ? ' (' + lat(stx.contents) + ')' : '');
        var cells = [String(n0 + j + 1), nm, it.group || '', 'Qty ' + it.qty, ''];
        var wrapped = cells.map(function (t, k) { return doc.splitTextToSize(lat(t) || '', cols[k].w - 3); });
        var h = Math.max.apply(null, wrapped.map(function (w) { return w.length; })) * 4.6 + 3.4;
        if (y + h > 262) { doc.addPage(); y = 18; headRow(); }
        if ((n0 + j) % 2) { doc.setFillColor(237, 241, 245); doc.rect(M, y, W - 2 * M, h, 'F'); }
        doc.setFontSize(10); doc.setTextColor(23, 34, 51);
        var x = M + 2; wrapped.forEach(function (w, k) { if (k === 3) doc.setFont(FN, 'bold'); doc.text(w, x, y + 5); doc.setFont(FN, 'normal'); x += cols[k].w; });
        y += h;
      });
      doc.setDrawColor(214, 221, 230); doc.setLineWidth(0.3); doc.line(M, y, W - M, y);
      y += 6; doc.setFontSize(10); doc.setTextColor(90, 104, 121);
      doc.text(countLabel(c.deviceIds.length, c.items) + ' in total. ' + (c.decidedByName && c.decidedByName !== c.byName ? 'Requested by ' + lat(c.byName) + ', approved by ' + lat(c.decidedByName) + '.' : 'Checked out by ' + lat(c.byName) + '.'), M, y);
      if (y > 236) { doc.addPage(); y = 20; }
      y = Math.max(y + 16, 238);
      [['Received by (engineer)', M], ['Handed over by (lab keeper)', 118]].forEach(function (s) {
        doc.setDrawColor(150, 160, 175); doc.line(s[1], y + 14, s[1] + 76, y + 14);
        doc.setFontSize(9.5); doc.setTextColor(90, 104, 121); doc.text(s[0], s[1], y + 19);
        doc.text('Name / signature / date', s[1], y + 23.5);
      });
      var pages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFontSize(8.5); doc.setTextColor(140, 150, 165);
        doc.text('Akhnaton Trading and Representation · Calibration Lab · generated ' + fmtDate(new Date()) + ' ' + fmtTime(new Date()), M, 290);
        doc.text('Page ' + p + ' of ' + pages, W - M, 290, { align: 'right' });
      }
      var fname = c.id + ' ' + (co.name || '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf';
      var blob = doc.output('blob');
      pdfSheet(blob, fname, 'Receipt ' + c.id, co.name || 'Receipt', c.deviceIds.length + ' device' + (c.deviceIds.length > 1 ? 's' : '') + ' · ' + fmtDate(c.ts), 'Akhnaton device check-out ' + c.id + ' – ' + co.name);
    });
  }

  /* Shared "PDF ready" sheet: download, open & view (print from the viewer), or share */
  function pdfSheet(blob, fname, title, headline, sub, shareText, kind) {
    var xls = kind === 'xlsx';
    var file = null; try { file = new File([blob], fname, { type: xls ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' }); } catch (e) {}
    var canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    var url = URL.createObjectURL(blob);
    function download() {
      var a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); }, 1000);
      toast('Downloaded: ' + fname);
    }
    openSheet(function (body, setFoot, setTitle) {
      setTitle(title);
      body.innerHTML = '<div class="done" style="padding-top:28px"><div class="ok" style="background:var(--blue)">' + ICON.pdf + '</div>' +
        '<h3>' + esc(headline) + '</h3><p>' + esc(sub) + '<br><small>' + esc(fname) + '</small></p>' +
        '<div style="display:grid;gap:10px;max-width:360px;margin:0 auto">' +
        '<button class="btn blue wide" data-rx="dl">Download ' + (xls ? 'Excel' : 'PDF') + '</button>' +
        (xls ? '' : '<button class="btn ghost wide" data-rx="view">Open & print</button>') +
        (canShare ? '<button class="btn ghost wide" data-rx="share">Share (WhatsApp, email…)</button>' : '') +
        '</div></div>';
      setFoot('<button class="btn ghost" data-rx="close">Close</button>');
      $$('[data-rx]').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.rx;
          if (k === 'dl') download();
          else if (k === 'view') { var w = window.open(url, '_blank'); if (!w) download(); }
          else if (k === 'share') navigator.share({ files: [file], title: title, text: shareText }).catch(function () {});
          else closeSheet();
        };
      });
    });
    setTimeout(function () { URL.revokeObjectURL(url); }, 10 * 60 * 1000);
  }

  /* Printable report of the device list exactly as filtered on the Devices screen */
  /* Excel copy of the device list exactly as filtered (one row per device, plus loggers & kits) */
  var xlsxLoading = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoading) xlsxLoading = new Promise(function (ok, bad) {
      var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      sc.onload = function () { ok(window.XLSX); }; sc.onerror = function () { xlsxLoading = null; bad(new Error('Could not load the Excel tool. Check the internet and try again.')); };
      document.head.appendChild(sc);
    });
    return xlsxLoading;
  }
  /* Make every sheet print on A4: given orientation, all columns fit the page width, header row repeats on each page */
  function xlsxA4(X, wb, setup) {
    setup = setup || {};
    var names = [];
    wb.SheetNames.forEach(function (n, i) {
      var ws = wb.Sheets[n], st = setup[n] || {};
      ws['!margins'] = { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.25, footer: 0.25 };
      if (st.head) names.push({ Name: '_xlnm.Print_Titles', Sheet: i, Ref: "'" + n.replace(/'/g, "''") + "'!$" + st.head + ':$' + st.head });
    });
    if (names.length) { wb.Workbook = wb.Workbook || {}; wb.Workbook.Names = (wb.Workbook.Names || []).concat(names); }
    var data = new Uint8Array(X.write(wb, { bookType: 'xlsx', type: 'array' }));
    try {
      var z = X.CFB.read(data, { type: 'array' }), dec = new TextDecoder(), enc = new TextEncoder();
      var wbXml = '', rels = '';
      z.FullPaths.forEach(function (fp, i) { if (/xl\/workbook\.xml$/.test(fp)) wbXml = dec.decode(z.FileIndex[i].content); if (/xl\/_rels\/workbook\.xml\.rels$/.test(fp)) rels = dec.decode(z.FileIndex[i].content); });
      var byFile = {};
      (wbXml.match(/<sheet [^>]*>/g) || []).forEach(function (tag, k) {
        var rid = (tag.match(/r:id="([^"]+)"/) || [])[1], m = rels.match(new RegExp('Id="' + rid + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + rid + '"'));
        if (m) byFile[m[1].replace(/^\/?xl\//, '')] = wb.SheetNames[k];
      });
      z.FullPaths.forEach(function (fp, i) {
        var short = (fp.match(/xl\/(worksheets\/sheet\d+\.xml)$/) || [])[1]; if (!short) return;
        var name = byFile[short], o = ((setup[name] || {}).o) || 'portrait', f = z.FileIndex[i], x = dec.decode(f.content);
        x = x.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>')
             .replace(/(<pageMargins[^>]*\/>)/, '$1<pageSetup paperSize="9" orientation="' + o + '" fitToWidth="1" fitToHeight="0"/>');
        f.content = enc.encode(x); f.size = f.content.length;
      });
      data = X.CFB.write(z, { fileType: 'zip', type: 'array' });
    } catch (e) { /* keep the plain file if anything goes wrong */ }
    return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function listXls() {
    var list = filteredDevices();
    var fLabel = (DEV_FILTERS.filter(function (x) { return x[0] === S.filter; })[0] || ['', 'All'])[1];
    var title = fLabel === 'All' ? 'All devices' : fLabel, now = new Date();
    toast('Preparing Excel…');
    loadXlsx().then(function (X) {
      function where(d) { if (Core.isCoReq(d)) return 'Lab (waiting approval)'; if (d.pending) return 'Transfer waiting'; if (d.status === 'At Client') return coName(d.companyId); if (d.status === 'In Office') return 'Lab'; return d.note || ''; }
      var head = ['#', 'Location group', 'Category', 'Sub category', 'Kept at', 'Device', 'Manufacturer', 'Model', 'Serial no.', 'Status', 'Where', 'With', 'Since', 'Expected back', 'Cal. due', 'Certificate', 'Calibrated?', 'Last cal.', 'Calibrated at', 'Resolution', 'Accuracy', 'Range'];
      var rows = [], n = 0, ordered = [];
      if (S.sort === 'place') { var G = groupByPlace(list); G.keys.forEach(function (k) { G.groups[k].forEach(function (d) { ordered.push([G.meta[k].title, d]); }); }); }
      else list.slice().sort(function (a, b) { return (a.site || '').localeCompare(b.site || '') || a.category.localeCompare(b.category) || (a.sub || '~').localeCompare(b.sub || '~') || bySerial(a, b); }).forEach(function (d) { ordered.push([d.category, d]); });
      ordered.forEach(function (x) {
        var d = x[1]; n++;
        rows.push([n, x[0], d.category, d.sub || '', d.site || 'Main lab', d.description, d.manufacturer || '', d.model && d.model !== 'N/A' ? d.model : '', d.serial, d.pending ? (Core.isCoReq(d) ? 'Requested' : 'Transfer') : d.status,
          where(d), names(d.holders), d.status === 'In Office' || !d.since ? '' : fmtDate(d.since), d.expectedReturn ? fmtDate(d.expectedReturn) : '',
          d.certStatus === 'none' ? 'Not required' : (d.calDue ? fmtDate(d.calDue) : ''), d.certUrl || '', d.certStatus === 'none' ? 'No' : 'Yes', d.calDate ? fmtDate(d.calDate) : '', d.calLab || '', d.resolution || '', d.accuracy || '', d.range || '']);
      });
      var wb = X.utils.book_new();
      var ws = X.utils.aoa_to_sheet([['Akhnaton Lab Devices — ' + title + ' — as of ' + fmtDate(now) + ' ' + fmtTime(now)], [], head].concat(rows));
      ws['!cols'] = [4, 20, 18, 24, 14, 34, 18, 16, 22, 14, 30, 26, 12, 13, 12, 30, 11, 12, 14, 12, 14, 20].map(function (w) { return { wch: w }; });
      ws['!autofilter'] = { ref: 'A3:V' + (rows.length + 3) };
      X.utils.book_append_sheet(wb, ws, 'Devices');
      var hs = holdings().filter(function (h) { return +h.qty > 0; });
      var krows = stockList().map(function (st) { return [st.group, st.name, st.note || '', st.total === '' ? '' : +st.total, stockOut(st.id), stockFree(st) == null ? '' : stockFree(st)]; });
      var ws2 = X.utils.aoa_to_sheet([['Loggers, sensors & kits — as of ' + fmtDate(now)], [], ['Group', 'Item', 'English name', 'Total', 'Out', 'In the lab']].concat(krows)
        .concat([[], ['Out now'], ['Group', 'Item', 'Qty', 'Company', 'With', 'Since']])
        .concat(hs.map(function (h) { return [h.group, h.name, +h.qty, coName(h.companyId), names(h.holders), fmtDate(h.since)]; })));
      ws2['!cols'] = [20, 32, 20, 10, 10, 12].map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws2, 'Loggers & kits');
      var blob = xlsxA4(X, wb, { 'Devices': { o: 'landscape', head: 3 }, 'Loggers & kits': { o: 'portrait', head: 3 } });
      var stamp = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
      var fname = 'Devices ' + title.replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ' + stamp + '.xlsx';
      pdfSheet(blob, fname, 'Device list', title, rows.length + ' device' + (rows.length === 1 ? '' : 's') + ' · Excel', 'Akhnaton devices – ' + title, 'xlsx');
    }).catch(function (e) { toast(e.message, true); });
  }
  function listPdf() {
    if (!window.jspdf) return toast('The PDF tool is still loading. Try again in a second.', true);
    var list = filteredDevices();
    if (!list.length) return toast('Nothing to print in this list.', true);
    var fLabel = (DEV_FILTERS.filter(function (x) { return x[0] === S.filter; })[0] || ['', 'All'])[1];
    var title = fLabel === 'All' ? 'All devices' : fLabel;
    loadLogo().then(function (logo) {
      function lat(t) { return pdfTxt(t); }
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      var FN = useFont(doc);
      var W = 297, H = 210, M = 12, y = 12, now = new Date();
      if (logo) { var lw = 50, lh = lw * logo.h / logo.w; doc.addImage(logo.data, 'JPEG', M, y, lw, lh); }
      doc.setFont(FN, 'bold'); doc.setFontSize(16); doc.setTextColor(19, 41, 75);
      doc.text('Device Location Report', W - M, y + 6, { align: 'right' });
      doc.setFont(FN, 'normal'); doc.setFontSize(10); doc.setTextColor(90, 104, 121);
      doc.text(title + (S.q ? '  ·  search: "' + lat(S.q) + '"' : '') + '  ·  ' + list.length + ' device' + (list.length > 1 ? 's' : ''), W - M, y + 12, { align: 'right' });
      doc.text('As of ' + fmtDate(now) + ', ' + fmtTime(now) + '  ·  by ' + lat(S.me && S.me.name), W - M, y + 17, { align: 'right' });
      y += 24; doc.setDrawColor(11, 118, 197); doc.setLineWidth(0.7); doc.line(M, y, W - M, y); y += 6;
      var cols = [{ t: '#', w: 8 }, { t: 'Device', w: 74 }, { t: 'Serial no.', w: 33 }, { t: 'Status', w: 27 }, { t: 'Where', w: 50 }, { t: 'With', w: 39 }, { t: 'Since', w: 21 }, { t: 'Cal. due', w: 21 }];
      function headRow() {
        doc.setFillColor(19, 41, 75); doc.rect(M, y, W - 2 * M, 7.5, 'F');
        doc.setFontSize(9.5); doc.setTextColor(255, 255, 255); doc.setFont(FN, 'bold');
        var x = M + 2; cols.forEach(function (cl) { doc.text(cl.t, x, y + 5.1); x += cl.w; }); doc.setFont(FN, 'normal'); y += 7.5;
      }
      function where(d) {
        if (isReq(d)) return 'Lab (waiting approval)';
        if (d.pending) return 'Transfer waiting';
        if (d.status === 'At Client') return coName(d.companyId);
        if (d.status === 'In Office') return 'Lab';
        return d.note || '';
      }
      function sectionTitle(t, n) {
        if (y + 16 > H - 14) { doc.addPage(); y = 14; }
        doc.setFont(FN, 'bold'); doc.setFontSize(11.5); doc.setTextColor(19, 41, 75);
        doc.text(lat(t) + '  (' + n + ')', M, y + 4); doc.setFont(FN, 'normal'); y += 6.5; headRow();
      }
      var n = 0;
      function rows(devs) {
        devs.forEach(function (d) {
          n++;
          var c = cert(d);
          var cells = [String(n), lat(d.description) + (d.manufacturer ? ' — ' + lat([d.manufacturer, d.model !== 'N/A' ? d.model : ''].filter(Boolean).join(' ')) : ''), lat(d.serial), d.pending ? (isReq(d) ? 'Requested' : 'Transfer') : d.status, lat(where(d)), lat(names(d.holders)), d.status === 'In Office' || !d.since ? '' : fmtDate(d.since), d.certStatus === 'none' ? 'Not req.' : (d.calDue ? fmtDate(d.calDue) + (c.kind === 'expired' ? ' (expired)' : '') : '')];
          var wrapped = cells.map(function (t, k) { return doc.splitTextToSize(t || '', cols[k].w - 2.5); });
          var h = Math.max.apply(null, wrapped.map(function (w) { return w.length; })) * 4.2 + 3;
          if (y + h > H - 14) { doc.addPage(); y = 14; headRow(); }
          if (n % 2 === 0) { doc.setFillColor(237, 241, 245); doc.rect(M, y, W - 2 * M, h, 'F'); }
          doc.setFontSize(9.3); doc.setTextColor(23, 34, 51);
          var x = M + 2; wrapped.forEach(function (w, k) { if (k === 7 && c.kind === 'expired') doc.setTextColor(194, 54, 43); doc.text(w, x, y + 4.6); doc.setTextColor(23, 34, 51); x += cols[k].w; });
          y += h;
        });
        doc.setDrawColor(214, 221, 230); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 5;
      }
      if (S.sort === 'place') {
        var G = groupByPlace(list);
        G.keys.forEach(function (k) { sectionTitle(G.meta[k].title, G.groups[k].length); rows(G.groups[k]); });
      } else {
        var cats = {}; list.forEach(function (d) { (cats[d.category] = cats[d.category] || []).push(d); });
        Object.keys(cats).sort().forEach(function (k) { sectionTitle(k, cats[k].length); rows(cats[k].sort(bySerial)); });
      }
      var pages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFontSize(8); doc.setTextColor(140, 150, 165);
        doc.text('Akhnaton Trading and Representation · Calibration Lab · Device Location Report · ' + fmtDate(now) + ' ' + fmtTime(now), M, H - 6);
        doc.text('Page ' + p + ' of ' + pages, W - M, H - 6, { align: 'right' });
      }
      var stamp = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
      var fname = 'Devices ' + title.replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ' + stamp + '.pdf';
      pdfSheet(doc.output('blob'), fname, 'Device list', title, list.length + ' device' + (list.length > 1 ? 's' : '') + ' · as of ' + fmtTime(now), 'Akhnaton devices – ' + title + ' – ' + fmtDate(now));
    });
  }

  /* ================= boot ================= */
  function route() {
    var v = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
    if (['home', 'jobs', 'devices', 'kits', 'activity', 'more'].indexOf(v) < 0) v = 'home';
    if (v !== S.view) { S.view = v; closeAll(); }
    render();
  }
  window.addEventListener('hashchange', route);
  var timer = null;
  function boot() {
    var cached = LS.get('cache', null);
    if (cached && !S.data && cached.users) {
      var meC = cached.users.filter(function (u) { return u.id === S.session.userId; })[0];
      if (meC) { S.data = cached; S.me = S.me || meC; index(); }
    }
    try { route(); } catch (e) {
      /* never leave a blank screen: drop the cached copy and wait for live data */
      S.data = null; LS.del('cache'); try { route(); } catch (e2) {}
    }
    refresh(!!S.data);
    clearInterval(timer);
    timer = setInterval(function () { if (document.visibilityState === 'visible' && S.session && !sheetStack.length) { S._keepScroll = true; refresh(true); } }, 20000);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.session) { S._keepScroll = true; refresh(true); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !DEMO) navigator.serviceWorker.register('OneSignalSDKWorker.js', { scope: '/' }).catch(function () {});
  if (S.session) boot(); else renderLogin();
  window.__app = { S: S, refresh: refresh };
})();
