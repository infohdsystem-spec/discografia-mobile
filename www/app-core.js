/* =========================================================================
   DISCOGRAFÍA v7.0.12 — Core (Parte 1/2)
   Constantes, utilidades, módulos, datos, enriquecimiento, streaming, legal,
   bulk, notFound, red, carpetas, lightbox.
   Autor: HDSystem IT · Tel: +54 9 11 4563-0851
   ========================================================================= */

const APP_VERSION = "7.0.12";
const STORAGE_KEY = 'discografia_db_v3';
const NOTFOUND_KEY = 'discografia_notfound_v1';
const OWNER_KEY = 'discografia_owner_v1';
const METACACHE_KEY = 'discografia_metacache_v1';
const CUSTOMFIELDS_KEY = 'discografia_custom_fields_v1';
const HISTORY_KEY = 'discografia_history_v1';
const THEME_KEY = 'discografia_theme_v1';
const UNDO_LIMIT = 30;
const MB_API = 'https://musicbrainz.org/ws/2/';
const DISCOGS_API = 'https://api.discogs.com';
const DISCOGS_CONFIG_KEY = 'discografia_discogs_config_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MIN_CONFIDENCE = 90;
const ISRC_REGEX = /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/;
const DEFAULT_AUTHOR = "HDSystem IT";
const DEFAULT_PHONE = "+54 9 11 4563-0851";
const COPYRIGHT_TEXT = "© 2024-" + new Date().getFullYear() + " HDSystem IT · Todos los derechos reservados";
const FETCH_TIMEOUT_MS = 8000;
const DISCOGS_TEST_TIMEOUT_MS = 25000;
const DISCOGS_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const RESOLVED_LINKS_KEY = 'discografia_resolved_links_v1';
const LEGAL_NOTICE_KEY = 'discografia_legal_accepted_v1';
const LEGAL_SIGNATURE_KEY = 'discografia_legal_signature_v1';
const RESOLVED_TTL = 30 * 24 * 3600000;
const RESOLVED_MAX = 500;

const ALLOWED_STREAM_DOMAINS = [
  'open.spotify.com',
  'music.youtube.com','youtube.com','youtu.be',
  'music.apple.com','itunes.apple.com',
  'deezer.com',
  'tidal.com',
  'music.amazon.com','amazon.com',
  'soundcloud.com',
  'discogs.com'
];

const isFileProtocol = () => location.protocol === 'file:';

function buildMBUserAgent(){
  let contact = '';
  try { const o = JSON.parse(localStorage.getItem(OWNER_KEY) || '{}'); contact = (o.email || o.contact || '').trim(); } catch(e){}
  if (!contact) contact = 'noreply@example.com';
  return `DiscografiaApp/${APP_VERSION} ( ${contact} )`;
}
let MB_USER_AGENT = buildMBUserAgent();

function isAlbumUrl(url, svcKey){
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase() + u.search.toLowerCase();
    switch(svcKey){
      case 'spotify':    return path.includes('/album/') && !path.includes('/track/') && !path.includes('/playlist/');
      case 'apple':      return path.includes('/album/');
      case 'deezer':     return path.includes('/album/') && !path.includes('/track/');
      case 'tidal':      return path.includes('/album/') && !path.includes('/track/');
      case 'youtube':    return path.includes('olak5uy') || path.includes('/browse/') || path.includes('/playlist');
      case 'amazon':     return path.includes('/albums/') && !path.includes('/tracks/');
      case 'soundcloud': return path.includes('/sets/');
      default: return true;
    }
  } catch(e){ return false; }
}

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function freeLocalStorageCaches(){
  const keysToDrop = [METACACHE_KEY, RESOLVED_LINKS_KEY, HISTORY_KEY, NOTFOUND_KEY];
  let freed = 0;
  for (const k of keysToDrop){
    try {
      const prev = localStorage.getItem(k);
      if (prev){ freed += prev.length; localStorage.removeItem(k); }
    } catch(e){}
  }
  try { if (typeof MetadataCache !== 'undefined' && MetadataCache.clear) MetadataCache.clear(); } catch(e){}
  try { if (typeof ResolvedLinks !== 'undefined' && ResolvedLinks.clear) ResolvedLinks.clear(); } catch(e){}
  try {
    const keep = new Set([STORAGE_KEY, DISCOGS_CONFIG_KEY, OWNER_KEY, 'discografia_legal_v1', 'discografia_theme_v1', 'discografia_folder_path_v1']);
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.startsWith('discografia_') && !keep.has(k) && k !== STORAGE_KEY) toRemove.push(k);
    }
    for (const k of toRemove){
      try {
        const prev = localStorage.getItem(k);
        if (prev) freed += prev.length;
        localStorage.removeItem(k);
      } catch(e){}
    }
  } catch(e){}
  return freed;
}
function isQuotaError(e){
  return !!(e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message||''))));
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const upper = v => (v === null || v === undefined) ? "" : String(v).toUpperCase();

const STREAMING_SERVICES = [
  { key:'spotify',   name:'Spotify',       icon:'🟢', pattern:/open\.spotify\.com/i,     color:'#1db954' },
  { key:'youtube',   name:'YouTube Music', icon:'🔴', pattern:/(music\.)?youtube\.com/i, color:'#ff0000' },
  { key:'apple',     name:'Apple Music',   icon:'🍎', pattern:/music\.apple\.com/i,      color:'#fa243c' },
  { key:'deezer',    name:'Deezer',        icon:'🎵', pattern:/deezer\.com/i,            color:'#a238ff' },
  { key:'tidal',     name:'Tidal',         icon:'🌊', pattern:/tidal\.com/i,             color:'#00d4ff' },
  { key:'amazon',    name:'Amazon Music',  icon:'📦', pattern:/music\.amazon\./i,        color:'#ff9900' },
  { key:'soundcloud',name:'SoundCloud',    icon:'☁️', pattern:/soundcloud\.com/i,        color:'#ff5500' },
  { key:'discogs',   name:'Discogs',       icon:'💿', pattern:/discogs\.com/i,           color:'#555555' }
];

function isAnyModalOpen(){
  const modals = ["#modal","#pasteModal","#catModal","#manualModal","#bulkEnrichModal","#notFoundModal","#discogsConfigModal","#ownerConfigModal","#bulkMoveModal","#viewModal","#folderConfigModal","#folderBrowserModal","#networkDiagModal","#autoBackupModal","#duplicatesModal","#customFieldsModal","#historyModal","#scannerModal","#loansModal","#exitModal","#albumConfirmModal","#legalModal"];
  return modals.some(sel => $(sel)?.classList.contains("open")) || !!$("#coverLightbox")?.classList.contains("open");
}

function highlight(texto, q){
  const t = esc(texto);
  if (!q) return t;
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return t;
  const accented = {'a':'[aàáâäãå]','e':'[eèéêë]','i':'[iìíîï]','o':'[oòóôöõ]','u':'[uùúûü]','n':'[nñ]','c':'[cç]','y':'[yýÿ]'};
  const buildPattern = term => term.split('').map(ch => { const low = ch.toLowerCase(); if (accented[low]) return accented[low]; return ch.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }).join('');
  const pattern = terms.map(buildPattern).join("|");
  try { return t.replace(new RegExp(`(${pattern})`,"ig"), "<mark>$1</mark>"); } catch { return t; }
}
function debounce(fn, ms=160){ let t; const w = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; w.cancel = () => { clearTimeout(t); t = null; }; return w; }
function download(filename, content, mime="application/json"){
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}
function timestamp(){ const d = new Date(), pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`; }
function findRowByKey(key){ if (!key) return null; return $$("#tbodyCD tr").find(tr => tr.dataset.key === key) || null; }

function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT_MS){
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try { controller.abort(new DOMException(`Timeout after ${timeoutMs}ms`, 'TimeoutError')); }
    catch(_) { controller.abort(); }
  }, timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const _lastCallBySource = { MusicBrainz: 0, Discogs: 0 };
const _minDelayBySource = { MusicBrainz: 1000, Discogs: 1000 };
async function throttleSource(source){
  const minMs = _minDelayBySource[source] ?? 500;
  const now = Date.now();
  const wait = Math.max(0, minMs - (now - (_lastCallBySource[source] || 0)));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCallBySource[source] = Date.now();
}
let _mb503Until = 0, _discogs429Until = 0;

function stripParenthetical(s){
  return String(s||'').replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeYear(y){
  if (y === null || y === undefined || y === '') return null;
  const n = parseInt(String(y).slice(0, 4), 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1900 || n > 2100) return null;
  return n;
}

function normMatch(s){ return String(s||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function levenshtein(a, b){
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}
function stripArticles(s){ return String(s||'').replace(/^(the|a|an|el|la|los|las|un|una)\s+/i,'').replace(/\s+(the|a|an|el|la|los|las|un|una)$/i,'').trim(); }
function similarity(a, b){
  const x = normMatch(stripArticles(a)), y = normMatch(stripArticles(b));
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.9;
  const A = new Set(x.split(' ')), B = new Set(y.split(' '));
  const inter = [...A].filter(v => B.has(v)).length;
  const union = new Set([...A, ...B]).size;
  const j = union ? inter / union : 0;
  const lev = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  return Math.max(j, lev * 0.9);
}
function matchConfidence(t, i, cand){ return Math.round((similarity(t, cand.title) * 0.6 + similarity(i, cand.artist) * 0.4) * 100); }

function esSoloOrtografia(a, b){
  const A = String(a||'').trim(), B = String(b||'').trim();
  if (!A || !B) return false;
  const an = normMatch(A), bn = normMatch(B);
  if (an === bn) return true;
  const ap = normMatch(stripParenthetical(A));
  const bp = normMatch(stripParenthetical(B));
  if (ap && bp && ap === bp) return true;
  const sim = similarity(A, B);
  const lenDiff = Math.abs(A.length - B.length);
  if (sim >= 0.90 && lenDiff <= 3) return true;
  return false;
}

function corregirCampo(valorActual, valorAPI, confianza, replace, umbralMin = 85){
  const cur = String(valorActual || '').trim();
  const api = String(valorAPI  || '').trim();
  if (!api) return null;
  if (Number(confianza) < umbralMin) return null;
  if (cur === api) return null;
  if (!cur) return api;
  if (esSoloOrtografia(cur, api)) return api;
  if (replace) return api;
  return null;
}

function confidenceChip(conf){
  const n = Number(conf) || 0;
  const color = n >= 90 ? 'var(--ok)' : n >= 75 ? 'var(--accent2)' : 'var(--warn)';
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:.68rem;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}55">● ${n}%</span>`;
}

function limpiarTituloParaBusqueda(titulo){
  let t = String(titulo || '').trim();
  if (!t) return '';
  t = t.replace(/[*#]+/g, ' ');
  t = t.replace(/\.{2,}/g, ' ');
  const parts = t.split(/\s*\/\s*/);
  if (parts.length === 2 && normMatch(parts[0]) === normMatch(parts[1])) t = parts[0];
  t = t.replace(/\s*\(\s*(en\s+vivo|live)\s*\)\s*$/i, '').trim();
  t = t.replace(/\s+(CD|VOL|VOLUMEN|PARTE|DISC|DISCO)\s*#?\s*\d+\s*$/i, '').trim();
  t = t.replace(/\s+GIRA\s+/i, ' ').trim();
  t = t.replace(/\s+([AB])\s*$/i, (m) => {
    const sinLado = t.replace(/\s+([AB])\s*$/i, '').trim();
    return sinLado.length >= 5 ? '' : m;
  }).trim();
  return t.replace(/\s+/g, ' ').trim();
}

const TYPOS_INTERPRETES = {
  'soda estereo': 'Soda Stereo','soda estéreo': 'Soda Stereo','the beatle': 'The Beatles',
  'beatle': 'The Beatles','rolling stone': 'The Rolling Stones','led zeppelin': 'Led Zeppelin',
  'pink floid': 'Pink Floyd','ac dc': 'AC/DC','acdc': 'AC/DC','guns and roses': "Guns N' Roses",
  'gun n roses': "Guns N' Roses",'black sabath': 'Black Sabbath','charly garcia': 'Charly García',
  'charly garcía': 'Charly García','luis alberto spinetta': 'Luis Alberto Spinetta',
  'spinetta jade': 'Spinetta Jade','seru giran': 'Serú Girán','seru girá': 'Serú Girán',
  'fito paez': 'Fito Páez','fito páez': 'Fito Páez','enanos verdes': 'Enanitos Verdes',
  'los enanitos verdes': 'Enanitos Verdes','los fabulosos cadillacs': 'Los Fabulosos Cadillacs',
  'patricio rey': 'Patricio Rey y sus Redonditos de Ricota',
  'redonditos de ricota': 'Patricio Rey y sus Redonditos de Ricota'
};
function limpiarInterpreteParaBusqueda(interprete){
  let i = String(interprete || '').trim();
  if (!i) return '';
  i = i.replace(/[*#]+/g, ' ').trim();
  i = i.replace(/\s+/g, ' ').trim();
  const key = normMatch(i);
  if (TYPOS_INTERPRETES[key]) i = TYPOS_INTERPRETES[key];
  return i;
}

/* ═══════════════════════════════════════════════════════════════════
   Módulos base
   ═══════════════════════════════════════════════════════════════════ */

const ThemeManager = (() => {
  function load(){ try { const s = localStorage.getItem(THEME_KEY); if (s === 'light' || s === 'dark') return s; return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch(e){ return 'dark'; } }
  function apply(theme){
    document.body.classList.toggle('theme-light', theme === 'light');
    const btn = $('#themeToggle'); if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  }
  function toggle(){
    const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch(e){}
    apply(next);
    Toast.show(next === 'light' ? '☀️ Tema claro' : '🌙 Tema oscuro', 'info', 1800);
  }
  function init(){ apply(load()); }
  return { init, toggle, apply };
})();

const FileSystemDefault = (() => {
  const DB_NAME = 'discografia_fs_v1', STORE = 'handles', HANDLE_KEY = 'defaultDir';
  const LS_PATH_KEY = 'discografia_folder_path_v1';

  let dirHandle = null;
  let folderPath = null;
  let mode = 'browser';

  function detectMode(){
    try {
      if (window.__DISCO_FS__ && typeof window.__DISCO_FS__.isAvailable === 'function' && window.__DISCO_FS__.isAvailable()){
        return 'tauri';
      }
    } catch(e){}
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window && 'showSaveFilePicker' in window){
      return 'browser';
    }
    return 'unsupported';
  }

  function openDB(){ return new Promise((res, rej) => { const req = indexedDB.open(DB_NAME, 1); req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); }; req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
  async function idbPut(k, v){ const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function idbGet(k){ const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readonly'); const r = tx.objectStore(STORE).get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function idbDel(k){ const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

  async function ensurePermission(h, m = 'readwrite'){
    if (!h) return false;
    try {
      const o = { mode: m };
      if ((await h.queryPermission(o)) === 'granted') return true;
      if ((await h.requestPermission(o)) === 'granted') return true;
    } catch(e){ return false; }
    return false;
  }

  async function load(){
    mode = detectMode();
    if (mode === 'tauri'){
      try { folderPath = localStorage.getItem(LS_PATH_KEY) || null; } catch(e){ folderPath = null; }
      return;
    }
    if (mode === 'browser'){
      try {
        const h = await idbGet(HANDLE_KEY);
        if (h) dirHandle = h;
      } catch(e){ console.warn('FS load:', e); }
    }
  }

  async function pickFolder(){
    if (mode === 'tauri'){
      const p = await window.__DISCO_FS__.pickFolder();
      if (!p) throw new Error('Sin selección');
      folderPath = String(p);
      try { localStorage.setItem(LS_PATH_KEY, folderPath); } catch(e){}
      return { name: folderPath.split(/[\\/]/).filter(Boolean).pop() || folderPath };
    }
    if (mode === 'browser'){
      const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'discografia-default', startIn: 'documents' });
      if (!(await ensurePermission(h, 'readwrite'))) throw new Error('Permiso denegado');
      dirHandle = h;
      await idbPut(HANDLE_KEY, h);
      return h;
    }
    throw new Error('Navegador sin soporte');
  }

  async function clear(){
    if (mode === 'tauri'){
      folderPath = null;
      try { localStorage.removeItem(LS_PATH_KEY); } catch(e){}
      return;
    }
    dirHandle = null;
    try { await idbDel(HANDLE_KEY); } catch(e){}
  }

  const getHandle = () => dirHandle;
  const getName = () => {
    if (mode === 'tauri') return folderPath ? (folderPath.split(/[\\/]/).filter(Boolean).pop() || folderPath) : null;
    return dirHandle?.name || null;
  };
  const isSet = () => (mode === 'tauri') ? !!folderPath : !!dirHandle;
  const isSupported = () => mode !== 'unsupported';
  const getMode = () => mode;

  async function ensureReady(m = 'readwrite'){
    if (mode === 'tauri') return !!folderPath;
    if (mode === 'browser'){ if (!dirHandle) return false; return await ensurePermission(dirHandle, m); }
    return false;
  }

  function joinPath(dir, name){
    if (!dir) return name;
    const sep = dir.indexOf('\\') !== -1 ? '\\' : '/';
    const clean = String(dir).replace(/[\\/]+$/, '');
    return clean + sep + name;
  }

  async function saveFile(name, content, mime = 'application/json'){
    if (mode === 'tauri'){
      if (!folderPath) throw new Error('Sin carpeta');
      const full = joinPath(folderPath, name);
      await window.__DISCO_FS__.save(full, content);
      return true;
    }
    if (mode === 'browser'){
      if (!dirHandle) throw new Error('Sin carpeta');
      if (!(await ensureReady('readwrite'))) throw new Error('Permiso denegado');
      const fh = await dirHandle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(new Blob([content], { type: mime + ';charset=utf-8' }));
      await w.close();
      return true;
    }
    throw new Error('Navegador sin soporte');
  }

  async function listFiles(){
    if (mode === 'tauri'){
      if (!folderPath) return [];
      const items = await window.__DISCO_FS__.list(folderPath);
      return (items || [])
        .filter(it => it.isFile)
        .map(it => ({ name: it.name, size: it.size || 0, modifiedTime: it.modifiedTime || 0, handle: null }))
        .sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));
    }
    if (mode === 'browser'){
      if (!dirHandle) return [];
      if (!(await ensureReady('read'))) return [];
      const out = [];
      for await (const [name, h] of dirHandle.entries()){
        if (h.kind === 'file'){
          try {
            const f = await h.getFile();
            out.push({ name, size: f.size, modifiedTime: f.lastModified, handle: h });
          } catch(e){}
        }
      }
      return out.sort((a, b) => b.modifiedTime - a.modifiedTime);
    }
    return [];
  }

  async function readFile(name){
    if (mode === 'tauri'){
      if (!folderPath) throw new Error('Sin carpeta');
      const full = joinPath(folderPath, name);
      return await window.__DISCO_FS__.read(full);
    }
    if (mode === 'browser'){
      if (!dirHandle) throw new Error('Sin carpeta');
      if (!(await ensureReady('read'))) throw new Error('Permiso denegado');
      const fh = await dirHandle.getFileHandle(name);
      const f = await fh.getFile();
      return await f.text();
    }
    throw new Error('Navegador sin soporte');
  }

  async function deleteFile(name){
    if (mode === 'tauri'){
      if (!folderPath) throw new Error('Sin carpeta');
      const full = joinPath(folderPath, name);
      await window.__DISCO_FS__.del(full);
      return true;
    }
    if (mode === 'browser'){
      if (!dirHandle) throw new Error('Sin carpeta');
      if (!(await ensureReady('readwrite'))) throw new Error('Permiso denegado');
      await dirHandle.removeEntry(name);
      return true;
    }
    throw new Error('Navegador sin soporte');
  }

  function refreshBadge(){
    const b = $("#folderBadge"); if (!b) return;
    const n = getName();
    if (n){
      b.textContent = '· ' + n;
      b.style.display = 'inline';
      b.style.cssText = 'display:inline-block;background:rgba(79,195,247,.25);color:var(--accent);border-radius:10px;padding:1px 7px;font-size:.62rem;font-weight:700;margin-left:6px';
    } else {
      b.textContent = ''; b.style.display = 'none';
    }
  }

  return { load, isSupported, isSet, getName, getHandle, pickFolder, clear, ensureReady, saveFile, listFiles, readFile, deleteFile, refreshBadge, getMode };
})();

async function saveOrDownload(filename, content, mimeType = "application/json"){
  if (FileSystemDefault.isSet() && FileSystemDefault.isSupported()){
    try { await FileSystemDefault.saveFile(filename, content, mimeType); Toast.show(`💾 Guardado en "${FileSystemDefault.getName()}"`, "ok", 3500); return true; }
    catch(err){ Toast.show(`No se pudo escribir: ${err.message}. Descargando…`, "warn", 5500); }
  }
  download(filename, content, mimeType);
  Toast.show("📥 Archivo descargado", "ok", 2800);
  return true;
}

const OwnerConfig = (() => {
  let data = { name: "", contact: "", email: "" };
  function load(){ try { const r = localStorage.getItem(OWNER_KEY); if (r) data = Object.assign(data, JSON.parse(r) || {}); } catch(e){} }
  function persist(){ try { localStorage.setItem(OWNER_KEY, JSON.stringify(data)); } catch(e){} }
  const get = () => ({ ...data });
  function set(d){ data = { name: String(d.name||'').trim(), contact: String(d.contact||'').trim(), email: String(d.email||'').trim() }; persist(); MB_USER_AGENT = buildMBUserAgent(); render(); }
  function clear(){ data = { name:'', contact:'', email:'' }; localStorage.removeItem(OWNER_KEY); MB_USER_AGENT = buildMBUserAgent(); render(); }
  const displayName = () => data.name || DEFAULT_AUTHOR;
  function contactLine(){ const p = []; if (data.contact) p.push(data.contact); if (data.email) p.push(data.email); return p.join(' · '); }
  function render(){
    const dc = contactLine() || DEFAULT_PHONE;
    const fl = $("#footerAuthorLine"); if (fl) fl.innerHTML = `<b>Autor:</b> ${esc(displayName())} <span class="sep">|</span><b>Tel:</b> ${esc(dc)} <span class="sep">|</span><span class="copy"><span class="footer-version">Discografía v${APP_VERSION}</span> · ${esc(COPYRIGHT_TEXT)}</span>`;
    const pl = $("#printOwnerLine"); if (pl) pl.innerHTML = `Lista generada el <span id="printDate">—</span> · ${esc(displayName())} · ${esc(dc)}`;
    const pf = $("#printFooterLine"); if (pf) pf.textContent = `Discografía v${APP_VERSION} — ${displayName()} — ${dc} — ${COPYRIGHT_TEXT}`;
    const mi = $("#manualOwnerInfo"); if (mi) mi.innerHTML = `<b>${esc(displayName())}</b><br>📞 ${esc(dc)}<br>${esc(COPYRIGHT_TEXT)}`;
  }
  return { load, persist, get, set, clear, render, displayName, contactLine };
})();

const MetadataCache = (() => {
  let cache = {};
  function load(){ try { const r = localStorage.getItem(METACACHE_KEY); if (r){ const p = JSON.parse(r); if (p && typeof p === 'object') cache = p; } } catch(e){ cache = {}; } }
  function persist(){ try { localStorage.setItem(METACACHE_KEY, JSON.stringify(cache)); } catch(e){} }
  const key = (t, i, y) => norm(`${i||''}|${t||''}|${y||''}`).replace(/\s+/g,' ').trim();
  function get(t, i, y){ const k = key(t, i, y); const e = cache[k]; if (!e) return null; if (Date.now() - (e.ts||0) > CACHE_TTL_MS){ delete cache[k]; return null; } return e.data; }
  function set(t, i, y, d){ if (!d) return; const c = Number(d.confidence||0); if (c < CACHE_MIN_CONFIDENCE) return; cache[key(t,i,y)] = { ts: Date.now(), data: d }; persist(); }
  function clear(){ cache = {}; try { localStorage.removeItem(METACACHE_KEY); } catch(e){} }
  return { load, persist, get, set, clear };
})();

const Toast = (() => {
  const container = $("#toasts");
  const icons = { ok:'✓', err:'✕', warn:'⚠', info:'ℹ' };
  return {
    show(msg, type="ok", ms=3200, action=null){
      const el = document.createElement("div");
      el.className = "toast " + type;
      el.innerHTML = `<div class="toast-icon">${icons[type]||icons.info}</div><div class="toast-content">${esc(msg)}</div>`;
      if (action){ const b = document.createElement("button"); b.type = "button"; b.textContent = action.label; b.onclick = () => { action.fn(); el.remove(); }; el.appendChild(b); }
      container.appendChild(el);
      setTimeout(() => { el.classList.add("hide"); setTimeout(() => el.remove(), 220); }, ms);
    }
  };
})();

const CustomFields = (() => {
  let fields = [];
  function load(){ try { const r = localStorage.getItem(CUSTOMFIELDS_KEY); if (r) fields = JSON.parse(r) || []; } catch(e){ fields = []; } }
  function persist(){ try { localStorage.setItem(CUSTOMFIELDS_KEY, JSON.stringify(fields)); } catch(e){} }
  const getAll = () => [...fields];
  function add({ name, type, options }){
    if (!name || !name.trim()) return false;
    const clean = name.trim().slice(0, 40);
    if (fields.some(f => f.name.toLowerCase() === clean.toLowerCase())){ Toast.show('Ya existe un campo con ese nombre', 'warn'); return false; }
    fields.push({ id: 'cf_' + Date.now().toString(36), name: clean, type: type || 'text', options: options ? options.split(',').map(o => o.trim()).filter(Boolean) : [] });
    persist(); return true;
  }
  function remove(id){ fields = fields.filter(f => f.id !== id); persist(); }
  function render(){
    const list = $('#cfList'); if (!list) return;
    if (!fields.length){ list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:.82rem">Sin campos personalizados</div>'; return; }
    list.innerHTML = fields.map(f => `<div class="cf-item"><div class="cf-name">${esc(f.name)}</div><div class="cf-type">${esc(f.type)}</div><button type="button" data-cf-del="${esc(f.id)}" title="Eliminar">🗑️</button></div>`).join('');
    list.querySelectorAll('[data-cf-del]').forEach(btn => {
      btn.addEventListener('click', () => { if (!confirm('¿Eliminar este campo?')) return; remove(btn.dataset.cfDel); render(); Toast.show('Campo eliminado','warn'); });
    });
  }
  function renderInModal(values = {}){
    const host = $('#customFieldsHost'); if (!host) return;
    if (!fields.length){ host.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:.82rem">No hay campos personalizados definidos.</div>'; return; }
    host.innerHTML = fields.map(f => {
      const val = values[f.id] ?? '';
      let input;
      if (f.type === 'number') input = `<input type="number" data-cf-input="${esc(f.id)}" value="${esc(val)}" style="width:100%;padding:9px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;color:var(--txt);font-size:.9rem">`;
      else if (f.type === 'date') input = `<input type="date" data-cf-input="${esc(f.id)}" value="${esc(val)}" style="width:100%;padding:9px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;color:var(--txt);font-size:.9rem">`;
      else if (f.type === 'boolean') input = `<select data-cf-input="${esc(f.id)}" style="width:100%;padding:9px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;color:var(--txt);font-size:.9rem"><option value="">—</option><option value="true"${val==='true'?' selected':''}>Sí</option><option value="false"${val==='false'?' selected':''}>No</option></select>`;
      else if (f.type === 'select') input = `<select data-cf-input="${esc(f.id)}" style="width:100%;padding:9px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;color:var(--txt);font-size:.9rem"><option value="">—</option>${f.options.map(o => `<option value="${esc(o)}"${val===o?' selected':''}>${esc(o)}</option>`).join('')}</select>`;
      else input = `<input type="text" data-cf-input="${esc(f.id)}" data-uppercase value="${esc(val)}" style="width:100%;padding:9px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;color:var(--txt);font-size:.9rem">`;
      return `<div class="field"><label>${esc(f.name)} <span style="font-size:.6rem;color:var(--muted)">(${esc(f.type)})</span></label>${input}</div>`;
    }).join('');
  }
  function readFromModal(){
    const out = {};
    $$('#customFieldsHost [data-cf-input]').forEach(el => { const v = el.value.trim(); if (v !== '') out[el.dataset.cfInput] = v; });
    return out;
  }
  return { load, persist, getAll, add, remove, render, renderInModal, readFromModal };
})();

const HistoryLog = (() => {
  const MAX = 200;
  let items = [];
  function load(){ try { const r = localStorage.getItem(HISTORY_KEY); if (r) items = JSON.parse(r) || []; } catch(e){ items = []; } }
  function persist(){ try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(-MAX))); } catch(e){} }
  function log(cat, title, detail){
    items.push({ id: 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6), cat: cat||'INFO', title: String(title||'').slice(0,120), detail: String(detail||'').slice(0,200), ts: new Date().toISOString() });
    if (items.length > MAX) items = items.slice(-MAX);
    persist();
  }
  const getAll = () => [...items].reverse();
  function clear(){ items = []; persist(); }
  function filtered(cat, search){
    let out = getAll();
    if (cat) out = out.filter(i => i.cat === cat);
    if (search){ const s = norm(search); out = out.filter(i => norm(i.title + ' ' + i.detail).includes(s)); }
    return out;
  }
  function render(){
    const list = $('#histList'); if (!list) return;
    const cat = $('#histFilter')?.value || '';
    const search = $('#histSearch')?.value || '';
    const fi = filtered(cat, search);
    if (!fi.length){ list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-style:italic">Sin actividad registrada</div>'; return; }
    const icons = { CREATE:'➕', EDIT:'✏️', DELETE:'🗑️', IMPORT:'📥', ENRICH:'✨', LOAN:'📚', EXPORT:'📄', INFO:'ℹ️' };
    list.innerHTML = fi.map(i => `<div class="history-item cat-${esc(i.cat)}"><span class="hi-icon">${icons[i.cat]||'📌'}</span><div class="hi-text"><div class="hi-title">${esc(i.title)}</div>${i.detail ? `<div class="hi-detail">${esc(i.detail)}</div>` : ''}</div><div class="hi-time">${new Date(i.ts).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}</div></div>`).join('');
  }
  function exportCSV(){
    const all = getAll();
    if (!all.length){ Toast.show('Historial vacío','warn'); return; }
    const sep = ';';
    const e = v => { const s = String(v??''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const rows = [['Fecha','Categoría','Acción','Detalle'].join(sep)];
    for (const i of all) rows.push([i.ts, i.cat, i.title, i.detail].map(e).join(sep));
    saveOrDownload(`discografia_historial_${timestamp()}.csv`, '\uFEFF' + rows.join('\r\n'), 'text/csv');
  }
  return { load, persist, log, getAll, clear, filtered, render, exportCSV };
})();

const Store = (() => {
  let db = null;
  let _allCDsCache = null;
  function invalidateCache(){ _allCDsCache = null; }
  function buildEmpty(){ return { version: 5, updated: null, seeded: true, categories: {}, prefs: { enrich: true, autoBackup: true, replaceOnEnrich: true } }; }
  function slugify(str){ return String(str||'').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,32) || "cat_" + Date.now().toString(36); }
  function uniqueKey(base, cats){ let k = base, i = 2; while (cats[k]) k = base + "_" + (i++); return k; }
  function sanitizeProvenance(p){
    if (!p || typeof p !== 'object') return {};
    const out = {};
    for (const k in p){
      const v = p[k]; if (!v || typeof v !== 'object') continue;
      out[k] = { source: v.source ? String(v.source) : null, confidence: (typeof v.confidence === 'number' && Number.isFinite(v.confidence)) ? v.confidence : null, date: v.date || null };
    }
    return out;
  }
  function genSubId(){ return 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
  function sanitizeSubcategories(arr){
    if (!Array.isArray(arr)) return [];
    return arr.map(s => ({
      id: s.id || genSubId(),
      label: String(s.label || 'Sin nombre'),
      icon: String(s.icon || '📂')
    }));
  }
  function hydrate(cd){
    return {
      id: cd.id || (crypto.randomUUID ? crypto.randomUUID() : "cd_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2)),
      nro: cd.nro ?? 0,
      titulo: upper(cd.titulo),
      interprete: upper(cd.interprete),
      anio: cd.anio ?? null,
      anioEdicion: cd.anioEdicion ?? null,
      formato: cd.formato ?? "CD", estado: cd.estado ?? "Excelente",
      estadoDisco: cd.estadoDisco ?? "", estadoCaja: cd.estadoCaja ?? "",
      estadoFolleto: cd.estadoFolleto ?? "", estadoArte: cd.estadoArte ?? "",
      sello: upper(cd.sello), genero: upper(cd.genero), catalogo: upper(cd.catalogo),
      codigo: cd.codigo ?? "", isrc: (cd.isrc ?? "").toString().toUpperCase(), edicion: upper(cd.edicion), pais: upper(cd.pais),
      ubicacion: upper(cd.ubicacion), cantidad: cd.cantidad ?? 1,
      adquisicion: cd.adquisicion ?? "", valor: cd.valor ?? null, moneda: cd.moneda ?? "ARS",
      notas: cd.notas ?? "",
      mbId: cd.mbId ?? null, discogsId: cd.discogsId ?? null,
      portada: cd.portada ?? null, portadaSource: cd.portadaSource ?? null,
      enrichmentSource: cd.enrichmentSource ?? null, enrichmentConfidence: cd.enrichmentConfidence ?? null, enrichedAt: cd.enrichedAt ?? null,
      provenance: sanitizeProvenance(cd.provenance),
      prestadoA: upper(cd.prestadoA), fechaPrestamo: cd.fechaPrestamo ?? "",
      fechaDevolucion: cd.fechaDevolucion ?? "", notasPrestamo: upper(cd.notasPrestamo),
      customFields: (cd.customFields && typeof cd.customFields === 'object') ? { ...cd.customFields } : {},
      links: (cd.links && typeof cd.links === 'object' && !Array.isArray(cd.links)) ? { ...cd.links } : {},
      subcat: cd.subcat ?? null
    };
  }
  function load(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw){
        const p = JSON.parse(raw);
        if (p && p.categories && typeof p.categories === 'object'){
          const clean = {};
          for (const k in p.categories){
            const c = p.categories[k] || {};
            clean[k] = {
              label: c.label || k,
              icon: c.icon || "📀",
              subcategories: sanitizeSubcategories(c.subcategories),
              cds: Array.isArray(c.cds) ? c.cds.map(hydrate) : []
            };
          }
          db = { version: 5, updated: p.updated || null, seeded: p.seeded === true, categories: clean, prefs: Object.assign({ enrich: true, autoBackup: true, replaceOnEnrich: true }, p.prefs || {}) };
          invalidateCache();
          return;
        }
      }
    } catch(e){ console.warn("localStorage:", e); }
    db = buildEmpty();
    invalidateCache();
  }
  function persist(){
    try { db.updated = new Date().toISOString(); localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); invalidateCache(); updateModifiedLabel(); }
    catch(e){
      if (isQuotaError(e)){
        freeLocalStorageCaches();
        try {
          db.updated = new Date().toISOString();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          invalidateCache(); updateModifiedLabel();
          Toast.show("⚠️ Storage lleno: se liberaron cachés y se reintentó guardar.", "warn", 8000);
          return;
        } catch(e2){
          Toast.show("⚠️ Almacenamiento lleno. Exportá un backup YA (Ctrl+S) y vaciá caché en ⚙️.", "err", 12000);
        }
      } else Toast.show("No se pudo guardar: " + e.message, "err", 7000);
    }
  }
  const persistSilent = persist;
  function updateModifiedLabel(){
    const el = $("#fModified"); if (!el) return;
    if (db.updated){ const d = new Date(db.updated); el.innerHTML = `· 💾 ${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}`; el.style.color = "var(--ok)"; }
    else { el.textContent = "· Sin cambios"; el.style.color = "var(--muted)"; }
  }
  function allCDs(){ if (!_allCDsCache) _allCDsCache = Object.values(db.categories).flatMap(c => c.cds); return _allCDsCache; }
  const total = () => allCDs().length;
  const get = cat => db.categories[cat];
  const getCDs = cat => db.categories[cat]?.cds || [];
  const categories = () => db.categories;
  const catKeys = () => Object.keys(db.categories);
  function resetAll(){ localStorage.removeItem(STORAGE_KEY); db = buildEmpty(); invalidateCache(); persist(); try { localStorage.removeItem(NOTFOUND_KEY); } catch(e){} if (typeof NotFoundList !== "undefined") NotFoundList.clear(); }
  function replaceAll(nd){
    db = { version: 5, updated: new Date().toISOString(), seeded: true, categories: {}, prefs: db?.prefs || { enrich: true, autoBackup: true, replaceOnEnrich: true } };
    const src = nd?.categories || {};
    for (const k in src){
      const c = src[k] || {};
      db.categories[k] = {
        label: c.label || k,
        icon: c.icon || "📀",
        subcategories: sanitizeSubcategories(c.subcategories),
        cds: Array.isArray(c.cds) ? c.cds.map(hydrate) : []
      };
    }
    invalidateCache(); persist();
  }
  function addCategory({ label, icon } = {}){
    const key = uniqueKey(slugify(label), db.categories);
    db.categories[key] = { label: label || "Nueva categoría", icon: icon || "📀", subcategories: [], cds: [] };
    persist(); return key;
  }
  function updateCategory(key, { label, icon } = {}){
    if (!db.categories[key]) return false;
    if (label !== undefined) db.categories[key].label = label;
    if (icon !== undefined) db.categories[key].icon = icon;
    persist(); return true;
  }
  function deleteCategory(key){ if (!db.categories[key]) return false; delete db.categories[key]; persist(); return true; }
  function addSubcategory(catKey, { label, icon } = {}){
    const cat = db.categories[catKey];
    if (!cat) return null;
    if (!Array.isArray(cat.subcategories)) cat.subcategories = [];
    const id = genSubId();
    cat.subcategories.push({ id, label: String(label || 'Subcategoría'), icon: icon || '📂' });
    persist();
    return id;
  }
  function updateSubcategory(catKey, subId, { label, icon } = {}){
    const cat = db.categories[catKey];
    if (!cat || !Array.isArray(cat.subcategories)) return false;
    const sub = cat.subcategories.find(s => s.id === subId);
    if (!sub) return false;
    if (label !== undefined) sub.label = label;
    if (icon !== undefined) sub.icon = icon;
    persist();
    return true;
  }
  function deleteSubcategory(catKey, subId){
    const cat = db.categories[catKey];
    if (!cat || !Array.isArray(cat.subcategories)) return false;
    const idx = cat.subcategories.findIndex(s => s.id === subId);
    if (idx === -1) return false;
    cat.subcategories.splice(idx, 1);
    for (const cd of cat.cds){ if (cd.subcat === subId) cd.subcat = null; }
    persist();
    return true;
  }
  function moveSubcategory(catKey, subId, dir){
    const cat = db.categories[catKey];
    if (!cat || !Array.isArray(cat.subcategories)) return false;
    const i = cat.subcategories.findIndex(s => s.id === subId);
    if (i === -1) return false;
    const j = dir === 'left' ? i - 1 : i + 1;
    if (j < 0 || j >= cat.subcategories.length) return false;
    [cat.subcategories[i], cat.subcategories[j]] = [cat.subcategories[j], cat.subcategories[i]];
    persist();
    return true;
  }
  function getSubcategories(catKey){
    const cat = db.categories[catKey];
    return (cat && Array.isArray(cat.subcategories)) ? cat.subcategories.map(s => ({ ...s })) : [];
  }
  function getSubcategory(catKey, subId){
    const cat = db.categories[catKey];
    if (!cat || !Array.isArray(cat.subcategories)) return null;
    const s = cat.subcategories.find(x => x.id === subId);
    return s ? { ...s } : null;
  }
  function renameCategoryKey(oldKey, newLabel){
    if (!db.categories[oldKey]) return null;
    const nk = uniqueKey(slugify(newLabel), db.categories);
    const rebuilt = {};
    for (const k in db.categories){ if (k === oldKey) rebuilt[nk] = db.categories[oldKey]; else rebuilt[k] = db.categories[k]; }
    db.categories = rebuilt; db.categories[nk].label = newLabel; persist(); return nk;
  }
  function moveCategory(key, dir){
    const keys = catKeys(); const i = keys.indexOf(key); if (i === -1) return false;
    const j = dir === 'left' ? i - 1 : i + 1;
    if (j < 0 || j >= keys.length) return false;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    const rebuilt = {}; for (const k of keys) rebuilt[k] = db.categories[k];
    db.categories = rebuilt; persist(); return true;
  }
  const getPref = (k, d) => db.prefs?.[k] ?? d;
  function setPref(k, v){ db.prefs = db.prefs || {}; db.prefs[k] = v; persist(); }
  return { load, persist, persistSilent, resetAll, replaceAll, allCDs, total, get, getCDs, categories, catKeys, addCategory, updateCategory, deleteCategory, renameCategoryKey, moveCategory, hydrate, buildEmpty, slugify, uniqueKey, getPref, setPref, addSubcategory, updateSubcategory, deleteSubcategory, moveSubcategory, getSubcategories, getSubcategory, get isEmpty(){ return total() === 0 && catKeys().length === 0; } };
})();

const NotFoundList = (() => {
  let items = [];
  function load(){ try { const r = localStorage.getItem(NOTFOUND_KEY); if (r){ const p = JSON.parse(r); if (Array.isArray(p)) items = p; } } catch(e){} updateBadge(); }
  function persist(){ try { localStorage.setItem(NOTFOUND_KEY, JSON.stringify(items)); } catch(e){} updateBadge(); }
  function add(cd){ const i = items.findIndex(x => x.catKey === cd.catKey && x.nro === cd.nro); if (i === -1) items.push({ ...cd, ts: new Date().toISOString() }); else items[i] = { ...items[i], ...cd, ts: new Date().toISOString() }; }
  function remove(catKey, nro){ const before = items.length; items = items.filter(x => !(x.catKey === catKey && x.nro === nro)); return items.length < before; }
  function clear(){ items = []; persist(); }
  const getAll = () => [...items];
  const count = () => items.length;
  function updateBadge(){ const b = $("#notFoundBadge"); const btn = $("#btnNotFound"); if (b) b.textContent = items.length; if (btn) btn.style.display = items.length > 0 ? "" : "none"; }
  return { load, persist, add, remove, clear, getAll, count, updateBadge };
})();

const AutoBackup = (() => {
  let changeCount = 0, pendingTimer = null, lastReason = "";
  const DEBOUNCE_MS = 4000, RE_ASK_MS = 120000;
  const getEnabled = () => { try { return Store.getPref("autoBackup", true); } catch(e){ return true; } };
  function setEnabled(v){ try { Store.setPref("autoBackup", !!v); } catch(e){} if (!v){ changeCount = 0; if (pendingTimer){ clearTimeout(pendingTimer); pendingTimer = null; } } updateBadge(); syncToggle(); }
  function syncToggle(){ const cb = $("#autoBackupToggle"); if (cb) cb.checked = getEnabled(); }
  function updateBadge(){ const b = $("#autobackupBadge"); if (!b) return; if (changeCount > 0 && getEnabled()){ b.textContent = changeCount; b.style.display = ""; } else b.style.display = "none"; }
  function markChange(reason){
    lastReason = reason || ''; changeCount++; updateBadge();
    if (!getEnabled()) return;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      if (changeCount <= 0) return;
      if (isAnyModalOpen()){ pendingTimer = setTimeout(() => { pendingTimer = null; if (changeCount > 0 && getEnabled() && !isAnyModalOpen()) askBackup(); }, 10000); return; }
      askBackup();
    }, DEBOUNCE_MS);
  }
  function askBackup(){
    $("#autoBackupCount").textContent = changeCount + " cambio" + (changeCount === 1 ? "" : "s");
    $("#autoBackupReason").textContent = lastReason || "modificación";
    $("#autoBackupModal").classList.add("open");
  }
  function doBackup(){
    $("#autoBackupModal").classList.remove("open");
    const dis = $("#autoBackupDisableAfter")?.checked;
    changeCount = 0; updateBadge();
    // v7.0.12: manejo de errores en exportFullJSON()
    Promise.resolve(exportFullJSON()).catch(err => Toast.show("Error backup: " + (err?.message || err), "err", 6000));
    if (dis){ $("#autoBackupDisableAfter").checked = false; setEnabled(false); Toast.show("Backup automático desactivado.","warn"); }
  }
  function later(){
    $("#autoBackupModal").classList.remove("open");
    const dis = $("#autoBackupDisableAfter")?.checked;
    if (dis){ $("#autoBackupDisableAfter").checked = false; setEnabled(false); Toast.show("Backup automático desactivado","warn",4000); return; }
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pendingTimer = null; if (changeCount > 0 && getEnabled() && !isAnyModalOpen()) askBackup(); }, RE_ASK_MS);
  }
  function reset(){ changeCount = 0; updateBadge(); }
  const hasPending = () => changeCount > 0 && getEnabled();
  return { markChange, askBackup, doBackup, later, getEnabled, setEnabled, updateBadge, syncToggle, reset, hasPending };
})();

const Undo = (() => {
  const stack = [];
  function updateBadge(){
    const b = $("#btnUndo"); if (!b) return;
    if (stack.length > 0){ b.classList.add("active"); b.title = `Deshacer: ${stack[stack.length-1].label} (Ctrl+Z) — ${stack.length} operación(es)`; }
    else { b.classList.remove("active"); b.title = "Nada que deshacer"; }
  }
  return {
    push(label, restore){ if (typeof restore !== "function") return; stack.push({ label, restore }); if (stack.length > UNDO_LIMIT) stack.shift(); updateBadge(); },
    pop(){ const op = stack.pop(); updateBadge(); if (!op){ Toast.show("Nada que deshacer","warn",1800); return; } op.restore(); Toast.show("Deshecho: " + op.label,"ok",2200); },
    clear(){ stack.length = 0; updateBadge(); },
    updateBadge
  };
})();

const Duplicates = (() => {
  function find(threshold = 0.92){
    const groups = [];
    const all = Store.allCDs().map(cd => {
      let cat = null;
      for (const k of Store.catKeys()){ if (Store.getCDs(k).includes(cd)){ cat = k; break; } }
      return { cd, cat };
    });
    const visited = new Set();
    for (let i = 0; i < all.length; i++){
      if (visited.has(i)) continue;
      const group = [all[i]]; visited.add(i);
      for (let j = i + 1; j < all.length; j++){
        if (visited.has(j)) continue;
        const a = all[i].cd, b = all[j].cd;
        const sT = similarity(a.titulo, b.titulo);
        const sA = similarity(a.interprete, b.interprete);
        const score = sT * 0.55 + sA * 0.35 + (a.anio && b.anio && a.anio === b.anio ? 0.10 : 0);
        if (score >= threshold){ group.push(all[j]); visited.add(j); }
      }
      if (group.length > 1) groups.push(group);
    }
    return groups;
  }
  function render(){
    const groups = find(0.92);
    const summary = $('#dupSummary'), list = $('#dupList');
    if (!summary || !list) return;
    if (!groups.length){
      summary.innerHTML = `✅ <b>No se detectaron duplicados</b> — analizados ${Store.total()} CDs con umbral 92%.`;
      summary.style.borderLeftColor = 'var(--ok)'; summary.style.background = 'rgba(93,220,154,.08)';
      list.innerHTML = ''; return;
    }
    const totalDup = groups.reduce((s, g) => s + g.length, 0);
    summary.innerHTML = `⚠️ <b>${groups.length} grupo${groups.length === 1 ? '' : 's'}</b> de posibles duplicados · <b>${totalDup}</b> CDs involucrados.`;
    summary.style.borderLeftColor = 'var(--warn)'; summary.style.background = 'rgba(255,169,77,.08)';
    list.innerHTML = groups.map((g, gi) => `<div class="dup-group"><div class="dup-group-head"><div class="dgh-title">🔍 Grupo #${gi+1} — ${g.length} CDs similares</div><div class="dgh-score">${Math.round(similarity(g[0].cd.titulo, g[1]?.cd.titulo||'')*100)}% similitud</div></div><div class="dup-items">${g.map(({cd, cat}) => `<div class="dup-item">${cd.portada ? `<img src="${esc(cd.portada)}" alt="">` : `<div class="dup-ph">💿</div>`}<div style="min-width:0"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cd.titulo)}</div><div style="font-size:.72rem;color:var(--muted)">${esc(cd.interprete)} · ${cd.anio ?? '—'} · Nº ${cd.nro} · ${esc(Store.get(cat)?.label || cat)}</div></div><button type="button" class="btn danger" data-dup-del="${esc(cdKey(cat, cd))}" title="Eliminar">🗑️</button></div>`).join('')}</div></div>`).join('');
    list.querySelectorAll('[data-dup-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { cat, id } = parseCDKey(btn.dataset.dupDel);
        const cd = Store.getCDs(cat).find(c => c.id === id);
        if (!cd) return;
        if (!confirm(`¿Eliminar "${cd.titulo}" de "${Store.get(cat).label}"?`)) return;
        const before = snapshotAll();
        const list = Store.getCDs(cat);
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) list.splice(idx, 1);
        Undo.push('eliminar duplicado', () => restoreAll(before));
        Store.persist();
        HistoryLog.log('DELETE', `Duplicado eliminado: ${cd.titulo}`, cd.interprete);
        AutoBackup.markChange('eliminación de duplicado');
        render(); renderTabs(); renderAll();
        Toast.show('Duplicado eliminado', 'ok');
      });
    });
  }
  function exportCSV(){
    const groups = find(0.92);
    if (!groups.length){ Toast.show('Sin duplicados', 'warn'); return; }
    const sep = ';';
    const e = v => { const s = String(v??''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const rows = [['Grupo','Nº','Título','Intérprete','Año','Categoría'].join(sep)];
    groups.forEach((g, gi) => { g.forEach(({cd, cat}) => { rows.push([gi+1, cd.nro, cd.titulo, cd.interprete, cd.anio ?? '', Store.get(cat)?.label || cat].map(e).join(sep)); }); });
    saveOrDownload(`discografia_duplicados_${timestamp()}.csv`, '\uFEFF' + rows.join('\r\n'), 'text/csv');
  }
  return { find, render, exportCSV };
})();

const DuplicateChecker = (() => {
  let _set = null;
  function rebuild(){ const g = Duplicates.find(0.92); const s = new Set(); for (const grp of g){ for (const {cd, cat} of grp){ s.add(cdKey(cat, cd)); } } _set = s; }
  function isDuplicate(cd){ if (!_set) rebuild(); for (const k of Store.catKeys()){ if (Store.getCDs(k).includes(cd)) return _set.has(cdKey(k, cd)); } return false; }
  function invalidate(){ _set = null; }
  return { isDuplicate, invalidate };
})();

const Loans = (() => {
  const isLoaned = cd => !!(cd.prestadoA && cd.prestadoA.trim());
  function isOverdue(cd){ if (!isLoaned(cd) || !cd.fechaDevolucion) return false; return new Date(cd.fechaDevolucion) < new Date(); }
  function getAll(){
    const out = [];
    for (const k of Store.catKeys()){ for (const cd of Store.getCDs(k)){ if (isLoaned(cd)) out.push({ cd, cat: k }); } }
    // v7.0.12: variable local renombrada a dbv para evitar shadowing
    return out.sort((a, b) => {
      const da = a.cd.fechaDevolucion || '9999-12-31';
      const dbv = b.cd.fechaDevolucion || '9999-12-31';
      return da.localeCompare(dbv);
    });
  }
  function render(){
    const all = getAll();
    const summary = $('#loansSummary'), list = $('#loansList');
    if (!summary || !list) return;
    if (!all.length){ summary.innerHTML = '✅ <b>No hay CDs prestados</b> actualmente.'; summary.style.borderLeftColor = 'var(--ok)'; summary.style.background = 'rgba(93,220,154,.08)'; list.innerHTML = ''; return; }
    const overdue = all.filter(({cd}) => isOverdue(cd)).length;
    summary.innerHTML = `📚 <b>${all.length}</b> CD${all.length === 1 ? '' : 's'} prestado${all.length === 1 ? '' : 's'}${overdue > 0 ? ` · <b style="color:var(--danger)">${overdue} vencido${overdue === 1 ? '' : 's'}</b>` : ''}.`;
    list.innerHTML = `<div style="display:grid;grid-template-columns:1fr;gap:6px">${all.map(({cd, cat}) => {
      const ov = isOverdue(cd);
      return `<div class="loan-info-box${ov ? ' overdue' : ''}" style="display:grid;grid-template-columns:60px 1fr auto;gap:12px;align-items:center">${cd.portada ? `<img src="${esc(cd.portada)}" style="width:48px;height:48px;border-radius:6px;object-fit:cover">` : `<div style="width:48px;height:48px;border-radius:6px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1.2rem">💿</div>`}<div style="min-width:0"><div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cd.titulo)}</div><div style="font-size:.72rem;color:var(--muted);margin-top:2px">${esc(cd.interprete)} · Nº ${cd.nro} · ${esc(Store.get(cat)?.label || cat)}</div><div style="font-size:.72rem;margin-top:4px"><b>Prestado a:</b> ${esc(cd.prestadoA)}${cd.fechaDevolucion ? ` · <b>Devolución:</b> ${new Date(cd.fechaDevolucion).toLocaleDateString('es-AR')}${ov ? ' <span style="color:var(--danger);font-weight:700">(VENCIDO)</span>' : ''}` : ''}</div></div><button type="button" class="btn" data-loan-return="${esc(cdKey(cat, cd))}">↩️ Devolver</button></div>`;
    }).join('')}</div>`;
    list.querySelectorAll('[data-loan-return]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { cat, id } = parseCDKey(btn.dataset.loanReturn);
        const cd = Store.getCDs(cat).find(c => c.id === id);
        if (!cd) return;
        if (!confirm(`¿Marcar "${cd.titulo}" como devuelto?`)) return;
        const before = snapshotAll();
        cd.prestadoA = ''; cd.fechaPrestamo = ''; cd.fechaDevolucion = ''; cd.notasPrestamo = '';
        Undo.push('devolver CD', () => restoreAll(before));
        Store.persist();
        HistoryLog.log('LOAN', `Devuelto: ${cd.titulo}`, cd.interprete);
        AutoBackup.markChange('devolución');
        render(); renderAll();
        Toast.show('Marcado como devuelto', 'ok');
      });
    });
  }
  function exportCSV(){
    const all = getAll();
    if (!all.length){ Toast.show('Sin préstamos', 'warn'); return; }
    const sep = ';';
    const e = v => { const s = String(v??''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const rows = [['Nº','Título','Intérprete','Categoría','Prestado a','Fecha préstamo','Fecha devolución','Estado'].join(sep)];
    for (const {cd, cat} of all){ rows.push([cd.nro, cd.titulo, cd.interprete, Store.get(cat)?.label || cat, cd.prestadoA || '', cd.fechaPrestamo || '', cd.fechaDevolucion || '', isOverdue(cd) ? 'VENCIDO' : 'En plazo'].map(e).join(sep)); }
    saveOrDownload(`discografia_prestamos_${timestamp()}.csv`, '\uFEFF' + rows.join('\r\n'), 'text/csv');
  }
  return { isLoaned, isOverdue, getAll, render, exportCSV };
})();

const BarcodeScanner = (() => {
  let stream = null;
  let nativeDetector = null;
  let html5Scanner = null;
  let rafId = null;
  let running = false;
  let onDetected = null;

  const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  const hasHtml5Qr = typeof window !== 'undefined' && typeof window.Html5Qrcode !== 'undefined';

  async function start(callback){
    onDetected = callback;
    if (hasNativeDetector){ return startNative(); }
    if (hasHtml5Qr){ return startHtml5(); }
    const fb = $('#scanFallback');
    if (fb){ fb.style.display = 'block'; fb.innerHTML = '⚠️ No hay soporte de escáner disponible. Ingresá el código manualmente abajo.'; }
    const sw = $('#scanWrap'); if (sw) sw.style.display = 'none';
    const st = $('#scanStatus');
    if (st){ st.textContent = 'Escaneo automático no disponible.'; st.className = 'scanner-status err'; }
  }

  async function startNative(){
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = $('#scanVideo'); video.srcObject = stream; await video.play();
      nativeDetector = new window.BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] });
      running = true;
      $('#scanStatus').textContent = 'Apuntá al código de barras…';
      $('#scanStatus').className = 'scanner-status';
      scanLoopNative();
    } catch(err){
      $('#scanStatus').textContent = 'No se pudo acceder a la cámara: ' + err.message;
      $('#scanStatus').className = 'scanner-status err';
    }
  }

  async function scanLoopNative(){
    if (!running) return;
    const video = $('#scanVideo');
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA){
      rafId = requestAnimationFrame(scanLoopNative);
      return;
    }
    try {
      const results = await nativeDetector.detect(video);
      if (results && results.length){
        const code = results[0].rawValue;
        running = false;
        $('#scanStatus').textContent = '✓ Código detectado: ' + code;
        $('#scanStatus').className = 'scanner-status ok';
        if (typeof onDetected === 'function') onDetected(code);
        stop();
        return;
      }
    } catch(e){}
    rafId = requestAnimationFrame(scanLoopNative);
  }

  async function startHtml5(){
    try {
      const container = $('#scanWrap');
      const video = $('#scanVideo');
      const overlay = container.querySelector('.scan-overlay');
      if (video) video.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
      let host = document.getElementById('html5qrReader');
      if (!host){
        host = document.createElement('div');
        host.id = 'html5qrReader';
        host.style.width = '100%';
        host.style.height = '100%';
        container.appendChild(host);
      }
      host.style.display = '';
      html5Scanner = new window.Html5Qrcode('html5qrReader', { verbose: false });
      const config = { fps: 10, qrbox: { width: 260, height: 160 }, aspectRatio: 1.333 };
      running = true;
      $('#scanStatus').textContent = 'Apuntá al código de barras…';
      $('#scanStatus').className = 'scanner-status';
      await html5Scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!running) return;
          running = false;
          $('#scanStatus').textContent = '✓ Código detectado: ' + decodedText;
          $('#scanStatus').className = 'scanner-status ok';
          if (typeof onDetected === 'function') onDetected(decodedText);
          stop();
        },
        () => {}
      );
    } catch(err){
      $('#scanStatus').textContent = 'No se pudo acceder a la cámara: ' + (err.message || err);
      $('#scanStatus').className = 'scanner-status err';
    }
  }

  function stop(){
    running = false;
    if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    const v = $('#scanVideo'); if (v){ v.srcObject = null; v.style.display = ''; }
    const overlay = $('#scanWrap')?.querySelector('.scan-overlay');
    if (overlay) overlay.style.display = '';
    if (html5Scanner){
      try {
        Promise.resolve(html5Scanner.stop()).then(() => { try { html5Scanner.clear(); } catch(_){} }).catch(()=>{});
      } catch(e){}
      html5Scanner = null;
    }
    const host = document.getElementById('html5qrReader');
    if (host) host.style.display = 'none';
  }

  return { start, stop, isSupported: () => hasNativeDetector || hasHtml5Qr };
})();

const AdvancedSearch = (() => {
  function tokenize(query){
    const tokens = []; let cur = ''; let inQ = false;
    for (let i = 0; i < query.length; i++){
      const ch = query[i];
      if (ch === '"'){ inQ = !inQ; continue; }
      if (!inQ && /\s/.test(ch)){ if (cur) { tokens.push(cur); cur = ''; } } else cur += ch;
    }
    if (cur) tokens.push(cur);
    return tokens;
  }
  function matches(cd, query){
    const tokens = tokenize(query);
    if (!tokens.length) return true;
    let result = true, pendingOp = 'AND';
    for (const tk of tokens){
      if (tk === 'AND' || tk === 'OR'){ pendingOp = tk; continue; }
      if (!tk || tk === '-' || tk === '--') continue;
      const neg = tk.startsWith('-');
      const clean = neg ? tk.slice(1) : tk;
      if (!clean) continue;
      let hit;
      if (clean.includes(':')){
        const idx = clean.indexOf(':');
        const f = clean.slice(0, idx).toLowerCase();
        const v = clean.slice(idx + 1);
        if (!v) continue;
        hit = matchField(cd, f, v);
      } else {
        hit = matchGlobal(cd, clean);
      }
      if (neg) hit = !hit;
      result = pendingOp === 'OR' ? (result || hit) : (result && hit);
      pendingOp = 'AND';
    }
    return result;
  }
  function matchField(cd, field, value){
    const v = norm(value);
    const cmp = value.match(/^(>=|<=|>|<|=)/);
    const isCmp = !!cmp;
    function compare(target){
      if (isCmp){
        const n1 = parseFloat(target), n2 = parseFloat(value.replace(cmp[0], ''));
        if (isNaN(n1) || isNaN(n2)) return false;
        switch(cmp[0]){ case '>': return n1 > n2; case '<': return n1 < n2; case '>=': return n1 >= n2; case '<=': return n1 <= n2; case '=': return n1 === n2; }
      }
      return norm(target).includes(v);
    }
    switch(field){
      case 'artist': case 'artista': case 'interprete': case 'intérprete': return compare(cd.interprete);
      case 'title': case 'titulo': case 'título': return compare(cd.titulo);
      case 'year': case 'anio': case 'año': return compare(String(cd.anio ?? ''));
      case 'genre': case 'genero': case 'género': return compare(cd.genero);
      case 'label': case 'sello': return compare(cd.sello);
      case 'format': case 'formato': return compare(cd.formato);
      case 'catalog': case 'catalogo': case 'catálogo': return compare(cd.catalogo);
      case 'isrc': return compare(cd.isrc);
      case 'country': case 'pais': case 'país': return compare(cd.pais);
      case 'location': case 'ubicacion': case 'ubicación': return compare(cd.ubicacion);
      case 'nro': case 'numero': case 'número': return compare(String(cd.nro));
      case 'loaned': case 'prestado': const isL = Loans.isLoaned(cd); return value === 'true' ? isL : value === 'false' ? !isL : isL;
      default: return matchGlobal(cd, value);
    }
  }
  function matchGlobal(cd, term){
    const t = norm(term); if (!t) return true;
    const h = norm([cd.titulo, cd.interprete, cd.sello, cd.anio, cd.genero, cd.ubicacion, cd.catalogo, cd.pais, cd.edicion, cd.notas].join(' '));
    return h.includes(t);
  }
  function isAdvanced(query){
    const q = String(query || '').trim();
    if (!q) return false;
    if (/\b[a-zA-Z_ñÑáéíóúÁÉÍÓÚ]+\s*:\s*\S+/.test(q)) return true;
    if (/(^|\s)(AND|OR)(\s|$)/.test(q)) return true;
    if (/(^|\s)-[^\s-]/.test(q)) return true;
    return false;
  }
  return { matches, isAdvanced };
})();

/* ═══════════════════════════════════════════════════════════════════
   Enriquecimiento — helpers
   ═══════════════════════════════════════════════════════════════════ */

function enrichMeta(base, t, i, pre){
  base.confidence = typeof pre === 'number'
    ? pre
    : matchConfidence(t, i, { title: base._title || t, artist: base._artist || i });
  base.enrichedAt = new Date().toISOString();
  return base;
}
function makeProvenance(source, confidence){ return { source: source || null, confidence: (typeof confidence === 'number' && Number.isFinite(confidence)) ? confidence : null, date: new Date().toISOString() }; }
function verificarFechaEmision(info, userYear){
  if (!info) return info;
  const y = parseInt(userYear); if (!y || !info.anio) return info;
  const d = info.anio - y;
  info.yearUser = y; info.yearFound = info.anio;
  if (d === 0) info.confidence = Math.min(100, (info.confidence||0)+5);
  else if (Math.abs(d) <= 1){}
  else if (d < 0 && Math.abs(d) > 20){ info.yearReissue = true; info.confidence = Math.min(100, (info.confidence||0)+3); }
  else if (d > 0 && d <= 5){ info.confidence = Math.max(0, (info.confidence||0)-10); info.yearWarning = true; }
  else if (d > 5){ info.confidence = Math.max(0, (info.confidence||0)-25); info.yearMismatch = true; }
  else info.yearWarning = true;
  return info;
}

/* ═══════════════════════════════════════════════════════════════════
   Discogs — config y API
   ═══════════════════════════════════════════════════════════════════ */

function getDiscogsConfig(){
  try { return JSON.parse(localStorage.getItem(DISCOGS_CONFIG_KEY) || '{}') || {}; }
  catch(e){ return {}; }
}
function getDiscogsToken(){ return String(getDiscogsConfig().token || '').trim(); }
function getDiscogsProxy(){ return String(getDiscogsConfig().proxy || '').trim(); }
function saveDiscogsConfig(token, proxy){
  const t = String(token || '').trim().replace(/^["']+|["']+$/g, '').replace(/^Discogs\s+token\s*=\s*/i, '').replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
  const p = String(proxy || '').trim();
  if (!t && !p){ try { localStorage.removeItem(DISCOGS_CONFIG_KEY); } catch(e){} return true; }
  const payload = JSON.stringify({ token: t, proxy: p, updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem(DISCOGS_CONFIG_KEY, payload);
    return true;
  } catch(e1){
    if (!isQuotaError(e1)){ console.error('saveDiscogsConfig', e1); return false; }
    const freed = freeLocalStorageCaches();
    console.warn('[Discogs] Quota excedida. Liberados ~', freed, 'chars de caché. Reintentando…');
    try {
      localStorage.setItem(DISCOGS_CONFIG_KEY, payload);
      try { if (typeof Toast !== 'undefined') Toast.show('⚠️ Storage lleno: se liberaron cachés y se guardó el token.', 'warn', 6000); } catch(_){}
      return true;
    } catch(e2){
      console.error('saveDiscogsConfig retry failed', e2);
      try {
        if (typeof Toast !== 'undefined') Toast.show('Storage lleno. Exportá un backup (Ctrl+S) y vaciá caché en ⚙️.', 'err', 9000);
      } catch(_){}
      return false;
    }
  }
}
function clearDiscogsConfig(){ try { localStorage.removeItem(DISCOGS_CONFIG_KEY); } catch(e){} }

function discogsUrl(url, tokenOverride = null, useProxy = false){
  const token = tokenOverride !== null ? String(tokenOverride).trim() : getDiscogsToken();
  let finalUrl = String(url);
  if (useProxy && token){
    const sep = finalUrl.includes('?') ? '&' : '?';
    finalUrl += sep + 'token=' + encodeURIComponent(token);
  }
  if (!useProxy) return finalUrl;
  const configuredProxy = getDiscogsProxy();
  const proxy = configuredProxy || DEFAULT_CORS_PROXY;
  if (/[?&]url=$/.test(proxy) || proxy.endsWith('=')){ return proxy + encodeURIComponent(finalUrl); }
  if (proxy.endsWith('/')){ return proxy + finalUrl.replace(/^https?:\/\//, ''); }
  return proxy + '?url=' + encodeURIComponent(finalUrl);
}
function discogsHeaders(tokenOverride = null){
  const token = tokenOverride !== null ? String(tokenOverride).trim() : getDiscogsToken();
  const headers = { 'Accept': 'application/json' };
  if (token) headers['Authorization'] = 'Discogs token=' + token;
  return headers;
}
function isDiscogsNetworkError(err){
  if (!err) return false;
  const name = String(err.name || '');
  const msg  = String(err.message || '');
  return (name === 'TypeError' || name === 'AbortError' || name === 'TimeoutError' ||
    /failed to fetch/i.test(msg) || /network/i.test(msg) || /cors/i.test(msg) ||
    /aborted/i.test(msg) || /timeout/i.test(msg));
}
async function fetchDiscogsDirect(url, token, timeoutMs = DISCOGS_FETCH_TIMEOUT_MS){
  return await fetchWithTimeout(url, { method: 'GET', headers: discogsHeaders(token), credentials: 'omit', cache: 'no-store' }, timeoutMs);
}
async function fetchDiscogsProxy(url, token, timeoutMs = DISCOGS_FETCH_TIMEOUT_MS){
  const proxyUrl = discogsUrl(url, token, true);
  return await fetchWithTimeout(proxyUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'omit', cache: 'no-store' }, timeoutMs);
}
async function fetchDiscogs(url, timeoutMs = DISCOGS_FETCH_TIMEOUT_MS, tokenOverride = null){
  const token = tokenOverride !== null ? String(tokenOverride).trim() : getDiscogsToken();
  if (!token) throw new Error('No hay token de Discogs configurado.');
  const manualProxy = getDiscogsProxy();
  if (manualProxy){
    try { return await fetchDiscogsProxy(url, token, timeoutMs); }
    catch(err){ throw new Error('No se pudo conectar con Discogs mediante el proxy configurado.'); }
  }
  try { const response = await fetchDiscogsDirect(url, token, timeoutMs); return response; }
  catch(directError){
    if (!isDiscogsNetworkError(directError)) throw directError;
  }
  try { const response = await fetchDiscogsProxy(url, token, Math.max(timeoutMs, 20000)); return response; }
  catch(proxyError){ throw new Error('No se pudo conectar con Discogs.'); }
}
async function testDiscogsConnection(tokenOverride = null, attempt = 1){
  const token = String(tokenOverride ?? getDiscogsToken()).trim();
  if (!token) throw new Error('No hay token configurado.');
  const MAX = 2;
  try {
    const res = await fetchDiscogs(`${DISCOGS_API}/oauth/identity`, DISCOGS_TEST_TIMEOUT_MS, token);
    if (!res.ok){
      let detail = 'HTTP ' + res.status;
      try { const json = await res.json(); if (json?.message) detail += ' · ' + json.message; } catch(_){}
      if (res.status === 401) detail += ' · Token inválido o expirado';
      if (res.status === 403) detail += ' · Acceso rechazado por Discogs';
      if (res.status === 429) detail += ' · Rate limit de Discogs';
      throw new Error(detail);
    }
    return await res.json();
  } catch(err){
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError' || /aborted|timeout/i.test(String(err?.message || ''));
    if (isTimeout && attempt < MAX){ await new Promise(r => setTimeout(r, 1500)); return testDiscogsConnection(tokenOverride, attempt + 1); }
    throw err;
  }
}
function updateDiscogsStatus(kind, text){
  const el = $("#discogsStatus"); if (!el) return;
  const icons = { ok: '🟢', warn: '🟠', error: '🔴', idle: '⚪' };
  el.innerHTML = `${icons[kind] || icons.idle} ${esc(text)}`;
}
function updateDiscogsProtoHint(){
  const el = $("#discogsProtoHint"); if (!el) return;
  const manualProxy = getDiscogsProxy();
  if (isFileProtocol()){
    el.style.display = 'block';
    el.style.background = 'rgba(93,220,154,.08)';
    el.style.borderLeft = '4px solid var(--ok)';
    if (manualProxy){ el.innerHTML = `🟢 <b>file:// + proxy manual:</b> <code>${esc(manualProxy)}</code>.`; }
    else { el.innerHTML = `🟢 <b>file://:</b> se intentará conexión directa y fallback automático.`; }
  } else {
    el.style.display = 'block';
    el.style.background = 'rgba(79,195,247,.08)';
    el.style.borderLeft = '4px solid var(--accent)';
    if (manualProxy){ el.innerHTML = `🟢 <b>Proxy manual activo:</b> <code>${esc(manualProxy)}</code>.`; }
    else { el.innerHTML = `ℹ️ Se usará <b>conexión directa</b> con Discogs (token por header).`; }
  }
  updateDiscogsSecurityWarning();
}
function updateDiscogsSecurityWarning(){
  const el = $("#discogsSecurityWarning"); if (!el) return;
  const manualProxy = getDiscogsProxy();
  const token = getDiscogsToken();
  const shouldShow = !!(token && (manualProxy || isFileProtocol()));
  el.style.display = shouldShow ? 'flex' : 'none';
  if (shouldShow){ el.innerHTML = `<div><b>Seguridad:</b> cuando se usa un proxy, el token viaja en la URL.</div>`; }
}
function openDiscogsConfig(){
  const modal = $("#discogsConfigModal"); if (!modal) return;
  const config = getDiscogsConfig();
  $("#discogsTokenInput").value = config.token || "";
  $("#discogsProxyInput").value = config.proxy || "";
  updateDiscogsStatus(config.token ? 'warn' : 'idle', config.token ? 'Token guardado.' : 'Sin configurar');
  updateDiscogsProtoHint();
  modal.classList.add('open');
}
function closeDiscogsConfig(){ $("#discogsConfigModal")?.classList.remove('open'); }

async function fetchDiscogsReleaseDetails(id){
  if (!id) return null;
  try { await throttleSource("Discogs"); const res = await fetchDiscogs(`${DISCOGS_API}/releases/${id}`); if (!res.ok) return null; const d = await res.json(); const p = d.images?.find(i => i.type === 'primary') || d.images?.[0]; const y = d.year ? parseInt(d.year) : null; return { cover: p?.uri || p?.uri150 || null, year: (y && y >= 1900) ? y : null }; }
  catch(e){ return null; }
}
async function fetchDiscogsMasterDetails(masterId){
  if (!masterId) return null;
  try { await throttleSource("Discogs"); const res = await fetchDiscogs(`${DISCOGS_API}/masters/${masterId}`); if (!res.ok) return null; const d = await res.json(); const y = d.year ? parseInt(d.year) : null; return { year: (y && y >= 1900 && y <= 2100) ? y : null, cover: (d.images?.find(i => i.type === 'primary') || d.images?.[0])?.uri || null, title: d.title || null, masterId: masterId }; }
  catch(e){ return null; }
}
async function fetchCoverArtFromCAA(mbId){
  if (!mbId) return null;
  try { const res = await fetchWithTimeout(`https://coverartarchive.org/release/${mbId}`, {}, 6000); if (!res.ok) return null; const d = await res.json(); if (!Array.isArray(d.images) || !d.images.length) return null; const f = d.images.find(i => i.front) || d.images[0]; return f.image || f.thumbnails?.["500"] || f.thumbnails?.large || f.thumbnails?.["250"] || null; }
  catch(e){ return null; }
}
function cleanDiscogsTitle(raw){ return String(raw||'').replace(/\s*\(\d+\)\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim(); }

async function fetchExternalLinks(mbid){
  if (!mbid) return {};
  try {
    await throttleSource("MusicBrainz");
    const res = await fetchWithTimeout(`${MB_API}release/${mbid}?inc=url-rels&fmt=json`, { headers: { 'User-Agent': MB_USER_AGENT } }, 8000);
    if (!res.ok) return {};
    const d = await res.json();
    const links = {};
    for (const rel of (d.relations || [])){
      const url = rel?.url?.resource;
      if (!url) continue;
      for (const svc of STREAMING_SERVICES){
        if (svc.pattern.test(url) && !links[svc.key]) links[svc.key] = url;
      }
    }
    return links;
  } catch(e){ return {}; }
}

/* ═══════════════════════════════════════════════════════════════════
   Streaming — resolución de links
   ═══════════════════════════════════════════════════════════════════ */

function isSafeStreamUrl(url){
  if (!url || typeof url !== 'string') return false;
  if (!/^https:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return ALLOWED_STREAM_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch(e){ return false; }
}

const ResolvedLinks = {
  _cache: null,
  _load(){
    if (this._cache) return this._cache;
    try { this._cache = JSON.parse(localStorage.getItem(RESOLVED_LINKS_KEY) || '{}'); } catch(e){ this._cache = {}; }
    return this._cache;
  },
  get(cdId){
    const c = this._load();
    const e = c[cdId];
    if (!e) return null;
    if (Date.now() - (e.ts||0) > RESOLVED_TTL){ delete c[cdId]; this._persist(); return null; }
    return e.links;
  },
  set(cdId, links){
    const c = this._load();
    c[cdId] = { links, ts: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > RESOLVED_MAX){
      keys.sort((a,b) => (c[a].ts||0) - (c[b].ts||0));
      for (let i = 0; i < 100; i++) delete c[keys[i]];
    }
    this._persist();
  },
  _persist(){ try { localStorage.setItem(RESOLVED_LINKS_KEY, JSON.stringify(this._cache)); } catch(e){} },
  clear(){ this._cache = {}; try { localStorage.removeItem(RESOLVED_LINKS_KEY); } catch(e){} }
};

async function findAppleAlbumMatch(cd){
  const term = `${cd.interprete || ''} ${cd.titulo || ''}`.trim();
  if (!term) return null;
  const countries = ['US', 'AR', 'ES', 'MX'];
  let allResults = [];
  for (const country of countries){
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=50&country=${country}`;
      const r = await fetchWithTimeout(url, { cache: 'no-store' }, 8000);
      if (!r.ok) continue;
      const data = await r.json();
      if (data.results && data.results.length){ allResults = data.results; break; }
    } catch(_){}
  }
  if (!allResults.length) return null;

  const nArtist = normMatch(cd.interprete || '');
  const nTitle  = normMatch(cd.titulo || '');
  const year    = cd.anio ? String(cd.anio) : '';

  const albumsOnly = allResults.filter(r => {
    if (r.wrapperType !== 'collection') return false;
    if (r.collectionType === 'Single') return false;
    if ((r.trackCount || 0) < 4) return false;
    return true;
  });
  const pool = albumsOnly.length ? albumsOnly : allResults;

  const badWords = ['live','en vivo','en directo','compilation','greatest hits',
                    'the best of','best of','anthology','karaoke','tribute',
                    'remastered 20','deluxe edition','bonus tracks'];
  function scoreAlbum(r){
    let s = 0;
    const ra = normMatch(r.artistName || '');
    const rt = normMatch(r.collectionName || '');
    const ry = (r.releaseDate || '').slice(0, 4);
    const tc = r.trackCount || 0;

    if (ra !== nArtist && !ra.includes(nArtist) && !nArtist.includes(ra)) return -1;
    if (ra === nArtist) s += 100;
    else if (ra.includes(nArtist) || nArtist.includes(ra)) s += 50;

    if (rt === nTitle) s += 100;
    else if (rt.includes(nTitle) || nTitle.includes(rt)) s += 40;
    else return -1;

    if (year && ry === year) s += 30;
    else if (year && Math.abs(parseInt(ry) - parseInt(year)) <= 1) s += 10;

    for (const bw of badWords){
      if (rt.includes(bw) && !nTitle.includes(bw)) s -= 60;
    }
    s += Math.min(tc, 20);
    return s;
  }

  const scored = pool.map(r => ({ r, s: scoreAlbum(r) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.length ? scored[0].r : null;
}

const ODESLI_PLATFORM_MAP = {
  spotify: 'spotify',
  appleMusic: 'apple', itunes: 'apple',
  youtubeMusic: 'youtube', youtube: 'youtube',
  amazonMusic: 'amazon', amazon: 'amazon',
  deezer: 'deezer',
  tidal: 'tidal',
  soundcloud: 'soundcloud'
};

async function resolveAllPlatformLinks(appleMusicUrl){
  const links = {};
  if (appleMusicUrl && isSafeStreamUrl(appleMusicUrl)) links.apple = appleMusicUrl;
  try {
    const odesliUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(appleMusicUrl)}&userCountry=US`;
    const r = await fetchWithTimeout(odesliUrl, { cache: 'no-store' }, 8000);
    if (r.ok){
      const data = await r.json();
      const platforms = data.linksByPlatform || {};
      for (const [odeKey, odeData] of Object.entries(platforms)){
        const ourKey = ODESLI_PLATFORM_MAP[odeKey];
        if (!ourKey || !odeData?.url) continue;
        if (!isSafeStreamUrl(odeData.url)) continue;
        if (!isAlbumUrl(odeData.url, ourKey)) continue;
        if (!links[ourKey]) links[ourKey] = odeData.url;
      }
    } else {
      console.warn('Odesli HTTP', r.status, '— usando solo Apple Music');
    }
  } catch (err){
    console.warn('Odesli no disponible:', err?.message || err);
  }
  return links;
}

function guardarLinksEnCD(cd, links){
  if (!cd.links) cd.links = {};
  let changed = false;
  for (const [k, v] of Object.entries(links)){
    if (v && isSafeStreamUrl(v) && isAlbumUrl(v, k) && !cd.links[k]){ cd.links[k] = v; changed = true; }
  }
  if (changed){
    Store.persist();
    HistoryLog.log('EDIT', `Links de streaming guardados`, cd.titulo);
    AutoBackup.markChange('links streaming');
  }
  return changed;
}

function mostrarModalConfirmacionAlbum(cd, match, links, svcName, svcIcon){
  return new Promise((resolve) => {
    const m = $("#albumConfirmModal");
    const body = $("#albumConfirmBody");
    if (!m || !body){ resolve('cancel'); return; }
    const available = Object.keys(links);
    const cover = match.artworkUrl100 ? match.artworkUrl100.replace('100x100', '300x300') : (cd.portada || '');
    const platformsList = available.map(k => {
      const svc = STREAMING_SERVICES.find(s => s.key === k);
      return svc ? `<span class="ca-plat">${svc.icon} ${esc(svc.name)}</span>` : '';
    }).join('');
    body.innerHTML = `
      <div class="ca-hero">
        ${cover ? `<img src="${esc(cover)}" alt="Portada" onerror="this.style.display='none'">` : `<div style="width:110px;height:110px;border-radius:10px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:2.5rem;border:1px solid var(--line)">💿</div>`}
        <div class="ca-info">
          <h3>${esc(match.collectionName || cd.titulo)}</h3>
          <p>${esc(match.artistName || cd.interprete)}${match.releaseDate ? ` · ${match.releaseDate.slice(0,4)}` : ''}</p>
          <div style="font-size:.72rem;color:var(--muted);margin-top:8px">Se abrirá en <b style="color:var(--accent)">${esc(svcName)}</b></div>
        </div>
      </div>
      <div class="ca-plats">${platformsList || '<span style="color:var(--muted);font-size:.78rem">Sin plataformas disponibles</span>'}</div>
      <div class="ca-warn">⚠️ Si no es el álbum correcto (versión en vivo, cover, edición especial), elegí "Buscar manualmente".</div>
    `;
    const modalBox = m.querySelector('.modal');
    modalBox.querySelector('.ca-foot')?.remove();
    const footer = document.createElement('div');
    footer.className = 'ca-foot modal-foot';
    footer.innerHTML = `
      <button type="button" class="btn" data-dec="cancel">✗ Buscar manualmente</button>
      <button type="button" class="btn" data-dec="once">🔗 Solo abrir</button>
      <button type="button" class="btn primary" data-dec="save">⭐ Recordar</button>
    `;
    modalBox.appendChild(footer);
    function cleanup(dec){
      m.classList.remove('open');
      modalBox.querySelector('.ca-foot')?.remove();
      document.body.style.overflow = '';
      resolve(dec);
    }
    footer.querySelectorAll('button[data-dec]').forEach(b => {
      b.addEventListener('click', () => cleanup(b.dataset.dec));
    });
    const closeBtn = $("#albumConfirmClose");
    const closeHandler = () => cleanup('cancel');
    closeBtn?.addEventListener('click', closeHandler, { once: true });
    const overlayHandler = (e) => { if (e.target.id === 'albumConfirmModal') cleanup('cancel'); };
    m.addEventListener('click', overlayHandler, { once: true });
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
}

function abrirBuscadorWebManual(cd, svcKey){
  const q = encodeURIComponent(`${cd.interprete || ''} ${cd.titulo || ''}${cd.anio ? ' ' + cd.anio : ''}`.trim());
  const urls = {
    spotify: `https://open.spotify.com/search/${q}/albums`,
    youtube: `https://music.youtube.com/search?q=${q}&sp=EgIQAw%253D%253D`,
    apple: `https://music.apple.com/search?term=${q}&entity=album`,
    deezer: `https://www.deezer.com/search/${q}/album`,
    tidal: `https://tidal.com/search?q=${q}`,
    amazon: `https://music.amazon.com/search/${q}`,
    soundcloud: `https://soundcloud.com/search?q=${q}`,
    discogs: `https://www.discogs.com/search/?q=${q}&type=release`
  };
  const url = urls[svcKey];
  if (url && isSafeStreamUrl(url)) window.open(url, '_blank', 'noopener');
}

function attachLongPress(el, callback, ms=600){
  let timer = null;
  let wasLong = false;
  const start = () => {
    wasLong = false;
    timer = setTimeout(() => {
      wasLong = true;
      if (navigator.vibrate) navigator.vibrate(30);
      callback();
    }, ms);
  };
  const cancel = () => { if (timer){ clearTimeout(timer); timer = null; } };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', (e) => { cancel(); if (wasLong){ e.preventDefault(); e.stopPropagation(); } }, { passive: false });
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('touchmove', cancel);
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', (e) => { cancel(); if (wasLong){ e.preventDefault(); e.stopPropagation(); } });
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('click', (e) => { if (wasLong){ e.preventDefault(); e.stopPropagation(); wasLong = false; } }, true);
  el.addEventListener('contextmenu', e => e.preventDefault());
}

function removeResolvedLinkFromCD(cd, svcKey){
  if (!cd.links || !cd.links[svcKey]) return false;
  delete cd.links[svcKey];
  Store.persist();
  HistoryLog.log('EDIT', `Link quitado: ${svcKey}`, cd.titulo);
  AutoBackup.markChange('link quitado');
  return true;
}

function mostrarMenuQuitarLink(cd, svcKey, svcName, svcIcon){
  return new Promise(resolve => {
    const url = cd.links?.[svcKey] || '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.zIndex = '400';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width:460px">
        <div class="modal-head">
          <h3><span>🔗</span><span>Link guardado</span></h3>
          <button type="button" class="close" data-mql-x>✕</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;gap:12px;align-items:center;padding:14px;background:rgba(93,220,154,.06);border:1px solid rgba(93,220,154,.3);border-radius:12px;margin-bottom:14px">
            <span style="font-size:1.8rem">${svcIcon}</span>
            <div style="min-width:0;flex:1">
              <div style="font-size:.9rem;font-weight:700">${esc(svcName)}</div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${esc(cd.titulo || '—')}</div>
            </div>
          </div>
          <div style="font-size:.76rem;color:var(--warn);padding:10px 12px;background:rgba(255,169,77,.06);border-left:3px solid var(--warn);border-radius:8px;line-height:1.55">
            Si quitás este link, la próxima vez que toques <b>${svcIcon} ${esc(svcName)}</b> te voy a preguntar de nuevo.
          </div>
          <div style="margin-top:10px;padding:10px 12px;background:rgba(79,195,247,.06);border-left:3px solid var(--accent);border-radius:8px;font-size:.72rem;color:var(--muted);line-height:1.5;word-break:break-all">
            <b>URL actual:</b><br>${esc(url)}
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-mql-cancel>Cancelar</button>
          <div class="right"><button type="button" class="btn danger" data-mql-remove>🗑️ Quitar link</button></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cerrar = (resultado) => { overlay.remove(); resolve(resultado); };
    overlay.querySelector('[data-mql-x]').addEventListener('click', () => cerrar(false));
    overlay.querySelector('[data-mql-cancel]').addEventListener('click', () => cerrar(false));
    overlay.querySelector('[data-mql-remove]').addEventListener('click', () => cerrar(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(false); });
  });
}

function mostrarMenuResetearLinks(cd){
  return new Promise(resolve => {
    const links = cd.links || {};
    const keys = Object.keys(links).filter(k => STREAMING_SERVICES.some(s => s.key === k));
    if (!keys.length){ resolve(false); return; }
    const lista = keys.map(k => {
      const svc = STREAMING_SERVICES.find(s => s.key === k);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:.82rem"><span style="font-size:1.1rem">${svc?.icon||'🔗'}</span><span>${esc(svc?.name||k)}</span></div>`;
    }).join('');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.style.zIndex = '400';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="max-width:460px">
        <div class="modal-head">
          <h3><span>🔄</span><span>Resetear links guardados</span></h3>
          <button type="button" class="close" data-mrl-x>✕</button>
        </div>
        <div class="modal-body">
          <div style="font-size:.82rem;color:var(--muted);line-height:1.55;margin-bottom:12px">
            Se van a quitar <b>${keys.length}</b> link${keys.length === 1 ? '' : 's'} de <b>${esc(cd.titulo || '—')}</b>.
          </div>
          <div style="padding:12px 14px;background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:10px">${lista}</div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-mrl-cancel>Cancelar</button>
          <div class="right"><button type="button" class="btn danger" data-mrl-reset>🗑️ Quitar todos</button></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cerrar = (resultado) => { overlay.remove(); resolve(resultado); };
    overlay.querySelector('[data-mrl-x]').addEventListener('click', () => cerrar(false));
    overlay.querySelector('[data-mrl-cancel]').addEventListener('click', () => cerrar(false));
    overlay.querySelector('[data-mrl-reset]').addEventListener('click', () => cerrar(true));
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(false); });
  });
}

function wireStreamingSectionEvents(section, cd){
  if (!section || !cd) return;
  section.querySelectorAll('[data-smart-search]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    const svcKey = btn.dataset.smartSearch;
    const svcDef = STREAMING_SERVICES.find(s => s.key === svcKey);
    if (!svcDef) return;
    btn.addEventListener('click', () => {
      if (btn.dataset.busy === '1') return;
      btn.dataset.busy = '1';
      buscarYReproducir(cd, svcDef.key, svcDef.name, svcDef.icon, btn).finally(() => { delete btn.dataset.busy; });
    });
  });

  section.querySelectorAll('[data-saved-key]').forEach(el => {
    const svcKey = el.dataset.savedKey;
    const svcDef = STREAMING_SERVICES.find(s => s.key === svcKey);
    if (!svcDef) return;
    if (!el.dataset.wired){
      el.dataset.wired = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const url = cd.links?.[svcKey];
        if (url && isSafeStreamUrl(url)) window.open(url, '_blank', 'noopener');
        else Toast.show('🔒 URL no permitida', 'warn', 3000);
      });
      attachLongPress(el, async () => {
        const quitar = await mostrarMenuQuitarLink(cd, svcKey, svcDef.name, svcDef.icon);
        if (quitar){
          removeResolvedLinkFromCD(cd, svcKey);
          refreshStreamingSectionInDetail(cd);
          Toast.show(`🗑️ Link de ${svcDef.name} quitado`, 'info', 2500);
        }
      });
    }
  });

  const resetBtn = section.querySelector('#resetLinksBtn');
  if (resetBtn && !resetBtn.dataset.wired){
    resetBtn.dataset.wired = '1';
    resetBtn.addEventListener('click', async () => {
      const confirmar = await mostrarMenuResetearLinks(cd);
      if (confirmar){
        const keys = Object.keys(cd.links || {}).filter(k => STREAMING_SERVICES.some(s => s.key === k));
        keys.forEach(k => delete cd.links[k]);
        Store.persist();
        HistoryLog.log('EDIT', `Links reseteados`, `${keys.length} · ${cd.titulo}`);
        AutoBackup.markChange('reset links');
        refreshStreamingSectionInDetail(cd);
        Toast.show(`🗑️ ${keys.length} link${keys.length === 1 ? '' : 's'} quitado${keys.length === 1 ? '' : 's'}`, 'info', 2800);
      }
    });
  }
}

function refreshStreamingSectionInDetail(cd){
  const viewBody = $("#viewBody");
  if (!viewBody) return;
  const oldSection = viewBody.querySelector('.stream-section');
  if (!oldSection) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderStreamingSection(cd);
  const newSection = temp.firstElementChild;
  if (!newSection) return;
  oldSection.replaceWith(newSection);
  wireStreamingSectionEvents(newSection, cd);
}

async function buscarYReproducir(cd, svcKey, svcName, svcIcon, triggerBtn){
  const original = triggerBtn ? triggerBtn.innerHTML : '';

  if (cd.links && cd.links[svcKey]){
    const url = cd.links[svcKey];
    if (!isSafeStreamUrl(url)){ Toast.show('🔒 URL no permitida', 'warn', 3500); return; }
    window.open(url, '_blank', 'noopener');
    return;
  }

  const cached = ResolvedLinks.get(cd.id);
  if (cached && cached[svcKey]){
    const url = cached[svcKey];
    if (!isSafeStreamUrl(url)){ Toast.show('🔒 URL no permitida', 'warn', 3000); return; }
    window.open(url, '_blank', 'noopener');
    return;
  }

  if (triggerBtn){
    triggerBtn.disabled = true;
    triggerBtn.classList.add('busy');
    triggerBtn.innerHTML = `<span class="si">${svcIcon}</span><span class="sn">Buscando…</span><span class="sx">⏳</span>`;
  }

  try {
    const appleMatch = await findAppleAlbumMatch(cd);
    if (!appleMatch) throw new Error('No encontré el álbum en iTunes.');
    if (!appleMatch.collectionViewUrl) throw new Error('Sin URL de Apple Music');

    const links = await resolveAllPlatformLinks(appleMatch.collectionViewUrl);
    if (!links[svcKey] && !links.apple && !Object.keys(links).length){
      throw new Error(`No encontré links de streaming para ${svcName}`);
    }
    if (!links[svcKey] && links.apple && svcKey !== 'apple'){
      links._fallbackService = svcKey;
    }

    if (triggerBtn){
      triggerBtn.innerHTML = original;
      triggerBtn.disabled = false;
      triggerBtn.classList.remove('busy');
    }

    const decision = await mostrarModalConfirmacionAlbum(cd, appleMatch, links, svcName, svcIcon);
    if (decision === 'cancel'){ abrirBuscadorWebManual(cd, svcKey); return; }
    ResolvedLinks.set(cd.id, links);
    if (decision === 'save'){
      guardarLinksEnCD(cd, links);
      refreshStreamingSectionInDetail(cd);
      Toast.show('⭐ Guardado', 'ok', 2800);
    }
    let finalUrl = links[svcKey];
    if (!finalUrl && links.apple && svcKey !== 'apple'){
      Toast.show(`⚠️ ${svcName} no disponible vía API. Abriendo Apple Music / buscador…`, 'warn', 4000);
      finalUrl = links.apple;
      setTimeout(() => abrirBuscadorWebManual(cd, svcKey), 600);
    }
    if (!isSafeStreamUrl(finalUrl)){ Toast.show('🔒 URL bloqueada', 'warn', 4000); return; }
    window.open(finalUrl, '_blank', 'noopener');
  } catch (error){
    Toast.show('⚠️ ' + error.message, 'warn', 4500);
    if (triggerBtn){ triggerBtn.innerHTML = original; triggerBtn.disabled = false; triggerBtn.classList.remove('busy'); }
    abrirBuscadorWebManual(cd, svcKey);
  }
}

function renderStreamingSection(cd){
  const cdLinks = cd.links || {};
  const knownKeys = STREAMING_SERVICES.map(s => s.key);
  const directCount = Object.keys(cdLinks).filter(k => knownKeys.includes(k) && isSafeStreamUrl(cdLinks[k])).length;
  const otherLinks = Object.entries(cdLinks).filter(([k, v]) => !knownKeys.includes(k) && isSafeStreamUrl(v));

  const parts = [];
  if (cd.titulo)     parts.push(`"${cd.titulo}"`);
  if (cd.interprete) parts.push(`"${cd.interprete}"`);
  if (cd.anio)       parts.push(String(cd.anio));
  const q = encodeURIComponent(parts.join(' ').trim());

  const discogsSearch = `https://www.discogs.com/search/?q=${q}&type=release`;
  const SMART_SERVICES = new Set(['spotify', 'youtube', 'apple', 'deezer', 'tidal', 'amazon', 'soundcloud']);

  const badge = directCount > 0
    ? `<span class="stream-count">✅ ${directCount} guardado${directCount === 1 ? '' : 's'}</span>`
    : `<span class="stream-count" style="background:rgba(255,169,77,.15);color:var(--warn);border-color:rgba(255,169,77,.4)">🎯 Búsqueda inteligente</span>`;

  const items = STREAMING_SERVICES.map(svc => {
    const direct = cdLinks[svc.key];
    if (direct && isSafeStreamUrl(direct)){
      return `<button type="button" class="stream-btn direct" style="--svc-color:${svc.color}" data-saved-key="${svc.key}" data-url="${esc(direct)}" title="Abrir en ${esc(svc.name)} — mantené presionado para gestionar">
        <span class="si">${svc.icon}</span><span class="sn">${esc(svc.name)}</span><span class="sx">↗</span>
      </button>`;
    }
    if (svc.key === 'discogs'){
      return `<a href="${esc(discogsSearch)}" target="_blank" rel="noopener" class="stream-btn search" style="--svc-color:${svc.color}" title="Buscar en Discogs">
        <span class="si">${svc.icon}</span><span class="sn">${esc(svc.name)}</span><span class="sx">🔍</span>
      </a>`;
    }
    if (SMART_SERVICES.has(svc.key)){
      return `<button type="button" class="stream-btn search" style="--svc-color:${svc.color}" data-smart-search="${svc.key}" title="Búsqueda inteligente en ${esc(svc.name)}">
        <span class="si">${svc.icon}</span><span class="sn">${esc(svc.name)}</span><span class="sx">🎯</span>
      </button>`;
    }
    return '';
  }).join('');

  const othersHTML = otherLinks.length ? `
    <div style="margin-top:12px">
      <div style="font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px">🔗 Otros enlaces</div>
      <div class="stream-grid">${otherLinks.filter(([,url]) => isSafeStreamUrl(url)).map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener" class="stream-btn direct" style="--svc-color:var(--purple)"><span class="si">🔗</span><span class="sn">${esc(k)}</span><span class="sx">↗</span></a>`).join('')}</div>
    </div>` : '';

  let note = '';
  if (directCount === 0 && !otherLinks.length){
    note = `<div class="stream-hint-note stream-hint-warn">💡 <b style="color:var(--warn)">Sin links guardados.</b> Tocá un servicio 🎯. Te muestro el álbum encontrado y podés <b style="color:var(--accent2)">⭐ Recordar</b> para que la próxima abra directo.</div>`;
  } else if (directCount > 0){
    note = `<div class="stream-hint-note stream-hint-ok">
      💾 <b style="color:var(--ok)">${directCount} link${directCount === 1 ? '' : 's'} guardado${directCount === 1 ? '' : 's'}</b>. Tocá cualquiera y abre directo.
      <div style="margin-top:8px;font-size:.68rem;color:var(--muted);line-height:1.5">🔧 <b>¿Te equivocaste con alguno?</b> Mantené presionado el link guardado (600 ms) para quitarlo.</div>
    </div>`;
  }

  const resetBtn = directCount > 0 ? `<button type="button" id="resetLinksBtn">🔄 Resetear todos los links guardados</button>` : '';

  return `<div class="stream-section">
    <div class="stream-head">
      <span>🎧 Escuchar en ${badge}</span>
      <span class="lock">🔒 Solo streaming</span>
    </div>
    <div class="stream-grid">${items}</div>
    ${othersHTML}
    ${note}
    ${resetBtn}
    <div class="stream-note">✅ <b style="color:var(--ok)">Solo reproducción legal.</b> Este visor <b>no descarga</b> ni aloja contenido.</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   LEGAL — Aviso + Firma SHA-256
   ═══════════════════════════════════════════════════════════════════ */

async function firmarAceptacionLegal(){
  const payload = `v${APP_VERSION}|${Date.now()}|${navigator.userAgent}|${location.origin}`;
  try {
    if (crypto?.subtle?.digest){
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }
  } catch(e){}
  let h = 0;
  const s = `v${APP_VERSION}|${Date.now()}|${navigator.userAgent}`;
  for (let i = 0; i < s.length; i++){ h = (h*31 + s.charCodeAt(i)) | 0; }
  return 'fallback_' + Math.abs(h).toString(16);
}

function buildLegalBodyHTML(){
  const sig = (() => { try { return JSON.parse(localStorage.getItem(LEGAL_SIGNATURE_KEY) || 'null'); } catch(e){ return null; } })();
  const accepted = localStorage.getItem(LEGAL_NOTICE_KEY) === '1';
  const acceptedLine = (accepted && sig)
    ? `<div class="lg-sig"><b>Aceptado:</b> ${esc(sig.acceptedAt || '—')}<br><b>Firma SHA-256:</b> ${esc(sig.hash || '—')}<br><b>Versión:</b> ${esc(sig.version || APP_VERSION)}</div>` : '';
  return `
    <div class="legal-hero">
      <span class="lh-icon">⚖️</span>
      <div>
        <h3>Información importante sobre el uso de la app</h3>
        <p>Discografía v${APP_VERSION} es una herramienta de catalogación personal.</p>
      </div>
    </div>
    <div class="lg-box yes"><b>✅ Lo que SÍ hace</b><ul>
      <li>Abre el reproductor oficial del servicio elegido.</li>
      <li>Pre-carga la búsqueda del álbum.</li>
      <li>Usa APIs públicas (iTunes Search, MusicBrainz; Odesli si disponible).</li>
      <li>Guarda localmente el link directo si el usuario lo confirma.</li>
    </ul></div>
    <div class="lg-box no"><b>❌ Lo que NO hace</b><ul>
      <li>NO descarga audio ni video.</li>
      <li>NO reproduce contenido de forma no autorizada.</li>
      <li>NO evade DRM ni extrae streams.</li>
      <li>NO comparte tu colección con terceros.</li>
    </ul></div>
    <div class="lg-box info"><b>🛡️ Whitelist de dominios</b>
      <ul>${ALLOWED_STREAM_DOMAINS.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>
    <label class="lg-check">
      <input type="checkbox" id="legalAcepto">
      <span>He leído y acepto los términos. Entiendo que la app <b>NO descarga contenido</b>.</span>
    </label>
    ${acceptedLine}
  `;
}

function openLegalModal(){
  const m = $("#legalModal");
  const body = $("#legalBody");
  if (!m || !body) return;
  body.innerHTML = buildLegalBodyHTML();
  const chk = $("#legalAcepto");
  const btn = $("#legalAceptar");
  if (chk && btn){
    chk.checked = false;
    btn.disabled = true;
    btn.style.opacity = '.45';
    btn.style.cursor = 'not-allowed';
    if (chk._legalHandler){
      try { chk.removeEventListener('change', chk._legalHandler); } catch(_){}
      chk._legalHandler = null;
    }
    const handler = () => {
      btn.disabled = !chk.checked;
      btn.style.opacity = chk.checked ? '1' : '.45';
      btn.style.cursor = chk.checked ? 'pointer' : 'not-allowed';
    };
    chk.addEventListener('change', handler);
    chk._legalHandler = handler;
  }
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLegalModal(){
  const chk = $("#legalAcepto");
  if (chk && chk._legalHandler){
    try { chk.removeEventListener('change', chk._legalHandler); } catch(_){}
    chk._legalHandler = null;
  }
  $("#legalModal")?.classList.remove('open');
  document.body.style.overflow = '';
}

async function aceptarLegal(){
  const chk = $("#legalAcepto");
  if (chk && !chk.checked){ Toast.show('⚠️ Marcá la casilla primero', 'warn', 3000); return; }
  const hash = await firmarAceptacionLegal();
  try {
    localStorage.setItem(LEGAL_NOTICE_KEY, '1');
    localStorage.setItem(LEGAL_SIGNATURE_KEY, JSON.stringify({
      hash, version: APP_VERSION,
      acceptedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      origin: location.origin
    }));
  } catch(e){}
  closeLegalModal();
  HistoryLog.log('INFO', 'Aviso legal aceptado', `Firma: ${hash.slice(0,16)}…`);
  Toast.show(`✅ Aviso aceptado · Firma: ${hash.slice(0,12)}…`, 'ok', 3500);
}

function exportLegalPDF(){
  const sig = (() => { try { return JSON.parse(localStorage.getItem(LEGAL_SIGNATURE_KEY) || 'null'); } catch(e){ return null; } })();
  const o = OwnerConfig.get();
  const now = new Date().toLocaleString('es-AR');
  const win = window.open('', '_blank');
  if (!win){ Toast.show('Permitir popups', 'warn', 5000); return; }
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Aviso legal — Discografía v${APP_VERSION}</title>
  <style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:'Segoe UI',Roboto,sans-serif;color:#1a2332;line-height:1.6;padding:24px;font-size:11pt}h1{margin:0 0 6px;font-size:20pt;color:#1976d2}h2{margin:22px 0 10px;font-size:13pt;color:#333;border-bottom:2px solid #1976d2;padding-bottom:6px}.meta{font-size:9pt;color:#666;margin-bottom:20px}ul{padding-left:22px;margin:8px 0}li{margin:5px 0}.box{padding:12px 14px;border-radius:8px;margin:12px 0;font-size:10.5pt}.yes{background:#e8f5e9;border-left:4px solid #2ea043}.no{background:#ffebee;border-left:4px solid #d32f2f}.info{background:#e3f2fd;border-left:4px solid #1976d2}.sig{font-family:ui-monospace,Menlo,monospace;font-size:8.5pt;background:#f5f7fa;padding:12px;border-radius:6px;word-break:break-all;margin-top:14px}.foot{margin-top:40px;padding-top:14px;border-top:1px solid #ddd;font-size:9pt;color:#888;text-align:center}@media print{body{padding:0}}</style></head><body>
  <h1>⚖️ Aviso legal — Discografía v${APP_VERSION}</h1>
  <div class="meta">Generado: ${esc(now)} · ${esc(o.name || DEFAULT_AUTHOR)} · ${esc(OwnerConfig.contactLine() || DEFAULT_PHONE)}</div>
  <h2>1. Qué es</h2><p>Herramienta de catalogación personal de CDs.</p>
  <h2>2. Lo que SÍ hace</h2><div class="box yes"><ul><li>Abre el reproductor oficial.</li><li>Usa APIs públicas.</li></ul></div>
  <h2>3. Lo que NO hace</h2><div class="box no"><ul><li>NO descarga audio.</li><li>NO evade DRM.</li><li>NO sube datos a servidores propios.</li></ul></div>
  <h2>4. Whitelist</h2><div class="box info"><ul>${ALLOWED_STREAM_DOMAINS.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>
  ${sig ? `<h2>5. Firma SHA-256</h2><div class="sig"><b>Hash:</b> ${esc(sig.hash || '—')}<br><b>Fecha:</b> ${esc(sig.acceptedAt || '—')}</div>` : ''}
  <div class="foot">Discografía v${APP_VERSION} — ${esc(o.name || DEFAULT_AUTHOR)} — ${esc(COPYRIGHT_TEXT)}</div>
  <script>setTimeout(()=>window.print(),500)<\/script></body></html>`);
  win.document.close();
  HistoryLog.log('EXPORT', 'Aviso legal exportado a PDF');
}

function maybeShowLegalOnFirstRun(){
  if (localStorage.getItem(LEGAL_NOTICE_KEY) === '1') return;
  setTimeout(() => { if (!isAnyModalOpen()) openLegalModal(); }, 1500);
}

/* ═══════════════════════════════════════════════════════════════════
   MusicBrainz — enrichFromMusicBrainz
   ═══════════════════════════════════════════════════════════════════ */

async function enrichFromMusicBrainz(titulo, interprete, hints = {}){
  if (!titulo || !interprete) return null;
  const waitMs = _mb503Until - Date.now();
  if (waitMs > 0){
    _lastCallBySource.MusicBrainz = 0;
    throw new Error('COOLDOWN');
  }

  const tituloLimpio = limpiarTituloParaBusqueda(titulo);
  const interpreteLimpio = limpiarInterpreteParaBusqueda(interprete);

  const strategies = [
    { name: 'exacta',        query: `release:"${titulo}" AND artist:"${interprete}"` },
    { name: 'limpia',        query: `release:"${tituloLimpio}" AND artist:"${interpreteLimpio}"` },
    { name: 'sin-comillas',  query: `release:${tituloLimpio} AND artist:${interpreteLimpio}` },
    { name: 'solo-titulo',   query: `release:"${tituloLimpio}"` }
  ];
  const seen = new Set();
  const uniqueStrategies = strategies.filter(s => { if (seen.has(s.query)) return false; seen.add(s.query); return true; });

  let lastError = 'no-results';
  for (const strat of uniqueStrategies){
    try {
      await throttleSource("MusicBrainz");
      const q = encodeURIComponent(strat.query);
      const res = await fetchWithTimeout(`${MB_API}release?query=${q}&fmt=json&limit=10&inc=release-groups`, { headers: { 'User-Agent': MB_USER_AGENT } });
      if (res.status === 503){
        _mb503Until = Date.now() + 60000;
        console.warn(`[MB] ❄️ 503 — enfriando 60s`);
        throw new Error('COOLDOWN');
      }
      if (res.status === 429){
        const ra = parseInt(res.headers.get('Retry-After') || '60');
        _mb503Until = Date.now() + Math.max(60000, ra * 1000);
        throw new Error('COOLDOWN');
      }
      if (!res.ok){ lastError = 'HTTP ' + res.status; continue; }
      const d = await res.json();
      if (!d.releases?.length){ lastError = 'no-results'; continue; }

      const añosH = hints.anio ? parseInt(hints.anio) : null;
      const ranked = d.releases.map(r => {
        const ct = r.title;
        const ca = (r["artist-credit"] || []).map(x => x.name || x.artist?.name).join(" ");
        let sc = matchConfidence(tituloLimpio, interpreteLimpio, { title: ct, artist: ca });
        const rgd = r['release-group']?.['first-release-date'];
        if (añosH && rgd){ const y = parseInt(String(rgd).slice(0, 4), 10); if (Number.isFinite(y) && Math.abs(y - añosH) <= 1) sc = Math.min(100, sc + 8); }
        if (Array.isArray(r.format) && r.format.some(f => /cd/i.test(f))) sc = Math.min(100, sc + 3);
        const rgTitle = r['release-group']?.title || '';
        if (rgTitle && normMatch(rgTitle) === normMatch(tituloLimpio)) sc = Math.min(100, sc + 15);
        return { r, ct, ca, sc };
      }).sort((a, b) => b.sc - a.sc);

      if (!ranked.length || ranked[0].sc < 40){ lastError = 'low-confidence'; continue; }

      let best = null, coverUrl = null, externalLinks = {};
      for (const c of ranked.slice(0, 3)){
        const [cc, lk] = await Promise.all([fetchCoverArtFromCAA(c.r.id), fetchExternalLinks(c.r.id)]);
        if (cc){ best = c; coverUrl = cc; externalLinks = lk; break; }
        if (!best){ best = c; externalLinks = lk; }
      }
      if (!best){ lastError = 'no-cover'; continue; }

      const r = best.r;
      let anio = null;
      const rgDate = r['release-group']?.['first-release-date'];
      if (rgDate) anio = normalizeYear(String(rgDate).slice(0, 4));
      if (!anio && r.date) anio = normalizeYear(String(r.date).slice(0, 4));
      if (!anio && Array.isArray(r['release-events']) && r['release-events'][0]?.date){ anio = normalizeYear(String(r['release-events'][0].date).slice(0, 4)); }
      const anioPrensada = normalizeYear(r.date ? String(r.date).slice(0, 4) : null);

      console.log(`[MB] ✅ "${strat.name}" → ${best.ct} — ${best.ca} (score ${best.sc})`);
      return enrichMeta({
        source: "MusicBrainz", anio, anioPrensada, anioMaster: anio,
        sello: r['label-info']?.[0]?.label?.name || '', pais: r.country || '',
        catalogo: r['label-info']?.[0]?.['catalog-number'] || '',
        genero: r['release-group']?.genres?.[0]?.name || r.genres?.[0]?.name || r.tags?.[0]?.name || '',
        mbId: r.id, releaseGroupId: r['release-group']?.id || null,
        portada: coverUrl, portadaSource: coverUrl ? "MusicBrainz CAA" : null,
        links: externalLinks,
        _title: upper(best.ct), _artist: upper(best.ca),
        _strategy: strat.name
      }, titulo, interprete, best.sc);
    } catch(err){
      if (err.message === 'COOLDOWN') throw err;
      lastError = err.message;
    }
  }
  console.warn(`[MB] ❌ "${titulo}" de "${interprete}" → ${lastError}`);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════
   Discogs — enrichFromDiscogs
   ═══════════════════════════════════════════════════════════════════ */

async function enrichFromDiscogs(titulo, interprete, hints = {}){
  if (!getDiscogsToken()) return null;
  if (!titulo && !interprete && !hints.barcode) return null;
  const waitMs = _discogs429Until - Date.now();
  if (waitMs > 0){ _lastCallBySource.Discogs = 0; throw new Error('COOLDOWN'); }

  const tituloLimpio = limpiarTituloParaBusqueda(titulo);
  const interpreteLimpio = limpiarInterpreteParaBusqueda(interprete);
  const tituloParaQuery = tituloLimpio || titulo;
  const interpreteParaQuery = interpreteLimpio || interprete;

  const añosH  = hints.anio ? parseInt(hints.anio) : null;
  const paísH  = (hints.pais     || '').trim().toLowerCase();
  const selloH = (hints.sello    || '').trim().toLowerCase();
  const catH   = (hints.catalogo || '').trim().toLowerCase();
  const bcClean = hints.barcode ? String(hints.barcode).replace(/\s+/g,'') : '';
  let results = [];
  try {
    if (bcClean){
      await throttleSource("Discogs");
      const params = new URLSearchParams({ barcode: bcClean, type: 'release', per_page: '10' });
      const res = await fetchDiscogs(`${DISCOGS_API}/database/search?${params.toString()}`);
      if (res.status === 429){ const ra = parseInt(res.headers.get('Retry-After') || '60'); _discogs429Until = Date.now() + Math.max(30000, ra*1000); throw new Error('COOLDOWN'); }
      if (res.ok){ const d = await res.json(); if (d.results?.length) results = d.results; }
    }
    if (!results.length && tituloParaQuery && interpreteParaQuery){
      await throttleSource("Discogs");
      const params = new URLSearchParams({ artist: interpreteParaQuery, release_title: tituloParaQuery, type: 'release', per_page: '10' });
      const res = await fetchDiscogs(`${DISCOGS_API}/database/search?${params.toString()}`);
      if (res.status === 429){ const ra = parseInt(res.headers.get('Retry-After') || '60'); _discogs429Until = Date.now() + Math.max(30000, ra*1000); throw new Error('COOLDOWN'); }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (d.results?.length) results = d.results;
    }
    if (!results.length) return null;
    const ranked = results.map(r => {
      const rt = String(r.title || '');
      const sep = rt.includes(' – ') ? ' – ' : ' - ';
      const parts = rt.split(sep);
      const ca = parts.length > 1 ? parts[0].trim() : '';
      const ct = parts.length > 1 ? cleanDiscogsTitle(parts.slice(1).join(sep)) : cleanDiscogsTitle(rt);
      const bs = matchConfidence(tituloLimpio || ct, interpreteLimpio || ca, { title: ct, artist: ca || interpreteLimpio });
      let bonus = 0;
      if (añosH && r.year && Math.abs(parseInt(r.year) - añosH) <= 1) bonus += 8;
      if (paísH && r.country && normMatch(r.country).includes(normMatch(paísH))) bonus += 5;
      if (selloH && Array.isArray(r.label) && r.label.some(l => normMatch(l).includes(normMatch(selloH)))) bonus += 8;
      if (catH && r.catno && normMatch(r.catno).includes(normMatch(catH))) bonus += 15;
      if (Array.isArray(r.format) && r.format.some(f => /cd/i.test(f))) bonus += 3;
      if (bcClean && r.barcode && String(r.barcode).replace(/\s+/g,'') === bcClean) bonus += 25;
      const hc = (r.cover_image && !r.cover_image.includes('spacer.gif')) || (r.thumb && !r.thumb.includes('spacer.gif'));
      if (hc) bonus += 6;
      return { r, ct, ca, score: Math.min(100, bs + bonus), hc };
    }).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.hc !== b.hc) return b.hc ? 1 : -1;
      return 0;
    });
    const best = ranked[0];
    if (!best || Number(best.score || 0) < 70) return null;
    const r = best.r;
    let portada = null;
    if (r.cover_image && !r.cover_image.includes('spacer.gif')) portada = r.cover_image;
    else if (r.thumb && !r.thumb.includes('spacer.gif')) portada = r.thumb;
    let anioSearch = normalizeYear(r.year);
    let masterYear = null;
    if (r.master_id){ const master = await fetchDiscogsMasterDetails(r.master_id); if (master){ if (master.year) masterYear = master.year; if (!portada && master.cover) portada = master.cover; } }
    if (masterYear) anioSearch = masterYear;
    if (!portada || !anioSearch){ const det = await fetchDiscogsReleaseDetails(r.id); if (det){ if (!portada) portada = det.cover; if (!anioSearch) anioSearch = det.year; } }
    anioSearch = normalizeYear(anioSearch);
    return enrichMeta({
      source: 'Discogs', anio: anioSearch, anioPrensada: normalizeYear(r.year), anioMaster: masterYear,
      sello: upper(Array.isArray(r.label) ? (r.label[0] || '') : ''), pais: upper(r.country || ''),
      catalogo: upper(r.catno || ''), genero: upper(Array.isArray(r.genre) ? (r.genre[0] || '') : ''),
      discogsId: r.id, discogsMasterId: r.master_id || null,
      discogsUrl: r.uri ? `https://www.discogs.com${r.uri}` : null,
      portada, portadaSource: portada ? 'Discogs' : null,
      links: r.uri ? { discogs: `https://www.discogs.com${r.uri}` } : {},
      _title: upper(best.ct), _artist: upper(best.ca || interprete),
      _strategy: 'discogs-search'
    }, titulo || best.ct, interprete || best.ca, best.score);
  } catch(err){
    if (err.message === 'COOLDOWN') throw err;
    console.warn('[Discogs]', err.message);
    return null;
  }
}

async function enrichFromChain(titulo, interprete, options = {}){
  const { onSource = null, useSources = null, minConfidence = 70, useCache = true, hints = {}, prioridad = 'discogs' } = options;
  const cy = hints.anio || "";
  if (useCache){
    const c = MetadataCache.get(titulo, interprete, cy);
    if (c && c.portada){ if (onSource){ ["Discogs","MusicBrainz"].forEach(s => onSource(s, s === c.source ? "ok" : "skipped")); } return { ...c, _fromCache: true }; }
  }
  const hT = !!getDiscogsToken();
  const allSources = [
    { name: "Discogs", fn: (t,i,h) => enrichFromDiscogs(t,i,h), enabled: hT },
    { name: "MusicBrainz", fn: (t,i,h) => enrichFromMusicBrainz(t,i,h), enabled: true }
  ];
  const ordered = prioridad === 'musicbrainz'
    ? [allSources[1], allSources[0]]
    : [allSources[0], allSources[1]];
  const sources = ordered.filter(s => s.enabled && (!useSources || useSources.includes(s.name)));
  if (onSource) allSources.filter(s => !s.enabled).forEach(s => onSource(s.name, "skipped"));
  let best = null;
  for (const s of sources){
    if (onSource) onSource(s.name, "querying");
    let info = null;
    try {
      info = await s.fn(titulo, interprete, hints);
    } catch(err){
      if (err.message === 'COOLDOWN'){ if (onSource) onSource(s.name, "skipped"); continue; }
      if (onSource) onSource(s.name, "fail");
      continue;
    }
    if (info){
      verificarFechaEmision(info, hints.anio);
      if (onSource) onSource(s.name, "ok");
      if (!best || Number(info.confidence || 0) > Number(best.confidence || 0)) best = info;
      if (Number(info.confidence || 0) >= 95 && info.portada) break;
      if (best && best.portada && Number(best.confidence || 0) >= 85) break;
    } else if (onSource) onSource(s.name, "fail");
    await new Promise(r => setTimeout(r, 200));
  }
  if (best && Number(best.confidence || 0) < minConfidence) return null;
  if (best && useCache) MetadataCache.set(titulo, interprete, cy, best);
  return best;
}

function showEnrichBar(msg, active = true){ const b = $("#enrichBar"); if (!b) return; b.style.display = "flex"; b.classList.toggle("active", active); $("#enrichMsg").textContent = msg; }
function showEnrichResult(txt, src){ const b = $("#enrichBar"); if (!b) return; b.style.display = "flex"; b.classList.remove("active"); $("#enrichMsg").textContent = src ? `✓ Encontrado en ${src}` : "✓ Info encontrada"; $("#enrichResult").innerHTML = txt; setTimeout(() => b.style.display = "none", 3500); }
function showEnrichSources(states){
  const c = $("#enrichSources"); if (!c) return;
  const s = Object.keys(states);
  if (!s.length){ c.style.display = "none"; c.innerHTML = ""; return; }
  c.style.display = "flex";
  c.innerHTML = `<span class="label">Fuentes:</span>` + s.map(n => {
    const st = states[n] || "";
    const cl = st === "ok" ? "chip ok" : st === "querying" ? "chip querying" : st === "skipped" ? "chip skipped" : st === "fail" ? "chip fail" : "chip";
    return `<span class="${cl}"><span class="dot"></span>${n}</span>`;
  }).join("");
}
function renderCoverPreview(url, source){
  const img = $("#coverPreviewImg"), info = $("#coverPreviewSource"), clr = $("#btnClearCover");
  if (!img || !info) return;
  if (!url){ img.innerHTML = `<div class="cover-empty">💿</div>`; info.textContent = "Sin portada"; if (clr) clr.style.display = "none"; return; }
  img.innerHTML = `<img src="${esc(url)}" alt="Portada" loading="lazy">`;
  info.innerHTML = `<code>${esc(url.slice(0, 45))}${url.length > 45 ? "…" : ""}</code>${source ? `<br><b>${esc(source)}</b>` : ""}`;
  if (clr) clr.style.display = "";
}
async function fetchCoverManually(){
  const t = $("#fTitulo").value.trim(), i = $("#fInterprete").value.trim();
  if (!t || !i){ Toast.show("Completá título e intérprete", "warn"); return; }
  const btn = $("#btnFetchCover"); const orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner-xs"></span> Buscando…`;
  const states = {};
  try {
    const info = await enrichFromChain(t, i, { hints: { anio: $("#fAnio")?.value, pais: $("#fPais")?.value, sello: $("#fSello")?.value, catalogo: $("#fCatalogo")?.value, barcode: $("#fCodigo")?.value }, useCache: false, onSource: (n, s) => {
      if (s === 'querying'){ states[n] = 'querying'; showEnrichBar(`Buscando en ${n}…`); } else { states[n] = s === 'ok' ? 'ok' : s === 'skipped' ? 'skipped' : 'fail'; }
      showEnrichSources(states);
    }});
    if (info && info.portada){
      $("#fCoverUrl").value = info.portada;
      $("#fCoverUrl").dataset.enrichmentSource = info.source || "";
      $("#fCoverUrl").dataset.enrichmentConfidence = info.confidence ?? "";
      $("#fCoverUrl").dataset.enrichedAt = info.enrichedAt || "";
      renderCoverPreview(info.portada, info.portadaSource);
      showEnrichBar(`✓ Portada en ${info.source}`);
    } else showEnrichBar("Sin portada");
    setTimeout(() => { $("#enrichBar").style.display = "none"; $("#enrichSources").style.display = "none"; }, 2500);
  } finally { btn.disabled = false; btn.innerHTML = orig; }
}

let _enrichTimer = null, _enrichRequestId = 0;
function scheduleEnrichment(delay = 750){ if (_enrichTimer) clearTimeout(_enrichTimer); _enrichTimer = setTimeout(() => { _enrichTimer = null; autoEnrich(); }, delay); }
async function autoEnrich(){
  const tg = $("#enrichToggle"); if (!tg || !tg.checked) return;
  const t = $("#fTitulo").value.trim(), i = $("#fInterprete").value.trim();
  if (!t || !i) return;
  const myId = ++_enrichRequestId;
  const rc = $("#replaceToggle"); const re = rc ? rc.checked : Store.getPref("replaceOnEnrich", true);
  showEnrichBar("Buscando…"); const states = {};
  const info = await enrichFromChain(t, i, { hints: { anio: $("#fAnio")?.value, pais: $("#fPais")?.value, sello: $("#fSello")?.value, catalogo: $("#fCatalogo")?.value, barcode: $("#fCodigo")?.value }, onSource: (n, s) => {
    if (s === 'querying'){ states[n] = 'querying'; showEnrichBar(`Consultando ${n}…`); } else { states[n] = s === 'ok' ? 'ok' : s === 'skipped' ? 'skipped' : 'fail'; }
    showEnrichSources(states);
  }});
  if (myId !== _enrichRequestId) return;
  if (!info){ showEnrichBar("Sin datos"); setTimeout(() => { $("#enrichBar").style.display = "none"; $("#enrichSources").style.display = "none"; }, 2500); return; }
  const campos = [], reps = [];
  const cv = s => String($(s)?.value ?? "").trim();
  function ap(sel, nv, l){
    if (nv === null || nv === undefined || nv === "") return;
    const ov = cv(sel);
    if (re){ if (ov && ov !== String(nv)) reps.push(`${l}: ${ov} → ${nv}`); $(sel).value = nv; campos.push(l); }
    else if (!ov){ $(sel).value = nv; campos.push(l); }
  }
  (function(){
    const anioAlbumActual = parseInt(cv("#fAnio")) || null;
    const anioApi = info.anio;
    if (anioApi && anioAlbumActual && (anioApi - anioAlbumActual) > 5){
      const anioEdActual = parseInt(cv("#fAnioEdicion")) || null;
      if (re || !anioEdActual){
        if (anioEdActual !== anioApi){ $("#fAnioEdicion").value = anioApi; campos.push("📅 Año edición"); }
      }
    } else { ap("#fAnio", anioApi, "Año álbum"); }
  })();
  ap("#fSello", upper(info.sello), "Sello");
  ap("#fGenero", upper(info.genero), "Género");
  ap("#fPais", upper(info.pais), "País");
  ap("#fCatalogo", upper(info.catalogo), "Catálogo");
  if (info._title){
    const nuevo = corregirCampo(cv("#fTitulo"), upper(info._title), info.confidence, re);
    if (nuevo && nuevo !== cv("#fTitulo")){ reps.push(`Título: "${cv("#fTitulo")}" → "${nuevo}"`); $("#fTitulo").value = upper(nuevo); campos.push("🎵 Título"); }
  }
  if (info._artist){
    const nuevo = corregirCampo(cv("#fInterprete"), upper(info._artist), info.confidence, re);
    if (nuevo && nuevo !== cv("#fInterprete")){ reps.push(`Intérprete: "${cv("#fInterprete")}" → "${nuevo}"`); $("#fInterprete").value = upper(nuevo); campos.push("🎤 Intérprete"); }
  }
  if (info.portada){
    const oc = cv("#fCoverUrl");
    if (re || !oc){
      if (oc && oc !== info.portada) reps.push("Portada reemplazada");
      $("#fCoverUrl").value = info.portada;
      $("#fCoverUrl").dataset.enrichmentSource = info.source || "";
      $("#fCoverUrl").dataset.enrichmentConfidence = info.confidence ?? "";
      $("#fCoverUrl").dataset.enrichedAt = info.enrichedAt || "";
      renderCoverPreview(info.portada, info.portadaSource);
      campos.push("🖼️ Portada");
    }
  }
  if (info.links && Object.keys(info.links).length){
    const actuales = (() => { try { return JSON.parse($("#fLinks").value || '{}'); } catch(e){ return {}; } })();
    const merged = re ? { ...actuales, ...info.links } : { ...info.links, ...actuales };
    $("#fLinks").value = JSON.stringify(merged);
    campos.push("🎧 Links streaming");
  }
  showEnrichSources(states);
  if (reps.length) Toast.show(`🔄 ${reps.join(" · ")}`, "info", 5500);
  if (campos.length) showEnrichResult(campos.join(" · ") + " " + confidenceChip(info.confidence), info.source);
  else { showEnrichBar(`Sin campos nuevos`); setTimeout(() => { $("#enrichBar").style.display = "none"; $("#enrichSources").style.display = "none"; }, 2500); }
}

/* ═══════════════════════════════════════════════════════════════════
   BULK ENRICH
   ═══════════════════════════════════════════════════════════════════ */

const BulkEnrich = (() => {
  let running = false, cancelled = false;
  let stats = { total: 0, ok: 0, skip: 0, fail: 0, fields: 0, covers: 0, cached: 0, links: 0, requeued: 0 };
  let items = [], requeueIdx = [], sourceStats = {}, notFoundInRun = [];

  function log(icon, cls, title, detail){
    const el = $("#bulkLog"); if (!el) return;
    const e = document.createElement("div"); e.className = "log-entry";
    e.innerHTML = `<span class="log-icon">${icon}</span><span class="log-${cls}"><span class="log-title">${esc(title)}</span>${detail ? ` <span class="log-detail">— ${esc(detail)}</span>` : ""}</span>`;
    el.appendChild(e); el.scrollTop = el.scrollHeight;
  }
  function updateSourcesViz(states){
    const el = $("#bulkSourcesViz"); if (!el) return;
    el.innerHTML = ["Discogs","MusicBrainz"].map(s => {
      const st = states[s] || "";
      const cl = st === "ok" ? "sv-chip ok" : st === "querying" ? "sv-chip querying" : st === "skipped" ? "sv-chip skipped" : st === "fail" ? "sv-chip fail" : "sv-chip";
      return `<span class="${cl}"><span class="sv-dot"></span>${s}</span>`;
    }).join("");
  }
  function updateRequeueBadge(){
    const el = $("#bulkRequeue"); if (!el) return;
    if (requeueIdx.length > 0) el.innerHTML = `<span class="requeue-badge">🔁 ${requeueIdx.length} re-encolados</span>`;
    else el.innerHTML = '';
  }
  function reset(){
    running = false; cancelled = false;
    stats = { total: 0, ok: 0, skip: 0, fail: 0, fields: 0, covers: 0, cached: 0, links: 0, requeued: 0 };
    items = []; requeueIdx = []; sourceStats = {}; notFoundInRun = [];
    $("#bulkLog").innerHTML = ""; $("#bulkBar").style.width = "0%"; $("#bulkCurrent").textContent = "0"; $("#bulkTotal").textContent = "0";
    $("#bulkEta").textContent = ""; $("#bulkSourcesViz").innerHTML = "";
    $("#bulkEnrichConfig").style.display = "";
    $("#bulkEnrichProgress").style.display = "none";
    $("#bulkEnrichSummary").style.display = "none";
    $("#bulkEnrichStart").style.display = ""; $("#bulkEnrichStart").disabled = false;
    $("#bulkEnrichStop").style.display = "none"; $("#bulkEnrichStop").disabled = false;
    $("#bulkEnrichStop").textContent = "⏹️ Detener";
    $("#bulkNotFoundActions").style.display = "none";
    const rq = $("#bulkRequeue"); if (rq) rq.innerHTML = '';
  }
  function getFields(){ return { anio: $("#optAnio")?.checked, anioEdicion: $("#optAnioEdicion")?.checked, sello: $("#optSello")?.checked, genero: $("#optGenero")?.checked, pais: $("#optPais")?.checked, catalogo: $("#optCatalogo")?.checked, portada: $("#optPortada")?.checked, links: $("#optLinks")?.checked }; }
  function activeSources(){ const s = []; if ($("#srcDiscogs")?.checked && getDiscogsToken()) s.push("Discogs"); if ($("#srcMB")?.checked) s.push("MusicBrainz"); return s; }
  function needs(cd, f){ if (f.anio && !cd.anio) return true; if (f.anioEdicion && !cd.anioEdicion) return true; if (f.sello && !cd.sello) return true; if (f.genero && !cd.genero) return true; if (f.pais && !cd.pais) return true; if (f.catalogo && !cd.catalogo) return true; if (f.portada && !cd.portada) return true; if (f.links && (!cd.links || !Object.keys(cd.links).length)) return true; return false; }
  function isVarious(cd){ const i = norm(cd.interprete); return i.includes("various") || i.includes("varios") || i.includes("vv.aa") || i.includes("vv aa") || i === ""; }
  function computeItems(){
    const f = getFields();
    const scope = document.querySelector('input[name="scope"]:checked')?.value || "incomplete";
    const forceAll = scope === "all-force";
    const sd = forceAll ? false : ($("#optSkipDone")?.checked !== false);
    const sv = $("#optSkipVarious")?.checked !== false;
    let src = [];
    if (scope === "category"){ if (App.cat && App.cat !== ALL_CATS) src = Store.getCDs(App.cat).map(cd => ({ cd, cat: App.cat })); else for (const k of Store.catKeys()) for (const cd of Store.getCDs(k)) src.push({ cd, cat: k }); }
    else { for (const k of Store.catKeys()) for (const cd of Store.getCDs(k)) src.push({ cd, cat: k }); }
    items = src.filter(({cd}) => { if (sv && isVarious(cd)) return false; if (!forceAll && sd && !needs(cd, f)) return false; return true; });
    return items;
  }
  function updatePreview(){
    const list = computeItems(); const el = $("#bulkPreview"); if (!el) return;
    const f = getFields(); const af = Object.entries(f).filter(([,v]) => v).map(([k]) => k);
    const as = activeSources(); const re = $("#optReplace")?.checked !== false;
    let warn = '';
    if ($("#srcDiscogs")?.checked && !getDiscogsToken()){
      warn = `<div class="bulk-token-warning">⚠️ <b>Discogs está tildado pero NO tenés token configurado.</b> Se usará solo MusicBrainz (rate limit 1 req/seg → puede fallar en lotes grandes). Configurá el token en ⚙️ → 🎚️ Configurar Discogs.</div>`;
    }
    if (!af.length){ el.innerHTML = `⚠️ Seleccioná al menos un campo.${warn}`; $("#bulkEnrichStart").disabled = true; return; }
    if (!as.length){ el.innerHTML = `⚠️ Sin fuentes activas.${warn}`; $("#bulkEnrichStart").disabled = true; return; }
    if (!list.length){ el.innerHTML = `ℹ️ No hay CDs para enriquecer.${warn}`; $("#bulkEnrichStart").disabled = true; return; }
    const modo = re ? "🔄 REEMPLAZO" : "✨ solo vacíos";
    el.innerHTML = `🎯 <b>${list.length}</b> CDs · Modo: <b>${modo}</b>.<br><span style="font-size:.78rem">Campos: <b>${af.join(", ")}</b> · Fuentes: <b>${as.join(" → ")}</b></span>${warn}`;
    $("#bulkEnrichStart").disabled = false;
  }
  async function processOne(idx, as, re, tnf, uc, retry, f){
    const { cd, cat } = items[idx];
    $("#bulkCurrent").textContent = idx + 1; $("#bulkTotal").textContent = items.length;
    $("#bulkBar").style.width = ((idx+1)/items.length*100).toFixed(1) + "%";
    log("🔍", "info", `Buscando: ${cd.titulo}`);
    const rowKey = cdKey(cat, cd); const row = findRowByKey(rowKey);
    if (row && (App.cat === ALL_CATS || cat === App.cat)) row.classList.add("enriching");
    let info = null; const tried = [], states = {};
    if (uc){ const c = MetadataCache.get(cd.titulo, cd.interprete, cd.anio); if (c){ info = { ...c, _fromCache: true }; stats.cached++; states[c.source || "Discogs"] = "ok"; } }
    if (!info){
      for (const sn of as){
        if (sn === "MusicBrainz" && Date.now() < _mb503Until){
          states[sn] = "skipped";
          const waitS = Math.ceil((_mb503Until - Date.now())/1000);
          log("❄️", "warn", "MB enfriando", `${waitS}s · re-encolando`);
          if (!requeueIdx.includes(idx)){ requeueIdx.push(idx); updateRequeueBadge(); }
          continue;
        }
        if (sn === "Discogs" && Date.now() < _discogs429Until){
          states[sn] = "skipped";
          const waitS = Math.ceil((_discogs429Until - Date.now())/1000);
          log("❄️", "warn", "Discogs enfriando", `${waitS}s · re-encolando`);
          if (!requeueIdx.includes(idx)){ requeueIdx.push(idx); updateRequeueBadge(); }
          continue;
        }
        tried.push(sn); states[sn] = "querying"; updateSourcesViz(states);
        let att = 0;
        while (att <= (retry ? 1 : 0)){
          try {
            if (sn === "Discogs") info = await enrichFromDiscogs(cd.titulo, cd.interprete, { anio: cd.anio, pais: cd.pais, sello: cd.sello, catalogo: cd.catalogo, barcode: cd.codigo });
            else info = await enrichFromMusicBrainz(cd.titulo, cd.interprete, { anio: cd.anio });
          } catch(err){
            if (err.message === 'COOLDOWN'){
              if (!requeueIdx.includes(idx)){ requeueIdx.push(idx); updateRequeueBadge(); }
              break;
            }
          }
          if (info && info.portada) break;
          if (info && !f.portada) break;
          att++;
          if (att <= (retry ? 1 : 0)) await new Promise(r => setTimeout(r, 1000));
          if (info) break;
        }
        if (info){ verificarFechaEmision(info, cd.anio); states[sn] = "ok"; if (uc) MetadataCache.set(cd.titulo, cd.interprete, cd.anio, info); }
        else states[sn] = "fail";
        updateSourcesViz(states);
        if (info && info.portada) break;
        if (info && !f.portada) break;
      }
    }
    if (row && (App.cat === ALL_CATS || cat === App.cat)) row.classList.remove("enriching");
    if (!info){
      stats.fail++; log("❌", "err", cd.titulo, "Sin resultados");
      if (tnf) notFoundInRun.push({ catKey: cat, catLabel: Store.get(cat)?.label || cat, nro: cd.nro, titulo: cd.titulo, interprete: cd.interprete, anio: cd.anio ?? null, sources: tried.join(", ") });
      return;
    }
    let changes = 0, reps = 0; const dp = []; const prov = cd.provenance || {}; const stamp = makeProvenance(info.source, info.confidence);
    function ap(k, nv, ov, l){
      if (nv === null || nv === undefined || nv === "") return false;
      const ho = ov !== null && ov !== undefined && String(ov).trim() !== "";
      if (re){ cd[k] = upper(nv); prov[k] = stamp; if (ho && String(ov) !== String(nv)){ dp.push(`${l} ${ov}→${nv}`); reps++; } else dp.push(l); return true; }
      else if (!ho){ cd[k] = upper(nv); prov[k] = stamp; dp.push(l); return true; }
      return false;
    }
    if (info._title && Number(info.confidence) >= 85){
      const nuevo = corregirCampo(cd.titulo, upper(info._title), info.confidence, re);
      if (nuevo && nuevo !== cd.titulo){ if (cd.titulo){ dp.push(`Título "${cd.titulo}"→"${nuevo}"`); reps++; } else dp.push("Título"); cd.titulo = upper(nuevo); prov.titulo = stamp; changes++; }
    }
    if (info._artist && Number(info.confidence) >= 85){
      const nuevo = corregirCampo(cd.interprete, upper(info._artist), info.confidence, re);
      if (nuevo && nuevo !== cd.interprete){ if (cd.interprete){ dp.push(`Intérprete "${cd.interprete}"→"${nuevo}"`); reps++; } else dp.push("Intérprete"); cd.interprete = upper(nuevo); prov.interprete = stamp; changes++; }
    }
    if (f.anio && info.anio){
      const esReed = cd.anio && (info.anio - cd.anio) > 5;
      if (esReed){
        if (f.anioEdicion){
          const prev = cd.anioEdicion;
          if (re){ if (prev !== info.anio){ if (prev) dp.push(`Año edición ${prev}→${info.anio}`); else dp.push("Año edición"); cd.anioEdicion = info.anio; prov.anioEdicion = stamp; changes++; } }
          else if (!prev){ cd.anioEdicion = info.anio; prov.anioEdicion = stamp; dp.push("Año edición"); changes++; }
        }
      } else { if (ap("anio", info.anio, cd.anio, "Año álbum")) changes++; }
    } else if (f.anioEdicion && info.anio && !cd.anioEdicion && !cd.anio){
      cd.anioEdicion = info.anio; prov.anioEdicion = stamp; dp.push("Año edición"); changes++;
    }
    if (f.sello && info.sello && ap("sello", info.sello, cd.sello, "Sello")) changes++;
    if (f.genero && info.genero && ap("genero", info.genero, cd.genero, "Género")) changes++;
    if (f.pais && info.pais && ap("pais", info.pais, cd.pais, "País")) changes++;
    if (f.catalogo && info.catalogo && ap("catalogo", info.catalogo, cd.catalogo, "Catálogo")) changes++;
    if (f.portada && info.portada){
      const hc = !!cd.portada;
      if (re || !hc){
        if (hc && cd.portada !== info.portada){ dp.push("Portada reemplazada"); reps++; } else dp.push("Portada");
        cd.portada = info.portada; cd.portadaSource = info.portadaSource; prov.portada = stamp;
        changes++; stats.covers++;
      }
    }
    if (f.links && info.links && Object.keys(info.links).length){
      const prev = cd.links || {};
      const merged = re ? { ...prev, ...info.links } : { ...info.links, ...prev };
      const nuevos = Object.keys(merged).filter(k => !prev[k]).length;
      if (nuevos > 0 || re){
        cd.links = merged;
        if (nuevos > 0){ dp.push(`🎧 ${nuevos} link${nuevos === 1 ? '' : 's'}`); changes++; stats.links += nuevos; }
      }
    }
    if (info.mbId && !cd.mbId) cd.mbId = info.mbId;
    if (info.discogsId && !cd.discogsId) cd.discogsId = info.discogsId;
    if (info.source){ cd.enrichmentSource = info.source; cd.enrichmentConfidence = info.confidence ?? null; cd.enrichedAt = info.enrichedAt || new Date().toISOString(); }
    cd.provenance = prov;
    if (changes > 0){
      stats.ok++; stats.fields += changes; sourceStats[info.source] = (sourceStats[info.source] || 0) + 1;
      const strategyTag = info._strategy ? ` [${info._strategy}]` : '';
      log(reps > 0 ? "🔄" : "✅", reps > 0 ? "warn" : "ok", cd.titulo, `[${info.source}${strategyTag}] ${dp.join(", ")}`);
    } else { stats.skip++; log("⏭️", "warn", cd.titulo, "Sin cambios"); }
  }
  async function run(){
    if (running) return;
    reset(); computeItems();
    if (!items.length){ Toast.show("No hay CDs para enriquecer", "warn"); return; }
    const f = getFields(); const retry = $("#optRetry")?.checked !== false; const as = activeSources();
    if (!as.length){ Toast.show("Sin fuentes activas", "warn", 6000); return; }
    const tnf = $("#optTrackNotFound")?.checked !== false; const uc = $("#optUseCache")?.checked !== false; const re = $("#optReplace")?.checked !== false;
    running = true; cancelled = false; stats.total = items.length;
    $("#bulkEnrichConfig").style.display = "none"; $("#bulkEnrichProgress").style.display = "";
    $("#bulkEnrichStart").style.display = "none"; $("#bulkEnrichStop").style.display = "";
    log("🚀", "info", `Iniciando${re ? " (REEMPLAZO)" : ""}`, `${items.length} CDs · ${as.join(" → ")}`);
    let saveC = 0;
    for (let i = 0; i < items.length; i++){
      if (cancelled){ log("⏹️", "warn", "Cancelado"); break; }
      await processOne(i, as, re, tnf, uc, retry, f);
      saveC++; if (saveC >= 5){ Store.persistSilent(); saveC = 0; }
      if (i < items.length - 1 && !cancelled) await new Promise(r => setTimeout(r, 1200));
    }
    if (requeueIdx.length > 0 && !cancelled){
      const req = [...requeueIdx]; requeueIdx = []; updateRequeueBadge();
      log("🔁", "info", `Re-procesando ${req.length} CDs saltados`, "esperando fin de cooldown…");
      while (Date.now() < _mb503Until && !cancelled){
        const waitS = Math.ceil((_mb503Until - Date.now())/1000);
        $("#bulkEta").textContent = `⏸️ Esperando ${waitS}s (rate limit)`;
        await new Promise(r => setTimeout(r, 2000));
      }
      stats.requeued = req.length;
      for (const idx of req){
        if (cancelled) break;
        log("🔁", "info", `Retry: ${items[idx].cd.titulo}`);
        await processOne(idx, as, re, tnf, uc, retry, f);
        Store.persistSilent();
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    if (saveC > 0) Store.persistSilent();
    Store.persist();
    if (notFoundInRun.length){ for (const it of notFoundInRun) NotFoundList.add(it); NotFoundList.persist(); }
    running = false;
    $("#bulkEnrichProgress").style.display = "none";
    $("#bulkEnrichSummary").style.display = "";
    $("#bulkEnrichStop").style.display = "none";
    const sb = Object.entries(sourceStats).map(([s, n]) => `<div class="sum-item"><div class="sum-icon">📡</div><div class="sum-label">${s}</div><div class="sum-value ok">${n}</div></div>`).join("");
    $("#bulkSummaryGrid").innerHTML = `
      <div class="sum-item"><div class="sum-icon">📊</div><div class="sum-label">Procesados</div><div class="sum-value">${stats.total}</div></div>
      <div class="sum-item"><div class="sum-icon">✅</div><div class="sum-label">Enriquecidos</div><div class="sum-value ok">${stats.ok}</div></div>
      <div class="sum-item"><div class="sum-icon">💨</div><div class="sum-label">Desde caché</div><div class="sum-value">${stats.cached}</div></div>
      <div class="sum-item"><div class="sum-icon">⏭️</div><div class="sum-label">Sin cambios</div><div class="sum-value warn">${stats.skip}</div></div>
      <div class="sum-item"><div class="sum-icon">❌</div><div class="sum-label">Sin resultados</div><div class="sum-value err">${stats.fail}</div></div>
      <div class="sum-item"><div class="sum-icon">📝</div><div class="sum-label">Campos</div><div class="sum-value ok">${stats.fields}</div></div>
      <div class="sum-item"><div class="sum-icon">🖼️</div><div class="sum-label">Portadas</div><div class="sum-value ok">${stats.covers}</div></div>
      <div class="sum-item"><div class="sum-icon">🎧</div><div class="sum-label">Links streaming</div><div class="sum-value ok">${stats.links}</div></div>
      ${stats.requeued > 0 ? `<div class="sum-item"><div class="sum-icon">🔁</div><div class="sum-label">Re-encolados</div><div class="sum-value ok">${stats.requeued}</div></div>` : ''}
      ${sb}`;
    if (notFoundInRun.length){ $("#bulkNotFoundActions").style.display = "flex"; $("#bulkNotFoundCount").textContent = notFoundInRun.length; }
    $("#bulkLogFinal").innerHTML = $("#bulkLog").innerHTML;
    renderTabs(); renderAll();
    if (stats.ok > 0){ AutoBackup.markChange(`enriquecimiento masivo (${stats.ok})`); HistoryLog.log('ENRICH', `Enriquecimiento masivo`, `${stats.ok} CDs · ${stats.fields} campos · ${stats.covers} portadas · ${stats.links} links`); }
    Toast.show(`Terminado: ${stats.ok} CDs · ${stats.fields} campos · ${stats.covers} portadas · ${stats.links} links`, "ok", 6000);
  }
  function stop(){ if (!running) return; if (!confirm("¿Detener?")) return; cancelled = true; $("#bulkEnrichStop").disabled = true; $("#bulkEnrichStop").textContent = "Deteniendo…"; }
  function open(){
    reset();
    updatePreview();
    $("#bulkEnrichModal").classList.add("open");
    if (!getDiscogsToken()){
      setTimeout(() => { Toast.show("💡 Sin token de Discogs. Solo se usará MusicBrainz.", "warn", 7000); }, 500);
    }
  }
  function close(){ if (running){ if (!confirm("¿Detener?")) return; cancelled = true; } $("#bulkEnrichModal").classList.remove("open"); if (running) setTimeout(() => { renderTabs(); renderAll(); }, 500); }
  return { open, close, run, stop, updatePreview, isRunning: () => running };
})();

async function runNetworkDiagnostics(){
  const host = $("#networkDiagContent"); if (!host) return;
  host.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted)"><span class="disc-loader"></span> Ejecutando…</div>`;
  const results = [];
  const checks = [
    { name: "MusicBrainz", fetcher: () => fetchWithTimeout(`${MB_API}release?query=release:%22test%22&fmt=json&limit=1`, { headers: { 'User-Agent': MB_USER_AGENT } }, 8000) },
    { name: "Discogs", fetcher: () => { if (!getDiscogsToken()) return Promise.reject(new Error('SIN_TOKEN')); return fetchDiscogs(`${DISCOGS_API}/database/search?q=test&per_page=1`, 8000); } },
    { name: "Cover Art Archive", fetcher: () => fetchWithTimeout(`https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15ffdd`, {}, 8000) },
    { name: "iTunes Search", fetcher: () => fetchWithTimeout(`https://itunes.apple.com/search?term=test&entity=album&limit=1&country=US`, { cache: 'no-store' }, 8000) },
    { name: "Odesli", fetcher: () => fetchWithTimeout(`https://api.song.link/v1-alpha.1/links?url=https%3A%2F%2Fmusic.apple.com%2Fus%2Falbum%2Ftest%2F123456789&userCountry=US`, { cache: 'no-store' }, 8000) }
  ];
  for (const c of checks){
    const t0 = Date.now(); let st = "—", col = "var(--muted)", ic = "❔", det = "";
    try {
      const r = await c.fetcher();
      const el = Date.now() - t0; st = `HTTP ${r.status} · ${el}ms`;
      if (r.ok){ col = "var(--ok)"; ic = "✅"; det = "OK"; }
      else if (r.status === 401){
        if (c.name === "Odesli"){
          col = "var(--warn)"; ic = "⚠️";
          det = "API pública deprecada (401). Streaming usa iTunes + Apple Music + buscador.";
          try { const body = await r.clone().json(); if (body?.code) det += ` [${body.code}]`; } catch(_){}
        } else {
          col = "var(--warn)"; ic = "🔑"; det = "Requiere token válido.";
        }
      }
      else if (r.status === 429){ col = "var(--warn)"; ic = "⏱️"; det = "Rate limit."; }
      else if (r.status === 503){ col = "var(--warn)"; ic = "❄️"; det = "Servicio no disponible."; }
      else if (r.status === 404){ col = "var(--ok)"; ic = "✅"; det = "API responde."; st = `HTTP 404 · ${el}ms`; }
      else { col = "var(--warn)"; ic = "⚠️"; det = "Respuesta no esperada."; }
    } catch (err){
      if (err.message === 'SIN_TOKEN'){
        const el = Date.now() - t0;
        st = `Sin token · ${el}ms`; col = "var(--warn)"; ic = "🔑"; det = "Configurá token Discogs.";
        results.push({ name: c.name, status: st, color: col, icon: ic, detail: det });
        continue;
      }
      const el = Date.now() - t0; st = `${err.name === 'AbortError' || err.name === 'TimeoutError' ? 'Timeout' : err.message} · ${el}ms`; col = "var(--danger)"; ic = "❌";
      det = (err.name === 'AbortError' || err.name === 'TimeoutError') ? "Timeout (>8s)." : "Error de red o CORS.";
    }
    results.push({ name: c.name, status: st, color: col, icon: ic, detail: det });
  }
  const manual = String(getDiscogsConfig().proxy || '').trim();
  const tk = getDiscogsToken() ? `✅ (${getDiscogsToken().length} chars)` : `❌ NO configurado`;
  let pi;
  if (manual) pi = `Proxy: <code>${esc(manual)}</code> (manual)`;
  else pi = `Modo: <b>directo → fallback automático</b>`;
  const mbC = _mb503Until > Date.now() ? ` · ❄️ ${Math.ceil((_mb503Until-Date.now())/1000)}s` : '';
  const dcC = _discogs429Until > Date.now() ? ` · ❄️ ${Math.ceil((_discogs429Until-Date.now())/1000)}s` : '';
  host.innerHTML = `
    <div style="padding:12px 14px;background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:10px;margin-bottom:14px;font-size:.82rem;line-height:1.7">
      Protocolo: <code>${esc(location.protocol)}//${esc(location.host || '…')}</code><br>
      Token: <b>${tk}</b><br>
      UA: <code>${esc(MB_USER_AGENT)}</code><br>
      ${pi}${mbC}${dcC}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
      <thead><tr style="background:rgba(255,255,255,.03)"><th style="text-align:left;padding:10px 12px;font-size:.65rem;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)">Fuente</th><th style="text-align:left;padding:10px 12px;font-size:.65rem;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)">Estado</th><th style="text-align:left;padding:10px 12px;font-size:.65rem;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)">Detalle</th></tr></thead>
      <tbody>${results.map(r => `<tr><td style="padding:10px 12px;border-bottom:1px solid rgba(37,45,58,.5);font-weight:600">${r.icon} ${esc(r.name)}</td><td style="padding:10px 12px;border-bottom:1px solid rgba(37,45,58,.5);color:${r.color};font-family:ui-monospace,monospace;font-size:.78rem">${esc(r.status)}</td><td style="padding:10px 12px;border-bottom:1px solid rgba(37,45,58,.5);color:var(--muted);font-size:.8rem">${r.detail}</td></tr>`).join('')}</tbody>
    </table>
    <div style="margin-top:14px;padding:10px 12px;background:rgba(79,195,247,.06);border-left:3px solid var(--accent);border-radius:8px;font-size:.78rem;color:var(--muted);line-height:1.55">
      💡 <b style="color:var(--txt)">Tips:</b> sin token Discogs el enriquecimiento usa solo MusicBrainz (más lento). 
      Si Odesli aparece deprecado, el streaming sigue funcionando con <b>iTunes → Apple Music</b> y buscadores web.
    </div>`;
}
function openNetworkDiag(){ $("#networkDiagModal").classList.add("open"); runNetworkDiagnostics(); }
function closeNetworkDiag(){ $("#networkDiagModal")?.classList.remove("open"); }

function updateFolderSupportStatus(){
  const el = $("#folderSupportStatus"); if (!el) return;
  const mode = FileSystemDefault.getMode();
  if (mode === 'tauri'){
    el.innerHTML = '🟢 <b>Modo nativo (Tauri)</b>: usando plugin <code>dialog + fs</code> del sistema.';
    el.style.borderLeft = "4px solid var(--ok)";
  } else if (mode === 'browser'){
    el.innerHTML = '🟢 <b>Modo navegador</b>: usando File System Access API.';
    el.style.borderLeft = "4px solid var(--ok)";
  } else {
    el.innerHTML = '🟠 <b>No soportado</b>. Se usará descarga clásica.';
    el.style.borderLeft = "4px solid var(--warn)";
  }
  const n = $("#folderCurrentName"); if (n) n.textContent = FileSystemDefault.getName() || "— Sin carpeta configurada —";
  const p = $("#folderPick"), c = $("#folderChange"), r = $("#folderRemove"), t = $("#folderTestPermission");
  const h = FileSystemDefault.isSet();
  if (p) p.style.display = h ? "none" : "";
  if (c) c.style.display = h ? "" : "none";
  if (r) r.style.display = h ? "" : "none";
  if (t) t.style.display = h ? "" : "none";
}
function openFolderConfig(){ updateFolderSupportStatus(); $("#folderConfigModal").classList.add("open"); }
function closeFolderConfig(){ $("#folderConfigModal")?.classList.remove("open"); }
async function pickDefaultFolder(){
  try { const h = await FileSystemDefault.pickFolder(); updateFolderSupportStatus(); FileSystemDefault.refreshBadge(); Toast.show(`📂 Carpeta: ${h.name}`, "ok", 4000); closeFolderConfig(); }
  catch (err){ if (err.name === "AbortError") return; Toast.show("Error: " + err.message, "err", 6500); }
}
async function removeDefaultFolder(){ if (!FileSystemDefault.isSet()) return; if (!confirm("¿Quitar la carpeta?")) return; await FileSystemDefault.clear(); FileSystemDefault.refreshBadge(); updateFolderSupportStatus(); Toast.show("Carpeta quitada", "warn", 3200); }
async function openFolderBrowser(){
  if (!FileSystemDefault.isSet()){ Toast.show("Configurá una carpeta primero", "warn"); openFolderConfig(); return; }
  $("#folderBrowserModal").classList.add("open"); await refreshFolderList();
}
function closeFolderBrowser(){ $("#folderBrowserModal")?.classList.remove("open"); }
async function refreshFolderList(){
  const host = $("#folderFileList"); if (!host) return;
  const n = $("#folderBrowserName"); if (n) n.textContent = FileSystemDefault.getName() || "—";
  host.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)"><span class="disc-loader"></span> Cargando…</div>`;
  try {
    if (!(await FileSystemDefault.ensureReady("read"))){
      host.innerHTML = `<div style="padding:24px;text-align:center;color:var(--warn);line-height:1.6">🔐 El navegador requiere reautorizar.<br><br><button type="button" class="btn primary" id="folderReauth">🔓 Reautorizar acceso</button></div>`;
      $("#folderReauth")?.addEventListener("click", async () => { await FileSystemDefault.ensureReady("readwrite"); refreshFolderList(); });
      return;
    }
    const files = await FileSystemDefault.listFiles();
    const info = $("#folderBrowserInfo"); if (info) info.textContent = `${files.length} archivo${files.length === 1 ? "" : "s"} en la carpeta`;
    if (!files.length){
      host.innerHTML = `<div style="padding:32px 20px;text-align:center;color:var(--muted)">📭 Sin archivos.<br><br><button type="button" class="btn primary" id="folderUploadEmpty">💾 Guardar primer backup</button></div>`;
      $("#folderUploadEmpty")?.addEventListener("click", saveBackupToFolder);
      return;
    }
    host.innerHTML = files.map(f => {
      const s = f.size ? `${(f.size/1024).toFixed(1)} KB` : '—';
      const d = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'}) : '—';
      const i = f.name.endsWith('.csv') ? '📊' : f.name.endsWith('.md') ? '📝' : '💾';
      return `<div class="folder-row gdrive-row" data-name="${esc(f.name)}"><span class="gdrive-icon">${i}</span><span class="gdrive-info"><span class="gdrive-name" title="${esc(f.name)}">${esc(f.name)}</span><span class="gdrive-meta">${esc(d)} · ${esc(s)}</span></span><span class="gdrive-actions"><button type="button" class="btn primary" data-act="restore">⬇️ Restaurar</button><button type="button" class="btn danger" data-act="delete" title="Eliminar">🗑️</button></span></div>`;
    }).join("");
    host.querySelectorAll(".folder-row").forEach(row => {
      const n = row.dataset.name;
      row.querySelector('[data-act="restore"]')?.addEventListener("click", () => restoreFromFolder(n));
      row.querySelector('[data-act="delete"]')?.addEventListener("click", () => deleteFromFolder(n));
    });
  } catch (err){ host.innerHTML = `<div style="padding:24px;text-align:center;color:var(--danger)">Error: ${esc(err.message)}</div>`; }
}
async function saveBackupToFolder(){
  try {
    if (!FileSystemDefault.isSet()){ openFolderConfig(); return; }
    if (!(await FileSystemDefault.ensureReady("readwrite"))){ Toast.show("Permiso denegado", "err"); return; }
    const o = OwnerConfig.get();
    const pl = { version: 5, appVersion: APP_VERSION, exported: new Date().toISOString(), owner: o.name || DEFAULT_AUTHOR, contact: OwnerConfig.contactLine() || DEFAULT_PHONE, categories: {} };
    for (const k of Store.catKeys()){ const c = Store.get(k); pl.categories[k] = { label: c.label, icon: c.icon, subcategories: c.subcategories || [], cds: c.cds }; }
    const fn = `discografia_v${APP_VERSION}_backup_${timestamp()}.json`;
    await FileSystemDefault.saveFile(fn, JSON.stringify(pl, null, 2), "application/json");
    Toast.show(`💾 Guardado: ${fn}`, "ok", 4000);
    if ($("#folderBrowserModal")?.classList.contains("open")) refreshFolderList();
  } catch (err){ Toast.show("Error: " + err.message, "err", 6500); }
}
async function restoreFromFolder(name){
  if (!name) return;
  if (!confirm(`¿Restaurar "${name}"?`)) return;
  try {
    const text = await FileSystemDefault.readFile(name);
    const data = JSON.parse(text);
    const before = JSON.stringify(Store.categories());
    if (data && data.categories){
      Store.replaceAll(data); NotFoundList.clear();
      Undo.push("restaurar", () => { Store.replaceAll({ categories: JSON.parse(before) }); ensureValidCat(); renderTabs(); renderAll(); });
      App.artista = null; App.q = ""; App.selected.clear(); App.focusedKey = null; App.subcat = null;
      $("#q").value = ""; $("#searchBox").classList.remove("has-value");
      ensureValidCat(); renderTabs(); renderAll();
      HistoryLog.log('IMPORT', `Restaurado: ${name}`);
      AutoBackup.markChange("restauración");
      Toast.show("Backup restaurado", "ok", 4000);
      closeFolderBrowser();
    } else Toast.show("Formato inesperado", "err", 6000);
  } catch (err){ Toast.show("Error: " + err.message, "err", 7000); }
}
async function deleteFromFolder(name){
  if (!name) return;
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  try { await FileSystemDefault.deleteFile(name); Toast.show("Eliminado", "ok"); refreshFolderList(); }
  catch (err){ Toast.show("Error: " + err.message, "err", 6000); }
}

const Lightbox = (() => {
  let cur = [], idx = 0;
  function open(url, t, key){
    if (!url) return;
    cur = [];
    $$("#tbodyCD tr").forEach(tr => { const i = tr.querySelector(".cover-thumb"); if (i) cur.push({ url: i.src, titulo: i.dataset.title || "", key: i.dataset.key || tr.dataset.key }); });
    idx = cur.findIndex(x => x.key === key); if (idx === -1) idx = 0;
    render();
    $("#coverLightbox").classList.add("open"); document.body.style.overflow = "hidden";
  }
  function render(){
    if (!cur.length) return;
    const it = cur[idx];
    $("#lbImg").src = it.url;
    $("#lbInfo").textContent = `${it.titulo} (${idx+1} de ${cur.length})`;
    $("#lbPrev").style.display = cur.length > 1 ? "" : "none";
    $("#lbNext").style.display = cur.length > 1 ? "" : "none";
  }
  function next(){ if (cur.length < 2) return; idx = (idx + 1) % cur.length; render(); }
  function prev(){ if (cur.length < 2) return; idx = (idx - 1 + cur.length) % cur.length; render(); }
  function close(){ $("#coverLightbox").classList.remove("open"); document.body.style.overflow = ""; }
  return { open, next, prev, close };
})();

function openNotFoundModal(){
  App.notFoundFilter = "";
  const si = $("#notFoundSearch"); if (si) si.value = "";
  renderNotFoundTable();
  const d = new Date();
  const fmt = d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  const pd = $("#printDate"); if (pd) pd.textContent = fmt;
  OwnerConfig.render();
  $("#notFoundModal").classList.add("open");
}
function closeNotFoundModal(){ $("#notFoundModal").classList.remove("open"); }
function renderNotFoundTable(){
  const items = NotFoundList.getAll();
  const filter = norm(App.notFoundFilter || "").trim();
  const tbody = $("#notFoundTbody"); const cnt = $("#notFoundCount");
  if (cnt) cnt.textContent = items.length;
  if (!items.length){ tbody.innerHTML = `<tr><td colspan="7" class="nf-empty">✅ No hay CDs pendientes.</td></tr>`; return; }
  let f = items;
  if (filter) f = items.filter(x => norm([x.titulo, x.interprete, x.catLabel].join(" ")).includes(filter));
  if (!f.length){ tbody.innerHTML = `<tr><td colspan="7" class="nf-empty">Sin coincidencias.</td></tr>`; return; }
  tbody.innerHTML = f.map((item, i) => {
    const cleanT = limpiarTituloParaBusqueda(item.titulo);
    const cleanI = limpiarInterpreteParaBusqueda(item.interprete);
    const cleanInfo = (cleanT !== item.titulo || cleanI !== item.interprete)
      ? `<br><span style="font-size:.65rem;color:var(--ok);opacity:.85">🔍 "${esc(cleanT)}" · "${esc(cleanI)}"</span>` : '';
    return `<tr data-nf-idx="${i}">
      <td class="nf-num">${item.nro}</td>
      <td class="nf-cat">${esc(item.catLabel)}</td>
      <td class="nf-titulo">${highlight(upper(item.titulo), App.notFoundFilter)}${cleanInfo}</td>
      <td class="nf-interprete">${highlight(upper(item.interprete), App.notFoundFilter)}</td>
      <td class="nf-anio">${item.anio ?? "—"}</td>
      <td>${esc(item.sources || "—")}</td>
      <td>
        <button type="button" class="btn primary" data-nf-retry="${i}" title="Reintentar">🔁 Reintentar</button>
        <button type="button" class="btn" data-nf-search="${i}" title="Buscar en Google">🌐</button>
      </td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('[data-nf-retry]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.nfRetry, 10);
      const item = f[idx];
      if (!item) return;
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = '⏳';
      try {
        const info = await enrichFromChain(item.titulo, item.interprete, { hints: { anio: item.anio }, useCache: false });
        if (!info){ Toast.show('❌ Sigue sin encontrarse', 'warn', 3000); btn.innerHTML = '❌'; setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2000); return; }
        const cat = item.catKey;
        const cd = Store.getCDs(cat).find(c => c.nro === item.nro);
        if (!cd){ Toast.show('CD no encontrado en la base', 'warn'); btn.innerHTML = orig; btn.disabled = false; return; }
        const prov = cd.provenance || {};
        const stamp = makeProvenance(info.source, info.confidence);
        if (info.anio && !cd.anio){ cd.anio = info.anio; prov.anio = stamp; }
        if (info.sello && !cd.sello){ cd.sello = upper(info.sello); prov.sello = stamp; }
        if (info.genero && !cd.genero){ cd.genero = upper(info.genero); prov.genero = stamp; }
        if (info.pais && !cd.pais){ cd.pais = upper(info.pais); prov.pais = stamp; }
        if (info.catalogo && !cd.catalogo){ cd.catalogo = upper(info.catalogo); prov.catalogo = stamp; }
        if (info.portada && !cd.portada){ cd.portada = info.portada; cd.portadaSource = info.portadaSource; prov.portada = stamp; }
        if (info.links && Object.keys(info.links).length){ cd.links = { ...(cd.links || {}), ...info.links }; }
        if (info._title && info.confidence >= 85 && cd.titulo) cd.titulo = upper(info._title);
        if (info._artist && info.confidence >= 85 && cd.interprete) cd.interprete = upper(info._artist);
        cd.enrichmentSource = info.source;
        cd.enrichmentConfidence = info.confidence ?? null;
        cd.enrichedAt = info.enrichedAt || new Date().toISOString();
        cd.provenance = prov;
        Store.persist();
        NotFoundList.remove(item.catKey, item.nro);
        NotFoundList.persist();
        AutoBackup.markChange('reintento OK');
        renderNotFoundTable();
        renderTabs(); renderAll();
        Toast.show(`✅ Encontrado en ${info.source} (${info.confidence}%)`, 'ok', 3500);
        HistoryLog.log('ENRICH', `Reintento OK: ${cd.titulo}`, info.source);
      } catch(err){
        Toast.show('⚠️ ' + err.message, 'warn', 4000);
        btn.innerHTML = orig; btn.disabled = false;
      }
    });
  });
  tbody.querySelectorAll('[data-nf-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.nfSearch, 10);
      const item = f[idx];
      if (!item) return;
      const q = encodeURIComponent(`${item.interprete} ${item.titulo}${item.anio ? ' ' + item.anio : ''}`.trim());
      window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener');
    });
  });
}
function printNotFoundList(){ const m = $("#notFoundModal"); m.classList.add("printing"); setTimeout(() => { window.print(); setTimeout(() => m.classList.remove("printing"), 500); }, 100); }
async function exportNotFoundCSV(){
  const items = NotFoundList.getAll();
  if (!items.length){ Toast.show("Lista vacía", "warn"); return; }
  const sep = ";";
  const e = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const rows = [["Nº","Categoría","Título","Intérprete","Año","Fuentes"].join(sep)];
  for (const i of items) rows.push([i.nro, i.catLabel, i.titulo, i.interprete, i.anio ?? "", i.sources || ""].map(e).join(sep));
  await saveOrDownload(`discografia_no_encontrados_${timestamp()}.csv`, "\uFEFF" + rows.join("\r\n"), "text/csv");
}
async function exportNotFoundJSON(){
  const items = NotFoundList.getAll();
  if (!items.length){ Toast.show("Lista vacía", "warn"); return; }
  const o = OwnerConfig.get();
  await saveOrDownload(`discografia_no_encontrados_${timestamp()}.json`, JSON.stringify({ exported: new Date().toISOString(), appVersion: APP_VERSION, owner: o.name || null, contact: OwnerConfig.contactLine() || null, total: items.length, cds: items }, null, 2));
}
function clearNotFoundList(){ const n = NotFoundList.count(); if (!n) return; if (!confirm(`¿Limpiar los ${n} CDs?`)) return; NotFoundList.clear(); renderNotFoundTable(); Toast.show("Lista limpiada", "warn"); }

/* ═══════════════════════════════════════════════════════════════════
   FIN PARTE 1 — Core
   La Parte 2 (UI + init) está en app-ui.js
   ═══════════════════════════════════════════════════════════════════ */