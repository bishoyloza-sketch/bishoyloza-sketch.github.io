/* ================= one flow: step bar from the company to the certificates ================= */
var FLOW = [['company', 'Company'], ['dept', 'Department'], ['type', 'Order type'], ['order', 'Order'], ['items', 'Items'], ['certs', 'Old certs'], ['refs', 'References'], ['det', 'Details'], ['read', 'Readings'], ['gen', 'Certificates']];
var FIDX = {}; FLOW.forEach(function (f, i) { FIDX[f[0]] = i; });
function curStep(p) { return p.stage !== 'done' ? p.stage : (p.tab || 'certs'); }
function reach(p) { var i = FIDX[curStep(p)]; if (!(p.reached >= i)) p.reached = i; return p.reached; }
function stepBar(p) { var cur = FIDX[curStep(p)], r = reach(p);
  return '<div class="stepbar" id="stepbar">' + FLOW.map(function (f, i) { var cls = i === cur ? 'on' : (i <= r ? 'ok' : '');
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
  var run = function () { var q = st.q.trim(); if (q.length < 2) { st.res = []; renderSheet(); return; } st.busy = true; renderSheet();
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
    '<div class="search">' + I.search + '<input id="fq" placeholder="Type a code or part of it – e.g. QIII or PR30-0" value="' + esc(st.q) + '" autocomplete="off"></div>' +
    (!spOn() ? '<div class="note warnbox">SharePoint is not connected.</div>' : st.err ? '<div class="note warnbox">' + esc(st.err) + '</div>' : st.busy ? '<div class="empty"><span class="spin dark"></span><b style="margin-top:10px">Searching the old certificates…</b></div>'
      : st.q.trim().length < 2 ? '<div class="small">Searches all old certificates on SharePoint. This company\'s come first.</div>'
      : st.res.length ? '<div class="list">' + st.res.map(function (r, i) { var have = p.items.some(function (x) { return norm(x.code) === norm(r.code); });
          return '<button class="row" data-fr="' + i + '"' + (have ? ' disabled style="opacity:.5"' : '') + '><span class="t"><b>' + esc(r.code) + (r.desc ? ' · ' + esc(r.desc) : '') + '</b><small>' + esc([r.certNo, r.folder].filter(Boolean).join(' · ')) + '</small></span>' + (have ? '<span class="pill">Added</span>' : r.mine ? '<span class="pill" style="--s-fg:var(--office);--s-bg:var(--office-soft)">This company</span>' : '<span class="pill" style="--s-fg:var(--muted);--s-bg:var(--oos-soft)">Other company</span>') + '</button>'; }).join('') + '</div>'
      : '<div class="empty"><b>Not found</b>Try fewer letters, or add it with “Add an item”.</div>'),
    foot: '<button class="btn" id="fDone">Done</button>',
    mount: function () { var i = $('#fq'); i.focus(); var pos = st.q.length; try { i.setSelectionRange(pos, pos); } catch (e) {}
      i.oninput = function () { st.q = i.value; clearTimeout(timer); timer = setTimeout(run, 450); };
      $$('[data-fr]').forEach(function (b) { b.onclick = function () { var r = st.res[+b.dataset.fr];
        p.items.push(newItem({ code: r.code, description: r.desc, manufacturer: r.man, prevCert: r.certNo, src: 'find', dept: p.depts[0] || '' })); saveProjects(); toast(r.code + ' added'); renderSheet(); }; });
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
