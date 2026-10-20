/* Rayane — portfolio d'architecture. Application web (PWA) sans framework.
 * Données : /api/content (Worker + D1). Fichiers : /media/* (R2).
 */
(function () {
'use strict';

/* ---------------------------------------------------------------- state */
let S = { site: {}, projects: [] };
const ui = { view: 'boot', id: null, filter: 'Tous', q: '', search: false, menu: false, admin: false, admTab: 'projects', open: null, confirm: null, busy: false, step: 1, up: null, history: 0, loadError: null };
let draft = null, draftAdded = [], setDraft = null, setAdded = [];
let pdfState = null, lightbox = null;

const $app = document.getElementById('app'), $layer = document.getElementById('layer');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------- API */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'x-requested-with': 'portfolio' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let r;
  try { r = await fetch(path, { method, headers, credentials: 'same-origin', body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch (e) { throw new Error('Connexion impossible. Vérifiez votre réseau.'); }
  let d = null; try { d = await r.json(); } catch (_) {}
  if (!r.ok) {
    const e = new Error((d && d.error) || 'Erreur ' + r.status); e.status = r.status;
    if (r.status === 401 && ui.admin) { ui.admin = false; }
    throw e;
  }
  return d;
}
function upload(blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/media');
    x.setRequestHeader('content-type', blob.type || 'application/octet-stream');
    x.setRequestHeader('x-filename', encodeURIComponent(name || 'fichier'));
    x.setRequestHeader('x-requested-with', 'portfolio');
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch (_) {} if (x.status < 300) resolve(d); else reject(Object.assign(new Error(d.error || "L'envoi a échoué."), { status: x.status })); };
    x.onerror = () => reject(new Error("Connexion perdue pendant l'envoi."));
    x.send(blob);
  });
}
const dropMedia = (url) => { if (url && url.startsWith('/media/')) api('/api/media/' + url.slice(7), { method: 'DELETE' }).catch(() => {}); };

/* ---------------------------------------------------------------- icons */
const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2z"/>',
  insta: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".8" fill="currentColor" stroke="none"/>',
  linkedin: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8.3 10.5v5.5M8.3 7.8v.1M11.7 16v-5.5M11.7 13c0-1.6 1-2.6 2.3-2.6s2 .9 2 2.6V16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
  edit: '<path d="M15.5 5.5l3 3L8 19H5v-3z"/>',
  logout: '<path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>'
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

/* ---------------------------------------------------------------- neutral placeholder (project without photos) */
const phCache = new Map();
function ph(seed) {
  if (phCache.has(seed)) return phCache.get(seed);
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const gy = 560, x0 = 140 + r() * 240, w = 520 + r() * 280, top = 260 + r() * 80, f = Math.round;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#e6e6e2"/><rect y="${gy}" width="1200" height="240" fill="#d3d1cb"/><rect x="${f(x0)}" y="${f(top)}" width="${f(w)}" height="${f(gy - top)}" fill="#bdb9b1"/><rect x="${f(x0 - 40)}" y="${f(top - 24)}" width="${f(w + 120)}" height="24" fill="#cfcbc4"/><rect x="${f(x0 + 60)}" y="${f(top + 50)}" width="${f(w * 0.5)}" height="${f(gy - top - 50)}" fill="#525a5e"/></svg>`;
  const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); phCache.set(seed, u); return u;
}

/* ---------------------------------------------------------------- selectors */
const imgsOf = (p) => (p.images && p.images.length ? p.images : [ph(p.id)]);
const cover = (p) => imgsOf(p)[0];
const pub = () => S.projects.filter((p) => p.published);
const cats = () => { const set = new Set(S.site.categories || []); S.projects.forEach((p) => p.category && set.add(p.category)); return [...set]; };
const byId = (id) => S.projects.find((p) => p.id === id);
const metaLine = (p) => [p.category, p.year].filter(Boolean).map(esc).join(' · ');
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b / 1024)) + ' Ko');

/* ---------------------------------------------------------------- routing (#/…) */
const ROUTES = { '': 'home', projets: 'projects', projet: 'project', 'a-propos': 'about', contact: 'contact', admin: 'admin' };
const HASH = { home: '#/', projects: '#/projets', about: '#/a-propos', contact: '#/contact', admin: '#/admin' };
function go(hash) { if (location.hash === hash) route(); else { ui.history++; location.hash = hash; } }
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const prev = ui.view;
  let view = ROUTES[parts[0]] || 'home', id = parts[1] || null;
  if (view === 'admin') {
    const sub = parts[1];
    id = parts[2] || null;
    if (sub === 'site') { view = 'admin'; ui.admTab = 'site'; }
    else if (sub === 'nouveau') view = 'wizard';
    else if (sub === 'modifier') view = 'wizard';
    else if (sub === 'publie') view = 'done';
    else ui.admTab = 'projects';
    if (view === 'wizard') {
      if (sub === 'nouveau' && (!draft || !draft.isNew)) startDraft(null);
      if (sub === 'modifier' && (!draft || draft.id !== id)) { const p = byId(id); if (p) startDraft(p); else view = 'admin'; }
    }
  }
  if (prev === 'wizard' && view !== 'wizard' && draft) discardDraft();
  if (!(prev === 'admin' && view === 'admin')) { setDraft = null; }
  ui.view = view; ui.id = id; ui.menu = false; ui.open = null; ui.confirm = null;
  if (pdfState) closePdf();
  lightbox = null;
  render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

const TABS = [['home', 'Accueil', 'home'], ['projects', 'Projets', 'folder'], ['about', 'À propos', 'user'], ['contact', 'Contact', 'mail']];
const tabOf = (v) => ({ project: 'projects', wizard: 'admin', done: 'admin', login: 'admin' }[v] || v);

function topBar() {
  const cur = tabOf(ui.view), adminView = cur === 'admin';
  const right = ui.view === 'projects' ? `<button class="iconbtn" data-a="search" aria-label="Rechercher">${ic('search')}</button>`
    : adminView && ui.admin ? `<button class="iconbtn" data-a="logout" aria-label="Se déconnecter" title="Se déconnecter">${ic('logout')}</button>` : '<span></span>';
  return `<header class="top"><div class="wrap gut"><div class="row">
    <button class="iconbtn menubtn" data-a="menu" aria-label="Menu">${ic('menu')}</button>
    <a class="brand" href="#/" style="text-decoration:none">${esc(S.site.name || 'Portfolio')}</a>
    <nav class="topnav" aria-label="Navigation">${TABS.map((t) => `<button data-go="${HASH[t[0]]}" ${cur === t[0] ? 'aria-current="page"' : ''}>${t[1]}</button>`).join('')}${ui.admin ? `<button data-go="#/admin" ${adminView ? 'aria-current="page"' : ''}>Admin</button>` : ''}</nav>
    <div class="right">${right}</div>
  </div>${ui.view === 'projects' && ui.search ? `<div class="searchbar"><input id="q" type="search" placeholder="Rechercher un projet, un lieu…" value="${esc(ui.q)}" aria-label="Rechercher"></div>` : ''}</div></header>`;
}
function tabBar() {
  const cur = tabOf(ui.view);
  return `<nav class="tabs" aria-label="Navigation"><div class="row gut">${TABS.map((t) => `<button class="tab" data-go="${HASH[t[0]]}" ${cur === t[0] ? 'aria-current="page"' : ''}>${ic(t[2])}<span>${t[1]}</span></button>`).join('')}</div></nav>`;
}

/* ---------------------------------------------------------------- public views */
function card(p) {
  return `<a class="card" href="#/projet/${encodeURIComponent(p.id)}" style="text-decoration:none">
    <div class="ph"><img src="${esc(cover(p))}" alt="${esc(p.title)}" loading="lazy"></div>
    <div class="cap"><div><div class="t">${esc(p.title)}${p.example ? '<span class="badge">Exemple</span>' : ''}</div><div class="meta">${metaLine(p)}</div></div>${ic('arrow')}</div>
  </a>`;
}
function vHome() {
  const s = S.site, list = pub().slice(0, 3);
  return `<section class="hero">${s.heroImage ? `<img src="${esc(s.heroImage)}" alt="">` : ''}<div class="in wrap gut">
      <div><h1 class="h-display">${esc(s.name)}</h1><div class="role">${esc(s.role)}</div>
      <div class="kicker kick">${esc(s.heroKicker).split('\n').join('<br>')}</div></div>
      <div class="tag">${esc(s.tagline)}</div>
    </div></section>
    <section class="section wrap gut">
      <div class="sec-head"><h2>Projets récents</h2><a class="linkbtn" href="#/projets" style="text-decoration:none">Tous les projets</a></div>
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : '<div class="empty">Aucun projet publié pour le moment.</div>'}
    </section>`;
}
function vProjects() {
  const q = ui.q.trim().toLowerCase();
  let list = pub();
  if (ui.filter !== 'Tous') list = list.filter((p) => p.category === ui.filter);
  if (q) list = list.filter((p) => [p.title, p.location, p.category, p.year, p.description].join(' ').toLowerCase().includes(q));
  const used = cats().filter((c) => pub().some((p) => p.category === c));
  return `<div class="wrap gut">
    <div class="chips" role="group" aria-label="Catégories">${['Tous', ...used].map((c) => `<button class="chip" data-a="filter" data-c="${esc(c)}" aria-pressed="${ui.filter === c}">${esc(c)}</button>`).join('')}</div>
    ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty">Aucun projet ne correspond${q ? ` à « ${esc(ui.q)} »` : ''}.</div>`}
  </div>`;
}
function vProject() {
  const p = byId(ui.id);
  if (!p || (!p.published && !ui.admin)) return `<div class="wrap gut"><div class="empty">Ce projet n'existe pas ou n'est plus en ligne.<br><br><a class="linkbtn" href="#/projets" style="text-decoration:none">Voir tous les projets</a></div></div>`;
  const im = imgsOf(p), extra = im.length - 3;
  const thumbs = im.slice(0, 3).map((u, i) => `<button data-a="lb" data-i="${i}" aria-label="Agrandir l'image ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy">${i === 2 && extra > 0 ? `<span class="more">+${extra}</span>` : ''}</button>`).join('');
  return `<div class="d-hero"><img src="${esc(im[0])}" alt="${esc(p.title)}">
      <button class="float l" data-a="back" aria-label="Retour">${ic('back')}</button>
      ${ui.admin ? `<button class="float r" data-go="#/admin/modifier/${encodeURIComponent(p.id)}" aria-label="Modifier ce projet">${ic('edit')}</button>` : ''}
    </div>
    <article class="d-body gut">
      <h1>${esc(p.title)}${p.example ? '<span class="badge">Exemple</span>' : ''}${!p.published ? '<span class="badge">Masqué</span>' : ''}</h1>
      <div class="meta">${[p.category, p.year, p.location].filter(Boolean).map(esc).join('<span aria-hidden="true">·</span>')}</div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      ${im.length > 1 ? `<div class="thumbs">${thumbs}</div>` : ''}
      ${p.pdf ? `<div style="margin-top:22px"><button class="btn pri block" data-a="pdf" data-id="${esc(p.id)}">${ic('download')} Voir le portfolio (PDF)</button></div>` : ''}
      <h2 class="lbl">Galerie</h2>
      <div class="gallery">${im.map((u, i) => `<button data-a="lb" data-i="${i}" aria-label="Agrandir l'image ${i + 1}"><img src="${esc(u)}" alt="${esc(p.title)} — image ${i + 1}" loading="lazy"></button>`).join('')}</div>
    </article>`;
}
function contactItems() {
  const s = S.site, it = [];
  if (s.location) it.push(['pin', s.location, null]);
  if (s.email) it.push(['mail', s.email, 'mailto:' + s.email]);
  if (s.phone) it.push(['phone', s.phone, 'tel:' + s.phone.replace(/[^\d+]/g, '')]);
  if (s.instagram) { const h = s.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, ''); it.push(['insta', '@' + h, 'https://instagram.com/' + h]); }
  if (s.linkedin) { const v = s.linkedin.replace(/^https?:\/\/(www\.)?/, ''); it.push(['linkedin', v, 'https://' + v]); }
  return it;
}
function contactList() {
  const it = contactItems();
  if (!it.length) return `<p class="muted">Les coordonnées seront bientôt disponibles.</p>`;
  return `<div class="clist">${it.map(([i, v, h]) => `<div class="citem">${ic(i)}<div class="v">${h ? `<a href="${esc(h)}" ${h.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(v)}</a>` : esc(v)}</div>${i === 'pin' ? '<span></span>' : `<button class="iconbtn" data-a="copy" data-t="${esc(v)}" aria-label="Copier">${ic('copy')}</button>`}</div>`).join('')}</div>`;
}
function vAbout() {
  const s = S.site;
  return `${s.aboutImage ? `<img class="about-img" src="${esc(s.aboutImage)}" alt="">` : ''}
    <div class="about gut"><h1 class="h-display">À propos</h1><p>${esc(s.aboutText)}</p><div class="rule"></div>${contactList()}</div>`;
}
function vContact() {
  return `<div class="about gut" style="padding-top:36px"><div class="kicker muted">${esc(S.site.role)} · ${esc(S.site.name)}</div><h1 class="h-display" style="margin-top:12px">Contact</h1>
    <p class="muted">Pour un projet, une collaboration ou une demande d'information.</p><div class="rule"></div>${contactList()}</div>`;
}

/* ---------------------------------------------------------------- admin */
function vLogin() {
  return `<div class="gut"><div class="login"><span class="lock">${ic('lock')} Espace administrateur</span><h1>Connexion</h1>
    <p class="muted" style="margin:0">Entrez le mot de passe pour gérer les projets et le contenu du site.</p>
    <form id="login-form"><div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <div class="err" id="login-err" role="alert"></div>
    <button class="btn pri block" type="submit" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span>' : ''} Se connecter</button></form></div></div>`;
}
function vAdmin() {
  if (!ui.admin) return vLogin();
  const head = `<div class="adm-head"><div><span class="lock">${ic('lock')} Espace administrateur</span><h1>${ui.admTab === 'projects' ? 'Mes projets' : 'Contenu du site'}</h1></div>
    ${ui.admTab === 'projects' ? `<button class="btn pri sm" data-go="#/admin/nouveau">${ic('plus')} Ajouter un projet</button>` : ''}</div>
    <div class="seg" role="group"><button data-go="#/admin" aria-pressed="${ui.admTab === 'projects'}">Projets</button><button data-go="#/admin/site" aria-pressed="${ui.admTab === 'site'}">Textes et images</button></div>`;
  if (ui.admTab === 'site') return `<div class="wrap gut">${head}${vSettings()}</div>`;
  const rows = S.projects.map((p, i) => {
    const st = p.example ? ['ex', p.published ? 'Exemple publié' : 'Exemple masqué'] : p.published ? ['ok', 'Publié'] : ['off', 'Masqué'];
    let extra = '';
    if (ui.confirm === p.id) extra = `<div class="confirm"><span>Supprimer « ${esc(p.title)} » et ses fichiers ?</span><button class="btn danger sm" data-a="del" data-id="${esc(p.id)}" ${ui.busy ? 'disabled' : ''}>Supprimer</button><button class="btn sec sm" data-a="nodel">Annuler</button></div>`;
    else if (ui.open === p.id) extra = `<div class="rowmenu">
      <button class="btn sec sm" data-go="#/admin/modifier/${encodeURIComponent(p.id)}">${ic('edit')} Modifier</button>
      <button class="btn sec sm" data-a="toggle" data-id="${esc(p.id)}" ${ui.busy ? 'disabled' : ''}>${p.published ? 'Masquer' : 'Publier'}</button>
      <button class="btn sec sm" data-a="move" data-id="${esc(p.id)}" data-d="-1" ${i === 0 || ui.busy ? 'disabled' : ''}>Monter</button>
      <button class="btn sec sm" data-a="move" data-id="${esc(p.id)}" data-d="1" ${i === S.projects.length - 1 || ui.busy ? 'disabled' : ''}>Descendre</button>
      <button class="btn sec sm" data-a="askdel" data-id="${esc(p.id)}" style="color:var(--danger)">Supprimer</button></div>`;
    return `<div class="prow"><img src="${esc(cover(p))}" alt=""><div style="min-width:0"><a class="t" href="#/projet/${encodeURIComponent(p.id)}" style="text-decoration:none;display:block">${esc(p.title)}</a><div class="meta">${metaLine(p)}</div><div class="status ${st[0]}">${st[1]}</div></div>
      <button class="iconbtn" data-a="rowmenu" data-id="${esc(p.id)}" aria-label="Actions pour ${esc(p.title)}" aria-expanded="${ui.open === p.id}">${ic('more')}</button></div>${extra}`;
  }).join('');
  return `<div class="wrap gut">${head}
    ${S.projects.some((p) => p.example) ? `<div class="note">Les projets marqués « Exemple » montrent la mise en page avec des photos libres de droits. Supprimez-les quand vos premiers projets sont en ligne.</div>` : ''}
    ${S.projects.length ? `<div class="plist">${rows}</div>` : `<div class="empty">Aucun projet. Ajoutez le premier.</div>`}</div>`;
}
function steps(n) { return `<div class="steps">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`; }
function progressBar() { return ui.up ? `<div class="hint" style="margin-top:14px">Envoi ${ui.up.done + 1} / ${ui.up.total}…</div><div class="progress"><span style="width:${Math.round(ui.up.pct * 100)}%"></span></div>` : ''; }
function vWizard() {
  if (!ui.admin) return vLogin();
  if (!draft) return vAdmin();
  const d = draft, step = ui.step;
  const titles = { 1: d.isNew ? 'Nouveau projet' : 'Modifier le projet', 2: 'Ajouter des images', 3: 'Ajouter un PDF' };
  const lead = step === 1 ? `<button class="iconbtn" data-a="wcancel" aria-label="Annuler">${ic('close')}</button>` : `<button class="iconbtn" data-a="wstep" data-s="${step - 1}" aria-label="Étape précédente">${ic('back')}</button>`;
  const uploading = !!ui.up;
  const act = step < 3 ? `<button class="btn pri sm" data-a="wstep" data-s="${step + 1}" ${uploading ? 'disabled' : ''}>Suivant</button>` : `<button class="btn pri sm" data-a="wsave" ${ui.busy || uploading ? 'disabled' : ''}>${d.isNew ? 'Publier' : 'Enregistrer'}</button>`;
  let body = '';
  if (step === 1) {
    const cs = cats(); const known = cs.includes(d.category);
    const opts = cs.map((c) => `<option ${c === d.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
    body = `<div class="field"><label for="f-title">Titre du projet</label><input id="f-title" data-f="title" value="${esc(d.title)}" placeholder="Villa du Lac" autocomplete="off"></div>
      <div class="two"><div class="field"><label for="f-cat">Catégorie</label><select id="f-cat" data-f="category">${opts}<option value="__new" ${known ? '' : 'selected'}>+ Nouvelle catégorie…</option></select></div>
      <div class="field"><label for="f-year">Année</label><input id="f-year" data-f="year" value="${esc(d.year)}" inputmode="numeric" maxlength="4" placeholder="${new Date().getFullYear()}"></div></div>
      <div class="field" id="newcat" ${known ? 'hidden' : ''}><label for="f-newcat">Nom de la nouvelle catégorie</label><input id="f-newcat" value="${known ? '' : esc(d.category)}" placeholder="Patrimoine, Intérieur…"></div>
      <div class="field"><label for="f-loc">Localisation (optionnel)</label><input id="f-loc" data-f="location" value="${esc(d.location)}" placeholder="Ville, pays"></div>
      <div class="field"><label for="f-desc">Description</label><textarea id="f-desc" data-f="description" placeholder="Le parti architectural, le site, les matériaux…">${esc(d.description)}</textarea></div>
      <label style="display:flex;gap:10px;align-items:center;font-size:14px"><input type="checkbox" id="f-pub" data-f="published" ${d.published ? 'checked' : ''}> Visible sur le site</label>`;
  } else if (step === 2) {
    body = `<label class="drop" id="drop" for="f-imgs">${ic('image')}<b>Ajouter des photos</b><span class="hint">Depuis votre iPhone ou par glisser-déposer. La première image sert de couverture.</span></label>
      <input id="f-imgs" type="file" accept="image/*" multiple hidden>
      ${progressBar()}
      <div class="imgs">${d.images.map((u, i) => `<div class="it"><img src="${esc(u)}" alt="">${i === 0 ? '<span class="cover">Couverture</span>' : ''}
        <button class="x" data-a="imgdel" data-i="${i}" aria-label="Retirer l'image">${ic('close')}</button>
        <div class="mv"><button data-a="imgmv" data-i="${i}" data-d="-1" aria-label="Avancer" ${i === 0 ? 'hidden' : ''}>${ic('back')}</button><span></span><button data-a="imgmv" data-i="${i}" data-d="1" aria-label="Reculer" ${i === d.images.length - 1 ? 'hidden' : ''}>${ic('next')}</button></div></div>`).join('')}
        ${d.images.length ? `<label class="it" for="f-imgs" style="display:grid;place-items:center;cursor:pointer" aria-label="Ajouter">${ic('plus')}</label>` : ''}</div>
      ${!d.images.length ? `<p class="hint" style="margin-top:12px">Sans photo, une illustration neutre s'affiche à la place.</p>` : ''}`;
  } else {
    body = `<label class="drop" for="f-pdf"><span class="pdficon">PDF</span><b>Ajouter le portfolio (PDF)</b><span class="hint">Depuis l'app Fichiers ou iCloud Drive. Optionnel, 60 Mo maximum.</span></label>
      <input id="f-pdf" type="file" accept="application/pdf,.pdf" hidden>
      ${progressBar()}
      ${d.pdf ? `<div class="filecard"><span class="pdficon">PDF</span><div style="min-width:0"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.pdf.name)}</div><div class="meta">${fmtSize(d.pdf.size)}</div></div><button class="iconbtn" data-a="pdfdel" aria-label="Retirer le PDF">${ic('close')}</button></div>` : ''}
      <div class="actions"><button class="btn pri" data-a="wsave" ${ui.busy || uploading ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span> Publication…' : d.isNew ? 'Publier le projet' : 'Enregistrer les modifications'}</button></div>`;
  }
  return `<div class="sheet gut"><div class="wbar">${lead}<h1>${titles[step]}</h1>${act}</div>${steps(step)}${body}</div>`;
}
function vDone() {
  if (!ui.admin) return vLogin();
  const p = byId(ui.id);
  return `<div class="gut"><div class="done"><div class="ck">${ic('check')}</div><h1>${ui.doneMsg || 'Projet publié !'}</h1><p class="muted">${p && p.published ? 'Votre projet est maintenant visible dans votre portfolio.' : 'Les modifications sont enregistrées.'}</p>
    ${p ? `<button class="btn pri" data-go="#/projet/${encodeURIComponent(p.id)}">Voir le projet</button>` : ''}<button class="btn sec" data-go="#/admin/nouveau">Ajouter un autre projet</button><button class="btn ghost" data-go="#/admin">Tableau de bord</button></div></div>`;
}
function vSettings() {
  const d = setDraft || (setDraft = JSON.parse(JSON.stringify(S.site)));
  const pick = (k, label) => `<div class="imgpick">${d[k] ? `<img src="${esc(d[k])}" alt="">` : `<img src="${ph(k)}" alt="">`}<div><div style="font-weight:600;font-size:14px">${label}</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><label class="btn sec sm" for="f-${k}">Changer l'image</label>${d[k] ? `<button class="btn ghost sm" data-a="imgreset" data-k="${k}">Retirer</button>` : ''}</div><input type="file" id="f-${k}" data-img="${k}" accept="image/*" hidden></div></div>`;
  const fld = (k, label, ph_, ta) => `<div class="field"><label for="s-${k}">${label}</label>${ta ? `<textarea id="s-${k}" data-s="${k}" placeholder="${esc(ph_ || '')}">${esc(d[k])}</textarea>` : `<input id="s-${k}" data-s="${k}" value="${esc(d[k])}" placeholder="${esc(ph_ || '')}">`}</div>`;
  return `<div style="max-width:640px">
    <h2 class="lbl" style="margin-top:4px">Accueil</h2><div style="height:12px"></div>
    ${pick('heroImage', "Image d'accueil")}${progressBar()}
    ${fld('name', 'Nom affiché', 'Rayane')}${fld('role', 'Titre', 'Architecte')}
    ${fld('heroKicker', 'Mots sous le nom (un par ligne)', '', true)}${fld('tagline', "Phrase d'accroche")}
    <h2 class="lbl">À propos</h2><div style="height:12px"></div>
    ${pick('aboutImage', 'Image de la page À propos')}
    ${fld('aboutText', 'Présentation', '', true)}
    <h2 class="lbl">Coordonnées</h2><p class="hint">Les champs vides ne s'affichent pas sur le site.</p>
    ${fld('location', 'Ville, pays', 'Annaba, Algérie')}${fld('email', 'E-mail', 'contact@exemple.com')}${fld('phone', 'Téléphone', '')}${fld('instagram', 'Instagram', '@rayane.architecte')}${fld('linkedin', 'LinkedIn', 'linkedin.com/in/…')}
    <h2 class="lbl">Catégories de projets</h2><div style="height:12px"></div>
    <div class="field"><label for="s-categories">Une par ligne, dans l'ordre des filtres</label><textarea id="s-categories" data-s="categories" style="min-height:110px">${esc((d.categories || []).join('\n'))}</textarea></div>
    <div class="actions"><button class="btn pri" data-a="setsave" ${ui.busy || ui.up ? 'disabled' : ''}>${ui.busy ? '<span class="spin"></span> Enregistrement…' : 'Enregistrer'}</button><button class="btn sec" data-a="setreset">Annuler les changements</button></div></div>`;
}

/* ---------------------------------------------------------------- overlays */
function renderLayer() {
  let h = '';
  if (ui.menu) {
    h += `<div class="drawer-bg" data-a="menu"></div><nav class="drawer" aria-label="Menu"><div class="brand">${esc(S.site.name)} · ${esc(S.site.role)}</div>
      ${TABS.map((t) => `<button class="it" data-go="${HASH[t[0]]}">${ic(t[2])}${t[1]}</button>`).join('')}
      <div class="sep"></div><button class="it" data-go="#/admin">${ic('lock')}Espace administrateur</button></nav>`;
  }
  if (lightbox) {
    const im = lightbox.list;
    h += `<div class="overlay" role="dialog" aria-label="Image"><div class="bar gut"><span class="meta" style="color:inherit">${lightbox.i + 1} / ${im.length}</span><button class="iconbtn" data-a="lbclose" aria-label="Fermer">${ic('close')}</button></div>
      <div class="stage" data-a="lbclose"><img src="${esc(im[lightbox.i])}" alt=""></div>
      ${im.length > 1 ? `<div class="nav"><button class="iconbtn" data-a="lbgo" data-d="-1" aria-label="Précédente">${ic('back')}</button><button class="iconbtn" data-a="lbgo" data-d="1" aria-label="Suivante">${ic('next')}</button></div>` : ''}</div>`;
  }
  if (ui.toast) h += `<div class="toast ${ui.toastErr ? 'err-t' : ''}" role="status">${esc(ui.toast)}</div>`;
  $layer.innerHTML = h;
}
function render() {
  if (ui.view === 'boot') return;
  const views = { home: vHome, projects: vProjects, project: vProject, about: vAbout, contact: vContact, admin: vAdmin, wizard: vWizard, done: vDone };
  $app.innerHTML = (ui.view === 'project' ? '' : topBar()) + `<main>${(views[ui.view] || vHome)()}</main>` + (ui.view === 'wizard' ? '' : tabBar());
  document.title = ui.view === 'project' && byId(ui.id) ? `${byId(ui.id).title} — ${S.site.name}` : `${S.site.name || 'Portfolio'} — ${S.site.role || 'Architecte'}`;
  renderLayer();
}
let toastT;
function toast(msg, isErr) { ui.toast = msg; ui.toastErr = !!isErr; renderLayer(); clearTimeout(toastT); toastT = setTimeout(() => { ui.toast = null; renderLayer(); }, isErr ? 5000 : 3000); }
function failed(e) { if (e && e.status === 401) { toast('Session expirée. Reconnectez-vous.', true); go('#/admin'); return; } toast(e && e.message ? e.message : 'Une erreur est survenue.', true); }

/* ---------------------------------------------------------------- images */
async function compress(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 2400, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    if (b) return b;
  } catch (_) {}
  return file;
}
async function uploadFiles(files, kind) {
  const list = files.filter((f) => (kind === 'pdf' ? f.type === 'application/pdf' || /\.pdf$/i.test(f.name) : /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)));
  if (!list.length) { toast(kind === 'pdf' ? 'Choisissez un fichier PDF.' : 'Choisissez des images.', true); return []; }
  const out = [];
  ui.up = { done: 0, total: list.length, pct: 0 }; render();
  for (const f of list) {
    try {
      const blob = kind === 'pdf' ? new Blob([f], { type: 'application/pdf' }) : await compress(f);
      const res = await upload(blob, f.name, (pct) => { ui.up.pct = pct; const bar = document.querySelector('.progress span'); if (bar) bar.style.width = Math.round(pct * 100) + '%'; });
      out.push(res);
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
  const dl = p.pdf.url + '?download=1';
  const el = document.createElement('div'); el.className = 'pdfv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', p.pdf.name);
  el.innerHTML = `<div class="bar gut"><button class="iconbtn" data-a="pdfclose" aria-label="Fermer">${ic('close')}</button><div class="t">${esc(p.pdf.name)}</div><a class="iconbtn" href="${esc(dl)}" download="${esc(p.pdf.name)}" aria-label="Télécharger le PDF">${ic('download')}</a></div>
    <div class="pages gut" id="pages"><div class="pmsg"><span class="spin"></span><p>Chargement du document…</p></div></div><div class="pcount" id="pcount"></div><div class="pthumbs gut" id="pthumbs"></div>`;
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
    const tio = lazy(thumbs, () => 52); [...thumbs.children].forEach((t) => tio.observe(t));
    const setCur = (i) => { count.textContent = `${i} / ${n}`; [...thumbs.children].forEach((t) => t.setAttribute('aria-current', String(+t.dataset.n === i))); };
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
    const p = res.project;
    const i = S.projects.findIndex((x) => x.id === p.id);
    if (i >= 0) S.projects[i] = p; else S.projects.unshift(p);
    if (p.category && !(S.site.categories || []).includes(p.category)) S.site.categories = [...(S.site.categories || []), p.category];
    ui.doneMsg = d.isNew ? 'Projet publié !' : 'Modifications enregistrées';
    draft = null; draftAdded = []; ui.busy = false;
    go('#/admin/publie/' + encodeURIComponent(p.id));
  } catch (e) { ui.busy = false; render(); failed(e); }
}

/* ---------------------------------------------------------------- events */
async function onClick(e) {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a, id = t.dataset.id;
  switch (a) {
    case 'menu': ui.menu = !ui.menu; renderLayer(); break;
    case 'search': ui.search = !ui.search; if (!ui.search) ui.q = ''; render(); if (ui.search) document.getElementById('q').focus(); break;
    case 'filter': ui.filter = t.dataset.c; render(); break;
    case 'back': if (ui.history > 0) { ui.history--; history.back(); } else go('#/projets'); break;
    case 'lb': { const p = byId(ui.id); lightbox = { list: imgsOf(p), i: +t.dataset.i }; renderLayer(); break; }
    case 'lbclose': if (e.target.tagName !== 'IMG') { lightbox = null; renderLayer(); } break;
    case 'lbgo': lightbox.i = (lightbox.i + +t.dataset.d + lightbox.list.length) % lightbox.list.length; renderLayer(); break;
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
    case 'wcancel': history.length > 1 && ui.history > 0 ? (ui.history--, history.back()) : go('#/admin'); break;
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
function readSettings() {
  if (!setDraft) return;
  document.querySelectorAll('[data-s]').forEach((el) => { const k = el.dataset.s; setDraft[k] = k === 'categories' ? el.value.split('\n').map((x) => x.trim()).filter(Boolean) : el.value; });
}
document.addEventListener('click', (e) => { if (pdfState && pdfState.el.contains(e.target)) return; onClick(e); });
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
  if (el.id === 'f-imgs' && el.files.length) {
    const res = await uploadFiles([...el.files], 'image');
    if (draft) res.forEach((r) => { draft.images.push(r.url); draftAdded.push(r.url); });
    render();
  }
  if (el.id === 'f-pdf' && el.files[0]) {
    const [r] = await uploadFiles([el.files[0]], 'pdf');
    if (r && draft) { if (draft.pdf && draftAdded.includes(draft.pdf.url)) dropMedia(draft.pdf.url); draft.pdf = { url: r.url, name: r.name, size: r.size }; draftAdded.push(r.url); }
    render();
  }
  if (el.dataset.img) {
    readSettings(); const k = el.dataset.img;
    const [r] = await uploadFiles([...el.files], 'image');
    if (r && setDraft) { setDraft[k] = r.url; setAdded.push(r.url); }
    render();
  }
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
  if (lightbox && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { lightbox.i = (lightbox.i + (e.key === 'ArrowRight' ? 1 : -1) + lightbox.list.length) % lightbox.list.length; renderLayer(); }
});
window.addEventListener('beforeunload', (e) => { if (ui.up || (draft && draftAdded.length)) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------------------------------------------------------- boot */
async function load() {
  const d = await api('/api/content');
  S = { site: d.site || {}, projects: d.projects || [] };
  ui.admin = !!d.admin;
}
(async () => {
  try { await load(); ui.view = 'home'; route(); }
  catch (e) { $app.innerHTML = `<div class="boot gut"><div style="text-align:center"><p>Le portfolio n'a pas pu se charger.</p><button class="btn sec" onclick="location.reload()">Réessayer</button></div></div>`; }
})();
})();
