/**
 * Rayane Portfolio — Cloudflare Worker
 *
 *  /api/*    API JSON (contenu public + espace administrateur)
 *  /media/*  photos et PDF stockés dans R2
 *  le reste  fichiers statiques de ./public (application web)
 *
 * Liaisons (wrangler.jsonc) : DB (D1), MEDIA (R2), ASSETS (fichiers statiques)
 * Secret : ADMIN_PASSWORD (mot de passe de l'espace administrateur)
 */

const SESSION_COOKIE = 'rp_session';
const SESSION_DAYS = 30;
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_PDF = 60 * 1024 * 1024;
const SITE_KEYS = ['name', 'role', 'heroKicker', 'tagline', 'heroImage', 'aboutImage', 'aboutText', 'location', 'email', 'phone', 'instagram', 'linkedin', 'categories'];
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'application/pdf': 'pdf' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      if (url.pathname.startsWith('/media/')) return await serveMedia(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Erreur interne du serveur.' }, 500);
    }
  },
};

/* ------------------------------------------------------------------ helpers */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

async function body(request) {
  try { return await request.json(); } catch { fail(400, 'Requête invalide.'); }
}

const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const uid = () => Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), '');

function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'projet';
}

/* ------------------------------------------------------------------ session */

async function hmacKey(env) {
  if (!env.ADMIN_PASSWORD) return null;
  const secret = env.SESSION_SECRET || 'rayane-portfolio:' + env.ADMIN_PASSWORD;
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(env, payload) {
  const key = await hmacKey(env);
  const data = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return data + '.' + sig;
}

async function isAdmin(request, env) {
  const key = await hmacKey(env);
  if (!key) return false;
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(/;\s*/).find((c) => c.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;
  const [data, sig] = token.split('.');
  if (!data || !sig) return false;
  const expected = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  if (!(await safeEqual(sig, expected))) return false;
  try {
    const payload = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch { return false; }
}

async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function sessionCookie(value, maxAge) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/* ------------------------------------------------------------------ data */

async function getSite(env) {
  const row = await env.DB.prepare('SELECT data FROM settings WHERE id = 1').first();
  return row ? JSON.parse(row.data) : {};
}

function rowToProject(r) {
  return {
    id: r.id, title: r.title, category: r.category, year: r.year, location: r.location,
    description: r.description, images: JSON.parse(r.images || '[]'), pdf: r.pdf ? JSON.parse(r.pdf) : null,
    published: !!r.published, example: !!r.example,
  };
}

async function getProjects(env, includeHidden) {
  const sql = 'SELECT * FROM projects ' + (includeHidden ? '' : 'WHERE published = 1 ') + 'ORDER BY position ASC, created_at DESC';
  const { results } = await env.DB.prepare(sql).all();
  return results.map(rowToProject);
}

const isMediaUrl = (u) => typeof u === 'string' && /^\/media\/[A-Za-z0-9._-]+$/.test(u);
// Fichiers acceptés : envoyés dans R2 (/media/…) ou fournis avec le site (/examples/…)
const isImageUrl = (u) => isMediaUrl(u) || (typeof u === 'string' && /^\/examples\/[A-Za-z0-9._-]+$/.test(u));

function cleanProject(input) {
  const p = {
    title: str(input.title, 120),
    category: str(input.category, 60),
    year: str(input.year, 10),
    location: str(input.location, 120),
    description: str(input.description, 6000),
    images: (Array.isArray(input.images) ? input.images : []).filter(isImageUrl).slice(0, 60),
    pdf: null,
    published: input.published !== false,
  };
  if (input.pdf && isImageUrl(input.pdf.url)) {
    p.pdf = { url: input.pdf.url, name: str(input.pdf.name, 160) || 'portfolio.pdf', size: Number(input.pdf.size) || 0 };
  }
  if (!p.title) fail(400, 'Le titre du projet est obligatoire.');
  return p;
}

function cleanSite(input, current) {
  const s = { ...current };
  for (const k of SITE_KEYS) {
    if (!(k in input)) continue;
    if (k === 'categories') s.categories = (Array.isArray(input.categories) ? input.categories : []).map((c) => str(c, 60)).filter(Boolean).slice(0, 30);
    else if (k === 'heroImage' || k === 'aboutImage') s[k] = isImageUrl(input[k]) ? input[k] : null;
    else s[k] = str(input[k], k === 'aboutText' ? 6000 : 300);
  }
  return s;
}

async function deleteMedia(env, urls) {
  const keys = urls.filter(isMediaUrl).map((u) => u.slice('/media/'.length));
  if (keys.length && env.MEDIA) await env.MEDIA.delete(keys);
}

function projectMedia(p) {
  return [...(p.images || []), p.pdf?.url].filter(Boolean);
}

/* ------------------------------------------------------------------ API */

async function api(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  if (path === '/api/content' && method === 'GET') {
    const admin = await isAdmin(request, env);
    const [site, projects] = await Promise.all([getSite(env), getProjects(env, admin)]);
    return json({ site, projects, admin });
  }

  if (path === '/api/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD) fail(503, "Le mot de passe administrateur n'est pas encore configuré sur Cloudflare (secret ADMIN_PASSWORD).");
    const { password } = await body(request);
    if (!(await safeEqual(String(password || ''), env.ADMIN_PASSWORD))) {
      await new Promise((r) => setTimeout(r, 700));
      fail(401, 'Mot de passe incorrect.');
    }
    const token = await sign(env, { exp: Date.now() + SESSION_DAYS * 86400e3 });
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
  }

  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  // ---- everything below requires the admin session
  if (method !== 'GET' && request.headers.get('x-requested-with') !== 'portfolio') fail(403, 'Requête refusée.');
  if (!(await isAdmin(request, env))) fail(401, 'Session expirée. Reconnectez-vous.');

  if (path === '/api/site' && method === 'PUT') {
    const current = await getSite(env);
    const next = cleanSite(await body(request), current);
    await env.DB.prepare("INSERT INTO settings (id, data, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
      .bind(JSON.stringify(next)).run();
    await deleteMedia(env, ['heroImage', 'aboutImage'].filter((k) => current[k] && current[k] !== next[k]).map((k) => current[k]));
    return json({ site: next });
  }

  if (path === '/api/projects' && method === 'POST') {
    const p = cleanProject(await body(request));
    const id = slugify(p.title) + '-' + uid().slice(-5);
    const min = await env.DB.prepare('SELECT COALESCE(MIN(position), 0) AS m FROM projects').first();
    await env.DB.prepare('INSERT INTO projects (id,title,category,year,location,description,images,pdf,published,example,position) VALUES (?,?,?,?,?,?,?,?,?,0,?)')
      .bind(id, p.title, p.category, p.year, p.location, p.description, JSON.stringify(p.images), p.pdf ? JSON.stringify(p.pdf) : null, p.published ? 1 : 0, (min?.m ?? 0) - 1).run();
    return json({ project: { id, ...p, example: false } }, 201);
  }

  if (path === '/api/projects/order' && method === 'POST') {
    const { ids } = await body(request);
    if (!Array.isArray(ids)) fail(400, 'Ordre invalide.');
    await env.DB.batch(ids.map((id, i) => env.DB.prepare('UPDATE projects SET position = ? WHERE id = ?').bind(i, String(id))));
    return json({ ok: true });
  }

  const m = path.match(/^\/api\/projects\/([A-Za-z0-9_-]+)$/);
  if (m) {
    const row = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(m[1]).first();
    if (!row) fail(404, "Ce projet n'existe plus.");
    const old = rowToProject(row);

    if (method === 'PUT') {
      const input = await body(request);
      // Partial update (e.g. only `published`) keeps the other fields.
      const p = cleanProject({ ...old, ...input });
      await env.DB.prepare("UPDATE projects SET title=?, category=?, year=?, location=?, description=?, images=?, pdf=?, published=?, updated_at=datetime('now') WHERE id=?")
        .bind(p.title, p.category, p.year, p.location, p.description, JSON.stringify(p.images), p.pdf ? JSON.stringify(p.pdf) : null, p.published ? 1 : 0, old.id).run();
      const keep = new Set(projectMedia(p));
      await deleteMedia(env, projectMedia(old).filter((u) => !keep.has(u)));
      return json({ project: { id: old.id, ...p, example: old.example } });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(old.id).run();
      await deleteMedia(env, projectMedia(old));
      return json({ ok: true });
    }
  }

  if (path === '/api/media' && method === 'POST') {
    if (!env.MEDIA) fail(503, "Le stockage des fichiers (R2) n'est pas configuré.");
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = TYPES[type];
    if (!ext) fail(415, 'Format non pris en charge. Utilisez une image JPEG, PNG, WebP ou un PDF.');
    const size = Number(request.headers.get('content-length') || 0);
    const max = type === 'application/pdf' ? MAX_PDF : MAX_IMAGE;
    if (size > max) fail(413, `Fichier trop lourd (maximum ${Math.round(max / 1048576)} Mo).`);
    const name = str(decodeURIComponent(request.headers.get('x-filename') || ''), 160) || 'fichier.' + ext;
    const key = uid() + '.' + ext;
    const obj = await env.MEDIA.put(key, request.body, {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { name },
    });
    if (obj.size > max) { await env.MEDIA.delete(key); fail(413, `Fichier trop lourd (maximum ${Math.round(max / 1048576)} Mo).`); }
    return json({ url: '/media/' + key, name, size: obj.size, type }, 201);
  }

  const mm = path.match(/^\/api\/media\/([A-Za-z0-9._-]+)$/);
  if (mm && method === 'DELETE') {
    const url = '/media/' + mm[1];
    // Never delete a file that is still used by a project or the site texts.
    const used = await env.DB.prepare("SELECT 1 FROM projects WHERE images LIKE ? OR pdf LIKE ? UNION SELECT 1 FROM settings WHERE data LIKE ? LIMIT 1")
      .bind(`%"${url}"%`, `%"${url}"%`, `%"${url}"%`).first();
    if (!used) await deleteMedia(env, [url]);
    return json({ ok: true, kept: !!used });
  }

  fail(404, 'Route inconnue.');
}

/* ------------------------------------------------------------------ media */

async function serveMedia(request, env, url) {
  if (!env.MEDIA) return new Response('Stockage non configuré', { status: 503 });
  const key = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!/^[A-Za-z0-9._-]+$/.test(key)) return new Response('Introuvable', { status: 404 });

  const obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  if (!obj) return new Response('Introuvable', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  const name = obj.customMetadata?.name || key;
  const disp = url.searchParams.has('download') ? 'attachment' : 'inline';
  headers.set('content-disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(name)}`);

  if (!('body' in obj) || !obj.body) return new Response(null, { status: 304, headers });
  if (obj.range && request.headers.has('range')) {
    const { offset = 0, length = obj.size - offset } = obj.range;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set('content-length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
}
