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
    view: 'home', filter: 'all', q: '', sort: LS.get('sort', 'place'), people: LS.get('people', null)
  };
  function req(action, payload) {
    return Api.call({ action: action, userId: S.session && S.session.userId, pin: S.session && S.session.pin, payload: payload || {} });
  }
  function refresh(silent) {
    return req('state').then(function (d) {
      S.data = d; S.lastSync = Date.now(); S.online = true; index(); LS.set('cache', d);
      S.me = d.users.filter(function (u) { return u.id === S.session.userId; })[0] || S.me;
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
  function stOf(d) { return d.pending ? { c: 'var(--pending)', bg: 'var(--pending-soft)', short: 'Transfer waiting' } : (ST[d.status] || ST['Other']); }
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
  function devSub(d) { return [d.manufacturer, d.model && d.model !== 'N/A' ? d.model : ''].filter(Boolean).join(' ') + ' · S/N ' + d.serial; }
  function coName(id) { return (IDX.co[id] || {}).name || '—'; }
  function names(list) { return (list || []).map(function (h) { return h.name; }).join(', '); }
  function can(what) {
    var r = S.me && S.me.role;
    if (what === 'keep') return r === 'admin' || r === 'keeper';
    if (what === 'admin') return r === 'admin';
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
      var order = { admin: 0, keeper: 1, engineer: 2 };
      people.sort(function (a, b) { return order[a.role] - order[b.role] || a.name.localeCompare(b.name); });
      var roleName = { admin: 'Admin', keeper: 'Lab keeper', engineer: 'Engineer' };
      app.innerHTML =
        (DEMO ? '<div class="demo">Preview with sample data — every PIN is 1234</div>' : '') +
        '<div class="login"><div class="login-top"><img src="logo.png" alt="Akhnaton Trading and Representation">' +
        '<h1>Lab devices,<br>live.</h1><p>Where every device is, with whom, and since when.</p></div>' +
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

  function signOut() { LS.del('session'); LS.del('cache'); S.session = null; S.me = null; S.data = null; closeSheet(); renderLogin(); }

  /* ================= shell ================= */
  function render() {
    if (!S.session) return renderLogin();
    if (!S.data) { $('#app').innerHTML = '<div class="loading"><div class="spin"></div></div>'; return; }
    var v = S.view, pend = myPending().length;
    var html = (DEMO ? '<div class="demo">Preview with sample data — changes stay on this phone only</div>' : '') + '<div class="shell">';
    if (v === 'home') html += viewHome();
    else if (v === 'devices') html += viewDevices();
    else if (v === 'activity') html += viewActivity();
    else html += viewMore();
    html += '</div>';
    if (can('keep') && (v === 'home' || v === 'devices')) html += '<button class="btn fab" id="fab">' + ICON.out + 'Check out</button>';
    html += '<nav class="nav" aria-label="Main"><div>' + [
      ['home', 'Today', ICON.home], ['devices', 'Devices', ICON.devices], ['activity', 'Activity', ICON.activity], ['more', 'Me', ICON.more]
    ].map(function (n) {
      return '<a href="#' + n[0] + '" class="' + (v === n[0] ? 'on' : '') + '"' + (v === n[0] ? ' aria-current="page"' : '') + '>' + n[2] + n[1] +
        (n[0] === 'home' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</a>';
    }).join('') + '</div></nav>';
    var y = window.scrollY;
    $('#app').innerHTML = html;
    window.scrollTo(0, S._keepScroll ? y : 0); S._keepScroll = false;
    wire();
  }
  function header(title) {
    var off = !S.online;
    return '<header class="top"><div class="top-row"><div class="brand"><img src="logo.png" alt="Akhnaton"><b>' + esc(title || 'Lab devices') + '</b></div>' +
      '<span class="sync' + (off ? ' off' : '') + '"><i></i>' + (off ? 'Offline' : 'Live') + '</span>' +
      '<button class="icon-btn" data-refresh aria-label="Refresh">' + ICON.refresh + '</button></div>';
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
    return S.data.transfers.filter(function (t) { return t.status === 'Pending' && (t.toEngineer.id === S.me.id || can('keep')); });
  }

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

    var pend = myPending();
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
    var engs = {}, since = null, exp = '', coIds = {};
    devs.forEach(function (d) { (d.holders || []).forEach(function (p) { engs[p.name] = 1; }); if (!since || d.since < since) since = d.since; if (d.expectedReturn && (!exp || d.expectedReturn < exp)) exp = d.expectedReturn; if (d.checkoutId) coIds[d.checkoutId] = 1; });
    var late = exp && daysUntil(exp) < 0;
    var days = since ? daysSince(since) : 0;
    return '<div class="site"><div class="site-h"><div><h3>' + esc(coName(coId)) + '</h3>' +
      '<div class="meta">With <b>' + esc(Object.keys(engs).join(', ') || '—') + '</b></div>' +
      '<div class="meta">Out since ' + when(since) + (days > 0 ? ' · ' + days + ' day' + (days > 1 ? 's' : '') : '') +
      (exp ? ' · back <span class="' + (late ? 'late' : '') + '">' + (late ? 'overdue, was ' : '') + fmtDate(exp) + '</span>' : '') + '</div></div>' +
      '<span class="cnt">' + devs.length + ' device' + (devs.length > 1 ? 's' : '') + '</span></div>' +
      '<div class="chips">' + devs.map(function (d) { return '<button class="dchip" data-dev="' + d.id + '">' + tag(d, 'sm') + '<em>' + esc(devTitle(d)) + '</em></button>'; }).join('') + '</div>' +
      '<div class="site-f">' + (can('keep') ? '<button class="btn sm" data-checkin="' + coId + '">Check in</button>' : '') +
      '<button class="btn sm ghost" data-transfer-co="' + coId + '">Move to…</button>' +
      (Object.keys(coIds).length === 1 ? '<button class="btn sm ghost" data-pdf="' + Object.keys(coIds)[0] + '" aria-label="Receipt PDF">' + ICON.pdf + '</button>' : '') +
      '</div></div>';
  }

  function devRow(d, grouped) {
    var s = stOf(d), c = cert(d), place = '';
    if (d.pending) place = 'Transfer waiting';
    else if (d.status === 'At Client') place = grouped ? 'With ' + names(d.holders) : coName(d.companyId) + ' · ' + names(d.holders);
    else if (d.status === 'In Office') place = 'In office';
    else place = s.short + (d.note ? ' · ' + d.note : '') + (d.holders && d.holders.length ? ' · ' + names(d.holders) : '');
    return '<button class="row" data-dev="' + d.id + '">' + tag(d) + '<span class="t"><b>' + esc(devTitle(d)) + '</b><small>' + esc(devSub(d)) + '</small>' +
      '<small style="color:' + s.c + ';font-weight:600">' + esc(place) + '</small></span>' +
      (c.kind === 'expired' ? '<span class="warn" title="' + esc(c.text) + '">Cal. expired</span>' : c.kind === 'soon' ? '<span class="warn" style="color:var(--service)">Due ' + c.days + 'd</span>' : '') + '</button>';
  }

  /* ---------- Devices ---------- */
  function viewDevices() {
    var f = S.filter, q = S.q;
    var list = S.data.devices.filter(function (d) {
      if (f === 'office' && (d.status !== 'In Office' || d.pending)) return false;
      if (f === 'out' && ((d.status === 'In Office' && !d.pending) || d.status === 'Out of Service')) return false;
      if (f === 'client' && d.status !== 'At Client') return false;
      if (f === 'service' && (Core.SERVICE.indexOf(d.status) < 0)) return false;
      if (f === 'oos' && d.status !== 'Out of Service') return false;
      if (f === 'expired' && cert(d).kind !== 'expired') return false;
      return matches(d, q);
    });
    var byPlace = S.sort === 'place';
    function bySerial(a, b) { return a.description.localeCompare(b.description) || a.serial.localeCompare(b.serial); }
    var fl = [['all', 'All'], ['office', 'In office'], ['out', 'Outside now'], ['client', 'At clients'], ['service', 'In service'], ['expired', 'Cal. expired'], ['oos', 'Out of service']];
    var h = header('Devices') + '</header><main>' +
      '<div class="search">' + ICON.search + '<input id="q" type="search" placeholder="Name or last digits of serial" value="' + esc(q) + '" autocomplete="off" aria-label="Search devices"></div>' +
      '<div class="filters" role="tablist">' + fl.map(function (x) { return '<button class="fbtn' + (f === x[0] ? ' on' : '') + '" data-filter="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="sortbar"><span>' + list.length + ' device' + (list.length === 1 ? '' : 's') + '</span><div class="sortseg" role="radiogroup" aria-label="Group devices">' +
        '<button data-sort="place" class="' + (byPlace ? 'on' : '') + '" role="radio" aria-checked="' + byPlace + '">By location</button>' +
        '<button data-sort="type" class="' + (byPlace ? '' : 'on') + '" role="radio" aria-checked="' + !byPlace + '">By type</button></div></div>';
    if (!list.length) h += '<div class="empty"><b>' + (q ? 'No device matches “' + esc(q) + '”.' : 'No devices here right now.') + '</b>' + (q ? 'Try the last 2–3 digits of the serial, or a word like “tachometer”.' : '') + '</div>';
    else if (byPlace) {
      /* Group by where each device is right now: office first, then each client site, then service / other places */
      var groups = {}, meta = {};
      list.forEach(function (d) {
        var k, title, sub = '', rank;
        if (d.pending) { k = 'pending'; title = 'Transfer waiting'; rank = 2; }
        else if (d.status === 'In Office') { k = 'office'; title = 'In office'; rank = 0; }
        else if (d.status === 'At Client') { k = 'co:' + d.companyId; title = coName(d.companyId); rank = 1; }
        else if (d.status === 'Out of Service') { k = 'oos'; title = 'Out of service'; rank = 6; }
        else if (d.status === 'Other') { k = 'other:' + (d.note || ''); title = 'Other' + (d.note ? ' · ' + d.note : ''); rank = 5; }
        else { k = 'st:' + d.status; title = d.status; rank = d.status === 'Maintenance' ? 3 : 4; }
        (groups[k] = groups[k] || []).push(d);
        if (!meta[k]) meta[k] = { title: title, rank: rank, people: {}, since: d.since || '' };
        (d.holders || []).forEach(function (p) { meta[k].people[p.name || p.id] = 1; });
        if (d.since && (!meta[k].since || d.since < meta[k].since)) meta[k].since = d.since;
      });
      var keys = Object.keys(groups).sort(function (a, b) { return meta[a].rank - meta[b].rank || groups[b].length - groups[a].length || meta[a].title.localeCompare(meta[b].title); });
      var inN = list.filter(function (d) { return d.status === 'In Office' && !d.pending; }).length;
      var outsideN = list.filter(function (d) { return (d.status !== 'In Office' || d.pending) && d.status !== 'Out of Service'; }).length;
      var sites = keys.filter(function (k) { return k.indexOf('co:') === 0; }).length;
      if (f === 'all') h += '<div class="placesum"><button data-filter="office"><b>' + inN + '</b><span>in office</span></button><button data-filter="out"><b>' + outsideN + '</b><span>outside</span></button><button data-filter="client"><b>' + sites + '</b><span>client site' + (sites === 1 ? '' : 's') + '</span></button></div>';
      keys.forEach(function (k) {
        var m = meta[k], ppl = Object.keys(m.people);
        h += '<div class="sec place"><h2>' + esc(m.title) + ' <span class="cnt">' + groups[k].length + '</span></h2>' +
          (k !== 'office' && (ppl.length || m.since) ? '<small>' + esc(ppl.join(', ')) + (ppl.length && m.since ? ' · ' : '') + (m.since ? 'since ' + esc(when(m.since)) : '') + '</small>' : '') + '</div>' +
          '<div class="list">' + groups[k].sort(bySerial).map(function (d) { return devRow(d, true); }).join('') + '</div>';
      });
    } else {
      list.sort(function (a, b) { return a.category.localeCompare(b.category) || bySerial(a, b); });
      var cat = null, out = '';
      list.forEach(function (d) {
        if (d.category !== cat) { if (cat !== null) out += '</div>'; cat = d.category; out += '<div class="sec"><h2>' + esc(cat) + '</h2></div><div class="list">'; }
        out += devRow(d);
      });
      h += out + '</div>';
    }
    return h + '<div style="height:24px"></div></main>';
  }

  /* ---------- Activity ---------- */
  function viewActivity() {
    var mv = S.data.movements.slice().reverse().slice(0, 120);
    var cos = S.data.checkouts.slice().reverse().slice(0, 30);
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
    var role = { admin: 'Admin', keeper: 'Lab keeper', engineer: 'Engineer' }[S.me.role];
    var h = header('Me') + '<p class="hello">' + role + '<strong>' + esc(S.me.name) + '</strong></p></header><main>';
    h += '<div class="list" style="margin-top:6px">' +
      '<button class="row" data-act="pin"><span class="t"><b>Change my PIN</b><small>4 digits, only you know it</small></span></button>' +
      '<button class="row" data-act="refresh"><span class="t"><b>Refresh now</b><small>Last update ' + (S.lastSync ? when(S.lastSync) : '—') + ' · updates every 20 seconds</small></span></button>' +
      '</div>';
    if (can('admin')) {
      h += '<div class="sec"><h2>Admin</h2></div><div class="list">' +
        '<button class="row" data-act="people"><span class="t"><b>People &amp; PINs</b><small>' + S.data.users.length + ' people · roles, new staff, reset PIN</small></span></button>' +
        '<button class="row" data-act="companies"><span class="t"><b>Companies</b><small>' + S.data.companies.filter(function (c) { return c.active !== false; }).length + ' active · add or rename</small></span></button>' +
        '<button class="row" data-act="devlist"><span class="t"><b>Devices &amp; certificates</b><small>Add devices, due dates, certificate links</small></span></button>' +
        '</div>';
    }
    h += '<div class="sec"><h2>About</h2></div><div class="box" style="margin-top:0"><dl class="kv"><dt>Company</dt><dd>Akhnaton Trading and Representation</dd><dt>Devices</dt><dd>' + S.data.devices.length + '</dd><dt>Version</dt><dd>1.0' + (DEMO ? ' (preview)' : '') + '</dd></dl></div>';
    h += '<button class="btn ghost wide" style="margin-top:18px" data-act="signout">Sign out</button>';
    return h + '<div style="height:24px"></div></main>';
  }

  /* ================= wiring ================= */
  function wire() {
    $$('[data-refresh]').forEach(function (b) { b.onclick = function () { b.disabled = true; refresh().then(function () { toast('Up to date'); }); }; });
    $$('[data-dev]').forEach(function (b) { b.onclick = function () { openDevice(b.dataset.dev); }; });
    $$('[data-goto-filter]').forEach(function (b) { b.onclick = function () { S.filter = b.dataset.gotoFilter; S.q = ''; location.hash = '#devices'; }; });
    $$('[data-filter]').forEach(function (b) { b.onclick = function () { S.filter = b.dataset.filter; S._keepScroll = false; render(); }; });
    $$('[data-sort]').forEach(function (b) { b.onclick = function () { S.sort = b.dataset.sort; LS.set('sort', S.sort); S._keepScroll = false; render(); }; });
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
      if (d.pending) {
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
        '<div class="hero">' + tag(d, 'xl') + '<h3>' + esc(d.description) + '</h3><div class="sub">' + esc([d.manufacturer, d.model].filter(function (x) { return x && x !== 'N/A'; }).join(' · ')) + '</div>' +
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
        '<dt>Type</dt><dd>' + esc(d.category) + '</dd></dl></div>' +
        '<div class="box"><h4>History</h4><ul class="tl" id="hist"><li><small>Loading…</small></li></ul></div>';
      var btns = [];
      if (can('keep')) {
        if (d.status === 'In Office') btns.push('<button class="btn blue" data-a="out">Check out</button>');
        else btns.push('<button class="btn" data-a="in">Back in office</button>');
        btns.push('<button class="btn ghost" data-a="status">Change status</button>');
      }
      if (d.status === 'At Client' && !d.pending) btns.push('<button class="btn ghost" data-a="move">Move to another company</button>');
      if (can('admin')) btns.push('<button class="btn ghost" data-a="edit">Edit device</button>');
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
    people.sort(function (a, b) { return (a.role === 'engineer' ? 0 : 1) - (b.role === 'engineer' ? 0 : 1) || a.name.localeCompare(b.name); });
    function draw() {
      container.innerHTML = '<div class="list">' + people.map(function (u) {
        var on = selected.indexOf(u.id) >= 0;
        return '<button class="row' + (on ? ' sel' : '') + '" data-p="' + u.id + '"><span class="check">' + (on ? ICON.tick : '') + '</span><span class="t"><b>' + esc(u.name) + '</b><small>' + ({ admin: 'Admin', keeper: 'Lab keeper', engineer: 'Engineer' })[u.role] + '</small></span></button>';
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
  function devicePicker(container, selected, filterFn, onChange) {
    var q = '';
    function draw() {
      var list = S.data.devices.filter(function (d) { return filterFn(d) && matches(d, q); });
      list.sort(function (a, b) { return a.description.localeCompare(b.description) || a.serial.localeCompare(b.serial); });
      var picked = selected.map(function (id) { return IDX.dev[id]; }).filter(Boolean);
      container.innerHTML = '<div class="selbar"><div class="search" style="margin-bottom:8px">' + ICON.search + '<input id="dq" type="search" placeholder="Name or last digits of serial" value="' + esc(q) + '" autocomplete="off"></div>' +
        '<div class="picked">' + picked.map(function (d) { return '<button data-unpick="' + d.id + '" aria-label="Remove">' + esc(d.serialTail) + ' · ' + esc(d.description.split(' ').slice(0, 2).join(' ')) + ' ✕</button>'; }).join('') + '</div></div>' +
        (list.length ? '<div class="list">' + list.map(function (d) {
          var on = selected.indexOf(d.id) >= 0, c = cert(d);
          return '<button class="row' + (on ? ' sel' : '') + '" data-d="' + d.id + '"><span class="check">' + (on ? ICON.tick : '') + '</span>' + tag(d) + '<span class="t"><b>' + esc(d.description) + '</b><small>' + esc(devSub(d)) + '</small>' +
            (c.kind === 'expired' ? '<small style="color:var(--danger);font-weight:600">Calibration expired ' + fmtDate(d.calDue) + '</small>' : '') + '</span></button>';
        }).join('') + '</div>' : '<div class="empty"><b>No device here matches.</b>Only devices that are free for this step are listed.</div>');
      var inp = $('#dq', container); inp.oninput = function () { q = inp.value; var p = inp.selectionStart; draw(); var n = $('#dq', container); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
      $$('[data-d]', container).forEach(function (b) { b.onclick = function () { var id = b.dataset.d, i = selected.indexOf(id); if (i >= 0) selected.splice(i, 1); else selected.push(id); draw(); onChange && onChange(); }; });
      $$('[data-unpick]', container).forEach(function (b) { b.onclick = function () { selected.splice(selected.indexOf(b.dataset.unpick), 1); draw(); onChange && onChange(); }; });
    }
    draw();
  }

  /* ---------- check-out wizard ---------- */
  function checkoutFlow(preDevices) {
    var st = { step: 1, companyId: '', engineers: [], devices: (preDevices || []).slice(), expectedReturn: '', note: '' };
    openSheet(function (body, setFoot, setTitle) {
      function go(n) { st.step = n; draw(); }
      function draw() {
        var total = 4;
        if (st.step === 1) {
          setTitle('Which company?', 'Step 1 of ' + total);
          companyPicker(body, st.companyId, function (id) { st.companyId = id; foot(); });
        } else if (st.step === 2) {
          setTitle('Who is going?', 'Step 2 of ' + total);
          body.innerHTML = '<div class="note">Pick everyone in the team. Each of them will see the devices under their name.</div><div id="pp"></div>';
          peoplePicker($('#pp', body), st.engineers, {}, foot);
        } else if (st.step === 3) {
          setTitle('Which devices?', 'Step 3 of ' + total);
          devicePicker(body, st.devices, function (d) { return d.status === 'In Office' || st.devices.indexOf(d.id) >= 0; }, foot);
        } else {
          setTitle('Check and confirm', 'Step 4 of ' + total);
          var devs = st.devices.map(function (id) { return IDX.dev[id]; });
          var expired = devs.filter(function (d) { return cert(d).kind === 'expired'; });
          var notIn = devs.filter(function (d) { return d.status !== 'In Office'; });
          var quick = [1, 2, 3, 7].map(function (n) { var x = new Date(); x.setDate(x.getDate() + n); return { n: n, v: isoDay(x) }; });
          body.innerHTML =
            (expired.length ? '<div class="note warnbox"><b>' + expired.length + ' device' + (expired.length > 1 ? 's have' : ' has') + ' an expired calibration:</b> ' + expired.map(function (d) { return esc(d.description) + ' …' + esc(d.serialTail); }).join(', ') + '. You can still check out.</div>' : '') +
            (notIn.length ? '<div class="note warnbox">' + notIn.map(function (d) { return esc(d.description) + ' …' + esc(d.serialTail); }).join(', ') + ' is not marked in the office. Checking out will move it here.</div>' : '') +
            '<div class="box" style="margin-top:0"><h4>Going to</h4><div class="where">' + esc(coName(st.companyId)) + '</div><div class="meta">With <b>' + esc(st.engineers.map(function (id) { return IDX.user[id].name; }).join(', ')) + '</b></div></div>' +
            '<div class="box"><h4>' + devs.length + ' device' + (devs.length > 1 ? 's' : '') + '</h4><div class="chips" style="margin-top:0">' + devs.map(function (d) { return '<span class="dchip">' + tag(d, 'sm') + '<em>' + esc(d.description) + '</em></span>'; }).join('') + '</div></div>' +
            '<div class="box"><h4>Expected back (optional)</h4><div class="seg" style="margin-bottom:10px">' + quick.map(function (q) { return '<button data-rd="' + q.v + '" class="' + (st.expectedReturn === q.v ? 'on' : '') + '">' + (q.n === 1 ? 'Tomorrow' : 'In ' + q.n + ' days') + '</button>'; }).join('') + '</div>' +
            '<input class="inp" type="date" id="rd" value="' + esc(st.expectedReturn) + '" min="' + isoDay(new Date()) + '" aria-label="Expected return date"></div>' +
            '<div class="box"><h4>Note (optional)</h4><textarea class="inp" id="nt" placeholder="e.g. Autoclave mapping, building 3">' + esc(st.note) + '</textarea></div>';
          $$('[data-rd]', body).forEach(function (b) { b.onclick = function () { st.expectedReturn = st.expectedReturn === b.dataset.rd ? '' : b.dataset.rd; draw(); }; });
          $('#rd', body).onchange = function (e) { st.expectedReturn = e.target.value; draw(); };
          $('#nt', body).oninput = function (e) { st.note = e.target.value; };
        }
        foot();
      }
      function foot() {
        var ok = st.step === 1 ? !!st.companyId : st.step === 2 ? st.engineers.length > 0 : st.step === 3 ? st.devices.length > 0 : true;
        var label = st.step === 4 ? 'Confirm check-out' : st.step === 3 ? 'Next · ' + st.devices.length + ' selected' : 'Next';
        setFoot((st.step > 1 ? '<button class="btn ghost" data-prev style="flex:0 0 auto">Back</button>' : '') + '<button class="btn ' + (st.step === 4 ? 'blue' : '') + '" data-next ' + (ok ? '' : 'disabled') + '>' + label + '</button>');
        var p = $('[data-prev]'); if (p) p.onclick = function () { go(st.step - 1); };
        $('[data-next]').onclick = function () {
          if (st.step < 4) return go(st.step + 1);
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('checkout', { companyId: st.companyId, engineerIds: st.engineers, deviceIds: st.devices, expectedReturn: st.expectedReturn, note: st.note })
            .then(function (r) { return refresh(true).then(function () { return r; }); })
            .then(function (r) { doneScreen(body, setFoot, setTitle, r.checkoutId); })
            .catch(function (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Confirm check-out'; });
        };
      }
      draw();
    });
  }
  function doneScreen(body, setFoot, setTitle, coId) {
    setTitle('Checked out', '');
    var c = S.data.checkouts.filter(function (x) { return x.id === coId; })[0];
    body.innerHTML = '<div class="done"><div class="ok">' + ICON.bigtick + '</div><h3>' + esc(coName(c.companyId)) + '</h3><p>' + c.deviceIds.length + ' device' + (c.deviceIds.length > 1 ? 's' : '') + ' with ' + esc(names(c.engineers)) + '<br>Receipt ' + esc(coId) + '</p>' +
      '<button class="btn blue wide" data-pdf-now>' + ICON.pdf + 'Share receipt PDF</button></div>';
    setFoot('<button class="btn ghost" data-close>Done</button>');
    $('[data-pdf-now]', body).onclick = function () { receiptPdf(coId); };
    $('[data-close]').onclick = function () { closeAll(); };
  }

  /* ---------- check-in ---------- */
  function checkinFlow(coId) {
    var devs = S.data.devices.filter(function (d) { return d.status === 'At Client' && d.companyId === coId; });
    var sel = devs.map(function (d) { return d.id; });
    openSheet(function (body, setFoot, setTitle) {
      setTitle('Back from ' + coName(coId));
      function draw() {
        body.innerHTML = '<div class="note">Untick anything that is still at the client.</div><div id="dp"></div>';
        devicePicker($('#dp', body), sel, function (d) { return d.status === 'At Client' && d.companyId === coId; }, foot);
        foot();
      }
      function foot() {
        setFoot('<button class="btn" data-ok ' + (sel.length ? '' : 'disabled') + '>Check in ' + sel.length + ' device' + (sel.length === 1 ? '' : 's') + '</button>');
        $('[data-ok]').onclick = function () { submitCheckin(sel.slice(), this); };
      }
      draw();
    });
  }
  function simpleCheckin(ids) {
    var d = IDX.dev[ids[0]];
    askConfirm('Mark ' + d.description + ' …' + d.serialTail + ' as back in the office?', 'Back in office', function () { submitCheckin(ids); });
  }
  function submitCheckin(ids, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    req('checkin', { deviceIds: ids }).then(function () { return refresh(true); })
      .then(function () { closeAll(); toast(ids.length + ' device' + (ids.length > 1 ? 's' : '') + ' back in the office'); })
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
    var st = { step: preIds ? 2 : 1, devices: (preIds || []).slice(), to: [], companyId: '', note: '' };
    if (!preIds) st.devices = S.data.devices.filter(function (d) { return d.status === 'At Client' && d.companyId === fromCo && !d.pending; }).map(function (d) { return d.id; });
    openSheet(function (body, setFoot, setTitle) {
      function draw() {
        if (st.step === 1) {
          setTitle('Which devices move?', 'Step 1 of 4');
          devicePicker(body, st.devices, function (d) { return d.status === 'At Client' && d.companyId === fromCo && !d.pending; }, foot);
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
            '<div class="box"><h4>' + devs.length + ' device' + (devs.length > 1 ? 's' : '') + '</h4><div class="chips" style="margin-top:0">' + devs.map(function (d) { return '<span class="dchip">' + tag(d, 'sm') + '<em>' + esc(d.description) + '</em></span>'; }).join('') + '</div></div>' +
            '<div class="box"><h4>Note (optional)</h4><textarea class="inp" id="nt">' + esc(st.note) + '</textarea></div>' +
            (st.to[0] === S.me.id ? '<div class="note">You are taking them yourself, so the move is confirmed right away.</div>' : '');
          $('#nt', body).oninput = function (e) { st.note = e.target.value; };
        }
        foot();
      }
      function foot() {
        var ok = st.step === 1 ? st.devices.length : st.step === 2 ? st.to.length : st.step === 3 ? st.companyId : 1;
        var first = preIds ? 2 : 1;
        setFoot((st.step > first ? '<button class="btn ghost" data-prev style="flex:0 0 auto">Back</button>' : '') + '<button class="btn ' + (st.step === 4 ? 'blue' : '') + '" data-next ' + (ok ? '' : 'disabled') + '>' + (st.step === 4 ? 'Send transfer' : 'Next') + '</button>');
        var p = $('[data-prev]'); if (p) p.onclick = function () { st.step--; draw(); };
        $('[data-next]').onclick = function () {
          if (st.step < 4) { st.step++; return draw(); }
          var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
          req('transferRequest', { deviceIds: st.devices, toEngineerId: st.to[0], toCompanyId: st.companyId, note: st.note })
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
        var order = { admin: 0, keeper: 1, engineer: 2 };
        var list = S.data.users.slice().sort(function (a, b) { return order[a.role] - order[b.role] || a.name.localeCompare(b.name); });
        body.innerHTML = '<div class="list">' + list.map(function (u) {
          return '<button class="row" data-u="' + u.id + '"><span class="t"><b>' + esc(u.name) + (u.active === false ? ' (inactive)' : '') + '</b><small>' + ({ admin: 'Admin', keeper: 'Lab keeper', engineer: 'Engineer' })[u.role] + '</small></span></button>';
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
        [['engineer', 'Engineer'], ['keeper', 'Lab keeper'], ['admin', 'Admin']].map(function (r) { return '<button data-r="' + r[0] + '" class="' + (f.role === r[0] ? 'on' : '') + '">' + r[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="note" style="margin-top:14px">Engineers see everything and can move devices between companies. Lab keepers also check devices out and in. Admins manage people, companies and devices.</div>' +
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
      setFoot('<button class="btn" data-save>Save</button>');
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
      setFoot('<button class="btn blue" data-add>Add a device</button>');
      $('[data-add]').onclick = function () { editDevice(null, draw); };
    });
  }
  function editDevice(d, after) {
    var f = d ? JSON.parse(JSON.stringify(d)) : { category: '', manufacturer: '', description: '', model: '', serial: '', range: '', accuracy: '', calDue: '', certUrl: '', certStatus: 'dated' };
    openSheet(function (body, setFoot, setTitle) {
      setTitle(d ? 'Edit device' : 'Add a device');
      var fields = [['description', 'Name (e.g. Digital Tachometer)'], ['manufacturer', 'Manufacturer'], ['model', 'Model'], ['serial', 'Serial number'], ['category', 'Type (e.g. Temperature, Pressure)'], ['range', 'Range'], ['accuracy', 'Accuracy']];
      body.innerHTML = fields.map(function (x) { return '<label class="f"><span>' + x[1] + '</span><input class="inp" data-k="' + x[0] + '" value="' + esc(f[x[0]]) + '"></label>'; }).join('') +
        '<div class="box" style="margin:4px 0 14px"><h4>Certificate</h4><div class="seg" style="margin-bottom:12px"><button data-cs="dated" class="' + (f.certStatus !== 'none' ? 'on' : '') + '">Has a calibration certificate</button><button data-cs="none" class="' + (f.certStatus === 'none' ? 'on' : '') + '">No certificate needed</button></div>' +
        '<label class="f"><span>Calibration due date</span><input class="inp" type="date" data-k="calDue" value="' + esc(f.calDue) + '"></label>' +
        '<label class="f" style="margin:0"><span>Certificate link (SharePoint)</span><input class="inp" data-k="certUrl" value="' + esc(f.certUrl) + '" placeholder="https://evapharma.sharepoint.com/…"></label></div>';
      $$('[data-k]', body).forEach(function (i) { i.oninput = i.onchange = function () { f[i.dataset.k] = i.value; }; });
      $$('[data-cs]', body).forEach(function (b) { b.onclick = function () { f.certStatus = b.dataset.cs; $$('[data-cs]', body).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
      setFoot('<button class="btn" data-save>Save</button>');
      $('[data-save]').onclick = function () {
        req('saveDevice', { device: f }).then(function () { return refresh(true); }).then(function () { closeAll(); toast('Device saved'); }).catch(function (e) { toast(e.message, true); });
      };
    });
  }

  /* ================= PDF receipt ================= */
  var LOGO = null;
  function loadLogo() {
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
      function lat(t) { return String(t || '').replace(/[^\x20-\x7E\u00A0-\u024F\u2013\u2014]/g, '').replace(/\s+/g, ' ').trim(); }
      var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' });
      var W = 210, M = 16, y = 16, co = IDX.co[c.companyId] || {};
      if (logo) { var lw = 62, lh = lw * logo.h / logo.w; doc.addImage(logo.data, 'JPEG', M, y, lw, lh); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(19, 41, 75);
      doc.text('Device Check-out Receipt', W - M, y + 7, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(90, 104, 121);
      doc.text('Receipt no. ' + c.id, W - M, y + 13, { align: 'right' });
      doc.text('Calibration Lab', W - M, y + 18, { align: 'right' });
      y += 30; doc.setDrawColor(11, 118, 197); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 9;
      function field(label, val, x, w) {
        doc.setFontSize(9); doc.setTextColor(90, 104, 121); doc.text(label, x, y);
        doc.setFontSize(12); doc.setTextColor(23, 34, 51); doc.setFont('helvetica', 'bold');
        var lines = doc.splitTextToSize(val || '—', w); doc.text(lines, x, y + 5.5); doc.setFont('helvetica', 'normal');
        return lines.length;
      }
      var d = new Date(c.ts);
      var l1 = field('Company', lat(co.name) + (co.code ? '  (ID ' + co.code + ')' : ''), M, 108);
      field('Date & time of departure', fmtDate(d) + ', ' + fmtTime(d), 130, 64);
      y += 7 + l1 * 5.5;
      var offi = (co.official || '').split(' | ').filter(function (x) { return /^[\x20-\x7E]+$/.test(x); })[0];
      if (offi && offi !== co.name) { doc.setFontSize(9.5); doc.setTextColor(90, 104, 121); var ol = doc.splitTextToSize('Official name: ' + offi, 178); doc.text(ol, M, y - 2); y += ol.length * 4.5; }
      var l2 = field('Engineer(s)', names(c.engineers), M, 108);
      field('Expected return', c.expectedReturn ? fmtDate(c.expectedReturn) : 'Not set', 130, 64);
      y += 8 + l2 * 5.5;
      if (lat(c.note)) { var l3 = field('Note', lat(c.note), M, 178); y += 8 + l3 * 5.5; }
      // table
      var cols = [{ t: '#', w: 8 }, { t: 'Device', w: 64 }, { t: 'Manufacturer / Model', w: 44 }, { t: 'Serial no.', w: 36 }, { t: 'Cal. due', w: 26 }];
      function headRow() {
        doc.setFillColor(19, 41, 75); doc.rect(M, y, W - 2 * M, 8, 'F');
        doc.setFontSize(9.5); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        var x = M + 2; cols.forEach(function (cl) { doc.text(cl.t, x, y + 5.4); x += cl.w; }); doc.setFont('helvetica', 'normal'); y += 8;
      }
      headRow();
      c.deviceIds.forEach(function (id, i) {
        var dv = IDX.dev[id] || { description: id, manufacturer: '', model: '', serial: '', calDue: '' };
        var cells = [String(i + 1), dv.description, [dv.manufacturer, dv.model !== 'N/A' ? dv.model : ''].filter(Boolean).join(' '), dv.serial, dv.certStatus === 'none' ? 'Not required' : (dv.calDue ? fmtDate(dv.calDue) : '—')];
        var wrapped = cells.map(function (t, k) { return doc.splitTextToSize(t || '', cols[k].w - 3); });
        var h = Math.max.apply(null, wrapped.map(function (w) { return w.length; })) * 4.6 + 3.4;
        if (y + h > 262) { doc.addPage(); y = 18; headRow(); }
        if (i % 2) { doc.setFillColor(237, 241, 245); doc.rect(M, y, W - 2 * M, h, 'F'); }
        doc.setFontSize(10); doc.setTextColor(23, 34, 51);
        var x = M + 2; wrapped.forEach(function (w, k) { doc.text(w, x, y + 5); x += cols[k].w; });
        y += h;
      });
      doc.setDrawColor(214, 221, 230); doc.setLineWidth(0.3); doc.line(M, y, W - M, y);
      y += 6; doc.setFontSize(10); doc.setTextColor(90, 104, 121);
      doc.text(c.deviceIds.length + ' device' + (c.deviceIds.length > 1 ? 's' : '') + ' in total. Checked out by ' + c.byName + '.', M, y);
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
      var fname = c.id + ' ' + (co.name || '').replace(/[^\w\- ]+/g, '').trim() + '.pdf';
      var blob = doc.output('blob');
      var file = null; try { file = new File([blob], fname, { type: 'application/pdf' }); } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Check-out ' + c.id, text: 'Akhnaton device check-out ' + c.id + ' – ' + co.name }).catch(function () {});
      } else {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        toast('Receipt saved: ' + fname);
      }
    });
  }

  /* ================= boot ================= */
  function route() {
    var v = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
    if (['home', 'devices', 'activity', 'more'].indexOf(v) < 0) v = 'home';
    if (v !== S.view) { S.view = v; closeAll(); }
    render();
  }
  window.addEventListener('hashchange', route);
  var timer = null;
  function boot() {
    var cached = LS.get('cache', null);
    if (cached && !S.data) { S.data = cached; index(); }
    route();
    refresh(!!cached);
    clearInterval(timer);
    timer = setInterval(function () { if (document.visibilityState === 'visible' && S.session && !sheetStack.length) { S._keepScroll = true; refresh(true); } }, 20000);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.session) { S._keepScroll = true; refresh(true); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !DEMO) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (S.session) boot(); else renderLogin();
  window.__app = { S: S, refresh: refresh };
})();
