/* Akhnaton Device Tracker — core logic.
 * The SAME file runs in the app (demo mode) and inside Google Apps Script (server),
 * so every rule lives in one place.
 * db = { users:[], devices:[], companies:[], checkouts:[], transfers:[], movements:[] }
 */
var Core = (function () {
  'use strict';

  var STATUSES = ['In Office', 'At Client', 'Maintenance', 'External Calibration', 'Out of Service', 'Other'];
  var SERVICE = ['Maintenance', 'External Calibration', 'Other'];

  /* Items counted by quantity (no serial): data loggers, validator sensors, connections, tools.
   * total '' = not counted yet (no availability limit). Admin edits them in the app. */
  var STOCK_GROUPS = ['Data Loggers', 'Validator Sensors', 'Connections', 'Tools & Accessories'];
  var DEFAULT_STOCK = [
    ['S01', 'Data Loggers', 'Dickson Temp/RH data logger'], ['S02', 'Data Loggers', 'Elitech data logger'], ['S03', 'Data Loggers', 'Lascar data logger'],
    ['S04', 'Data Loggers', 'High temp/RH data logger'], ['S05', 'Data Loggers', 'Stainless steel data logger'],
    ['S06', 'Validator Sensors', 'Fluke validator sensor – Type T'], ['S07', 'Validator Sensors', 'Fluke validator sensor – Type K'],
    ['S08', 'Connections', 'Pressure connections'], ['S09', 'Connections', 'Autoclave connections'], ['S10', 'Connections', 'Glatt connections'],
    ['S11', 'Tools & Accessories', 'مفتاح فرنساوي', 'Adjustable wrench'], ['S12', 'Tools & Accessories', 'مفتاح عادة', 'Open-end wrench'], ['S13', 'Tools & Accessories', 'مفك عادة', 'Flat screwdriver'],
    ['S14', 'Tools & Accessories', 'مفك صليبة', 'Phillips screwdriver'], ['S15', 'Tools & Accessories', 'بنسة', 'Pliers'], ['S16', 'Tools & Accessories', 'شاحن بطاريات', 'Battery charger'],
    ['S17', 'Tools & Accessories', 'وصلة كهرباء', 'Extension cord']
  ];
  function ensureStock(db) {
    if (!db.stock) db.stock = [];
    if (!db.holdings) db.holdings = [];
    if (!db.jobs) db.jobs = [];
    if (db.stock.length) return false;
    DEFAULT_STOCK.forEach(function (x) { db.stock.push({ id: x[0], group: x[1], name: x[2], total: '', active: true, note: x[3] || '' }); });
    return true;
  }
  /* Buffers / solutions: a portion is poured out, the bottle stays in the lab */
  function isPortion(d) {
    return /^(pH Solution|Redox)$/.test(d.category || '') || (d.category === 'Conductivity' && /buffer|solution/i.test(d.description || ''));
  }

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
  function isSuper(actor) { return actor.role === 'superadmin'; }
  function canKeep(actor) { return actor.role === 'admin' || actor.role === 'keeper' || isSuper(actor); }
  function canJob(actor) { return actor.role === 'admin' || actor.role === 'supervisor' || isSuper(actor); }
  var ROLES = ['superadmin', 'admin', 'keeper', 'supervisor', 'engineer'];
  function isAdmin(actor) { return actor.role === 'admin' || isSuper(actor); }
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

  function isCoReq(d) { return String(d.pending || '').indexOf('CO-') === 0; }
  function cancelPendingFor(db, now, actor, d) {
    if (!d.pending) return;
    if (isCoReq(d)) {
      var c = byId(db.checkouts, d.pending);
      if (c && c.status === 'Pending') {
        c.deviceIds = c.deviceIds.filter(function (x) { return x !== d.id; });
        if (!c.deviceIds.length) { c.status = 'Cancelled'; c.decidedById = actor.id; c.decidedByName = actor.name; c.decidedTs = iso(now); }
        touch(db, 'checkouts');
      }
      d.pending = ''; return;
    }
    var t = byId(db.transfers, d.pending);
    if (t && t.status === 'Pending') {
      t.deviceIds = t.deviceIds.filter(function (x) { return x !== d.id; });
      if (!t.deviceIds.length) { t.status = 'Cancelled'; t.decidedById = actor.id; t.decidedByName = actor.name; t.decidedTs = iso(now); }
      touch(db, 'transfers');
    }
    d.pending = '';
  }

  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function outQty(db, stockId) { var n = 0; db.holdings.forEach(function (h) { if (h.stockId === stockId) n += num(h.qty); }); return n; }
  function cleanItems(db, items) {
    return (items || []).map(function (it) {
      var q = num(it.qty); need(q > 0, 'Quantity must be at least 1.');
      var st = it.stockId ? byId(db.stock, it.stockId) : null;
      if (it.stockId) need(st && st.active !== false, 'Unknown item.');
      var name = st ? st.name : String(it.name || '').trim(); need(name, 'Write the name of the item.');
      return { stockId: st ? st.id : '', name: name, group: st ? st.group : (it.group || 'Other'), qty: q };
    });
  }
  function checkAvailable(db, items) {
    var want = {};
    items.forEach(function (it) { if (it.stockId) want[it.stockId] = (want[it.stockId] || 0) + it.qty; });
    Object.keys(want).forEach(function (sid) {
      var st = byId(db.stock, sid); if (st.total === '' || st.total == null) return;
      var free = num(st.total) - outQty(db, sid);
      need(want[sid] <= free, st.name + ': only ' + Math.max(free, 0) + ' in the lab.');
    });
  }
  function giveItems(db, now, actor, rec, co) {
    (rec.items || []).forEach(function (it, i) {
      db.holdings.push({ id: 'H' + now + '-' + i + '-' + db.holdings.length, stockId: it.stockId, name: it.name, group: it.group, qty: it.qty,
        companyId: co.id, holders: rec.engineers, since: iso(now), checkoutId: rec.id });
      db.movements.push({ id: 'M' + now + '-I' + i + '-' + db.movements.length, ts: iso(now), deviceId: 'ITEM:' + (it.stockId || it.name), action: 'Checked out',
        status: 'At Client', companyId: co.id, holders: rec.engineers, byId: actor.id, byName: actor.name, checkoutId: rec.id, note: it.qty + ' × ' + it.name });
    });
    if ((rec.items || []).length) { touch(db, 'holdings'); touch(db, 'movements'); }
  }

  function nextCheckoutId(db, now) {
    var y = new Date(now).getFullYear(), n = 0, pre = 'CO-' + y + '-';
    db.checkouts.forEach(function (c) { if (c.id.indexOf(pre) === 0) n = Math.max(n, parseInt(c.id.slice(pre.length), 10) || 0); });
    return pre + pad(n + 1, 4);
  }

  function releaseCheckout(db, now, actor, rec, devs, co) {
    devs.forEach(function (d) {
      if (isPortion(d)) { log(db, now, actor, d, 'Portion taken', { checkoutId: rec.id, note: 'to ' + co.name + ' — bottle stays in the lab' }); return; }
      if (d.pending !== rec.id) cancelPendingFor(db, now, actor, d); else d.pending = '';
      d.status = 'At Client'; d.companyId = co.id; d.holders = rec.engineers; d.since = iso(now);
      d.expectedReturn = rec.expectedReturn || ''; d.checkoutId = rec.id; d.note = rec.note || '';
      log(db, now, actor, d, 'Checked out', { checkoutId: rec.id, note: rec.note });
    });
    giveItems(db, now, actor, rec, co);
    touch(db, 'devices'); co.lastUsed = iso(now); touch(db, 'companies');
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

    /* Lab keepers / admin: devices leave now. Everyone else: a request that waits for a lab keeper. */
    checkout: function (db, actor, p, now) {
      var job = byId(db.jobs, p.jobId); need(job, 'Choose the job first. A site supervisor opens jobs.');
      need(job.status !== 'Closed', 'This job is closed. Ask the site supervisor to reopen it.');
      p.companyId = job.companyId;
      var co = byId(db.companies, p.companyId); need(co, 'Choose the company.');
      need(p.engineerIds && p.engineerIds.length, 'Choose at least one engineer.');
      p.deviceIds = p.deviceIds || [];
      var items = cleanItems(db, p.items);
      need(p.deviceIds.length || items.length, 'Choose at least one device or item.');
      var eng = p.engineerIds.map(function (id) { var u = byId(db.users, id); need(u, 'Unknown engineer.'); return personRef(u); });
      var keeper = canKeep(actor);
      var devs = p.deviceIds.map(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        need(d.status === 'In Office' || isAdmin(actor), devName(d) + ' is not in the office (' + d.status + ').');
        if (!keeper && !isPortion(d)) need(!d.pending, devName(d) + ' is already reserved in another request.');
        return d;
      });
      checkAvailable(db, items);
      var id = nextCheckoutId(db, now);
      var rec = {
        id: id, ts: iso(now), jobId: job.id, companyId: co.id, engineers: eng, deviceIds: p.deviceIds.slice(),
        expectedReturn: p.expectedReturn || '', note: p.note || '', byId: actor.id, byName: actor.name, items: items,
        status: keeper ? 'Approved' : 'Pending', requestedTs: iso(now),
        decidedById: keeper ? actor.id : '', decidedByName: keeper ? actor.name : '', decidedTs: keeper ? iso(now) : ''
      };
      db.checkouts.push(rec);
      touch(db, 'checkouts');
      if (!keeper) {
        devs.forEach(function (d) { if (!isPortion(d)) d.pending = id; log(db, now, actor, d, 'Check-out requested', { checkoutId: id, note: 'for ' + co.name }); });
        touch(db, 'devices');
        return { checkoutId: id, pending: true };
      }
      releaseCheckout(db, now, actor, rec, devs, co);
      return { checkoutId: id };
    },

    /* Lab keeper approves (optionally removing some devices) or declines; the requester may cancel. */
    checkoutDecide: function (db, actor, p, now) {
      var c = byId(db.checkouts, p.checkoutId); need(c && c.status === 'Pending', 'This request is no longer waiting.');
      var own = c.byId === actor.id;
      need(canKeep(actor) || (own && !p.accept), 'Only a lab keeper can approve this request.');
      var co = byId(db.companies, c.companyId);
      var keep = p.accept ? (p.deviceIds ? p.deviceIds : c.deviceIds) : [];
      if (p.accept && p.items) c.items = cleanItems(db, p.items);
      if (p.accept) need(keep.length || (c.items || []).length, 'Keep at least one device, or decline the request.');
      c.deviceIds.forEach(function (id) {
        var d = byId(db.devices, id); if (!d || d.pending !== c.id) return;
        if (keep.indexOf(id) < 0) { d.pending = ''; log(db, now, actor, d, p.accept ? 'Removed from request' : (own && !canKeep(actor) ? 'Request cancelled' : 'Request declined'), { checkoutId: c.id, note: p.note || '' }); }
      });
      c.decidedById = actor.id; c.decidedByName = actor.name; c.decidedTs = iso(now);
      if (!p.accept) { c.status = own && !canKeep(actor) ? 'Cancelled' : 'Declined'; touch(db, 'checkouts'); touch(db, 'devices'); return { ok: true }; }
      checkAvailable(db, c.items || []);
      var devs = keep.map(function (id) {
        var d = byId(db.devices, id); need(d && (d.pending === c.id || d.status === 'In Office'), 'A device in this request is no longer available.');
        need(!d.pending || d.pending === c.id || isPortion(d), devName(d) + ' is reserved in another request.');
        need(d.status === 'In Office' || isAdmin(actor), devName(d) + ' is not in the office (' + d.status + ').');
        return d;
      });
      c.deviceIds = keep.slice(); c.status = 'Approved'; c.ts = iso(now);
      if (p.note) c.note = [c.note, p.note].filter(Boolean).join(' — ');
      touch(db, 'checkouts');
      releaseCheckout(db, now, actor, c, devs, co);
      return { checkoutId: c.id };
    },

    /* Change a request while it waits: the requester or a lab keeper. Closed once approved. */
    checkoutEdit: function (db, actor, p, now) {
      var c = byId(db.checkouts, p.checkoutId); need(c && c.status === 'Pending', 'This request was already decided, so it cannot be changed.');
      need(canKeep(actor) || c.byId === actor.id, 'Only the person who sent the request or a lab keeper can change it.');
      var ids = (p.deviceIds || c.deviceIds).slice();
      var items = p.items ? cleanItems(db, p.items) : (c.items || []);
      need(ids.length || items.length, 'Keep at least one device or item, or cancel the request.');
      ids.forEach(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        if (c.deviceIds.indexOf(id) >= 0) return;
        need(d.status === 'In Office', devName(d) + ' is not in the office (' + d.status + ').');
        need(!d.pending || isPortion(d), devName(d) + ' is already reserved in another request.');
      });
      checkAvailable(db, items);
      c.deviceIds.forEach(function (id) {
        if (ids.indexOf(id) >= 0) return;
        var d = byId(db.devices, id); if (!d) return;
        if (d.pending === c.id) d.pending = '';
        log(db, now, actor, d, 'Removed from request', { checkoutId: c.id });
      });
      ids.forEach(function (id) {
        if (c.deviceIds.indexOf(id) >= 0) return;
        var d = byId(db.devices, id); if (!isPortion(d)) d.pending = c.id;
        log(db, now, actor, d, 'Added to request', { checkoutId: c.id });
      });
      c.deviceIds = ids; c.items = items;
      if (p.engineerIds && p.engineerIds.length) c.engineers = p.engineerIds.map(function (id) { var u = byId(db.users, id); need(u, 'Unknown engineer.'); return personRef(u); });
      if (p.expectedReturn !== undefined) c.expectedReturn = p.expectedReturn || '';
      if (p.note !== undefined) c.note = p.note || '';
      c.editedByName = actor.name; c.editedTs = iso(now);
      touch(db, 'checkouts'); touch(db, 'devices');
      return { checkoutId: c.id };
    },

    /* Jobs: a site supervisor (or the admin) opens one per client visit; every request goes inside a job. */
    saveJob: function (db, actor, p, now) {
      need(canJob(actor), 'Only a site supervisor or the admin can open or edit jobs.');
      var j = p.job || {}, ex = j.id ? byId(db.jobs, j.id) : null;
      if (!ex) {
        var co = byId(db.companies, j.companyId); need(co, 'Choose the company.');
        var y = new Date(now).getFullYear(), n = 0, pre = 'JOB-' + y + '-';
        db.jobs.forEach(function (x) { if (x.id.indexOf(pre) === 0) n = Math.max(n, parseInt(x.id.slice(pre.length), 10) || 0); });
        ex = { id: pre + pad(n + 1, 3), ts: iso(now), companyId: co.id, status: 'Open', byId: actor.id, byName: actor.name, closedTs: '' };
        db.jobs.push(ex);
      } else if (j.companyId && j.companyId !== ex.companyId) {
        need(!db.checkouts.some(function (c) { return c.jobId === ex.id && c.status !== 'Declined' && c.status !== 'Cancelled'; }), 'This job already has requests, so its company cannot change.');
        need(byId(db.companies, j.companyId), 'Choose the company.'); ex.companyId = j.companyId;
      }
      if (j.title !== undefined) ex.title = String(j.title || '').trim();
      if (j.note !== undefined) ex.note = String(j.note || '').trim();
      if (j.status === 'Closed' && ex.status !== 'Closed') { ex.status = 'Closed'; ex.closedTs = iso(now); }
      if (j.status === 'Open') { ex.status = 'Open'; ex.closedTs = ''; }
      touch(db, 'jobs');
      return { jobId: ex.id };
    },

    /* Lab keeper marks whether the data sheet of a receipt came back to the office (any time). */
    setDataSheet: function (db, actor, p, now) {
      need(canKeep(actor), 'Only a lab keeper can mark data sheets.');
      var c = byId(db.checkouts, p.checkoutId); need(c && (c.status === 'Approved' || !c.status), 'Receipt not found.');
      c.dataSheet = p.value === 'Yes' ? 'Yes' : 'No';
      c.dataSheetTs = iso(now); c.dataSheetById = actor.id; c.dataSheetByName = actor.name;
      touch(db, 'checkouts');
      return { ok: true };
    },

    /* Admin: wipe trial history — everything, or only the last N days. Devices keep where they are now. */
    eraseHistory: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can erase history.');
      var days = num(p.days), cut = days > 0 ? iso(now - days * 864e5) : '';
      function inRange(ts) { return !cut || String(ts || '') >= cut; }
      var live = {};
      db.devices.forEach(function (d) { if (d.checkoutId) live[d.checkoutId] = 1; if (d.pending) live[d.pending] = 1; });
      db.holdings.forEach(function (h) { if (h.checkoutId) live[h.checkoutId] = 1; });
      var n0 = db.movements.length;
      db.movements = db.movements.filter(function (m) { return !inRange(m.ts); });
      var c0 = db.checkouts.length;
      db.checkouts = db.checkouts.filter(function (c) { return live[c.id] || c.status === 'Pending' || !inRange(c.requestedTs || c.ts); });
      db.transfers = db.transfers.filter(function (t) { return t.status === 'Pending' || !inRange(t.ts); });
      var used = {}; db.checkouts.forEach(function (c) { if (c.jobId) used[c.jobId] = 1; });
      var j0 = db.jobs.length;
      db.jobs = db.jobs.filter(function (j) { return used[j.id] || !inRange(j.ts); });
      touch(db, 'movementsAll'); touch(db, 'checkouts'); touch(db, 'transfers'); touch(db, 'jobs');
      return { moves: n0 - db.movements.length, receipts: c0 - db.checkouts.length, jobs: j0 - db.jobs.length };
    },

    checkin: function (db, actor, p, now) {
      need(canKeep(actor), 'Only lab keepers can check devices in.');
      p.deviceIds = p.deviceIds || [];
      need(p.deviceIds.length || (p.items || []).length, 'Choose what came back.');
      (p.items || []).forEach(function (it) {
        var h = byId(db.holdings, it.holdingId); need(h, 'This item is no longer out.');
        var q = Math.min(num(it.qty), num(h.qty)); if (q <= 0) return;
        h.qty = num(h.qty) - q;
        db.movements.push({ id: 'M' + now + '-R' + db.movements.length, ts: iso(now), deviceId: 'ITEM:' + (h.stockId || h.name), action: 'Returned to office',
          status: 'In Office', companyId: h.companyId, holders: h.holders, byId: actor.id, byName: actor.name, checkoutId: h.checkoutId, note: q + ' × ' + h.name });
        touch(db, 'movements');
      });
      if ((p.items || []).length) { db.holdings = db.holdings.filter(function (h) { return num(h.qty) > 0; }); touch(db, 'holdings'); }
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
      p.deviceIds = p.deviceIds || [];
      var tItems = (p.items || []).map(function (it) {
        var h = byId(db.holdings, it.holdingId); need(h, 'This item is no longer out.');
        var q = num(it.qty); need(q > 0 && q <= num(h.qty), h.name + ': choose between 1 and ' + h.qty + '.');
        return { holdingId: h.id, stockId: h.stockId, name: h.name, group: h.group, qty: q };
      });
      need(p.deviceIds.length || tItems.length, 'Choose the devices.');
      var from = null;
      p.deviceIds.forEach(function (id) {
        var d = byId(db.devices, id); need(d, 'Unknown device.');
        need(d.status === 'At Client', devName(d) + ' is not at a client.');
        need(!d.pending, devName(d) + ' already has a transfer waiting.');
        from = from || d;
      });
      if (!from) { var h0 = byId(db.holdings, tItems[0].holdingId); from = { companyId: h0.companyId, holders: h0.holders }; }
      var t = {
        id: 'TR' + now, ts: iso(now), deviceIds: p.deviceIds.slice(), items: tItems,
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
      if (p.accept) (t.items || []).forEach(function (it) {
        var h = byId(db.holdings, it.holdingId); if (!h) return;
        var q = Math.min(num(it.qty), num(h.qty)); if (q <= 0) return;
        h.qty = num(h.qty) - q;
        db.holdings.push({ id: 'H' + now + '-T' + db.holdings.length, stockId: h.stockId, name: h.name, group: h.group, qty: q,
          companyId: t.toCompanyId, holders: [t.toEngineer], since: iso(now), checkoutId: h.checkoutId });
        db.movements.push({ id: 'M' + now + '-T' + db.movements.length, ts: iso(now), deviceId: 'ITEM:' + (h.stockId || h.name), action: 'Transferred',
          status: 'At Client', companyId: t.toCompanyId, holders: [t.toEngineer], byId: actor.id, byName: actor.name, checkoutId: h.checkoutId, note: q + ' × ' + h.name + ' to ' + t.toEngineer.name });
        db.holdings = db.holdings.filter(function (x) { return num(x.qty) > 0; });
        touch(db, 'holdings'); touch(db, 'movements');
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

    deleteCompany: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can remove companies.');
      var co = byId(db.companies, p.companyId); need(co, 'This company was not found. Refresh and try again.');
      var devs = db.devices.filter(function (d) { return d.active !== false && d.companyId === co.id; });
      need(!devs.length, co.name + ' still has ' + devs.length + ' device' + (devs.length > 1 ? 's' : '') + ' with it. Check them in first.');
      var hs = (db.holdings || []).filter(function (h) { return h.companyId === co.id && (+h.qty || 0) > 0; });
      need(!hs.length, co.name + ' still has loggers or kits with it. Check them in first.');
      var reqs = db.checkouts.filter(function (c) { return c.status === 'Pending' && c.companyId === co.id; });
      need(!reqs.length, 'There is a check-out request waiting for ' + co.name + '. Approve or decline it first.');
      var trs = db.transfers.filter(function (t) { return t.status === 'Pending' && (t.toCompanyId === co.id || t.fromCompanyId === co.id); });
      need(!trs.length, 'There is a transfer waiting for ' + co.name + '. Confirm or decline it first.');
      db.companies.splice(db.companies.indexOf(co), 1);
      touch(db, 'companies');
      return { ok: true };
    },

    saveUser: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can manage people.');
      var u = p.user || {}; need(u.name && String(u.name).trim(), 'Write the person\'s name.');
      need(ROLES.indexOf(u.role) >= 0, 'Choose a role.');
      var ex = u.id ? byId(db.users, u.id) : null, pin = null;
      /* Super admin: the safety account (e.g. the general manager). Only a super admin can change one,
       * except that an admin may create the very first super admin. */
      if (ex && isSuper(ex)) need(isSuper(actor), 'Only the super admin can change this account.');
      if (u.role === 'superadmin' && !isSuper(actor)) {
        var supers = db.users.filter(function (x) { return isSuper(x) && x.active !== false && (!ex || x.id !== ex.id); });
        need(!supers.length, 'Only the super admin can make another super admin.');
      }
      if (!ex) {
        ex = { id: 'U' + now }; pin = String(1000 + Math.floor(Math.random() * 9000));
        ex.pinHash = pinHash(ex.id, pin); ex.mustChange = true; db.users.push(ex);
      }
      if (ex.id === actor.id) need(u.role === actor.role && u.active !== false, 'You cannot change your own role or deactivate yourself.');
      ex.name = String(u.name).trim(); ex.role = u.role; ex.active = u.active !== false; ex.phone = u.phone != null ? u.phone : (ex.phone || '');
      touch(db, 'users');
      return { id: ex.id, pin: pin };
    },

    resetPin: function (db, actor, p) {
      need(isAdmin(actor), 'Only the admin can reset a PIN.');
      var u = byId(db.users, p.userId); need(u, 'Unknown person.');
      need(!isSuper(u) || isSuper(actor), 'Only the super admin can reset this PIN.');
      var pin = String(1000 + Math.floor(Math.random() * 9000));
      u.pinHash = pinHash(u.id, pin); u.mustChange = true; touch(db, 'users');
      return { pin: pin };
    },

    saveStock: function (db, actor, p, now) {
      need(isAdmin(actor), 'Only the admin can edit loggers, sensors and kits.');
      var it = p.item || {}; need(String(it.name || '').trim(), 'Write the item name.');
      var ex = it.id ? byId(db.stock, it.id) : null;
      if (!ex) { ex = { id: 'S' + now, note: '' }; db.stock.push(ex); }
      ex.name = String(it.name).trim(); ex.group = STOCK_GROUPS.indexOf(it.group) >= 0 ? it.group : 'Tools & Accessories';
      ex.total = it.total === '' || it.total == null ? '' : String(Math.max(0, num(it.total)));
      if (it.active === false) need(outQty(db, ex.id) === 0, 'Some of these are still out. Check them in first.');
      ex.active = it.active !== false;
      touch(db, 'stock');
      return { id: ex.id };
    },

    saveDevice: function (db, actor, p, now) {
      need(canKeep(actor), 'Only a lab keeper or the admin can edit devices.');
      var d = p.device || {}; need(d.description && d.serial, 'Description and serial number are required.');
      var ex = d.id ? byId(db.devices, d.id) : null;
      if (!isAdmin(actor)) { need(ex, 'Only the admin can add new devices.'); need(d.active !== false, 'Only the admin can remove a device.'); }
      if (!ex) {
        ex = { id: 'D' + now, status: 'In Office', companyId: '', holders: [], since: iso(now), expectedReturn: '', checkoutId: '', note: '', pending: '' };
        db.devices.push(ex);
      }
      ['category', 'manufacturer', 'description', 'model', 'serial', 'accuracy', 'resolution', 'range', 'calDate', 'calDue', 'certNo', 'certUrl', 'remarks'].forEach(function (k) {
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
    if (ensureStock(db)) db._touched.stock = true;
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
    ensureStock(db);
    var openTransfers = db.transfers.filter(function (t) { return t.status === 'Pending'; });
    var recentCheckouts = db.checkouts.slice(-300);
    var moves = db.movements.slice(-(opts.movements || 250));
    return {
      devices: db.devices.filter(function (d) { return d.active !== false; }),
      companies: db.companies,
      users: db.users.map(publicUser),
      transfers: openTransfers,
      checkouts: recentCheckouts,
      stock: db.stock.filter(function (x) { return x.active !== false; }),
      holdings: db.holdings,
      jobs: db.jobs,
      movements: moves,
      serverTime: opts.now ? iso(opts.now) : ''
    };
  }

  return {
    STATUSES: STATUSES, SERVICE: SERVICE, ROLES: ROLES, apply: apply, snapshot: snapshot, isCoReq: isCoReq, isPortion: isPortion, STOCK_GROUPS: STOCK_GROUPS,
    pinHash: pinHash, serialTail: serialTail, verify: verify, publicUser: publicUser
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
