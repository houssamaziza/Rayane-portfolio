/* Rayane — portfolio d'architecture. Application web (PWA) sans framework.
 * Données : /api/content (Worker + D1). Fichiers : /media/* (R2). Photos d'exemple : Unsplash (4K).
 */
(function () {
'use strict';

/* ---------------------------------------------------------------- state */
let S = { site: {}, projects: [] };
const ui = { view: 'boot', id: null, filter: 'Tous', q: '', search: false, menu: false, admin: false, admTab: 'projects', open: null, confirm: null, busy: false, step: 1, up: null, history: 0, slide: 0 };
let layout = 'grid';
try { layout = localStorage.getItem('rp-layout') || 'grid'; } catch (_) {}
let draft = null, draftAdded = [], setDraft = null, setAdded = [];
let pdfState = null, lightbox = null, slideTimer = null;

const $app = document.getElementById('app'), $layer = document.getElementById('layer');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- API */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'x-requested-with': 'portfolio' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let r;
  try { r = await fetch(path, { method, headers, credentials: 'same-origin', body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch (e) { throw new Error('Connexion impossible. Vérifiez votre réseau.'); }
  let d = null; try { d = await r.json(); } catch (_) {}
  if (!r.ok) { const e = new Error((d && d.error) || 'Erreur ' + r.status); e.status = r.status; if (r.status === 401) ui.admin = false; throw e; }
  return d;
}
function upload(blob, name, onProgress, previewFor) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/media');
    x.setRequestHeader('content-type', blob.type || 'application/octet-stream');
    x.setRequestHeader('x-filename', encodeURIComponent(name || 'fichier'));
    x.setRequestHeader('x-requested-with', 'portfolio');
    if (previewFor) x.setRequestHeader('x-preview-for', previewFor);
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (_) {} if (x.status < 300) resolve(d); else reject(Object.assign(new Error(d.error || "L'envoi a échoué."), { status: x.status })); };
    x.onerror = () => reject(new Error("Connexion perdue pendant l'envoi."));
    x.send(blob);
  });
}
const dropMedia = (url) => { if (url && url.startsWith('/media/')) api('/api/media/' + url.slice(7), { method: 'DELETE' }).catch(() => {}); };

/* ---------------------------------------------------------------- icons */
const P = {
  menu: '<path d="M4 8h16M4 16h16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUR: '<path d="M7 17 17 7M8 7h9v9"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
  edit: '<path d="M15.5 5.5l3 3L8 19H5v-3z"/>',
  logout: '<path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>'
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ---------------------------------------------------------------- images (4K, responsive) */
const UNSPLASH = /^https:\/\/images\.unsplash\.com\//;
const isUpload = (u) => /^\/media\/.+\.(jpe?g|png|webp)$/i.test(u);
const previewOf = (u) => u.replace(/(\.[a-z0-9]+)$/i, '.m$1');
function srcAt(u, w) {
  if (UNSPLASH.test(u)) return `${u}?w=${w}&q=${w >= 2400 ? 75 : 80}&auto=format&fit=max`;
  if (isUpload(u) && w <= 1280) return previewOf(u);
  return u;
}
function srcset(u) {
  if (UNSPLASH.test(u)) return [640, 1080, 1600, 2400, 3840].map((w) => `${srcAt(u, w)} ${w}w`).join(', ');
  if (isUpload(u)) return `${previewOf(u)} 1280w, ${u} 3840w`;
  return '';
}
function pic(u, { sizes = '100vw', alt = '', cls = '', eager = false, w = 1600 } = {}) {
  if (!u) return '';
  const ss = srcset(u);
  const fallback = isUpload(u) ? ` onerror="if(this.srcset){this.removeAttribute('srcset');this.src='${esc(u)}'}"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(srcAt(u, w))}"${ss ? ` srcset="${esc(ss)}" sizes="${sizes}"` : ''} alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${fallback}>`;
}
// Photo plein écran en object-fit: cover : sur un écran vertical, l'image affichée fait 1,5 × la hauteur
const FULL = '(max-aspect-ratio: 3/2) 150svh, 100vw';
const phCache = new Map();
function ph(seed) {
  if (phCache.has(seed)) return phCache.get(seed);
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const gy = 560, x0 = 140 + r() * 240, w = 520 + r() * 280, top = 260 + r() * 80, f = Math.round;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#d9d9d5"/><rect y="${gy}" width="1200" height="240" fill="#c6c5bf"/><rect x="${f(x0)}" y="${f(top)}" width="${f(w)}" height="${f(gy - top)}" fill="#b0ada6"/><rect x="${f(x0 - 40)}" y="${f(top - 24)}" width="${f(w + 120)}" height="24" fill="#c2bfb8"/><rect x="${f(x0 + 60)}" y="${f(top + 50)}" width="${f(w * 0.5)}" height="${f(gy - top - 50)}" fill="#4a5155"/></svg>`;
  const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); phCache.set(seed, u); return u;
}

/* ---------------------------------------------------------------- selectors */
const imgsOf = (p) => (p.images && p.images.length ? p.images : [ph(p.id)]);
const cover = (p) => imgsOf(p)[0];
const pub = () => S.projects.filter((p) => p.published);
const cats = () => { const set = new Set(S.site.categories || []); S.projects.forEach((p) => p.category && set.add(p.category)); return [...set]; };
const byId = (id) => S.projects.find((p) => p.id === id);
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b / 1024)) + ' Ko');
const href = (p) => '#/projet/' + encodeURIComponent(p.id);

/* ---------------------------------------------------------------- routing (#/…) */
const ROUTES = { '': 'home', projets: 'projects', projet: 'project', 'a-propos': 'about', contact: 'contact', admin: 'admin' };
const HASH = { home: '#/', projects: '#/projets', about: '#/a-propos', contact: '#/contact', admin: '#/admin' };
function go(hash) { if (location.hash === hash) route(); else { ui.history++; location.hash = hash; } }
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const prev = ui.view;
  let view = ROUTES[parts[0]] || 'home', id = parts[1] || null;
  if (view === 'admin') {
    const sub = parts[1]; id = parts[2] || null;
    if (sub === 'site') ui.admTab = 'site';
    else if (sub === 'nouveau' || sub === 'modifier') view = 'wizard';
    else if (sub === 'publie') view = 'done';
    else ui.admTab = 'projects';
    if (view === 'wizard') {
      if (sub === 'nouveau' && (!draft || !draft.isNew)) startDraft(null);
      if (sub === 'modifier' && (!draft || draft.id !== id)) { const p = byId(id); if (p) startDraft(p); else view = 'admin'; }
    }
  }
  if (prev === 'wizard' && view !== 'wizard' && draft) discardDraft();
  if (!(prev === 'admin' && view === 'admin')) setDraft = null;
  ui.view = view; ui.id = id; ui.menu = false; ui.open = null; ui.confirm = null; ui.search = ui.search && view === 'projects';
  if (pdfState) closePdf();
  lightbox = null;
  const paint = () => { render(); window.scrollTo(0, 0); };
  if (document.startViewTransition && !reduced && prev !== 'boot') document.startViewTransition(paint); else paint();
}
window.addEventListener('hashchange', route);

const TABS = [['home', 'Accueil', 'home'], ['projects', 'Projets', 'grid'], ['about', 'À propos', 'user'], ['contact', 'Contact', 'mail']];
const tabOf = (v) => ({ project: 'projects', wizard: 'admin', done: 'admin' }[v] || v);
const overPhoto = () => ui.view === 'home' || ui.view === 'project';

function header() {
  const cur = tabOf(ui.view), isAdm = cur === 'admin';
  const tools = [];
  if (ui.view === 'projects') tools.push(`<button class="iconbtn" data-a="search" aria-label="Rechercher">${ic('search')}</button>`);
  if (isAdm && ui.admin) tools.push(`<button class="iconbtn" data-a="logout" aria-label="Se déconnecter" title="Se déconnecter">${ic('logout')}</button>`);
  tools.push(`<button class="iconbtn only-m" data-a="menu" aria-label="Menu">${ic('menu')}</button>`);
  return `<header class="hdr ${overPhoto() ? 'over' : 'solid'}" id="hdr"><div class="wrap gut row">
    <div style="display:flex;align-items:center;gap:6px;margin-left:-10px">${ui.view === 'project' ? `<button class="iconbtn" data-a="back" aria-label="Retour">${ic('back')}</button>` : ''}<a class="brand" href="#/" style="${ui.view === 'project' ? '' : 'margin-left:10px'}">${esc(S.site.name || 'Portfolio')}<small>${esc(S.site.role || '')}</small></a></div>
    <nav class="nav" aria-label="Navigation">${TABS.slice(1).map((t) => `<a href="${HASH[t[0]]}" ${cur === t[0] ? 'aria-current="page"' : ''}>${t[1]}</a>`).join('')}${ui.admin ? `<a href="#/admin" ${isAdm ? 'aria-current="page"' : ''}>Admin</a>` : ''}</nav>
    <div class="tools">${tools.join('')}</div></div></header>`;
}
function dock() {
  const cur = tabOf(ui.view);
  return `<nav class="dock" aria-label="Navigation">${TABS.map((t) => `<a href="${HASH[t[0]]}" ${cur === t[0] ? 'aria-current="page"' : ''}>${ic(t[2])}<span>${t[1]}</span></a>`).join('')}</nav>`;
}
function footer() {
  const s = S.site, y = new Date().getFullYear();
  return `<footer class="foot-cta wrap gut">
    <span class="mono muted">Contact</span>
    <a href="#/contact" class="xl big" style="margin-top:14px">Parlons de<br>votre projet</a>
    ${s.email ? `<a class="mail" href="mailto:${esc(s.email)}">${esc(s.email)} ${ic('arrowUR')}</a>` : ''}
    <div class="foot-bar mono"><span>© ${y} ${esc(s.name)} — ${esc(s.role)}${s.location ? ' · ' + esc(s.location) : ''}</span>
      <nav>${TABS.slice(1).map((t) => `<a href="${HASH[t[0]]}">${t[1]}</a>`).join('')}<a href="#/admin">Espace privé</a></nav></div>
  </footer><div class="dock-space"></div>`;
}

/* ---------------------------------------------------------------- public views */
function slides() {
  const list = [];
  if (S.site.heroImage) list.push({ img: S.site.heroImage, p: null });
  pub().filter((p) => p.images && p.images.length).slice(0, list.length ? 3 : 4).forEach((p) => list.push({ img: cover(p), p }));
  if (!list.length) list.push({ img: ph('hero'), p: null });
  return list;
}
function vHome() {
  const s = S.site, sl = slides(), all = pub(), feat = all.slice(0, 4);
  const i = ui.slide % sl.length, cur = sl[i];
  const years = all.map((p) => parseInt(p.year, 10)).filter((n) => n > 1900);
  const usedCats = new Set(all.map((p) => p.category).filter(Boolean));
  const firstPara = (s.aboutText || '').split(/\n\s*\n/)[0];
  return `<section class="hero" aria-label="Présentation">
      ${sl.map((x, k) => `<div class="slide ${k === i ? 'on' : ''}" data-k="${k}">${x.img.startsWith('data:') ? `<img src="${x.img}" alt="">` : pic(x.img, { eager: k === 0, w: 2400, sizes: FULL })}</div>`).join('')}
      <div class="kick mono">${esc(s.heroKicker).split('\n').join('<br>')}</div>
      <div class="in wrap gut">
        <h1 class="vh">${esc(s.name)} — ${esc(s.role)}</h1>
        <p class="tagline">${esc(s.tagline)}</p>
        <div class="foot">
          <div class="now" id="now">${nowLabel(cur, i, sl.length)}</div>
          ${sl.length > 1 ? `<div class="bars" role="tablist" aria-label="Diapositives">${sl.map((_, k) => `<button data-a="slide" data-k="${k}" class="${k === i ? 'on' : k < i ? 'done' : ''}" aria-label="Image ${k + 1}"><span><i></i></span></button>`).join('')}</div>` : ''}
        </div>
      </div>
    </section>
    <section class="sec wrap gut"><div class="statement-row"><span class="mono muted">— Approche</span>
      <div><p class="statement">${esc(firstPara)}</p><p style="margin-top:28px"><a class="arrow-link" href="#/a-propos">En savoir plus ${ic('arrow')}</a></p></div></div></section>
    <section class="sec wrap gut">
      <div class="sec-h"><h2 class="xl">Projets</h2><a class="arrow-link" href="#/projets">Tout voir <span class="mono">(${pad(all.length)})</span> ${ic('arrow')}</a></div>
      ${feat.length ? `<div class="feat">${feat.map((p, k) => `<a href="${href(p)}"><div class="img">${pic(cover(p), { sizes: '(min-width:900px) 60vw, 100vw', alt: p.title })}</div>
        <div class="cap"><span class="mono muted">${pad(k + 1)}</span><h3>${esc(p.title)}</h3><span class="mono muted">${esc(p.year)}</span></div></a>`).join('')}</div>` : '<div class="empty">Aucun projet publié pour le moment.</div>'}
    </section>
    ${all.length ? `<section class="sec wrap gut"><div class="figures">
      <div><span class="mono muted">Projets</span><b>${pad(all.length)}</b></div>
      <div><span class="mono muted">Catégories</span><b>${pad(usedCats.size)}</b></div>
      <div><span class="mono muted">Depuis</span><b>${years.length ? Math.min(...years) : '—'}</b></div></div></section>` : ''}
    ${footer()}`;
}
function nowLabel(cur, i, n) {
  if (cur.p) return `<span class="mono">${pad(i + 1)} / ${pad(n)}</span><b>${esc(cur.p.title)}</b><a href="${href(cur.p)}">Voir le projet ${ic('arrow')}</a>`;
  return `<span class="mono">${pad(i + 1)} / ${pad(n)}</span><a href="#/projets">Découvrir les projets ${ic('arrow')}</a>`;
}
function startSlides() {
  clearInterval(slideTimer);
  if (ui.view !== 'home' || reduced) return;
  const n = slides().length; if (n < 2) return;
  slideTimer = setInterval(() => showSlide((ui.slide + 1) % n), 6000);
}
function showSlide(k) {
  const sl = slides(); ui.slide = k;
  document.querySelectorAll('.hero .slide').forEach((el) => el.classList.toggle('on', +el.dataset.k === k));
  document.querySelectorAll('.bars button').forEach((b) => { const j = +b.dataset.k; b.className = j === k ? 'on' : j < k ? 'done' : ''; });
  const now = document.getElementById('now'); if (now) now.innerHTML = nowLabel(sl[k], k, sl.length);
}
function card(p) {
  return `<a class="card" href="${href(p)}"><div class="img">${pic(cover(p), { sizes: '(min-width:700px) 50vw, 100vw', alt: p.title })}${p.example ? '<span class="tag mono">Exemple</span>' : ''}</div>
    <div class="cap"><div><h3>${esc(p.title)}</h3><div class="mono muted" style="margin-top:6px">${esc(p.category)}${p.location ? ' · ' + esc(p.location) : ''}</div></div><span class="mono">${esc(p.year)}</span></div></a>`;
}
function vProjects() {
  const q = ui.q.trim().toLowerCase(), all = pub();
  let list = all;
  if (ui.filter !== 'Tous') list = list.filter((p) => p.category === ui.filter);
  if (q) list = list.filter((p) => [p.title, p.location, p.category, p.year, p.description].join(' ').toLowerCase().includes(q));
  const used = cats().filter((c) => all.some((p) => p.category === c));
  const count = (c) => (c === 'Tous' ? all.length : all.filter((p) => p.category === c).length);
  const body = !list.length ? `<div class="empty">Aucun projet ne correspond${q ? ` à « ${esc(ui.q)} »` : ''}.</div>`
    : layout === 'list' ? `<div class="list">${list.map((p, k) => `<a href="${href(p)}"><span class="mono muted">${pad(k + 1)}</span><h3>${esc(p.title)}</h3><span class="meta"><span class="mono">${esc(p.year)}</span><span class="mono muted">${esc(p.category)}</span></span>${pic(cover(p), { cls: 'thumb', sizes: '260px', w: 640 })}</a>`).join('')}</div>`
    : `<div class="grid">${list.map(card).join('')}</div>`;
  return `<div class="pad-top"><div class="wrap gut">
    <div class="idx-head"><h1 class="xl">Projets<sup>(${pad(all.length)})</sup></h1></div>
    ${ui.search ? `<div class="searchbar"><input id="q" type="search" placeholder="Rechercher un projet, un lieu…" value="${esc(ui.q)}" aria-label="Rechercher"></div>` : ''}
    <div class="toolbar"><div class="filters" role="group" aria-label="Catégories">${['Tous', ...used].map((c) => `<button data-a="filter" data-c="${esc(c)}" aria-pressed="${ui.filter === c}">${esc(c)}<sup>${pad(count(c))}</sup></button>`).join('')}</div>
      <div class="viewtog" role="group" aria-label="Affichage"><button data-a="layout" data-l="grid" aria-pressed="${layout === 'grid'}">Grille</button><button data-a="layout" data-l="list" aria-pressed="${layout === 'list'}">Liste</button></div></div>
    ${body}
  </div>${footer()}</div>`;
}
function vProject() {
  const p = byId(ui.id);
  if (!p || (!p.published && !ui.admin)) return `<div class="pad-top wrap gut"><div class="empty">Ce projet n'existe pas ou n'est plus en ligne.<br><br><a class="arrow-link" href="#/projets">Voir tous les projets ${ic('arrow')}</a></div></div>`;
  const all = pub(), idx = all.findIndex((x) => x.id === p.id), nxt = all.length > 1 ? all[(idx + 1) % all.length] : null;
  const im = imgsOf(p);
  const spec = [['Catégorie', p.category], ['Année', p.year], ['Lieu', p.location], ['Images', im.length && p.images.length ? pad(p.images.length) : '']].filter((r) => r[1]);
  return `<section class="p-hero">${im[0].startsWith('data:') ? `<img src="${im[0]}" alt="">` : pic(im[0], { eager: true, w: 2400, alt: p.title, sizes: FULL })}
      <div class="in wrap gut"><div class="row mono">${idx >= 0 ? `<span>${pad(idx + 1)} / ${pad(all.length)}</span>` : ''}<span>${esc(p.category)}</span><span>${esc(p.year)}</span>${p.location ? `<span>${esc(p.location)}</span>` : ''}${p.example ? '<span>Exemple</span>' : ''}${!p.published ? '<span>Masqué</span>' : ''}</div>
      <h1 class="xl">${esc(p.title)}</h1></div>
      <span class="scroll-hint mono">${ic('down')}</span></section>
    <div class="wrap gut"><div class="p-body">
      <aside class="p-side">
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
        <dl class="spec">${spec.map(([k, v]) => `<div><dt class="mono muted">${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${p.pdf ? `<button class="pdf-btn" data-a="pdf" data-id="${esc(p.id)}"><span class="pdficon">PDF</span><span style="flex:1;min-width:0"><b style="font-weight:500;display:block">Dossier du projet</b><span class="mono muted">${esc(p.pdf.name)}${p.pdf.size ? ' · ' + fmtSize(p.pdf.size) : ''}</span></span>${ic('arrow')}</button>` : ''}
        ${ui.admin ? `<p style="margin-top:20px"><a class="btn sec sm" href="#/admin/modifier/${encodeURIComponent(p.id)}">${ic('edit')} Modifier</a></p>` : ''}
      </aside>
      <div class="p-gal">${im.map((u, i) => `<button data-a="lb" data-i="${i}" aria-label="Agrandir l'image ${i + 1}">${u.startsWith('data:') ? `<img src="${u}" alt="">` : pic(u, { sizes: '(min-width:1000px) 58vw, 100vw', alt: `${p.title} — image ${i + 1}` })}</button>`).join('')}</div>
    </div></div>
    ${nxt ? `<a class="next" href="${href(nxt)}">${pic(cover(nxt), { w: 2400, sizes: FULL })}<div class="in wrap gut"><span class="mono">Projet suivant</span><h2 class="xl">${esc(nxt.title)}</h2></div></a>` : ''}
    ${footer()}`;
}
function contactItems() {
  const s = S.site, it = [];
  if (s.email) it.push(['E-mail', s.email, 'mailto:' + s.email]);
  if (s.phone) it.push(['Téléphone', s.phone, 'tel:' + s.phone.replace(/[^\d+]/g, '')]);
  if (s.instagram) { const h = s.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''); it.push(['Instagram', '@' + h, 'https://instagram.com/' + h]); }
  if (s.linkedin) { const v = s.linkedin.replace(/^https?:\/\/(www\.)?/, ''); it.push(['LinkedIn', v, 'https://' + v]); }
  if (s.location) it.push(['Studio', s.location, null]);
  return it;
}
function contactList() {
  const it = contactItems();
  if (!it.length) return `<p class="muted">Les coordonnées seront bientôt disponibles.</p>`;
  return `<div class="clist">${it.map(([k, v, h]) => `<div class="citem"><span class="mono muted">${k}</span><div class="v">${h ? `<a href="${esc(h)}" ${h.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(v)}</a>` : esc(v)}</div>${h ? `<button class="iconbtn" data-a="copy" data-t="${esc(v)}" aria-label="Copier">${ic('copy')}</button>` : '<span></span>'}</div>`).join('')}</div>`;
}
function vAbout() {
  const s = S.site;
  return `<div class="pad-top"><div class="wrap gut about"><h1 class="xl">À propos</h1>
    <div class="about-grid">${s.aboutImage ? pic(s.aboutImage, { cls: 'portrait', sizes: '(min-width:1000px) 40vw, 100vw', alt: '' }) : '<div></div>'}
    <div class="txt">${(s.aboutText || '').split(/\n\s*\n/).map((t) => `<p>${esc(t)}</p>`).join('')}${contactList()}</div></div></div>${footer()}</div>`;
}
function vContact() {
  const s = S.site;
  return `<div class="pad-top"><div class="wrap gut about"><div><span class="mono muted">${esc(s.role)} · ${esc(s.name)}</span><h1 class="xl" style="margin-top:14px">Contact</h1>
    ${s.email ? `<a class="contact-big" href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : `<p class="statement" style="margin-top:20px">Pour un projet, une collaboration ou une demande d'information.</p>`}</div>
    ${contactList()}</div><div class="dock-space"></div></div>`;
}

/* ---------------------------------------------------------------- admin */
function vLogin() {
  return `<div class="gut"><div class="login"><span class="lock mono">${ic('lock')} Espace privé</span><h1 class="xl">Connexion</h1>
    <p class="muted" style="margin:0">Entrez le mot de passe pour gérer les projets et le contenu du site.</p>
    <form id="login-form"><div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <div class="err" id="login-err" role="alert"></div>
    <button class="btn pri block" type="submit" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span>' : ''} Se connecter</button></form></div></div><div class="dock-space"></div>`;
}
function vAdmin() {
  if (!ui.admin) return vLogin();
  const head = `<div class="adm-head"><div><span class="lock mono">${ic('lock')} Espace privé</span><h1 class="xl">${ui.admTab === 'projects' ? 'Mes projets' : 'Contenu'}</h1></div>
    ${ui.admTab === 'projects' ? `<a class="btn pri sm" href="#/admin/nouveau">${ic('plus')} Ajouter un projet</a>` : ''}</div>
    <nav class="seg"><a href="#/admin" ${ui.admTab === 'projects' ? 'aria-current="page"' : ''}>Projets</a><a href="#/admin/site" ${ui.admTab === 'site' ? 'aria-current="page"' : ''}>Textes et images</a></nav>`;
  if (ui.admTab === 'site') return `<div class="adm wrap gut">${head}${vSettings()}</div><div class="dock-space"></div>`;
  const rows = S.projects.map((p, i) => {
    const st = p.example ? ['ex', p.published ? 'Exemple publié' : 'Exemple masqué'] : p.published ? ['ok', 'Publié'] : ['off', 'Masqué'];
    let extra = '';
    if (ui.confirm === p.id) extra = `<div class="confirm"><span>Supprimer « ${esc(p.title)} » et ses fichiers ?</span><button class="btn danger sm" data-a="del" data-id="${esc(p.id)}" ${ui.busy ? 'disabled' : ''}>Supprimer</button><button class="btn sec sm" data-a="nodel">Annuler</button></div>`;
    else if (ui.open === p.id) extra = `<div class="rowmenu">
      <a class="btn sec sm" href="#/admin/modifier/${encodeURIComponent(p.id)}">${ic('edit')} Modifier</a>
      <button class="btn sec sm" data-a="toggle" data-id="${esc(p.id)}" ${ui.busy ? 'disabled' : ''}>${p.published ? 'Masquer' : 'Publier'}</button>
      <button class="btn sec sm" data-a="move" data-id="${esc(p.id)}" data-d="-1" ${i === 0 || ui.busy ? 'disabled' : ''}>Monter</button>
      <button class="btn sec sm" data-a="move" data-id="${esc(p.id)}" data-d="1" ${i === S.projects.length - 1 || ui.busy ? 'disabled' : ''}>Descendre</button>
      <button class="btn sec sm" data-a="askdel" data-id="${esc(p.id)}" style="color:var(--danger)">Supprimer</button></div>`;
    const c = cover(p);
    return `<div class="prow">${c.startsWith('data:') ? `<img src="${c}" alt="">` : pic(c, { sizes: '76px', w: 640 })}<div style="min-width:0"><a class="t" href="${href(p)}">${esc(p.title)}</a><div class="mono muted">${esc(p.category)} · ${esc(p.year)}</div><div class="status ${st[0]}">${st[1]}</div></div>
      <button class="iconbtn" data-a="rowmenu" data-id="${esc(p.id)}" aria-label="Actions pour ${esc(p.title)}" aria-expanded="${ui.open === p.id}">${ic('more')}</button></div>${extra}`;
  }).join('');
  return `<div class="adm wrap gut">${head}
    ${S.projects.some((p) => p.example) ? `<div class="note">Les projets marqués « Exemple » montrent la mise en page avec des photos libres de droits. Supprimez-les quand vos premiers projets sont en ligne.</div>` : ''}
    ${S.projects.length ? `<div class="plist">${rows}</div>` : `<div class="empty">Aucun projet. Ajoutez le premier.</div>`}</div><div class="dock-space"></div>`;
}
function steps(n) { return `<div class="steps">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`; }
function progressBar() { return ui.up ? `<div class="hint" style="margin-top:14px">Envoi ${ui.up.done + 1} / ${ui.up.total}…</div><div class="progress"><span style="width:${Math.round(ui.up.pct * 100)}%"></span></div>` : ''; }
function thumb(u) { return u.startsWith('data:') ? `<img src="${u}" alt="">` : pic(u, { sizes: '120px', w: 640 }); }
function vWizard() {
  if (!ui.admin) return vLogin();
  if (!draft) return vAdmin();
  const d = draft, step = ui.step, uploading = !!ui.up;
  const titles = { 1: d.isNew ? 'Nouveau projet' : 'Modifier le projet', 2: 'Photos', 3: 'Dossier PDF' };
  const lead = step === 1 ? `<button class="iconbtn" data-a="wcancel" aria-label="Annuler">${ic('close')}</button>` : `<button class="iconbtn" data-a="wstep" data-s="${step - 1}" aria-label="Étape précédente">${ic('back')}</button>`;
  const act = step < 3 ? `<button class="btn pri sm" data-a="wstep" data-s="${step + 1}" ${uploading ? 'disabled' : ''}>Suivant</button>` : `<button class="btn pri sm" data-a="wsave" ${ui.busy || uploading ? 'disabled' : ''}>${d.isNew ? 'Publier' : 'Enregistrer'}</button>`;
  let body = '';
  if (step === 1) {
    const cs = cats(), known = cs.includes(d.category);
    body = `<div class="field"><label for="f-title">Titre du projet</label><input id="f-title" data-f="title" value="${esc(d.title)}" placeholder="Villa du Lac" autocomplete="off"></div>
      <div class="two"><div class="field"><label for="f-cat">Catégorie</label><select id="f-cat" data-f="category">${cs.map((c) => `<option ${c === d.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new" ${known ? '' : 'selected'}>+ Nouvelle catégorie…</option></select></div>
      <div class="field"><label for="f-year">Année</label><input id="f-year" data-f="year" value="${esc(d.year)}" inputmode="numeric" maxlength="4" placeholder="${new Date().getFullYear()}"></div></div>
      <div class="field" id="newcat" ${known ? 'hidden' : ''}><label for="f-newcat">Nom de la nouvelle catégorie</label><input id="f-newcat" value="${known ? '' : esc(d.category)}" placeholder="Patrimoine, Intérieur…"></div>
      <div class="field"><label for="f-loc">Localisation (optionnel)</label><input id="f-loc" data-f="location" value="${esc(d.location)}" placeholder="Ville, pays"></div>
      <div class="field"><label for="f-desc">Description</label><textarea id="f-desc" data-f="description" placeholder="Le parti architectural, le site, les matériaux…">${esc(d.description)}</textarea></div>
      <label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox" id="f-pub" data-f="published" ${d.published ? 'checked' : ''}> Visible sur le site</label>`;
  } else if (step === 2) {
    body = `<label class="drop" id="drop" for="f-imgs">${ic('image')}<b>Ajouter des photos</b><span class="hint">Depuis l'iPhone ou par glisser-déposer. Envoyées en haute définition (jusqu'à 4K). La première sert de couverture.</span></label>
      <input id="f-imgs" type="file" accept="image/*" multiple hidden>${progressBar()}
      <div class="imgs">${d.images.map((u, i) => `<div class="it">${thumb(u)}${i === 0 ? '<span class="cover">Couverture</span>' : ''}
        <button class="x" data-a="imgdel" data-i="${i}" aria-label="Retirer l'image">${ic('close')}</button>
        <div class="mv"><button data-a="imgmv" data-i="${i}" data-d="-1" aria-label="Avancer" ${i === 0 ? 'hidden' : ''}>${ic('back')}</button><span></span><button data-a="imgmv" data-i="${i}" data-d="1" aria-label="Reculer" ${i === d.images.length - 1 ? 'hidden' : ''}>${ic('next')}</button></div></div>`).join('')}
        ${d.images.length ? `<label class="it" for="f-imgs" style="display:grid;place-items:center;cursor:pointer" aria-label="Ajouter">${ic('plus')}</label>` : ''}</div>`;
  } else {
    body = `<label class="drop" for="f-pdf"><span class="pdficon">PDF</span><b>Ajouter le dossier (PDF)</b><span class="hint">Depuis l'app Fichiers ou iCloud Drive. Optionnel, 60 Mo maximum.</span></label>
      <input id="f-pdf" type="file" accept="application/pdf,.pdf" hidden>${progressBar()}
      ${d.pdf ? `<div class="filecard"><span class="pdficon">PDF</span><div style="min-width:0"><div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.pdf.name)}</div><div class="mono muted">${fmtSize(d.pdf.size || 0)}</div></div><button class="iconbtn" data-a="pdfdel" aria-label="Retirer le PDF">${ic('close')}</button></div>` : ''}
      <div class="actions"><button class="btn pri" data-a="wsave" ${ui.busy || uploading ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span> Publication…' : d.isNew ? 'Publier le projet' : 'Enregistrer les modifications'}</button></div>`;
  }
  return `<div class="sheet gut"><div class="wbar">${lead}<h1>${titles[step]}</h1>${act}</div>${steps(step)}${body}</div><div class="dock-space"></div>`;
}
function vDone() {
  if (!ui.admin) return vLogin();
  const p = byId(ui.id);
  return `<div class="gut"><div class="done"><div class="ck">${ic('check')}</div><h1 class="xl">${ui.doneMsg || 'Publié'}</h1><p class="muted">${p && p.published ? 'Le projet est visible dans le portfolio.' : 'Les modifications sont enregistrées.'}</p>
    ${p ? `<a class="btn pri" href="${href(p)}">Voir le projet</a>` : ''}<a class="btn sec" href="#/admin/nouveau">Ajouter un autre projet</a><a class="btn ghost" href="#/admin">Tableau de bord</a></div></div>`;
}
function vSettings() {
  const d = setDraft || (setDraft = JSON.parse(JSON.stringify(S.site)));
  const pick = (k, label) => `<div class="imgpick">${d[k] ? thumb(d[k]) : `<img src="${ph(k)}" alt="">`}<div><div style="font-weight:500;font-size:14px">${label}</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><label class="btn sec sm" for="f-${k}">Changer l'image</label>${d[k] ? `<button class="btn ghost sm" data-a="imgreset" data-k="${k}">Retirer</button>` : ''}</div><input type="file" id="f-${k}" data-img="${k}" accept="image/*" hidden></div></div>`;
  const fld = (k, label, ph_, ta) => `<div class="field"><label for="s-${k}">${label}</label>${ta ? `<textarea id="s-${k}" data-s="${k}" placeholder="${esc(ph_ || '')}">${esc(d[k])}</textarea>` : `<input id="s-${k}" data-s="${k}" value="${esc(d[k])}" placeholder="${esc(ph_ || '')}">`}</div>`;
  return `<div style="max-width:680px">
    <h2 class="lbl" style="margin-top:0">Accueil</h2>
    ${pick('heroImage', "Image d'accueil (1re image du diaporama)")}${progressBar()}
    ${fld('name', 'Nom affiché', 'Rayane')}${fld('role', 'Titre', 'Architecte')}
    ${fld('heroKicker', 'Mots en haut à droite (un par ligne)', '', true)}${fld('tagline', "Phrase d'accroche")}
    <h2 class="lbl">À propos</h2>
    ${pick('aboutImage', 'Image de la page À propos')}
    ${fld('aboutText', 'Présentation (le 1er paragraphe apparaît aussi sur l\'accueil)', '', true)}
    <h2 class="lbl">Coordonnées</h2><p class="hint" style="margin-top:-6px">Les champs vides ne s'affichent pas sur le site.</p>
    ${fld('location', 'Ville, pays', 'Annaba, Algérie')}${fld('email', 'E-mail', 'contact@exemple.com')}${fld('phone', 'Téléphone', '')}${fld('instagram', 'Instagram', '@rayane.architecte')}${fld('linkedin', 'LinkedIn', 'linkedin.com/in/…')}
    <h2 class="lbl">Catégories</h2>
    <div class="field"><label for="s-categories">Une par ligne, dans l'ordre des filtres</label><textarea id="s-categories" data-s="categories" style="min-height:110px">${esc((d.categories || []).join('\n'))}</textarea></div>
    <div class="actions"><button class="btn pri" data-a="setsave" ${ui.busy || ui.up ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span> Enregistrement…' : 'Enregistrer'}</button><button class="btn sec" data-a="setreset">Annuler les changements</button></div></div>`;
}

/* ---------------------------------------------------------------- overlays */
function renderLayer() {
  let h = '';
  if (ui.menu) {
    h += `<div class="menu-ov gut" role="dialog" aria-label="Menu"><div class="row"><a class="brand" href="#/">${esc(S.site.name)}</a><button class="iconbtn" data-a="menu" aria-label="Fermer">${ic('close')}</button></div>
      <nav>${TABS.map((t, k) => `<a href="${HASH[t[0]]}"><span class="mono">${pad(k + 1)}</span>${t[1]}</a>`).join('')}</nav>
      <div class="sm mono"><span>${esc(S.site.email || S.site.location || '')}</span><a href="#/admin">Espace privé</a></div></div>`;
  }
  if (lightbox) {
    const u = lightbox.list[lightbox.i];
    h += `<div class="lb" role="dialog" aria-label="Image"><div class="bar gut"><span class="mono">${pad(lightbox.i + 1)} / ${pad(lightbox.list.length)}</span><button class="iconbtn" data-a="lbclose" aria-label="Fermer">${ic('close')}</button></div>
      <div class="stage" id="lbstage">${u.startsWith('data:') ? `<img src="${u}" alt="">` : pic(u, { eager: true, w: 2400 })}</div>
      ${lightbox.list.length > 1 ? `<div class="nav2"><button class="iconbtn" data-a="lbgo" data-d="-1" aria-label="Précédente">${ic('back')}</button><button class="iconbtn" data-a="lbgo" data-d="1" aria-label="Suivante">${ic('next')}</button></div>` : ''}</div>`;
  }
  if (ui.toast) h += `<div class="toast ${ui.toastErr ? 'err-t' : ''}" role="status">${esc(ui.toast)}</div>`;
  $layer.innerHTML = h;
  document.body.style.overflow = ui.menu || lightbox || pdfState ? 'hidden' : '';
}
function render() {
  if (ui.view === 'boot') return;
  const views = { home: vHome, projects: vProjects, project: vProject, about: vAbout, contact: vContact, admin: vAdmin, wizard: vWizard, done: vDone };
  const inAdmin = ['admin', 'wizard', 'done'].includes(ui.view);
  $app.innerHTML = (ui.view === 'wizard' ? '' : header()) + `<main>${(views[ui.view] || vHome)()}</main>` + (inAdmin && ui.view !== 'admin' ? '' : dock());
  const p = ui.view === 'project' && byId(ui.id);
  document.title = p ? `${p.title} — ${S.site.name}` : `${S.site.name || 'Portfolio'} — ${S.site.role || 'Architecte'}`;
  renderLayer(); onScroll(); startSlides();
}
function onScroll() {
  const h = document.getElementById('hdr'); if (!h || !overPhoto()) return;
  const past = window.scrollY > window.innerHeight * 0.75;
  h.classList.toggle('solid', past); h.classList.toggle('over', !past);
}
window.addEventListener('scroll', onScroll, { passive: true });
let toastT;
function toast(msg, isErr) { ui.toast = msg; ui.toastErr = !!isErr; renderLayer(); clearTimeout(toastT); toastT = setTimeout(() => { ui.toast = null; renderLayer(); }, isErr ? 5000 : 3000); }
function failed(e) { if (e && e.status === 401) { toast('Session expirée. Reconnectez-vous.', true); go('#/admin'); return; } toast(e && e.message ? e.message : 'Une erreur est survenue.', true); }

/* ---------------------------------------------------------------- uploads (4K + aperçu 1280 px) */
async function encode(bmp, max, q) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', q));
}
async function prepare(file) {
  try { const bmp = await createImageBitmap(file); const full = await encode(bmp, 3840, 0.9); const prev = await encode(bmp, 1280, 0.82); if (full) return { full, prev }; } catch (_) {}
  return { full: file, prev: null };
}
async function uploadFiles(files, kind) {
  const list = files.filter((f) => (kind === 'pdf' ? f.type === 'application/pdf' || /\.pdf$/i.test(f.name) : /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)));
  if (!list.length) { toast(kind === 'pdf' ? 'Choisissez un fichier PDF.' : 'Choisissez des images.', true); return []; }
  const out = [];
  ui.up = { done: 0, total: list.length, pct: 0 }; render();
  const prog = (pct) => { ui.up.pct = pct; const bar = document.querySelector('.progress span'); if (bar) bar.style.width = Math.round(pct * 100) + '%'; };
  for (const f of list) {
    try {
      if (kind === 'pdf') out.push(await upload(new Blob([f], { type: 'application/pdf' }), f.name, prog));
      else {
        const { full, prev } = await prepare(f);
        const res = await upload(full, f.name, (x) => prog(x * (prev ? 0.85 : 1)));
        if (prev) await upload(prev, f.name, (x) => prog(0.85 + x * 0.15), res.url.slice(7)).catch(() => {});
        out.push(res);
      }
    } catch (e) { failed(e); if (e.status === 401) break; }
    ui.up.done++; ui.up.pct = 0;
  }
  ui.up = null; render();
  return out;
}

/* ---------------------------------------------------------------- PDF viewer (pdf.js) */
let pdfjsP = null;
function loadScript(u) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = u; s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); }); }
function loadPdfjs() {
  if (!pdfjsP) {
    const b = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
    pdfjsP = loadScript(b + 'pdf.min.js').then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = b + 'pdf.worker.min.js'; return window.pdfjsLib; });
    pdfjsP.catch(() => { pdfjsP = null; });
  }
  return pdfjsP;
}
async function openPdf(p) {
  closePdf();
  const dl = p.pdf.url + (p.pdf.url.startsWith('/media/') ? '?download=1' : '');
  const el = document.createElement('div'); el.className = 'pdfv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', p.pdf.name);
  el.innerHTML = `<div class="bar gut"><button class="iconbtn" data-a="pdfclose" aria-label="Fermer">${ic('close')}</button><div class="t">${esc(p.pdf.name)}</div><a class="iconbtn" href="${esc(dl)}" download="${esc(p.pdf.name)}" aria-label="Télécharger le PDF">${ic('download')}</a></div>
    <div class="pages gut" id="pages"><div class="pmsg"><span class="spin"></span><p class="mono">Chargement du document</p></div></div><div class="pcount mono" id="pcount"></div><div class="pthumbs gut" id="pthumbs"></div>`;
  pdfState = { el, p }; document.body.appendChild(el); document.body.style.overflow = 'hidden';
  el.addEventListener('click', onClick);
  const pages = el.querySelector('#pages');
  try {
    const lib = await loadPdfjs();
    const doc = await lib.getDocument({ url: p.pdf.url, isEvalSupported: false }).promise;
    if (!pdfState || pdfState.el !== el) { doc.destroy(); return; }
    pdfState.doc = doc;
    const n = doc.numPages; pages.innerHTML = '';
    const thumbs = el.querySelector('#pthumbs'), count = el.querySelector('#pcount'), holders = [];
    for (let i = 1; i <= n; i++) {
      const d = document.createElement('div'); d.className = 'page'; d.dataset.n = i; d.style.aspectRatio = '1/1.414'; pages.appendChild(d); holders.push(d);
      const t = document.createElement('button'); t.dataset.a = 'pjump'; t.dataset.n = i; t.setAttribute('aria-label', 'Page ' + i); t.style.aspectRatio = '1/1.414'; thumbs.appendChild(t);
    }
    const draw = async (pg, box, width) => {
      const page = await doc.getPage(pg); const vp0 = page.getViewport({ scale: 1 });
      const dpr = Math.min(2, window.devicePixelRatio || 1); const vp = page.getViewport({ scale: (width * dpr) / vp0.width });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      box.style.aspectRatio = ''; box.innerHTML = ''; box.appendChild(c);
    };
    const lazy = (root, width) => new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !e.target.dataset.done) { e.target.dataset.done = 1; draw(+e.target.dataset.n, e.target, width(e.target)).catch(() => {}); } }), { root, rootMargin: '600px' });
    const io = lazy(pages, (t) => t.clientWidth); holders.forEach((h) => io.observe(h));
    const tio = lazy(thumbs, () => 50); [...thumbs.children].forEach((t) => tio.observe(t));
    const setCur = (i) => { count.textContent = `${pad(i)} / ${pad(n)}`; [...thumbs.children].forEach((t) => t.setAttribute('aria-current', String(+t.dataset.n === i))); };
    setCur(1);
    pages.addEventListener('scroll', () => { const top = pages.scrollTop + pages.clientHeight * 0.35; let cur = 1; for (const h of holders) if (h.offsetTop <= top) cur = +h.dataset.n; setCur(cur); }, { passive: true });
    pdfState.jump = (i) => holders[i - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    pages.innerHTML = `<div class="pmsg"><p>Impossible d'afficher le document ici.</p><a class="btn pri" href="${esc(dl)}" download>${ic('download')} Télécharger le PDF</a></div>`;
  }
}
function closePdf() { if (pdfState) { pdfState.el.remove(); if (pdfState.doc) pdfState.doc.destroy(); pdfState = null; document.body.style.overflow = ''; } }

/* ---------------------------------------------------------------- wizard */
function startDraft(p) {
  draftAdded = []; ui.step = 1;
  draft = p ? Object.assign(JSON.parse(JSON.stringify(p)), { isNew: false })
    : { id: null, title: '', category: cats()[0] || 'Résidentiel', year: String(new Date().getFullYear()), location: '', description: '', images: [], pdf: null, published: true, isNew: true };
}
function discardDraft() { draftAdded.forEach(dropMedia); draft = null; draftAdded = []; }
function readStep1() {
  if (!draft || ui.step !== 1) return;
  document.querySelectorAll('[data-f]').forEach((el) => { draft[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  if (draft.category === '__new') draft.category = ((document.getElementById('f-newcat') || {}).value || '').trim();
}
function validStep1() {
  if (!draft.title) { toast('Donnez un titre au projet.', true); return false; }
  if (!draft.category) { toast('Choisissez ou saisissez une catégorie.', true); return false; }
  return true;
}
async function saveDraft() {
  if (ui.busy) return;
  const d = draft;
  const payload = { title: d.title, category: d.category, year: d.year, location: d.location, description: d.description, images: d.images, pdf: d.pdf, published: !!d.published };
  ui.busy = true; render();
  try {
    const res = d.isNew ? await api('/api/projects', { method: 'POST', body: payload }) : await api('/api/projects/' + encodeURIComponent(d.id), { method: 'PUT', body: payload });
    const p = res.project, i = S.projects.findIndex((x) => x.id === p.id);
    if (i >= 0) S.projects[i] = p; else S.projects.unshift(p);
    if (p.category && !(S.site.categories || []).includes(p.category)) S.site.categories = [...(S.site.categories || []), p.category];
    ui.doneMsg = d.isNew ? 'Publié' : 'Enregistré';
    draft = null; draftAdded = []; ui.busy = false;
    go('#/admin/publie/' + encodeURIComponent(p.id));
  } catch (e) { ui.busy = false; render(); failed(e); }
}

/* ---------------------------------------------------------------- events */
async function onClick(e) {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a, id = t.dataset.id;
  switch (a) {
    case 'menu': ui.menu = !ui.menu; renderLayer(); break;
    case 'search': ui.search = !ui.search; if (!ui.search) ui.q = ''; render(); if (ui.search) document.getElementById('q').focus(); break;
    case 'filter': ui.filter = t.dataset.c; render(); break;
    case 'layout': layout = t.dataset.l; try { localStorage.setItem('rp-layout', layout); } catch (_) {} render(); break;
    case 'slide': showSlide(+t.dataset.k); startSlides(); break;
    case 'back': if (ui.history > 0) { ui.history--; history.back(); } else go('#/projets'); break;
    case 'lb': { const p = byId(ui.id); lightbox = { list: imgsOf(p), i: +t.dataset.i }; renderLayer(); break; }
    case 'lbclose': lightbox = null; renderLayer(); break;
    case 'lbgo': lbMove(+t.dataset.d); break;
    case 'pdf': openPdf(byId(id)); break;
    case 'pdfclose': closePdf(); break;
    case 'pjump': if (pdfState && pdfState.jump) pdfState.jump(+t.dataset.n); break;
    case 'copy': { const v = t.dataset.t; try { await navigator.clipboard.writeText(v); toast('Copié : ' + v); } catch (_) { toast(v); } break; }
    case 'logout': await api('/api/logout', { method: 'POST' }).catch(() => {}); ui.admin = false; await load(); go('#/'); toast('Vous êtes déconnecté.'); break;
    case 'rowmenu': ui.open = ui.open === id ? null : id; ui.confirm = null; render(); break;
    case 'toggle': {
      const p = byId(id); ui.busy = true; render();
      try { const r = await api('/api/projects/' + encodeURIComponent(id), { method: 'PUT', body: { published: !p.published } }); Object.assign(p, r.project); toast(p.published ? 'Projet publié' : 'Projet masqué'); }
      catch (err) { failed(err); }
      ui.busy = false; ui.open = null; render(); break;
    }
    case 'move': {
      const i = S.projects.findIndex((p) => p.id === id), j = i + +t.dataset.d; if (j < 0 || j >= S.projects.length) break;
      const before = S.projects.slice();
      [S.projects[i], S.projects[j]] = [S.projects[j], S.projects[i]]; ui.busy = true; render();
      try { await api('/api/projects/order', { method: 'POST', body: { ids: S.projects.map((p) => p.id) } }); }
      catch (err) { S.projects = before; failed(err); }
      ui.busy = false; render(); break;
    }
    case 'askdel': ui.confirm = id; render(); break;
    case 'nodel': ui.confirm = null; render(); break;
    case 'del': {
      ui.busy = true; render();
      try { await api('/api/projects/' + encodeURIComponent(id), { method: 'DELETE' }); S.projects = S.projects.filter((p) => p.id !== id); toast('Projet supprimé'); }
      catch (err) { failed(err); }
      ui.busy = false; ui.confirm = null; ui.open = null; render(); break;
    }
    case 'wcancel': if (ui.history > 0) { ui.history--; history.back(); } else go('#/admin'); break;
    case 'wstep': { readStep1(); const s = +t.dataset.s; if (s > 1 && !validStep1()) break; ui.step = s; render(); window.scrollTo(0, 0); break; }
    case 'wsave': readStep1(); if (!validStep1()) { ui.step = 1; render(); break; } saveDraft(); break;
    case 'imgdel': { const u = draft.images.splice(+t.dataset.i, 1)[0]; if (draftAdded.includes(u)) dropMedia(u); render(); break; }
    case 'imgmv': { const i = +t.dataset.i, j = i + +t.dataset.d; [draft.images[i], draft.images[j]] = [draft.images[j], draft.images[i]]; render(); break; }
    case 'pdfdel': if (draft.pdf && draftAdded.includes(draft.pdf.url)) dropMedia(draft.pdf.url); draft.pdf = null; render(); break;
    case 'imgreset': readSettings(); setDraft[t.dataset.k] = null; render(); break;
    case 'setreset': setAdded.forEach(dropMedia); setDraft = null; setAdded = []; render(); toast('Changements annulés'); break;
    case 'setsave': {
      readSettings(); ui.busy = true; render();
      try { const r = await api('/api/site', { method: 'PUT', body: setDraft }); S.site = r.site; setDraft = null; setAdded = []; toast('Site mis à jour'); }
      catch (err) { failed(err); }
      ui.busy = false; render(); break;
    }
  }
}
function lbMove(d) { if (!lightbox) return; lightbox.i = (lightbox.i + d + lightbox.list.length) % lightbox.list.length; renderLayer(); }
function readSettings() {
  if (!setDraft) return;
  document.querySelectorAll('[data-s]').forEach((el) => { const k = el.dataset.s; setDraft[k] = k === 'categories' ? el.value.split('\n').map((x) => x.trim()).filter(Boolean) : el.value; });
}
document.addEventListener('click', (e) => {
  if (pdfState && pdfState.el.contains(e.target)) return;
  if (ui.menu && e.target.closest('.menu-ov a')) { ui.menu = false; renderLayer(); }
  if (lightbox && e.target.id === 'lbstage') { lightbox = null; renderLayer(); return; }
  onClick(e);
});
let touchX = null;
document.addEventListener('touchstart', (e) => { if (lightbox && e.target.closest('#lbstage')) touchX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 50) lbMove(dx < 0 ? 1 : -1); });
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { ui.q = e.target.value; const pos = e.target.selectionStart; render(); const q = document.getElementById('q'); q.focus(); q.setSelectionRange(pos, pos); }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const pw = document.getElementById('pw').value, err = document.getElementById('login-err');
  err.textContent = ''; ui.busy = true;
  try { await api('/api/login', { method: 'POST', body: { password: pw } }); ui.busy = false; await load(); route(); toast('Bienvenue dans votre espace'); }
  catch (x) { ui.busy = false; render(); const el = document.getElementById('login-err'); if (el) el.textContent = x.message; }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'f-cat') { document.getElementById('newcat').hidden = el.value !== '__new'; if (el.value === '__new') document.getElementById('f-newcat').focus(); }
  if (el.id === 'f-imgs' && el.files.length) { const res = await uploadFiles([...el.files], 'image'); if (draft) res.forEach((r) => { draft.images.push(r.url); draftAdded.push(r.url); }); render(); }
  if (el.id === 'f-pdf' && el.files[0]) {
    const [r] = await uploadFiles([el.files[0]], 'pdf');
    if (r && draft) { if (draft.pdf && draftAdded.includes(draft.pdf.url)) dropMedia(draft.pdf.url); draft.pdf = { url: r.url, name: r.name, size: r.size }; draftAdded.push(r.url); }
    render();
  }
  if (el.dataset.img) { readSettings(); const k = el.dataset.img; const [r] = await uploadFiles([...el.files], 'image'); if (r && setDraft) { setDraft[k] = r.url; setAdded.push(r.url); } render(); }
});
const dropZone = (e) => e.target.closest && e.target.closest('#drop');
document.addEventListener('dragover', (e) => { const d = dropZone(e); if (d) { e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { const d = dropZone(e); if (d) d.classList.remove('over'); });
document.addEventListener('drop', async (e) => {
  const d = dropZone(e); if (!d || !draft) return;
  e.preventDefault(); d.classList.remove('over');
  const res = await uploadFiles([...e.dataTransfer.files], 'image');
  res.forEach((r) => { draft.images.push(r.url); draftAdded.push(r.url); }); render();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (lightbox) { lightbox = null; renderLayer(); } else if (pdfState) closePdf(); else if (ui.menu) { ui.menu = false; renderLayer(); } }
  if (lightbox && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) lbMove(e.key === 'ArrowRight' ? 1 : -1);
});
window.addEventListener('beforeunload', (e) => { if (ui.up || (draft && draftAdded.length)) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------------------------------------------------------- boot */
async function load() {
  const d = await api('/api/content');
  S = { site: d.site || {}, projects: d.projects || [] };
  ui.admin = !!d.admin;
}
(async () => {
  try { await load(); route(); }
  catch (e) { $app.innerHTML = `<div class="boot gut"><div style="text-align:center;display:grid;gap:16px;justify-items:center"><p>Le portfolio n'a pas pu se charger.</p><button class="btn sec" onclick="location.reload()">Réessayer</button></div></div>`; }
})();
})();
