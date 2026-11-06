/* Akhnaton Device Tracker — core logic.
 * The SAME file runs in the app (demo mode) and inside Google Apps Script (server),
 * so every rule lives in one place.
 * db = { users:[], devices:[], companies:[], checkouts:[], transfers:[], movements:[] }
 */
var Core = (function () {
  'use strict';

  var STATUSES = ['In Office', 'At Client', 'Maintenance', 'External Calibration', 'Out of Service', 'Other'];
  var SERVICE = ['Maintenance', 'External Calibration', 'Other'];

  /* ---------- tiny SHA-256 (sync, works in browser + Apps Script) ---------- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, max = mp(2, 32), result = '', words = [], bitLen = ascii.length * 8;
    var hash = [], k = [], pc = 0, isC = {};
    for (var c = 2; pc < 64; c++) {
      if (!isC[c]) {
        for (var i = 0; i < 313; i += c) isC[i] = c;
        hash[pc] = (mp(c, .5) * max) | 0; k[pc++] = (mp(c, 1 / 3) * max) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii = unescape(encodeURIComponent(ascii)); bitLen = ascii.length * 8;
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8;
    words[words.length] = ((bitLen / max) | 0); words[words.length] = (bitLen);
    for (var j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  function pinHash(userId, pin) { return sha256('akh|' + userId + '|' + String(pin)); }

  /* ---------- helpers ---------- */
  function err(msg) { var e = new Error(msg); e.userFacing = true; throw e; }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function need(cond, msg) { if (!cond) err(msg); }
  function iso(now) { return new Date(now).toISOString(); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function personRef(u) { return { id: u.id, name: u.name }; }
  function canKeep(actor) { return actor.role === 'admin' || actor.role === 'keeper'; }
  function isAdmin(actor) { return actor.role === 'admin'; }
  function devName(d) { return d.description + ' (S/N ' + d.serial + ')'; }

  function log(db, now, actor, d, action, extra) {
    extra = extra || {};
    db.movements.push({
      id: 'M' + now + '-' + d.id + '-' + db.movements.length,
      ts: iso(now), deviceId: d.id, action: action,
      status: d.status, companyId: d.companyId || '', holders: d.holders || [],
      byId: actor.id, byName: actor.name,
      checkoutId: extra.checkoutId || d.checkoutId || '', note: extra.note || ''
    });
    db._touched.movements = true;
  }
  function touch(db, t) { db._touched[t] = true; }

  function clearPlace(d) {
    d.companyId = ''; d.holders = []; d.expectedReturn = ''; d.checkoutId = ''; d.note = ''; d.pending = '';
  }

  function cancelPendingFor(db, now, actor, d) {
    if (!d.pending) return;
    var t = byId(db.transfers, d.pending);
    if (t && t.status === 'Pending') {
      t.deviceIds = t.deviceIds.filter(function (x) { return x !== d.id; });
      if (!t.deviceIds.length) { t.status = 'Cancelled'; t.decidedById = actor.id; t.decidedByName = actor.name; t.decidedTs = iso(now); }
      touch(db, 'transfers');
    }
    d.pending = '';
  }

  function nextCheckoutId(db, now) {
    var y = new Date(now).getFullYear(), n = 0, pre = 'CO-' + y + '-';
    db.checkouts.forEach(function (c) { if (c.id.indexOf(pre) === 0) n = Math.max(n, parseInt(c.id.slice(pre.length), 10) || 0); });
    return pre + pad(n + 1, 4);
  }

  /* ---------- auth ---------- */
  function verify(db, userId, pin) {
    var u = byId(db.users, userId);
    if (!u || u.active === false) err('This account is not active. Ask the admin.');
    if (u.pinHash !== pinHash(u.id, pin)) err('Wrong PIN. Try again.');
    return u;
  }

  /* ---------- operations ---------- */
  var ops = {
    login: function (db, actor) {
      return { user: publicUser(actor), mustChange: !!actor.mustChange };
    },

    changePin: function (db, actor, p) {
      need(/^\d{4}$/.test(String(p.newPin)), 'The new PIN must be 4 digits.');
      actor.pinHash = pinHash(actor.id, p.newPin); actor.mustChange = false; touch(db, 'users');
      return { ok: true };
    },

    checkout: function (db, actor, p, now) {
      need(canKeep(actor), 'Only lab keepers can check devices out.');
      var co = byId(db.companies, p.companyId); need(co, 'Choose the company.');
      need(p.engineerIds && p.engineerIds.length, 'Choose at least one engineer.');
      need(p.deviceIds && p.deviceIds.length, 'Choose at least one device.');
      var eng = p.engineerIds.map(function (id) { var u = byId(db.users, id); need(u, 'Unknown engineer.'); return personRef(u); });
      var devs = p.deviceIds.map(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        need(d.status === 'In Office' || isAdmin(actor), devName(d) + ' is not in the office (' + d.status + ').');
        return d;
      });
      var id = nextCheckoutId(db, now);
      db.checkouts.push({
        id: id, ts: iso(now), companyId: co.id, engineers: eng, deviceIds: p.deviceIds.slice(),
        expectedReturn: p.expectedReturn || '', note: p.note || '', byId: actor.id, byName: actor.name
      });
      touch(db, 'checkouts');
      devs.forEach(function (d) {
        cancelPendingFor(db, now, actor, d);
        d.status = 'At Client'; d.companyId = co.id; d.holders = eng; d.since = iso(now);
        d.expectedReturn = p.expectedReturn || ''; d.checkoutId = id; d.note = p.note || '';
        log(db, now, actor, d, 'Checked out', { checkoutId: id, note: p.note });
      });
      touch(db, 'devices'); co.lastUsed = iso(now); touch(db, 'companies');
      return { checkoutId: id };
    },

    checkin: function (db, actor, p, now) {
      need(canKeep(actor), 'Only lab keepers can check devices in.');
      need(p.deviceIds && p.deviceIds.length, 'Choose the devices that came back.');
      p.deviceIds.forEach(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        cancelPendingFor(db, now, actor, d);
        var from = d.companyId;
        d.status = 'In Office'; clearPlace(d); d.since = iso(now);
        log(db, now, actor, d, 'Returned to office', { note: p.note || (from ? 'from ' + ((byId(db.companies, from) || {}).name || '') : '') });
      });
      touch(db, 'devices');
      return { ok: true };
    },

    setStatus: function (db, actor, p, now) {
      need(canKeep(actor), 'Only lab keepers can change a device status.');
      need(STATUSES.indexOf(p.status) >= 0 && p.status !== 'At Client', 'Choose a status.');
      if (p.status === 'Other') need(p.note && String(p.note).trim(), 'Write what happened to the device.');
      p.deviceIds.forEach(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        cancelPendingFor(db, now, actor, d);
        clearPlace(d); d.status = p.status; d.since = iso(now);
        d.note = p.note || '';
        d.holders = p.person ? [{ id: '', name: String(p.person) }] : [];
        d.expectedReturn = p.expectedReturn || '';
        log(db, now, actor, d, p.status === 'In Office' ? 'Returned to office' : 'Set to ' + p.status, { note: [p.person, p.note].filter(Boolean).join(' — ') });
      });
      touch(db, 'devices');
      return { ok: true };
    },

    transferRequest: function (db, actor, p, now) {
      var to = byId(db.users, p.toEngineerId); need(to, 'Choose who takes the devices.');
      var co = byId(db.companies, p.toCompanyId); need(co, 'Choose the company the devices go to.');
      need(p.deviceIds && p.deviceIds.length, 'Choose the devices.');
      var from = null;
      p.deviceIds.forEach(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        need(d.status === 'At Client', devName(d) + ' is not at a client.');
        need(!d.pending, devName(d) + ' already has a transfer waiting.');
        from = from || d;
      });
      var t = {
        id: 'TR' + now, ts: iso(now), deviceIds: p.deviceIds.slice(),
        fromCompanyId: from.companyId, fromHolders: from.holders,
        toCompanyId: co.id, toEngineer: personRef(to),
        requestedById: actor.id, requestedByName: actor.name, note: p.note || '',
        status: 'Pending', decidedById: '', decidedByName: '', decidedTs: ''
      };
      db.transfers.push(t); touch(db, 'transfers');
      p.deviceIds.forEach(function (id) { var d = byId(db.devices, id); d.pending = t.id; log(db, now, actor, d, 'Transfer requested', { note: 'to ' + to.name + ' @ ' + co.name }); });
      touch(db, 'devices');
      return { transferId: t.id };
    },

    transferDecide: function (db, actor, p, now) {
      var t = byId(db.transfers, p.transferId); need(t && t.status === 'Pending', 'This transfer is no longer waiting.');
      need(actor.id === t.toEngineer.id || canKeep(actor), 'Only ' + t.toEngineer.name + ' or a lab keeper can confirm this transfer.');
      t.status = p.accept ? 'Accepted' : 'Declined';
      t.decidedById = actor.id; t.decidedByName = actor.name; t.decidedTs = iso(now);
      touch(db, 'transfers');
      var co = byId(db.companies, t.toCompanyId);
      t.deviceIds.forEach(function (id) {
        var d = byId(db.devices, id); if (!d || d.pending !== t.id) return;
        d.pending = '';
        if (p.accept) {
          d.status = 'At Client'; d.companyId = t.toCompanyId; d.holders = [t.toEngineer]; d.since = iso(now);
          log(db, now, actor, d, 'Transferred', { note: 'to ' + t.toEngineer.name + ' @ ' + (co ? co.name : '') });
        } else {
          log(db, now, actor, d, 'Transfer declined', { note: 'by ' + actor.name });
        }
      });
      if (co && p.accept) { co.lastUsed = iso(now); touch(db, 'companies'); }
      touch(db, 'devices');
      return { ok: true };
    },

    /* ---- admin ---- */
    saveCompany: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can add or edit companies.');
      var c = p.company || {}; need(c.name && String(c.name).trim(), 'Write the company name.');
      var ex = c.id ? byId(db.companies, c.id) : null;
      var dup = db.companies.filter(function (x) { return x.name.toLowerCase() === String(c.name).trim().toLowerCase() && (!ex || x.id !== ex.id); });
      need(!dup.length, 'A company with this name already exists.');
      if (!ex) { ex = { id: 'C' + now, lastUsed: '' }; db.companies.push(ex); }
      ex.name = String(c.name).trim(); ex.official = c.official || ''; ex.code = c.code || ''; ex.group = c.group || 'Client';
      ex.active = c.active !== false; ex.logo = c.logo || ex.logo || '';
      touch(db, 'companies');
      return { id: ex.id };
    },

    saveUser: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can manage people.');
      var u = p.user || {}; need(u.name && String(u.name).trim(), 'Write the person\'s name.');
      need(['admin', 'keeper', 'engineer'].indexOf(u.role) >= 0, 'Choose a role.');
      var ex = u.id ? byId(db.users, u.id) : null, pin = null;
      if (!ex) {
        ex = { id: 'U' + now }; pin = String(1000 + Math.floor(Math.random() * 9000));
        ex.pinHash = pinHash(ex.id, pin); ex.mustChange = true; db.users.push(ex);
      }
      if (ex.id === actor.id) need(u.role === 'admin' && u.active !== false, 'You cannot remove your own admin access.');
      ex.name = String(u.name).trim(); ex.role = u.role; ex.active = u.active !== false; ex.phone = u.phone || '';
      touch(db, 'users');
      return { id: ex.id, pin: pin };
    },

    resetPin: function (db, actor, p) {
      need(isAdmin(actor), 'Only the admin can reset a PIN.');
      var u = byId(db.users, p.userId); need(u, 'Unknown person.');
      var pin = String(1000 + Math.floor(Math.random() * 9000));
      u.pinHash = pinHash(u.id, pin); u.mustChange = true; touch(db, 'users');
      return { pin: pin };
    },

    saveDevice: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can add or edit devices.');
      var d = p.device || {}; need(d.description && d.serial, 'Description and serial number are required.');
      var ex = d.id ? byId(db.devices, d.id) : null;
      if (!ex) {
        ex = { id: 'D' + now, status: 'In Office', companyId: '', holders: [], since: iso(now), expectedReturn: '', checkoutId: '', note: '', pending: '' };
        db.devices.push(ex);
      }
      ['category', 'manufacturer', 'description', 'model', 'serial', 'accuracy', 'range', 'calDue', 'certUrl'].forEach(function (k) {
        if (d[k] !== undefined) ex[k] = String(d[k] == null ? '' : d[k]).trim();
      });
      ex.certStatus = d.certStatus === 'none' ? 'none' : 'dated';
      ex.serialTail = serialTail(ex.serial);
      ex.active = d.active !== false;
      touch(db, 'devices');
      return { id: ex.id };
    }
  };

  function serialTail(s) {
    var first = String(s || '').split('&')[0].trim(), m = first.match(/[A-Za-z0-9]/g);
    return m ? m.slice(-3).join('') : first;
  }

  function publicUser(u) { return { id: u.id, name: u.name, role: u.role, active: u.active !== false, phone: u.phone || '' }; }

  /* Apply one request. Returns { result, touched } ; throws userFacing errors. */
  function apply(db, req, now) {
    db._touched = {};
    var op = ops[req.action];
    need(op, 'Unknown action.');
    var actor = verify(db, req.userId, req.pin);
    var result = op(db, actor, req.payload || {}, now);
    var touched = db._touched; delete db._touched;
    return { result: result, touched: touched };
  }

  /* Read model for the app. */
  function snapshot(db, opts) {
    opts = opts || {};
    var openTransfers = db.transfers.filter(function (t) { return t.status === 'Pending'; });
    var recentCheckouts = db.checkouts.slice(-300);
    var moves = db.movements.slice(-(opts.movements || 250));
    return {
      devices: db.devices.filter(function (d) { return d.active !== false; }),
      companies: db.companies,
      users: db.users.map(publicUser),
      transfers: openTransfers,
      checkouts: recentCheckouts,
      movements: moves,
      serverTime: opts.now ? iso(opts.now) : ''
    };
  }

  return {
    STATUSES: STATUSES, SERVICE: SERVICE, apply: apply, snapshot: snapshot,
    pinHash: pinHash, serialTail: serialTail, verify: verify, publicUser: publicUser
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
