/* =========================================================================
   DISCOGRAFÍA v7.0.12 — UI (Parte 2/2)
   Estado global App, renders, modales, eventos, inicialización.
   Autor: HDSystem IT · Tel: +54 9 11 4563-0851
   Depende de: app-core.js (debe cargarse primero)
   ========================================================================= */

/* ═══════════════════════════════════════════════════════════════════
   Estado global de la app
   ═══════════════════════════════════════════════════════════════════ */

const ALL_CATS = "__all__";
const App = { cat: null, q: "", sortKey: "nro", sortDir: 1, artista: null, selected: new Set(), focusedKey: null, editing: null, filters: { estado: "", formato: "", anioDesde: "", anioHasta: "", ubicacion: "", portada: "", prestamo: "" }, view: "table", notFoundFilter: "", detailCD: null, subcat: null };

const cdKey = (cat, cdOrNro) => {
  if (cdOrNro && typeof cdOrNro === "object" && cdOrNro.id) return `${cat}|${cdOrNro.id}`;
  const cd = Store.getCDs(cat).find(c => c.nro === cdOrNro);
  if (cd && cd.id) return `${cat}|${cd.id}`;
  return `${cat}|nro:${cdOrNro}`;
};
const parseCDKey = key => {
  const s = String(key || ""); const i = s.indexOf("|");
  if (i < 0) return { cat: s, id: "" };
  const cat = s.slice(0, i); const idPart = s.slice(i + 1);
  if (idPart.startsWith("nro:")){ const nro = parseInt(idPart.slice(4), 10); const cd = Store.getCDs(cat).find(c => c.nro === nro); return { cat, id: cd?.id || "" }; }
  return { cat, id: idPart };
};

function snapshotAll(){ const s = {}; for (const k of Store.catKeys()) s[k] = JSON.stringify(Store.get(k).cds); return s; }
function restoreAll(snap){ for (const k in snap){ const a = Store.getCDs(k); a.length = 0; JSON.parse(snap[k]).forEach(x => a.push(x)); } Store.persist(); renderTabs(); renderAll(); }

function findCategoryOfCD(cd){
  if (!cd) return null;
  for (const k of Store.catKeys()){ if (Store.getCDs(k).some(c => c.id === cd.id)) return k; }
  return null;
}
function viewCDs(){
  if (App.cat === ALL_CATS) return Store.allCDs();
  return App.cat ? Store.getCDs(App.cat) : [];
}
function cdKeyForView(cd){
  const cat = App.cat === ALL_CATS ? findCategoryOfCD(cd) : App.cat;
  return cat ? cdKey(cat, cd) : `${ALL_CATS}|${cd?.id}`;
}

function ensureValidCat(){
  const keys = Store.catKeys();
  if (!keys.length){ App.cat = null; return; }
  if (App.cat === ALL_CATS) return;
  if (!App.cat || !Store.get(App.cat)) App.cat = keys[0];
}
function getFiltered(cat = App.cat){
  if (!cat) return [];
  const q = App.q.trim();
  const f = App.filters;
  const useAdvanced = AdvancedSearch.isAdvanced(q);
  const qn = norm(q).trim();
  const terms = qn ? qn.split(/\s+/).filter(Boolean) : [];
  const source = (cat === ALL_CATS) ? Store.allCDs() : Store.getCDs(cat);
  return source.filter(cd => {
    if (App.artista && cd.interprete !== App.artista) return false;
    if (App.subcat && cd.subcat !== App.subcat) return false;
    if (f.estado === "__sin_estado__"){ if (cd.estado && cd.estado.trim()) return false; }
    else if (f.estado && (cd.estado || "Excelente") !== f.estado) return false;
    if (f.formato && (cd.formato || "CD") !== f.formato) return false;
    if (f.anioDesde){ const a = parseInt(f.anioDesde); if (!isNaN(a) && (cd.anio ?? -Infinity) < a) return false; }
    if (f.anioHasta){ const a = parseInt(f.anioHasta); if (!isNaN(a) && (cd.anio ?? Infinity) > a) return false; }
    if (f.ubicacion === "__con__" && !cd.ubicacion) return false;
    if (f.ubicacion === "__sin__" && cd.ubicacion) return false;
    if (f.portada === "__con__" && !cd.portada) return false;
    if (f.portada === "__sin__" && cd.portada) return false;
    if (f.prestamo === "__prestados__" && !Loans.isLoaned(cd)) return false;
    if (f.prestamo === "__disponibles__" && Loans.isLoaned(cd)) return false;
    if (f.prestamo === "__vencidos__" && !Loans.isOverdue(cd)) return false;
    if (!q) return true;
    if (useAdvanced) return AdvancedSearch.matches(cd, q);
    if (!terms.length) return true;
    const h = norm([cd.titulo, cd.interprete, cd.sello, cd.anio, cd.ubicacion, cd.catalogo].join(" "));
    return terms.every(t => h.includes(t));
  });
}
function sortCDs(arr){
  const { sortKey, sortDir } = App;
  return arr.slice().sort((a, b) => {
    let A = a[sortKey], B = b[sortKey];
    if (sortKey === "anio"){ A = A ?? -Infinity; B = B ?? -Infinity; return (A - B) * sortDir; }
    if (typeof A === "string") return norm(A).localeCompare(norm(B), "es") * sortDir;
    return ((A ?? 0) - (B ?? 0)) * sortDir;
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Render tabs (categorías + subcategorías)
   ═══════════════════════════════════════════════════════════════════ */

function renderTabs(){
  const el = $("#tabs"); el.innerHTML = "";
  const wrapAll = document.createElement("div"); wrapAll.className = "tab-wrap";
  const tabAll = document.createElement("div");
  tabAll.role = "tab"; tabAll.tabIndex = 0;
  tabAll.className = "tab tab-all" + (App.cat === ALL_CATS ? " active" : "");
  tabAll.innerHTML = `<span>🗂️</span><span>Todas</span><span class="badge">${Store.total()}</span>`;
  tabAll.title = "Ver todas las categorías juntas";
  tabAll.addEventListener("click", () => {
    if (App.cat === ALL_CATS) return;
    App.cat = ALL_CATS; App.artista = null; App.subcat = null; App.selected.clear(); App.focusedKey = null;
    renderTabs(); renderStats(); renderAll();
  });
  tabAll.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); tabAll.click(); } });
  wrapAll.appendChild(tabAll); el.appendChild(wrapAll);

  for (const k of Store.catKeys()){
    const c = Store.get(k);
    const wrap = document.createElement("div"); wrap.className = "tab-wrap";
    const tab = document.createElement("div");
    tab.role = "tab"; tab.tabIndex = 0;
    tab.className = "tab" + (k === App.cat ? " active" : "");
    tab.innerHTML = `<span>${esc(c.icon)}</span><span>${esc(c.label)}</span><span class="badge">${c.cds.length}</span>`;
    tab.addEventListener("click", (e) => {
      if (e.target.closest(".tab-menu-btn")) return;
      if (App.cat === k) return;
      App.cat = k; App.artista = null; App.subcat = null; App.selected.clear(); App.focusedKey = null;
      renderTabs(); renderStats(); renderAll();
    });
    tab.addEventListener("keydown", (e) => { if (e.target.closest(".tab-menu-btn")) return; if (e.key === "Enter" || e.key === " "){ e.preventDefault(); tab.click(); } });
    const mb = document.createElement("button");
    mb.type = "button"; mb.className = "tab-menu-btn"; mb.title = "Opciones"; mb.textContent = "⋯";
    mb.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); abrirMenuCategoria(k, mb); });
    tab.appendChild(mb); wrap.appendChild(tab); el.appendChild(wrap);
  }
  const add = document.createElement("button");
  add.type = "button"; add.className = "tab tab-add";
  add.innerHTML = `<span>➕</span><span>Nueva categoría</span>`;
  add.addEventListener("click", () => abrirModalCategoria("crear"));
  el.appendChild(add);
}

function renderSubtabs(){
  const el = $("#subtabs");
  if (!el) return;
  if (!App.cat || App.cat === ALL_CATS){ el.classList.remove("show"); el.innerHTML = ""; App.subcat = null; return; }
  const cat = Store.get(App.cat);
  if (!cat){ el.classList.remove("show"); el.innerHTML = ""; return; }
  const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
  if (App.subcat && !subs.some(s => s.id === App.subcat)) App.subcat = null;
  el.classList.add("show");
  el.innerHTML = "";
  if (subs.length){
    const wrapAll = document.createElement("div"); wrapAll.className = "tab-wrap";
    const tabAll = document.createElement("div");
    tabAll.role = "tab"; tabAll.tabIndex = 0;
    tabAll.className = "subtab subtab-all" + (App.subcat === null ? " active" : "");
    tabAll.innerHTML = `<span>📚</span><span>Todas</span><span class="badge">${cat.cds.length}</span>`;
    tabAll.title = "Ver todos los CDs de esta categoría";
    tabAll.addEventListener("click", () => { App.subcat = null; renderSubtabs(); renderAll(); });
    wrapAll.appendChild(tabAll);
    el.appendChild(wrapAll);
  }
  for (const sub of subs){
    const cnt = cat.cds.filter(c => c.subcat === sub.id).length;
    const wrap = document.createElement("div"); wrap.className = "tab-wrap";
    const tab = document.createElement("div");
    tab.role = "tab"; tab.tabIndex = 0;
    tab.className = "subtab" + (App.subcat === sub.id ? " active" : "");
    tab.innerHTML = `<span>${esc(sub.icon)}</span><span>${esc(sub.label)}</span><span class="badge">${cnt}</span>`;
    tab.addEventListener("click", (e) => {
      if (e.target.closest(".subtab-menu-btn")) return;
      App.subcat = (App.subcat === sub.id) ? null : sub.id;
      renderSubtabs(); renderAll();
    });
    tab.addEventListener("keydown", (e) => {
      if (e.target.closest(".subtab-menu-btn")) return;
      if (e.key === "Enter" || e.key === " "){ e.preventDefault(); tab.click(); }
    });
    const mb = document.createElement("button");
    mb.type = "button"; mb.className = "subtab-menu-btn"; mb.title = "Opciones"; mb.textContent = "⋯";
    mb.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); abrirMenuSubcategoria(App.cat, sub.id, mb); });
    tab.appendChild(mb); wrap.appendChild(tab); el.appendChild(wrap);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.className = "subtab subtab-add";
  add.innerHTML = `<span>➕</span><span>${subs.length ? "Subcategoría" : "Crear primera subcategoría"}</span>`;
  add.title = "Crear subcategoría";
  add.addEventListener("click", () => abrirModalSubcategoria("crear", App.cat));
  el.appendChild(add);
}

let _menuSubEl = null;
function cerrarMenuSubcategoria(){ if (_menuSubEl){ _menuSubEl.remove(); _menuSubEl = null; } }
function abrirMenuSubcategoria(catKey, subId, anchor){
  cerrarMenuSubcategoria();
  const cat = Store.get(catKey); const sub = Store.getSubcategory(catKey, subId);
  if (!cat || !sub) return;
  const menu = document.createElement("div");
  menu.style.cssText = `position:fixed;z-index:95;background:#1a2028;border:1px solid var(--line);border-radius:10px;padding:6px;min-width:210px;box-shadow:0 14px 40px rgba(0,0,0,.6);`;
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(window.innerWidth - 220, r.left - 160)) + "px";
  menu.style.top = Math.max(8, Math.min(window.innerHeight - 260, r.bottom + 6)) + "px";
  const items = [
    { icon:"✏️", label:"Renombrar", fn: () => abrirModalSubcategoria("renombrar", catKey, subId) },
    { icon:"🎨", label:"Cambiar icono", fn: () => abrirModalSubcategoria("icono", catKey, subId) },
    { icon:"⬅️", label:"Mover izquierda", fn: () => { if (Store.moveSubcategory(catKey, subId, "left")) { renderSubtabs(); renderAll(); } } },
    { icon:"➡️", label:"Mover derecha", fn: () => { if (Store.moveSubcategory(catKey, subId, "right")) { renderSubtabs(); renderAll(); } } },
    { sep:true },
    { icon:"🗑️", label:"Eliminar subcategoría", danger:true, fn: () => confirmarEliminarSubcategoria(catKey, subId) }
  ];
  for (const it of items){
    if (it.sep){ const s = document.createElement("div"); s.style.cssText = "height:1px;background:var(--line);margin:5px 3px"; menu.appendChild(s); continue; }
    const b = document.createElement("button"); b.type = "button";
    b.style.cssText = `display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:0;color:${it.danger ? "#ffb3b3" : "var(--txt)"};padding:9px 11px;border-radius:7px;cursor:pointer;font-size:.82rem;text-align:left;font-family:inherit`;
    b.innerHTML = `<span>${it.icon}</span><span>${it.label}</span>`;
    b.addEventListener("mouseenter", () => { b.style.background = it.danger ? "rgba(255,107,107,.14)" : "rgba(79,195,247,.12)"; b.style.color = it.danger ? "#fff" : "var(--accent)"; });
    b.addEventListener("mouseleave", () => { b.style.background = "transparent"; b.style.color = it.danger ? "#ffb3b3" : "var(--txt)"; });
    b.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); cerrarMenuSubcategoria(); it.fn(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu); _menuSubEl = menu;
}
document.addEventListener("click", (e) => { if (_menuSubEl && !_menuSubEl.contains(e.target)) cerrarMenuSubcategoria(); });

function confirmarEliminarSubcategoria(catKey, subId){
  const cat = Store.get(catKey); const sub = Store.getSubcategory(catKey, subId);
  if (!cat || !sub) return;
  const n = cat.cds.filter(c => c.subcat === subId).length;
  if (!confirm(`¿Eliminar la subcategoría "${sub.label}"?${n ? `\n\nContiene ${n} CD(s). Quedarán sin subcategoría (no se borran).` : ''}`)) return;
  Store.deleteSubcategory(catKey, subId);
  if (App.subcat === subId) App.subcat = null;
  HistoryLog.log('DELETE', `Subcategoría eliminada: ${sub.label}`, cat.label);
  AutoBackup.markChange('eliminación subcategoría');
  renderSubtabs(); renderTabs(); renderAll();
  Toast.show(`Subcategoría "${sub.label}" eliminada`, 'warn');
}

function abrirModalSubcategoria(mode, catKey, subId = null){
  _cmMode = "sub-" + mode;
  _cmKey = catKey;
  _subKey = subId || null;
  _cmAfter = null;
  _catSaving = false;
  const cat = Store.get(catKey);
  if (!cat) return;
  const sub = subId ? Store.getSubcategory(catKey, subId) : null;
  $("#catModalIcon").textContent = mode === "crear" ? "➕" : mode === "renombrar" ? "✏️" : "🎨";
  $("#catModalTitle").textContent = mode === "crear"
    ? `Nueva subcategoría en "${cat.label}"`
    : mode === "renombrar" ? `Renombrar subcategoría`
    : `Cambiar icono`;
  $("#catLabel").value = sub?.label || "";
  $("#catIcon").value = sub?.icon || "📂";
  $("#catIconPreview").textContent = sub?.icon || "📂";
  $("#wrapCatLabel").style.display = (mode === "icono") ? "none" : "";
  const li = $("#catLabel");
  if (mode === "icono") li.removeAttribute("required"); else li.setAttribute("required", "");
  const picker = $("#catIconPicker"); picker.innerHTML = "";
  const currentIcon = sub?.icon || "📂";
  const SUB_EMOJIS = ["📂","📁","🗂️","🎵","🎤","🎸","🎶","📀","💿","🎼","🎷","🎺","🥁","🎻","🎹","🎧","⭐","🔥","💫","✨","🌎","🇦🇷","🇧🇷","🇺🇸","🇬🇧"];
  for (const e of SUB_EMOJIS){
    const b = document.createElement("button"); b.type = "button"; b.textContent = e;
    if (e === currentIcon) b.classList.add("active");
    b.addEventListener("click", () => {
      $("#catIcon").value = e; $("#catIconPreview").textContent = e;
      picker.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    });
    picker.appendChild(b);
  }
  $("#catModal").classList.add("open");
  setTimeout(() => { if (mode !== "icono") $("#catLabel").focus(); else $("#catIcon").focus(); }, 80);
}

function populateSubcatOptions(catKey, selectedSubId){
  const sel = $("#fSubcat");
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin subcategoría —</option>';
  const subs = Store.getSubcategories(catKey);
  for (const sub of subs){
    const o = document.createElement("option");
    o.value = sub.id;
    o.textContent = sub.icon + " " + sub.label;
    if (sub.id === selectedSubId) o.selected = true;
    sel.appendChild(o);
  }
}

let _menuCatEl = null;
function cerrarMenuCategoria(){ if (_menuCatEl){ _menuCatEl.remove(); _menuCatEl = null; } }
function abrirMenuCategoria(key, anchor){
  cerrarMenuCategoria(); if (isAnyModalOpen()) return;
  const cat = Store.get(key); if (!cat) return;
  const menu = document.createElement("div");
  menu.style.cssText = `position:fixed;z-index:95;background:#1a2028;border:1px solid var(--line);border-radius:10px;padding:6px;min-width:210px;box-shadow:0 14px 40px rgba(0,0,0,.6);`;
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(window.innerWidth - 220, r.left - 160)) + "px";
  menu.style.top = Math.max(8, Math.min(window.innerHeight - 260, r.bottom + 6)) + "px";
  const items = [
    { icon:"✏️", label:"Renombrar", fn: () => abrirModalCategoria("renombrar", key) },
    { icon:"🎨", label:"Cambiar icono", fn: () => abrirModalCategoria("icono", key) },
    { icon:"⬅️", label:"Mover izquierda", fn: () => { Store.moveCategory(key, "left"); renderTabs(); } },
    { icon:"➡️", label:"Mover derecha", fn: () => { Store.moveCategory(key, "right"); renderTabs(); } },
    { sep:true },
    { icon:"📂", label:"Nueva subcategoría", fn: () => abrirModalSubcategoria("crear", key) },
    { sep:true },
    { icon:"➕", label:"Nueva categoría aquí", fn: () => abrirModalCategoria("crear", null, key) },
    { sep:true },
    { icon:"🗑️", label:"Eliminar categoría", danger:true, fn: () => confirmarEliminarCategoria(key) }
  ];
  for (const it of items){
    if (it.sep){ const s = document.createElement("div"); s.style.cssText = "height:1px;background:var(--line);margin:5px 3px"; menu.appendChild(s); continue; }
    const b = document.createElement("button"); b.type = "button";
    b.style.cssText = `display:flex;align-items:center;gap:10px;width:100%;background:transparent;border:0;color:${it.danger ? "#ffb3b3" : "var(--txt)"};padding:9px 11px;border-radius:7px;cursor:pointer;font-size:.82rem;text-align:left;font-family:inherit`;
    b.innerHTML = `<span>${it.icon}</span><span>${it.label}</span>`;
    b.addEventListener("mouseenter", () => { b.style.background = it.danger ? "rgba(255,107,107,.14)" : "rgba(79,195,247,.12)"; b.style.color = it.danger ? "#fff" : "var(--accent)"; });
    b.addEventListener("mouseleave", () => { b.style.background = "transparent"; b.style.color = it.danger ? "#ffb3b3" : "var(--txt)"; });
    b.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); cerrarMenuCategoria(); it.fn(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu); _menuCatEl = menu;
}
document.addEventListener("click", (e) => { if (_menuCatEl && !_menuCatEl.contains(e.target)) cerrarMenuCategoria(); });

function confirmarEliminarCategoria(key){
  const cat = Store.get(key); if (!cat) return;
  const n = cat.cds.length;
  if (!confirm(n === 0 ? `¿Eliminar "${cat.label}"?` : `⚠️ ¿Eliminar "${cat.label}"?\n\nContiene ${n} CDs.`)) return;
  if (n > 0 && !confirm("¿Realmente?")) return;
  const before = JSON.stringify(Store.categories());
  Store.deleteCategory(key);
  Undo.push("eliminar categoría", () => { Store.replaceAll({ categories: JSON.parse(before) }); ensureValidCat(); renderTabs(); renderAll(); });
  if (App.cat === key){ ensureValidCat(); App.artista = null; App.subcat = null; App.selected.clear(); App.focusedKey = null; }
  HistoryLog.log('DELETE', `Categoría eliminada: ${cat.label}`, `${n} CDs`);
  renderTabs(); renderStats(); renderAll(); AutoBackup.markChange("eliminación categoría");
  Toast.show(`Categoría "${cat.label}" eliminada`, "warn");
}

const EMOJIS = ["🎵","🎤","🎸","🎶","📀","💿","🎼","🎷","🎺","🥁","🎻","🎹","🎧","⭐","🇦🇷","🇧🇷","🇺🇸","🇬🇧","🌎","🔥","💫","✨","🎬","🎭"];
let _cmMode = "crear", _cmKey = null, _cmAfter = null, _subKey = null;
let _catSaving = false, _cdSaving = false;

function abrirModalCategoria(mode, key = null, after = null){
  _cmMode = mode; _cmKey = key; _cmAfter = after; _catSaving = false; _subKey = null;
  const cat = key ? Store.get(key) : null;
  $("#catModalIcon").textContent = mode === "crear" ? "➕" : mode === "renombrar" ? "✏️" : "🎨";
  $("#catModalTitle").textContent = mode === "crear" ? "Nueva categoría" : mode === "renombrar" ? "Renombrar" : "Cambiar icono";
  $("#catLabel").value = cat?.label || ""; $("#catIcon").value = cat?.icon || "🎵"; $("#catIconPreview").textContent = cat?.icon || "🎵";
  $("#wrapCatLabel").style.display = (mode === "icono") ? "none" : "";
  const li = $("#catLabel");
  if (mode === "icono") li.removeAttribute("required"); else li.setAttribute("required", "");
  const picker = $("#catIconPicker"); picker.innerHTML = "";
  const currentIcon = cat?.icon || "🎵";
  for (const e of EMOJIS){
    const b = document.createElement("button"); b.type = "button"; b.textContent = e;
    if (e === currentIcon) b.classList.add("active");
    b.addEventListener("click", () => {
      $("#catIcon").value = e; $("#catIconPreview").textContent = e;
      picker.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
    });
    picker.appendChild(b);
  }
  $("#catModal").classList.add("open");
  setTimeout(() => { if (mode !== "icono") $("#catLabel").focus(); else $("#catIcon").focus(); }, 80);
}
function cerrarCatModal(){
  $("#catModal").classList.remove("open");
  _cmKey = null; _cmAfter = null; _subKey = null;
  setTimeout(() => {
    _catSaving = false;
    const btn = $("#catSave");
    if (btn){ btn.disabled = false; if (btn.dataset._prev){ btn.textContent = btn.dataset._prev; delete btn.dataset._prev; } }
  }, 300);
}
function guardarCategoria(e){
  if (e) e.preventDefault();
  if (_catSaving) return;
  _catSaving = true;
  const btn = $("#catSave");
  if (btn){ btn.disabled = true; btn.dataset._prev = btn.textContent; btn.textContent = "⏳ Guardando…"; }
  const unlockCat = () => {
    _catSaving = false;
    if (btn){ btn.disabled = false; if (btn.dataset._prev){ btn.textContent = btn.dataset._prev; delete btn.dataset._prev; } }
  };
  const label = upper($("#catLabel").value.trim()), icon = $("#catIcon").value.trim() || "🎵";
  if (typeof _cmMode === 'string' && _cmMode.startsWith("sub-")){
    const subMode = _cmMode.slice(4);
    if (subMode === "crear"){
      if (!label){ $("#wrapCatLabel").classList.add("invalid"); unlockCat(); return; }
      const id = Store.addSubcategory(_cmKey, { label, icon: icon || "📂" });
      if (id){
        App.cat = _cmKey; App.subcat = id;
        HistoryLog.log('CREATE', `Subcategoría creada: ${label}`, Store.get(_cmKey)?.label || '');
        AutoBackup.markChange('nueva subcategoría');
        renderSubtabs(); renderTabs(); renderAll();
        Toast.show(`Subcategoría "${label}" creada`, "ok");
      } else { Toast.show("No se pudo crear la subcategoría", "err"); }
      cerrarCatModal();
      return;
    }
    if (subMode === "renombrar"){
      if (!label){ $("#wrapCatLabel").classList.add("invalid"); unlockCat(); return; }
      if (Store.updateSubcategory(_cmKey, _subKey, { label })){
        HistoryLog.log('EDIT', `Subcategoría renombrada: ${label}`);
        AutoBackup.markChange('renombrar subcategoría');
        renderSubtabs(); renderAll();
        Toast.show(`Renombrada a "${label}"`, "ok");
      }
      cerrarCatModal();
      return;
    }
    if (subMode === "icono"){
      if (Store.updateSubcategory(_cmKey, _subKey, { icon: icon || "📂" })){
        HistoryLog.log('EDIT', `Icono de subcategoría actualizado`);
        AutoBackup.markChange('cambio icono subcategoría');
        renderSubtabs(); renderAll();
        Toast.show("Icono actualizado", "ok");
      }
      cerrarCatModal();
      return;
    }
    unlockCat();
    return;
  }
  if (_cmMode === "crear"){
    if (!label){ $("#wrapCatLabel").classList.add("invalid"); unlockCat(); return; }
    const before = JSON.stringify(Store.categories());
    const nk = Store.addCategory({ label, icon });
    if (_cmAfter && Store.get(_cmAfter)){
      const keys = Store.catKeys(); const ti = keys.indexOf(_cmAfter); const ni = keys.indexOf(nk);
      if (ti !== -1 && ni !== -1){ keys.splice(ni, 1); keys.splice(ti + 1, 0, nk); const rb = {}; for (const k of keys) rb[k] = Store.get(k); Store.replaceAll({ categories: rb }); }
    }
    Undo.push("crear categoría", () => { Store.replaceAll({ categories: JSON.parse(before) }); ensureValidCat(); renderTabs(); renderAll(); });
    App.cat = nk; App.artista = null; App.subcat = null; App.selected.clear(); App.focusedKey = null;
    HistoryLog.log('CREATE', `Categoría creada: ${label}`, icon);
    renderTabs(); renderStats(); renderAll();
    AutoBackup.markChange("nueva categoría");
    Toast.show(`Categoría "${label}" creada`, "ok");
    cerrarCatModal();
    return;
  }
  if (_cmMode === "renombrar"){
    if (!label){ $("#wrapCatLabel").classList.add("invalid"); unlockCat(); return; }
    const cat = Store.get(_cmKey); if (!cat){ unlockCat(); return; }
    const before = JSON.stringify(Store.categories()); const oldKey = _cmKey; let nk = oldKey;
    if (label !== cat.label) nk = Store.renameCategoryKey(oldKey, label) || oldKey; else Store.updateCategory(oldKey, { label });
    Undo.push("renombrar categoría", () => { Store.replaceAll({ categories: JSON.parse(before) }); ensureValidCat(); renderTabs(); renderAll(); });
    if (App.cat === oldKey) App.cat = nk;
    if (nk !== oldKey){
      const rem = new Set();
      for (const k of App.selected){ const { cat: c, id } = parseCDKey(k); rem.add(c === oldKey ? `${nk}|${id}` : k); }
      App.selected = rem;
      if (App.focusedKey && App.focusedKey.startsWith(oldKey + "|")) App.focusedKey = `${nk}|${parseCDKey(App.focusedKey).id}`;
    }
    HistoryLog.log('EDIT', `Categoría renombrada: ${label}`);
    renderTabs(); renderStats(); renderAll(); ensureValidCat();
    AutoBackup.markChange("renombrar categoría");
    Toast.show(`Renombrada a "${label}"`, "ok");
    cerrarCatModal();
    return;
  }
  if (_cmMode === "icono"){
    Store.updateCategory(_cmKey, { icon });
    HistoryLog.log('EDIT', `Icono actualizado`);
    renderTabs(); AutoBackup.markChange("cambio icono");
    Toast.show("Icono actualizado", "ok");
    cerrarCatModal();
    return;
  }
  unlockCat();
}

function setArtistFilter(name){
  if (name){
    App.artista = name;
    App.q = '';
    const qEl = $("#q");
    if (qEl) qEl.value = '';
    $("#searchBox")?.classList.remove("has-value", "adv-mode");
    const advBadge = $("#advModeBadge"); if (advBadge) advBadge.style.display = "none";
    App.filters = { estado: '', formato: '', anioDesde: '', anioHasta: '', ubicacion: '', portada: '', prestamo: '' };
    const fE = $("#fFiltroEstado"); if (fE) fE.value = '';
    const fF = $("#fFiltroFormato"); if (fF) fF.value = '';
    const fAD = $("#fFiltroAnioDesde"); if (fAD) fAD.value = '';
    const fAH = $("#fFiltroAnioHasta"); if (fAH) fAH.value = '';
    const fU = $("#fFiltroUbicacion"); if (fU) fU.value = '';
    const fP = $("#fFiltroPortada"); if (fP) fP.value = '';
    const fPr = $("#fFiltroPrestamo"); if (fPr) fPr.value = '';
    Toast.show(`🎤 Solo ${upper(name)} (exacto)`, 'ok', 2200);
  } else {
    App.artista = null;
    Toast.show('🎤 Filtro de artista quitado', 'info', 1500);
  }
  renderAll();
  const main = document.querySelector('main');
  if (main) main.scrollTop = 0;
}

/* ═══════════════════════════════════════════════════════════════════
   Render tabla + artistas + stats
   ═══════════════════════════════════════════════════════════════════ */

function renderTabla(){
  const tbody = $("#tbodyCD");
  if (!App.cat){
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><span class="big">📁</span>Creá una categoría.</td></tr>`;
    $("#cdCount").textContent = "—"; $("#checkAll").checked = false; updateSelectionBar(); return;
  }
  const datos = sortCDs(getFiltered());
  const q = App.q.trim();
  if (!datos.length){ tbody.innerHTML = `<tr><td colspan="7" class="empty"><span class="big">💿</span>No hay CDs.</td></tr>`; }
  else {
    const frag = document.createDocumentFragment();
    for (const cd of datos){
      const key = cdKeyForView(cd);
      const tr = document.createElement("tr");
      tr.dataset.key = key; tr.dataset.nro = cd.nro;
      if (App.selected.has(key)) tr.classList.add("selected");
      if (App.focusedKey === key) tr.classList.add("focused");
      const loaned = Loans.isLoaned(cd); const overdue = Loans.isOverdue(cd);
      const coverHtml = cd.portada ? `<img class="cover-thumb" src="${esc(cd.portada)}" alt="" loading="lazy" data-key="${esc(key)}" data-title="${esc(upper(cd.titulo))} — ${esc(upper(cd.interprete))}">` : `<div class="cover-placeholder" title="Sin portada">💿</div>`;
      const loanIcon = loaned ? ` <span class="loan-badge${overdue ? ' overdue' : ''}" title="${overdue ? 'VENCIDO' : 'Prestado'}">📤${overdue ? '!' : ''}</span>` : '';
      const hasLinks = cd.links && Object.keys(cd.links).length > 0;
      tr.innerHTML = `
        <td class="check"><input type="checkbox" ${App.selected.has(key)?"checked":""}></td>
        <td class="cover">${coverHtml}</td>
        <td class="num">${cd.nro}</td>
        <td class="titulo">${highlight(upper(cd.titulo), q)}</td>
        <td class="art" title="${esc(upper(cd.interprete))}">${highlight(upper(cd.interprete), q)}${loanIcon}</td>
        <td class="anio">${cd.anio ?? "—"}</td>
        <td class="actions">${hasLinks ? `<button type="button" class="stream-quick" title="Ver CD y sus links de streaming">🎧</button>` : ''}<button type="button" class="view" title="Ver">👁️</button><button type="button" class="edit" title="Editar">✏️</button><button type="button" class="del" title="Eliminar">🗑️</button></td>`;
      tr.querySelector("td.check input").addEventListener("change", e => { e.stopPropagation(); toggleSelect(key, e.target.checked); });
      tr.querySelector("td.art").addEventListener("click", () => {
        const act = App.artista === cd.interprete;
        setArtistFilter(act ? null : cd.interprete);
      });
      tr.querySelector(".stream-quick")?.addEventListener("click", e => { e.stopPropagation(); abrirVista(cd); setTimeout(() => { $("#viewBody")?.querySelector(".stream-grid")?.scrollIntoView({behavior:"smooth",block:"center"}); }, 150); });
      tr.querySelector(".view").addEventListener("click", e => { e.stopPropagation(); abrirVista(cd); });
      tr.querySelector(".edit").addEventListener("click", e => { e.stopPropagation(); abrirModal("editar", cd); });
      tr.querySelector(".del").addEventListener("click", e => { e.stopPropagation(); eliminarCD(cd); });
      const thumb = tr.querySelector(".cover-thumb");
      if (thumb){ thumb.addEventListener("click", e => { e.stopPropagation(); Lightbox.open(cd.portada, `${cd.titulo} — ${cd.interprete}`, key); }); thumb.addEventListener("error", () => { thumb.outerHTML = `<div class="cover-placeholder" title="Error">⚠️</div>`; }); }
      tr.addEventListener("click", e => { if (e.target.closest("td.check") || e.target.closest("td.actions") || e.target.closest("td.cover")) return; App.focusedKey = key; updateFocusedRow(); });
      frag.appendChild(tr);
    }
    tbody.replaceChildren(frag);
  }
  const total = (App.cat === ALL_CATS) ? Store.total() : Store.getCDs(App.cat).length;
  const fa = Object.values(App.filters).some(v => v) || App.artista || App.q.trim() || App.subcat;
  $("#cdCount").innerHTML = fa ? `Mostrando <b>${datos.length}</b> de ${total} · <b>filtrado</b>` : `Todos: <b>${total}</b>`;
  $$("#tablaCD thead th[data-key]").forEach(th => { const k = th.dataset.key; th.classList.toggle("sorted", k === App.sortKey); th.querySelector(".arrow").textContent = k === App.sortKey ? (App.sortDir === 1 ? "▲" : "▼") : "▲"; });
  $("#checkAll").checked = datos.length > 0 && datos.every(cd => App.selected.has(cdKeyForView(cd)));
  updateSelectionBar();
  const chip = $("#activeArtistChip");
  if (chip){ if (App.artista){ chip.innerHTML = `<span class="artist-chip">🎤 <b>${esc(upper(App.artista))}</b> <button type="button" class="chip-remove" title="Quitar">✕</button></span>`; chip.querySelector(".chip-remove").addEventListener("click", (e) => { e.stopPropagation(); App.artista = null; renderAll(); }); } else chip.innerHTML = ""; }
  const fab = $("#fabVerTodos"); if (fab) fab.classList.toggle("show", !!App.artista);
  const notice = $("#artFilterNotice"); const nn = $("#artFilterName");
  if (notice){ if (App.artista){ notice.classList.add("show"); if (nn) nn.textContent = upper(App.artista); } else notice.classList.remove("show"); }
  if (GridView.isEnabled()) GridView.render();
}
function updateFocusedRow(){ $$("#tbodyCD tr").forEach(tr => tr.classList.toggle("focused", tr.dataset.key === App.focusedKey)); const el = findRowByKey(App.focusedKey); if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }

function renderArtistas(){
  if (!App.cat){ $("#listaArt").innerHTML = ""; $("#artCount").innerHTML = "—"; return; }
  const q = App.q.trim();
  const m = new Map();
  for (const cd of viewCDs()){ if (!cd.interprete) continue; m.set(cd.interprete, (m.get(cd.interprete) || 0) + 1); }
  const sortMode = Store.getPref('artSort', 'count');
  const lista = [...m.entries()].map(([nombre, count]) => ({ nombre, count }));
  if (sortMode === 'alpha'){ lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: 'base', numeric: true })); }
  else if (sortMode === 'alpha-desc'){ lista.sort((a, b) => b.nombre.localeCompare(a.nombre, "es", { sensitivity: 'base', numeric: true })); }
  else { lista.sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre, "es", { sensitivity: 'base', numeric: true })); }
  const max = Math.max(...lista.map(a => a.count), 1);
  const ul = $("#listaArt");
  const frag = document.createDocumentFragment();
  lista.forEach((a, i) => {
    const li = document.createElement("li");
    const act = App.artista === a.nombre;
    li.className = "art-item" + (act ? " active" : "");
    const rankLabel = (sortMode === 'count') ? String(i + 1) : a.nombre.charAt(0).toUpperCase();
    li.innerHTML = `<span class="art-rank">${esc(rankLabel)}</span><span class="art-info"><span class="art-name">${highlight(upper(a.nombre), q)}</span><span class="bar"><i style="width:${Math.round(a.count/max*100)}%"></i></span></span><span class="art-count">${a.count}</span>`;
    li.title = act ? `Quitar filtro` : `Ver los ${a.count} CDs`;
    li.setAttribute("role", "button"); li.setAttribute("tabindex", "0");
    li.addEventListener("click", () => { setArtistFilter(act ? null : a.nombre); });
    li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); li.click(); } });
    frag.appendChild(li);
  });
  ul.replaceChildren(frag);
  $("#artCount").innerHTML = `<b>${lista.length}</b> intérpretes${App.artista ? ` · <span style="color:var(--purple)">${esc(upper(App.artista))}</span>` : ""}`;
}

function renderStats(){
  const cds = viewCDs();
  const años = cds.map(c => c.anio).filter(a => a && a > 0);
  const min = años.length ? Math.min(...años) : 0, max = años.length ? Math.max(...años) : 0;
  const art = new Map();
  for (const c of cds) art.set(c.interprete, (art.get(c.interprete) || 0) + 1);
  const top = [...art.entries()].sort((a, b) => b[1] - a[1])[0];
  const cp = cds.filter(c => c.portada).length;
  $("#stTotal").textContent = cds.length;
  $("#stArt").textContent = art.size;
  $("#stRango").textContent = años.length ? `${min}–${max}` : "—";
  const st = $("#stTop");
  if (top){ const fn = top[0]; st.textContent = `${fn.length > 14 ? fn.slice(0, 14) + "…" : fn} (${top[1]})`; st.title = `${fn} — ${top[1]} CDs`; } else { st.textContent = "—"; st.title = ""; }
  $("#stCovers").textContent = `${cp}/${cds.length}`;
  $("#fTotal").textContent = Store.total();
}

/* ═══════════════════════════════════════════════════════════════════
   Dashboard + proyección
   ═══════════════════════════════════════════════════════════════════ */

let _charts = {};
function computeDash(){
  const all = Store.allCDs(); const total = all.length;
  const aS = new Set(); const sM = new Map(); const yM = new Map(); const dM = new Map();
  let cU = 0, cV = 0, cS = 0, cG = 0, cA = 0, cC = 0, cP = 0, vT = 0;
  for (const cd of all){
    if (cd.interprete) aS.add(cd.interprete);
    if (cd.sello){ sM.set(cd.sello, (sM.get(cd.sello) || 0) + 1); cS++; }
    if (cd.anio && cd.anio > 0){ yM.set(cd.anio, (yM.get(cd.anio) || 0) + 1); const d = Math.floor(cd.anio / 10) * 10; dM.set(d, (dM.get(d) || 0) + 1); cA++; }
    if (cd.ubicacion) cU++; if (cd.genero) cG++; if (cd.catalogo) cC++; if (cd.portada) cP++;
    if (cd.valor != null && Number.isFinite(Number(cd.valor))){ const cn = Math.max(1, parseInt(cd.cantidad) || 1); vT += Number(cd.valor) * cn; cV++; }
  }
  const años = all.map(c => c.anio).filter(a => a && a > 0);
  const aMin = años.length ? Math.min(...años) : null, aMax = años.length ? Math.max(...años) : null;
  const aM = new Map();
  for (const cd of all){ if (cd.interprete) aM.set(cd.interprete, (aM.get(cd.interprete) || 0) + 1); }
  const topA = [...aM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topA40 = [...aM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  const topS = [...sM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topY = [...yM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const dec = [...dM.entries()].sort((a, b) => a[0] - b[0]);
  const catD = Store.catKeys().map(k => ({ key: k, label: Store.get(k).label, icon: Store.get(k).icon, count: Store.getCDs(k).length }));
  return { total, artistas: aS.size, valorTotal: vT, añoMin: aMin, añoMax: aMax, topArtistas: topA, topArtistasAll: topA40, topSellos: topS, topAnios: topY, decadas: dec, catData: catD, conUbicacion: cU, conValor: cV, conSello: cS, conGenero: cG, conAnio: cA, conCatalogo: cC, conPortada: cP };
}
function destroyCharts(){
  for (const id in _charts){
    try { _charts[id].destroy(); } catch(e){}
    delete _charts[id];
  }
}
function renderDashboard(){
  if (!Store.catKeys().length) return;
  const d = computeDash();
  const kpis = [
    { icon:"💿", label:"Total CDs", value: d.total.toLocaleString("es-AR"), sub: `${Store.catKeys().length} categorías` },
    { icon:"🎤", label:"Intérpretes", value: d.artistas.toLocaleString("es-AR"), sub: d.total && d.artistas ? `${(d.total/d.artistas).toFixed(1)} CDs/int.` : "—" },
    { icon:"📅", label:"Años", value: d.añoMin && d.añoMax ? `${d.añoMin}–${d.añoMax}` : "—", sub: d.añoMin ? `${d.añoMax - d.añoMin + 1} años` : "" },
    { icon:"💰", label:"Valor", value: d.valorTotal > 0 ? `$${d.valorTotal.toLocaleString("es-AR", {maximumFractionDigits: 0})}` : "—", sub: d.conValor > 0 ? `${d.conValor} con valor` : "" },
    { icon:"🖼️", label:"Portadas", value: `${d.conPortada}/${d.total}`, sub: d.total > 0 ? `${Math.round(d.conPortada/d.total*100)}%` : "" }
  ];
  $("#dashKpiRow").innerHTML = kpis.map(k => `<div class="dash-kpi"><div class="kpi-icon">${k.icon}</div><div class="kpi-text"><div class="kpi-label">${esc(k.label)}</div><div class="kpi-value">${esc(k.value)}</div><div class="kpi-sub">${esc(k.sub)}</div></div></div>`).join("");
  const chAv = typeof Chart !== "undefined";
  const colors = ["#4fc3f7","#a78bfa","#ffca28","#5ddc9a","#ff6b6b","#ffa94d","#f472b6","#34d399","#60a5fa","#fbbf24","#c084fc","#f87171"];
  function upsert(id, cfg){
    const cv = document.getElementById(id);
    if (!chAv || !cv) return;
    if (_charts[id]){
      try {
        if (_charts[id].canvas === cv){ _charts[id].data = cfg.data; _charts[id].update('none'); return; }
        _charts[id].destroy();
      } catch(e){ try { _charts[id].destroy(); } catch(_){} }
      delete _charts[id];
    }
    try { _charts[id] = new Chart(cv, cfg); } catch(e){ console.warn(id, e); }
  }
  upsert("chartCategorias", { type:"doughnut", data:{ labels: d.catData.map(c => c.icon + " " + c.label), datasets: [{ data: d.catData.map(c => c.count), backgroundColor: colors, borderColor: "rgba(14,17,22,.6)", borderWidth: 2 }] }, options:{ responsive: true, maintainAspectRatio: false, plugins:{ legend:{ position:"bottom", labels:{ color:"#e6ebf2", font:{ size:11 }, boxWidth:12, padding:10 } } } } });
  upsert("chartArtistas", { type:"bar", data:{ labels: d.topArtistas.map(([n]) => n.length > 22 ? n.slice(0,20) + "…" : n), datasets:[{ label:"CDs", data: d.topArtistas.map(([,n]) => n), backgroundColor: "rgba(167,139,250,.7)", borderColor: "#a78bfa", borderWidth: 1, borderRadius: 4 }] }, options:{ indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins:{ legend:{ display: false } }, scales:{ x:{ ticks:{ color:"#8b97a8", font:{ size:10 } }, grid:{ color:"rgba(37,45,58,.4)" } }, y:{ ticks:{ color:"#e6ebf2", font:{ size:10 } }, grid:{ display: false } } } } });
  let acc = 0; const dAcc = d.decadas.map(([,n]) => (acc += n));
  upsert("chartDecadas", { type:"bar", data:{ labels: d.decadas.map(([dc]) => `${dc}s`), datasets:[{ label:"CDs", data: d.decadas.map(([,n]) => n), backgroundColor: "rgba(255,202,40,.55)", borderColor: "#ffca28", borderWidth: 1, borderRadius: 4, yAxisID: "y" }, { type:"line", label:"Acumulado", data: dAcc, borderColor: "#4fc3f7", backgroundColor: "rgba(79,195,247,.15)", borderWidth: 2, tension: .35, pointRadius: 4, pointBackgroundColor: "#4fc3f7", fill: true, yAxisID: "y1" }] }, options:{ responsive: true, maintainAspectRatio: false, plugins:{ legend:{ labels:{ color:"#e6ebf2", font:{ size:11 }, boxWidth:12 } } }, scales:{ x:{ ticks:{ color:"#8b97a8", font:{ size:10 } }, grid:{ display: false } }, y:{ position:"left", ticks:{ color:"#ffca28", font:{ size:10 } }, grid:{ color:"rgba(37,45,58,.4)" } }, y1:{ position:"right", ticks:{ color:"#4fc3f7", font:{ size:10 } }, grid:{ display: false } } } } });
  const sEl = $("#topSellos"); if (sEl) sEl.innerHTML = d.topSellos.length ? d.topSellos.map(([n, v], i) => `<li><span class="tl-rank">${i+1}</span><span class="tl-name" title="${esc(n)}">${esc(n)}</span><span class="tl-value">${v}</span></li>`).join("") : `<li style="color:var(--muted);justify-content:center">Sin datos</li>`;
  const yEl = $("#topAnios"); if (yEl) yEl.innerHTML = d.topAnios.length ? d.topAnios.map(([n, v], i) => `<li><span class="tl-rank">${i+1}</span><span class="tl-name">${n}</span><span class="tl-value">${v}</span></li>`).join("") : `<li style="color:var(--muted);justify-content:center">Sin datos</li>`;
  const wc = $("#wordcloud");
  if (wc){ if (d.topArtistasAll.length){ const mv = d.topArtistasAll[0][1]; wc.innerHTML = d.topArtistasAll.map(([n, v]) => { const s = 0.8 + (v/mv)*1.4; const o = 0.5 + (v/mv)*0.5; return `<span style="font-size:${s}rem;opacity:${o}" title="${esc(n)}: ${v} CDs">${esc(n)}</span>`; }).join(""); } else wc.innerHTML = `<span style="color:var(--muted)">Sin datos</span>`; }
  const hI = [
    { label:"Con año", val: d.conAnio, total: d.total },
    { label:"Con sello", val: d.conSello, total: d.total },
    { label:"Con género", val: d.conGenero, total: d.total },
    { label:"Con ubicación", val: d.conUbicacion, total: d.total },
    { label:"Con Nº catálogo", val: d.conCatalogo, total: d.total },
    { label:"Con valor", val: d.conValor, total: d.total },
    { label:"Con portada", val: d.conPortada, total: d.total }
  ];
  const hg = $("#healthGrid");
  if (hg) hg.innerHTML = hI.map(h => { const p = h.total ? Math.round(h.val / h.total * 100) : 0; return `<div class="health-item"><div class="hi-label">${h.label}</div><div class="hi-value">${h.val} <span style="font-size:.7rem;color:var(--muted);font-weight:400">/ ${h.total}</span></div><div class="hi-bar"><i style="width:${p}%"></i></div><div style="font-size:.65rem;color:var(--muted);text-align:right">${p}%</div></div>`; }).join("");
  renderProjection(d.valorTotal);
}
function renderProjection(vA){
  const ts = $("#projTasa"); if (!ts) return;
  const años = parseInt($("#projAnios").value) || 10;
  let tasa = parseFloat(ts.value); if (ts.value === "custom") tasa = (parseFloat($("#projCustom").value) || 0) / 100;
  let base = $("#projBase").value === "manual" ? (parseFloat($("#projManual").value) || 0) : vA;
  const fut = base * Math.pow(1 + tasa, años); const gan = fut - base; const roi = base > 0 ? ((fut / base) - 1) * 100 : 0;
  const r = $("#projectionResult"); if (!r) return;
  r.innerHTML = `<div class="pr-item"><div class="pr-label">Valor actual</div><div class="pr-value">$${base.toLocaleString("es-AR", {maximumFractionDigits: 0})}</div></div><div class="pr-item"><div class="pr-label">En ${años} años</div><div class="pr-value ${fut >= base ? 'green' : 'red'}">$${fut.toLocaleString("es-AR", {maximumFractionDigits: 0})}</div></div><div class="pr-item"><div class="pr-label">Ganancia/Pérdida</div><div class="pr-value ${gan >= 0 ? 'green' : 'red'}">${gan >= 0 ? '+' : ''}$${gan.toLocaleString("es-AR", {maximumFractionDigits: 0})}</div></div><div class="pr-item"><div class="pr-label">ROI</div><div class="pr-value ${roi >= 0 ? 'green' : 'red'}">${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%</div></div>`;
}
function setView(v){
  App.view = v; const isD = v === "dashboard";
  $("#tableView").style.display = isD ? "none" : "";
  $("#dashboardView").classList.toggle("active", isD);
  $("#panelArtistas").classList.toggle("hidden-panel", isD);
  const b = $("#btnVista"); b.innerHTML = isD ? `<span class="ico">📋</span><span>Tabla</span>` : `<span class="ico">📊</span><span>Panel</span>`;
  b.classList.toggle("active", isD);
  if (isD) renderDashboard(); else { destroyCharts(); renderTabla(); renderArtistas(); renderStats(); }
}
function renderAll(){
  ensureValidCat();
  renderSubtabs();
  const ie = Store.isEmpty;
  $("#emptyState").classList.toggle("hidden", !ie);
  $("#tableView").style.display = ie || App.view === "dashboard" ? "none" : "";
  $("#dashboardView").classList.toggle("active", !ie && App.view === "dashboard");
  const ap = $("#panelArtistas");
  if (ap){ ap.classList.toggle("hidden-panel", ie || App.view === "dashboard"); }
  if (!ie){ if (App.view === "dashboard") renderDashboard(); else { renderTabla(); renderArtistas(); } renderStats(); }
  else { $("#cdCount").textContent = "—"; $("#artCount").textContent = "—"; $("#stTotal").textContent = "0"; $("#stArt").textContent = "0"; $("#stRango").textContent = "—"; $("#stTop").textContent = "—"; $("#stCovers").textContent = "0/0"; $("#fTotal").textContent = "0"; }
  const n = Store.catKeys().length;
  $("#subtitle").textContent = "Colección profesional de CDs · " + n + " categoría" + (n === 1 ? "" : "s");
  NotFoundList.updateBadge(); FileSystemDefault.refreshBadge();
  const fab = $("#fabVerTodos"); if (fab) fab.classList.toggle("show", !!App.artista);
  DuplicateChecker.invalidate();
}
function toggleSelect(k, c){ if (c) App.selected.add(k); else App.selected.delete(k); const tr = findRowByKey(k); if (tr) tr.classList.toggle("selected", c); updateSelectionBar(); syncCheckAll(); }
function updateSelectionBar(){ const b = $("#selectionBar"); if (App.selected.size === 0){ b.classList.remove("show"); return; } b.classList.add("show"); $("#selCount").textContent = App.selected.size; }
function syncCheckAll(){ const a = $$("#tbodyCD tr").length; const c = $$("#tbodyCD tr.selected").length; $("#checkAll").checked = a > 0 && c === a; $("#checkAll").indeterminate = c > 0 && c < a; }

/* ═══════════════════════════════════════════════════════════════════
   Vista cuadrícula
   ═══════════════════════════════════════════════════════════════════ */

const GridView = (() => {
  let enabled = false;
  function isEnabled(){ return enabled; }
  function setEnabled(v){
    enabled = !!v;
    const btn = $('#btnGrid'); if (btn) btn.classList.toggle('active', enabled);
    const tw = $('#tableWrap'); const gw = $('#gridWrap');
    if (gw) gw.style.display = enabled ? '' : 'none';
    if (tw) tw.style.display = enabled ? 'none' : '';
    if (enabled) render();
  }
  function render(){
    if (!enabled || !App.cat) return;
    const w = $('#gridWrap'); if (!w) return;
    const datos = sortCDs(getFiltered());
    if (!datos.length){ w.innerHTML = '<div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--muted)"><span style="font-size:3rem;opacity:.5;display:block;margin-bottom:12px">💿</span>No hay CDs</div>'; return; }
    w.innerHTML = datos.map(cd => {
      const key = cdKeyForView(cd);
      const isSel = App.selected.has(key);
      const loaned = Loans.isLoaned(cd); const ov = Loans.isOverdue(cd);
      const dup = DuplicateChecker.isDuplicate(cd);
      const cover = cd.portada ? `<img src="${esc(cd.portada)}" alt="" loading="lazy">` : `<div class="gc-placeholder">💿</div>`;
      const badges = [];
      if (loaned) badges.push(`<span class="gc-badge loan">📤${ov ? '!' : ''}</span>`);
      if (dup) badges.push(`<span class="gc-badge dup">🔍</span>`);
      return `<div class="grid-card${isSel ? ' selected' : ''}" data-gc-key="${esc(key)}">
        <div class="gc-check" data-gc-check="${esc(key)}">${isSel ? '✓' : ''}</div>
        ${badges.length ? `<div class="gc-badges">${badges.join('')}</div>` : ''}
        <div class="gc-cover" data-gc-open="${esc(key)}">${cover}</div>
        <div class="gc-title" title="${esc(upper(cd.titulo))}">${esc(upper(cd.titulo))}</div>
        <div class="gc-artist" title="${esc(upper(cd.interprete))}">${esc(upper(cd.interprete))}</div>
        <div class="gc-meta"><span class="gc-nro">#${cd.nro}</span><span class="gc-year">${cd.anio ?? '—'}</span></div>
        <div class="gc-actions">
          <button type="button" data-gc-view="${esc(key)}" title="Ver">👁️</button>
          <button type="button" data-gc-edit="${esc(key)}" title="Editar">✏️</button>
          <button type="button" data-gc-del="${esc(key)}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
    }).join('');
    w.querySelectorAll('[data-gc-check]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const k = el.dataset.gcCheck; toggleSelect(k, !App.selected.has(k)); render(); }); });
    w.querySelectorAll('[data-gc-open]').forEach(el => { el.addEventListener('click', () => { const { cat, id } = parseCDKey(el.dataset.gcOpen); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd && cd.portada) Lightbox.open(cd.portada, `${cd.titulo} — ${cd.interprete}`, el.dataset.gcOpen); }); });
    w.querySelectorAll('[data-gc-view]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const { cat, id } = parseCDKey(el.dataset.gcView); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd) abrirVista(cd); }); });
    w.querySelectorAll('[data-gc-edit]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const { cat, id } = parseCDKey(el.dataset.gcEdit); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd) abrirModal('editar', cd); }); });
    w.querySelectorAll('[data-gc-del]').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const { cat, id } = parseCDKey(el.dataset.gcDel); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd) eliminarCD(cd); }); });
  }
  return { isEnabled, setEnabled, render };
})();

/* ═══════════════════════════════════════════════════════════════════
   Modal CD — Nuevo / Editar
   ═══════════════════════════════════════════════════════════════════ */

const setVal = (s, v) => { const el = $(s); if (el) el.value = v; };
const getVal = s => $(s)?.value ?? "";
function fillDatalist(sel, set){ const dl = $(sel); if (!dl) return; dl.innerHTML = ""; [...set].sort((a, b) => a.localeCompare(b, "es")).forEach(v => { const o = document.createElement("option"); o.value = upper(v); dl.appendChild(o); }); }
function switchModalTab(n){ $$(".modal-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === n)); $$(".tab-panel").forEach(p => p.style.display = p.dataset.panel === n ? "" : "none"); }
function clearValidation(){ $$(".field.invalid").forEach(f => f.classList.remove("invalid")); }
function abrirVista(cd){
  if (!cd) return;
  App.detailCD = cd;
  const v = (val, fb = "—") => (val === null || val === undefined || val === "") ? fb : val;
  const cov = cd.portada ? `<img src="${esc(cd.portada)}" alt="Portada" style="width:180px;height:180px;border-radius:12px;object-fit:cover;border:1px solid var(--line);box-shadow:0 8px 30px rgba(0,0,0,.5);cursor:zoom-in" data-lb-key="${esc(cdKeyForView(cd))}">` : `<div style="width:180px;height:180px;border-radius:12px;background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:3rem;opacity:.4">💿</div>`;
  const secs = [
    { t: "📀 Edición", c: [["Formato", v(cd.formato)], ["Año álbum", v(cd.anio)], ["Año edición", v(cd.anioEdicion)], ["Sello", v(upper(cd.sello))], ["Género", v(upper(cd.genero))], ["Nº catálogo", v(upper(cd.catalogo))], ["Código de barras", v(cd.codigo)], ["ISRC", v(cd.isrc)], ["Edición", v(upper(cd.edicion))], ["País", v(upper(cd.pais))]] },
    { t: "🔍 Estado físico", c: [["Estado general", v(cd.estado)], ["Disco", v(cd.estadoDisco)], ["Caja", v(cd.estadoCaja)], ["Folleto", v(cd.estadoFolleto)], ["Arte / carátula", v(cd.estadoArte)]] },
    { t: "📍 Ubicación y valor", c: [["Ubicación", v(upper(cd.ubicacion))], ["Cantidad", v(cd.cantidad, 1)], ["Fecha ingreso", v(cd.adquisicion)], ["Valor", cd.valor != null ? `${cd.moneda || "ARS"} ${Number(cd.valor).toLocaleString("es-AR")}` : "—"], ["Moneda", v(cd.moneda)]] }
  ];
  if (Loans.isLoaned(cd)) secs.push({ t: "📚 Préstamo", c: [["Prestado a", v(upper(cd.prestadoA))], ["Fecha préstamo", v(cd.fechaPrestamo)], ["Fecha devolución", v(cd.fechaDevolucion)], ["Notas", v(upper(cd.notasPrestamo))]] });
  const cf = cd.customFields || {};
  const cfs = CustomFields.getAll().filter(f => cf[f.id]);
  if (cfs.length) secs.push({ t: "📝 Personalizados", c: cfs.map(f => [f.name, v(cf[f.id])]) });
  const rSec = (s) => `<div style="margin-bottom:18px"><div class="section-label" style="margin-top:0">${s.t}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px 18px">${s.c.map(([k, val]) => `<div><div style="font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;font-weight:600">${esc(k)}</div><div style="font-size:.88rem;color:var(--txt);word-break:break-word;text-transform:uppercase">${esc(String(val))}</div></div>`).join("")}</div></div>`;
  $("#viewTitle").textContent = upper(cd.titulo) || "Detalles del CD";
  const realCat = findCategoryOfCD(cd) || App.cat;
  const realCatObj = Store.get(realCat);
  const subObj = cd.subcat ? Store.getSubcategory(realCat, cd.subcat) : null;
  $("#viewBody").innerHTML = `
    <div style="display:flex;gap:20px;flex-wrap:wrap;padding:16px;background:linear-gradient(135deg,rgba(79,195,247,.07),rgba(167,139,250,.05));border:1px solid rgba(79,195,247,.22);border-radius:12px;margin-bottom:20px;align-items:flex-start">
      <div style="flex:0 0 auto">${cov}</div>
      <div style="flex:1;min-width:200px">
        <div style="font-size:.62rem;color:var(--accent);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:6px">🎵 Título</div>
        <div style="font-size:1.25rem;font-weight:700;color:var(--txt);margin-bottom:14px;line-height:1.25;text-transform:uppercase">${esc(upper(cd.titulo) || "—")}</div>
        <div style="font-size:.62rem;color:var(--accent);text-transform:uppercase;letter-spacing:1.2px;font-weight:700;margin-bottom:6px">🎤 Intérprete</div>
        <div style="font-size:1rem;color:var(--txt);margin-bottom:14px;text-transform:uppercase">${esc(upper(cd.interprete) || "—")}</div>
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Nº</div><div style="font-size:1rem;font-weight:700;color:var(--accent2)">${cd.nro ?? "—"}</div></div>
          <div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Año álbum</div><div style="font-size:1rem;font-weight:700;color:var(--accent2)">${cd.anio ?? "—"}</div></div>
          ${cd.anioEdicion ? `<div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Año edición</div><div style="font-size:1rem;font-weight:700;color:var(--purple)">${cd.anioEdicion}</div></div>` : ''}
          <div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Categoría</div><div style="font-size:1rem;font-weight:600;color:var(--txt)">${esc(realCatObj?.label || "—")}</div></div>
          ${subObj ? `<div><div style="font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Subcategoría</div><div style="font-size:1rem;font-weight:600;color:var(--purple)">${esc(subObj.icon)} ${esc(subObj.label)}</div></div>` : ''}
        </div>
      </div>
    </div>
    ${secs.map(rSec).join("")}
    ${renderStreamingSection(cd)}
    ${cd.notas ? `<div style="margin-top:8px"><div class="section-label" style="margin-top:0">📝 Observaciones</div><div style="font-size:.85rem;color:var(--txt);line-height:1.6;padding:12px 14px;background:rgba(255,255,255,.02);border:1px solid var(--line);border-radius:10px;white-space:pre-wrap">${esc(cd.notas)}</div></div>` : ""}
    ${cd.enrichmentSource ? `<div style="margin-top:16px;padding:10px 14px;background:rgba(79,195,247,.06);border-left:3px solid var(--accent);border-radius:8px;font-size:.75rem;color:var(--muted)">✨ Enriquecido desde <b style="color:var(--accent)">${esc(cd.enrichmentSource)}</b>${cd.enrichmentConfidence != null ? ` · Confianza: <b>${cd.enrichmentConfidence}%</b>` : ""}${cd.enrichedAt ? ` · ${new Date(cd.enrichedAt).toLocaleDateString('es-AR')}` : ""}</div>` : ""}`;
  const m = $("#viewModal"); m.dataset.editKey = cdKeyForView(cd); m.classList.add("open");
  document.body.style.overflow = "hidden";
  const img = $("#viewBody img[data-lb-key]");
  if (img) img.addEventListener("click", () => Lightbox.open(cd.portada, `${cd.titulo} — ${cd.interprete}`, cdKeyForView(cd)));
  const streamSection = $("#viewBody .stream-section");
  if (streamSection) wireStreamingSectionEvents(streamSection, cd);
}
function cerrarVista(){ $("#viewModal").classList.remove("open"); document.body.style.overflow = ""; App.detailCD = null; }
function abrirModal(modo, cd = null){
  _cdSaving = false;
  const _sb = $("#btnSave"), _sn = $("#btnSaveAndNew");
  if (_sb) _sb.disabled = false;
  if (_sn) _sn.disabled = false;
  if (!Store.catKeys().length){ Toast.show("Creá una categoría primero", "warn"); abrirModalCategoria("crear"); return; }
  App.editing = modo === "editar" ? { cat: (App.cat === ALL_CATS ? findCategoryOfCD(cd) : App.cat), original: cd } : null;
  $("#modalIcon").textContent = modo === "editar" ? "✏️" : "➕";
  $("#modalTitle").textContent = modo === "editar" ? "Editar CD" : "Nuevo CD";
  $("#enrichBar").style.display = "none"; $("#enrichResult").textContent = ""; $("#enrichSources").style.display = "none";
  $("#fCoverUrl").value = ""; delete $("#fCoverUrl").dataset.enrichmentSource; delete $("#fCoverUrl").dataset.enrichmentConfidence; delete $("#fCoverUrl").dataset.enrichedAt;
  $("#fLinks").value = modo === "editar" && cd && cd.links ? JSON.stringify(cd.links) : "";
  $("#wrapCoverUrl").style.display = "none"; renderCoverPreview(null, null);
  const tg = $("#enrichToggle"); if (tg) tg.checked = Store.getPref("enrich", true);
  const rt = $("#replaceToggle"); if (rt) rt.checked = Store.getPref("replaceOnEnrich", true);
  const sel = $("#fCat"); sel.innerHTML = "";
  for (const k of Store.catKeys()){ const c = Store.get(k); const o = document.createElement("option"); o.value = k; o.textContent = c.icon + " " + c.label;
    const preselected = (modo === "editar" && App.editing?.cat === k) || (modo === "nuevo" && App.cat !== ALL_CATS && k === App.cat) || (modo === "nuevo" && App.cat === ALL_CATS && k === Store.catKeys()[0]);
    if (preselected) o.selected = true;
    sel.appendChild(o);
  }
  sel.disabled = false;
  const iS = new Set(), sS = new Set(), gS = new Set();
  for (const k of Store.catKeys()){ for (const c of Store.getCDs(k)){ if (c.interprete) iS.add(c.interprete); if (c.sello) sS.add(c.sello); if (c.genero) gS.add(c.genero); } }
  fillDatalist("#interpreteList", iS); fillDatalist("#selloList", sS); fillDatalist("#generoList", gS);
  populateSubcatOptions(sel.value, modo === "editar" && cd ? (cd.subcat || "") : "");
  switchModalTab("edicion"); clearValidation();
  const loanBanner = $("#loanActiveBanner");
  if (modo === "editar" && cd){
    setVal("#fNro", cd.nro); setVal("#fTitulo", upper(cd.titulo)); setVal("#fInterprete", upper(cd.interprete)); setVal("#fAnio", cd.anio ?? ""); setVal("#fAnioEdicion", cd.anioEdicion ?? ""); setVal("#fFormato", cd.formato || "CD");
    setVal("#fEstado", cd.estado || "Excelente"); setVal("#fSello", upper(cd.sello)); setVal("#fGenero", upper(cd.genero)); setVal("#fCatalogo", upper(cd.catalogo));
    setVal("#fCodigo", cd.codigo || ""); setVal("#fISRC", cd.isrc || ""); setVal("#fEdicion", upper(cd.edicion)); setVal("#fPais", upper(cd.pais));
    setVal("#fUbicacion", upper(cd.ubicacion)); setVal("#fCantidad", cd.cantidad || 1); setVal("#fAdquisicion", cd.adquisicion || "");
    setVal("#fValor", cd.valor ?? ""); setVal("#fNotas", cd.notas || ""); setVal("#fMoneda", cd.moneda || "ARS");
    setVal("#fEstadoDisco", cd.estadoDisco || ""); setVal("#fEstadoCaja", cd.estadoCaja || ""); setVal("#fEstadoFolleto", cd.estadoFolleto || ""); setVal("#fEstadoArte", cd.estadoArte || "");
    setVal("#fPrestadoA", upper(cd.prestadoA)); setVal("#fFechaPrestamo", cd.fechaPrestamo || ""); setVal("#fFechaDevolucion", cd.fechaDevolucion || ""); setVal("#fNotasPrestamo", upper(cd.notasPrestamo));
    if (cd.portada){ $("#fCoverUrl").value = cd.portada; renderCoverPreview(cd.portada, cd.portadaSource); }
    if (Loans.isLoaned(cd)){ loanBanner.style.display = "block"; loanBanner.innerHTML = `📚 <b>Prestado a:</b> ${esc(upper(cd.prestadoA))}${cd.fechaDevolucion ? ` · Devolución: ${esc(cd.fechaDevolucion)}` : ''}`; } else loanBanner.style.display = "none";
    CustomFields.renderInModal(cd.customFields || {});
  } else {
    const targetCat = sel.value || Store.catKeys()[0];
    const cds = Store.getCDs(targetCat) || [];
    const mx = cds.reduce((m, c) => Math.max(m, c.nro || 0), 0);
    setVal("#fNro", mx + 1); setVal("#fTitulo", ""); setVal("#fInterprete", App.artista ? upper(App.artista) : ""); setVal("#fAnio", ""); setVal("#fAnioEdicion", "");
    setVal("#fFormato", "CD"); setVal("#fEstado", "Excelente"); setVal("#fSello", ""); setVal("#fGenero", ""); setVal("#fCatalogo", "");
    setVal("#fCodigo", ""); setVal("#fISRC", ""); setVal("#fEdicion", ""); setVal("#fPais", "");
    setVal("#fUbicacion", ""); setVal("#fCantidad", 1); setVal("#fAdquisicion", new Date().toISOString().slice(0, 10));
    setVal("#fValor", ""); setVal("#fNotas", ""); setVal("#fMoneda", "ARS");
    setVal("#fEstadoDisco", ""); setVal("#fEstadoCaja", ""); setVal("#fEstadoFolleto", ""); setVal("#fEstadoArte", "");
    setVal("#fPrestadoA", ""); setVal("#fFechaPrestamo", ""); setVal("#fFechaDevolucion", ""); setVal("#fNotasPrestamo", "");
    loanBanner.style.display = "none";
    CustomFields.renderInModal({});
  }
  $("#modal").classList.add("open");
  setTimeout(() => $("#fTitulo").focus(), 80);
}
function cerrarModal(){
  if (_enrichTimer){ clearTimeout(_enrichTimer); _enrichTimer = null; }
  _enrichRequestId++;
  $("#modal").classList.remove("open");
  App.editing = null;
  _cdSaving = false;
  const sb = $("#btnSave"), sn = $("#btnSaveAndNew");
  if (sb) sb.disabled = false;
  if (sn) sn.disabled = false;
}
function validarForm(){
  clearValidation(); let ok = true, tt = null;
  const nro = parseInt(getVal("#fNro"), 10);
  const t = getVal("#fTitulo").trim(); const i = getVal("#fInterprete").trim();
  const a = getVal("#fAnio").trim(); const v = getVal("#fValor").trim(); const isr = getVal("#fISRC").trim().toUpperCase();
  if (!Number.isFinite(nro) || nro < 1){ $("#wrapNro").classList.add("invalid"); ok = false; }
  if (!t){ $("#wrapTitulo").classList.add("invalid"); ok = false; }
  if (!i){ $("#wrapInterprete").classList.add("invalid"); ok = false; }
  if (a !== ""){ const n = parseInt(a); if (isNaN(n) || n < 1900 || n > 2100){ $("#wrapAnio").classList.add("invalid"); ok = false; } }
  const aE = getVal("#fAnioEdicion").trim();
  if (aE !== ""){ const n = parseInt(aE); if (isNaN(n) || n < 1900 || n > 2100){ $("#wrapAnioEdicion").classList.add("invalid"); ok = false; tt = tt || "edicion"; } }
  if (v !== ""){ const n = Number(v); if (!Number.isFinite(n) || n < 0){ $("#wrapValor").classList.add("invalid"); ok = false; tt = "ubicacion"; } }
  if (isr !== "" && !ISRC_REGEX.test(isr)){ $("#wrapISRC").classList.add("invalid"); ok = false; tt = tt || "edicion"; }
  if (tt) switchModalTab(tt);
  return ok;
}
function guardarCD(e){
  if (e) e.preventDefault();
  if (_cdSaving) return false;
  if (!validarForm()){ Toast.show("Revisá los campos marcados", "err"); return false; }
  const cat = getVal("#fCat"); if (!Store.get(cat)){ Toast.show("Categoría inexistente", "err"); return false; }
  _cdSaving = true;
  const saveBtn = $("#btnSave"), saveNewBtn = $("#btnSaveAndNew");
  if (saveBtn){ saveBtn.disabled = true; }
  if (saveNewBtn){ saveNewBtn.disabled = true; }
  const unlockCD = () => {
    _cdSaving = false;
    if (saveBtn) saveBtn.disabled = false;
    if (saveNewBtn) saveNewBtn.disabled = false;
  };
  const nro = parseInt(getVal("#fNro"), 10);
  const aRaw = getVal("#fAnio").trim(); const vRaw = getVal("#fValor").trim(); const cov = $("#fCoverUrl").value.trim(); const isr = getVal("#fISRC").trim().toUpperCase();
  let valor = null; if (vRaw !== ""){ const n = Number(vRaw); if (Number.isFinite(n) && n >= 0) valor = n; }
  const data = {
    nro,
    titulo: upper(getVal("#fTitulo").trim()),
    interprete: upper(getVal("#fInterprete").trim()),
    anio: aRaw === "" ? null : parseInt(aRaw),
    anioEdicion: (() => { const e2 = getVal("#fAnioEdicion").trim(); if (e2 === "") return null; const n = parseInt(e2); return (Number.isFinite(n) && n >= 1900 && n <= 2100) ? n : null; })(),
    formato: getVal("#fFormato") || "CD", estado: getVal("#fEstado") || "Excelente",
    estadoDisco: getVal("#fEstadoDisco") || "", estadoCaja: getVal("#fEstadoCaja") || "",
    estadoFolleto: getVal("#fEstadoFolleto") || "", estadoArte: getVal("#fEstadoArte") || "",
    sello: upper(getVal("#fSello").trim()), genero: upper(getVal("#fGenero").trim()),
    catalogo: upper(getVal("#fCatalogo").trim()), codigo: upper(getVal("#fCodigo").trim()), isrc: isr,
    edicion: upper(getVal("#fEdicion").trim()), pais: upper(getVal("#fPais").trim()),
    ubicacion: upper(getVal("#fUbicacion").trim()), cantidad: Math.max(1, parseInt(getVal("#fCantidad")) || 1),
    adquisicion: getVal("#fAdquisicion") || "", valor, moneda: getVal("#fMoneda") || "ARS",
    notas: getVal("#fNotas").trim(), portada: cov || null,
    enrichmentSource: $("#fCoverUrl")?.dataset.enrichmentSource || null,
    enrichmentConfidence: $("#fCoverUrl")?.dataset.enrichmentConfidence ? Number($("#fCoverUrl").dataset.enrichmentConfidence) : null,
    enrichedAt: $("#fCoverUrl")?.dataset.enrichedAt || null,
    prestadoA: upper(getVal("#fPrestadoA").trim()), fechaPrestamo: getVal("#fFechaPrestamo") || "",
    fechaDevolucion: getVal("#fFechaDevolucion") || "", notasPrestamo: upper(getVal("#fNotasPrestamo").trim()),
    customFields: CustomFields.readFromModal(),
    subcat: getVal("#fSubcat") || null,
    links: (() => { try { const l = JSON.parse($("#fLinks").value || '{}'); return (l && typeof l === 'object' && !Array.isArray(l)) ? l : {}; } catch(e){ return {}; } })()
  };
  const wE = !!App.editing; const before = snapshotAll();
  if (wE){
    const oCat = App.editing.cat; const oList = Store.getCDs(oCat); const idx = oList.indexOf(App.editing.original);
    if (idx === -1){ Toast.show("No se encontró el original", "err"); cerrarModal(); unlockCD(); return false; }
    const oData = oList[idx];
    const cProv = { ...(oData.provenance || {}) };
    if (data.portada && data.enrichmentSource){ cProv.portada = makeProvenance(data.enrichmentSource, data.enrichmentConfidence); }
    const merged = { ...oData, ...data, provenance: cProv };
    if (oCat === cat){
      const dup = oList.findIndex((c, i2) => i2 !== idx && c.nro === nro);
      if (dup !== -1 && !confirm(`Ya existe Nº ${nro}. ¿Continuar?`)){ unlockCD(); return false; }
      oList[idx] = merged;
      HistoryLog.log('EDIT', `CD editado: ${data.titulo}`, data.interprete);
      Toast.show("CD actualizado", "ok");
    } else {
      const tList = Store.getCDs(cat); let fNro = nro;
      if (tList.some(c => c.nro === fNro)){ const mx = tList.reduce((m, c) => Math.max(m, c.nro || 0), 0); const sug = mx + 1; if (!confirm(`Nº ${fNro} ocupado. ¿Usar ${sug}?`)){ unlockCD(); return false; } fNro = sug; }
      merged.nro = fNro;
      const oKey = `${oCat}|${oData.id}`; const nKey = `${cat}|${merged.id}`;
      oList.splice(idx, 1); tList.push(merged);
      if (App.selected.has(oKey)){ App.selected.delete(oKey); App.selected.add(nKey); }
      if (App.focusedKey === oKey) App.focusedKey = nKey;
      if (App.cat !== ALL_CATS) App.cat = cat;
      App.artista = null;
      HistoryLog.log('EDIT', `CD movido: ${data.titulo}`, `${oCat} → ${cat}`);
      Toast.show(`Movido a "${Store.get(cat).label}" · Nº ${fNro}`, "ok", 3800);
    }
    Undo.push(oCat === cat ? "editar CD" : "mover CD", () => restoreAll(before));
  } else {
    const list = Store.getCDs(cat);
    if (list.some(c => c.nro === nro) && !confirm(`Ya existe Nº ${nro}. ¿Agregar?`)){ unlockCD(); return false; }
    const nuevo = Store.hydrate(data);
    if (data.portada && data.enrichmentSource){ nuevo.provenance = { portada: makeProvenance(data.enrichmentSource, data.enrichmentConfidence) }; }
    list.push(nuevo);
    Undo.push("agregar CD", () => restoreAll(before));
    HistoryLog.log('CREATE', `CD agregado: ${data.titulo}`, data.interprete);
    Toast.show("CD agregado a " + Store.get(cat).label, "ok");
  }
  Store.persist(); cerrarModal(); renderTabs(); renderAll();
  AutoBackup.markChange(wE ? "edición de CD" : "nuevo CD");
  return true;
}
function eliminarCD(cd){
  if (!confirm(`¿Eliminar?\n\nNº ${cd.nro}\n"${cd.titulo}"\n${cd.interprete}`)) return;
  const cat = (App.cat === ALL_CATS) ? findCategoryOfCD(cd) : App.cat;
  if (!cat){ Toast.show("No se pudo determinar la categoría", "err"); return; }
  const list = Store.getCDs(cat); const before = JSON.stringify(list);
  const idx = list.indexOf(cd); if (idx === -1) return;
  list.splice(idx, 1);
  Undo.push("eliminar CD", () => { const a = Store.getCDs(cat); a.length = 0; JSON.parse(before).forEach(x => a.push(x)); Store.persist(); renderTabs(); renderAll(); });
  Store.persist(); renderTabs(); renderAll();
  HistoryLog.log('DELETE', `CD eliminado: ${cd.titulo}`, cd.interprete);
  AutoBackup.markChange("eliminación CD");
  Toast.show("CD eliminado", "warn");
}

/* ═══════════════════════════════════════════════════════════════════
   Exportaciones
   ═══════════════════════════════════════════════════════════════════ */

async function exportFullJSON(){
  const o = OwnerConfig.get();
  const pl = { version: 5, appVersion: APP_VERSION, exported: new Date().toISOString(), owner: o.name || DEFAULT_AUTHOR, contact: OwnerConfig.contactLine() || DEFAULT_PHONE, categories: {} };
  for (const k of Store.catKeys()){ const c = Store.get(k); pl.categories[k] = { label: c.label, icon: c.icon, subcategories: c.subcategories || [], cds: c.cds }; }
  await saveOrDownload(`discografia_v${APP_VERSION}_backup_${timestamp()}.json`, JSON.stringify(pl, null, 2));
  HistoryLog.log('EXPORT', `Backup JSON completo`, `${Store.total()} CDs`);
}
async function exportCatJSON(){
  if (!App.cat || App.cat === ALL_CATS){ Toast.show(App.cat === ALL_CATS ? "Elegí una categoría (no 'Todas')" : "Sin categoría activa", "warn"); return; }
  const c = Store.get(App.cat);
  await saveOrDownload(`discografia_${App.cat}_${timestamp()}.json`, JSON.stringify({ version: 5, appVersion: APP_VERSION, exported: new Date().toISOString(), category: App.cat, label: c.label, icon: c.icon, subcategories: c.subcategories || [], cds: c.cds }, null, 2));
}
async function exportCatCSV(){
  if (!App.cat){ Toast.show("Sin categoría activa", "warn"); return; }
  const sep = ";";
  const e = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
  const cfAll = CustomFields.getAll();
  const lkCols = STREAMING_SERVICES.map(s => s.key);
  const baseHeaders = ["ID","Nro","Título","Intérprete","Año","Año edición","Formato","Estado","EstadoDisco","EstadoCaja","EstadoFolleto","EstadoArte","Sello","Género","Nº catálogo","Código de barras","ISRC","Edición","País","Ubicación","Cantidad","Fecha ingreso","Valor","Moneda","Observaciones","Portada","Fuente enriquecimiento","Confianza","Fecha enriquecimiento","PrestadoA","FechaPrestamo","FechaDevolucion","NotasPrestamo","Subcategoría"];
  const headers = [...baseHeaders, ...lkCols, ...cfAll.map(f => f.name)];
  const rows = [headers.join(sep)];
  const source = getFiltered();
  const catObj = App.cat !== ALL_CATS ? Store.get(App.cat) : null;
  for (const cd of source){
    const cf = cd.customFields || {};
    const links = cd.links || {};
    const subLabel = cd.subcat && catObj ? (catObj.subcategories?.find(s => s.id === cd.subcat)?.label || "") : "";
    rows.push([cd.id ?? "", cd.nro, cd.titulo, cd.interprete, cd.anio ?? "", cd.anioEdicion ?? "", cd.formato ?? "CD", cd.estado ?? "Excelente", cd.estadoDisco ?? "", cd.estadoCaja ?? "", cd.estadoFolleto ?? "", cd.estadoArte ?? "", cd.sello ?? "", cd.genero ?? "", cd.catalogo ?? "", cd.codigo ?? "", cd.isrc ?? "", cd.edicion ?? "", cd.pais ?? "", cd.ubicacion ?? "", cd.cantidad ?? 1, cd.adquisicion ?? "", cd.valor ?? "", cd.moneda ?? "ARS", cd.notas ?? "", cd.portada ?? "", cd.enrichmentSource ?? "", cd.enrichmentConfidence ?? "", cd.enrichedAt ?? "", cd.prestadoA ?? "", cd.fechaPrestamo ?? "", cd.fechaDevolucion ?? "", cd.notasPrestamo ?? "", subLabel, ...lkCols.map(k => links[k] ?? ""), ...cfAll.map(f => cf[f.id] ?? "")].map(e).join(sep));
  }
  const nm = (App.cat === ALL_CATS) ? "todas_las_categorias" : App.cat;
  await saveOrDownload(`discografia_${nm}_${timestamp()}.csv`, "\uFEFF" + rows.join("\r\n"), "text/csv");
}
async function exportCatMarkdown(){
  if (!App.cat){ Toast.show("Sin categoría activa", "warn"); return; }
  const c = (App.cat === ALL_CATS) ? { label: "Todas las categorías", icon: "🗂️" } : Store.get(App.cat);
  const cds = getFiltered();
  const lines = [`# ${c.icon} ${c.label}`, ``, `Total: **${cds.length}**`, ``, `| Nº | Título | Intérprete | Año | Portada |`, `|---:|---|---|---:|---|`];
  for (const cd of cds){ const s = v => String(v ?? "").replace(/\|/g, "\\|"); lines.push(`| ${cd.nro} | ${s(cd.titulo)} | ${s(cd.interprete)} | ${cd.anio ?? "—"} | ${cd.portada ? "✅" : "—"} |`); }
  const nm = (App.cat === ALL_CATS) ? "todas" : App.cat;
  await saveOrDownload(`discografia_${nm}_${timestamp()}.md`, lines.join("\n"), "text/markdown");
}
async function exportCatPDF(){
  if (!App.cat){ Toast.show("Sin categoría activa", "warn"); return; }
  const c = (App.cat === ALL_CATS) ? { label: "Todas las categorías", icon: "🗂️" } : Store.get(App.cat);
  const cds = sortCDs(getFiltered());
  const o = OwnerConfig.get(); const now = new Date().toLocaleString('es-AR');
  const win = window.open('', '_blank');
  if (!win){ Toast.show('Permitir popups para PDF', 'warn', 5000); return; }
  const rows = cds.map(cd => `<tr><td>${cd.nro}</td><td>${cd.portada ? `<img src="${esc(cd.portada)}" style="width:50px;height:50px;object-fit:cover;border-radius:4px">` : ''}</td><td>${esc(cd.titulo)}</td><td>${esc(cd.interprete)}</td><td>${cd.anio ?? '—'}</td><td>${cd.anioEdicion ?? '—'}</td><td>${esc(cd.formato || 'CD')}</td><td>${esc(cd.sello || '—')}</td><td>${cd.valor != null ? `${cd.moneda || 'ARS'} ${Number(cd.valor).toLocaleString('es-AR')}` : '—'}</td></tr>`).join('');
  const tV = cds.reduce((s, cd) => { const cn = Math.max(1, parseInt(cd.cantidad) || 1); return s + (cd.valor != null ? Number(cd.valor) * cn : 0); }, 0);
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(c.icon)} ${esc(c.label)} — Discografía</title><style>*{box-sizing:border-box}body{font-family:'Segoe UI',Roboto,sans-serif;padding:24px;color:#1a2332}h1{margin:0 0 4px;font-size:1.6rem}h2{margin:0 0 20px;font-size:1.1rem;color:#666;font-weight:500}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1976d2;padding-bottom:14px;margin-bottom:18px}.header .meta{text-align:right;font-size:.82rem;color:#666;line-height:1.6}.summary{display:flex;gap:20px;margin-bottom:18px;font-size:.85rem}.summary div{padding:8px 14px;background:#f5f7fa;border-radius:8px}.summary b{color:#1976d2}table{width:100%;border-collapse:collapse;font-size:.82rem}th{background:#f0f3f7;padding:9px 8px;text-align:left;border-bottom:1px solid #d5dde7;font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;color:#4a5568}td{padding:8px;border-bottom:1px solid #eee;vertical-align:middle}tr:nth-child(even) td{background:#fafbfc}.footer{margin-top:24px;padding-top:14px;border-top:1px solid #ddd;font-size:.75rem;color:#888;text-align:center}@media print{body{padding:0}thead{display:table-header-group}tr{page-break-inside:avoid}}</style></head><body><div class="header"><div><h1>${esc(c.icon)} ${esc(c.label)}</h1><h2>Discografía v${APP_VERSION} — ${esc(o.name || DEFAULT_AUTHOR)}</h2></div><div class="meta">${esc(OwnerConfig.contactLine() || DEFAULT_PHONE)}<br>Generado: ${esc(now)}</div></div><div class="summary"><div>Total: <b>${cds.length}</b> CDs</div>${tV > 0 ? `<div>Valor total: <b>$${tV.toLocaleString('es-AR', {maximumFractionDigits: 0})}</b></div>` : ''}</div><table><thead><tr><th style="width:50px">Nº</th><th style="width:60px">Portada</th><th>Título</th><th>Intérprete</th><th style="width:60px">Año</th><th style="width:60px">Año ed.</th><th style="width:70px">Formato</th><th>Sello</th><th style="width:90px">Valor</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Discografía v${APP_VERSION} — ${esc(o.name || DEFAULT_AUTHOR)} — ${esc(COPYRIGHT_TEXT)}</div><script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  win.document.close();
  HistoryLog.log('EXPORT', `PDF: ${c.label}`, `${cds.length} CDs`);
}

/* ═══════════════════════════════════════════════════════════════════
   Importar
   ═══════════════════════════════════════════════════════════════════ */

function detectDelimiter(t){ const f = String(t).split(/\r?\n/)[0] || ""; return (f.match(/;/g) || []).length >= (f.match(/,/g) || []).length ? ";" : ","; }
function parseCSV(text, delim){
  const d = delim || detectDelimiter(text);
  const rows = []; let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i], n = text[i+1];
    if (inQ){ if (c === '"' && n === '"'){ cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; }
    else { if (c === '"') inQ = true; else if (c === d){ row.push(cur); cur = ""; } else if (c === '\n'){ row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === '\r'){} else cur += c; }
  }
  if (cur !== "" || row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}
function importCSV(file, text){
  if (!App.cat || App.cat === ALL_CATS){ Toast.show("Elegí una categoría primero (no 'Todas')", "warn"); return; }
  const rows = parseCSV(text);
  if (rows.length < 2){ Toast.show("CSV vacío o inválido", "err"); return; }
  const nh = h => String(h || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  const header = rows[0].map(nh);
  const find = (...a) => header.findIndex(h => a.some(x => h === x || h.includes(x)));
  const linkIdx = {};
  for (const svc of STREAMING_SERVICES){ linkIdx[svc.key] = find(svc.key, svc.name.toLowerCase()); }
  const subcatIdx = find("subcategoria", "subcategory");
  const idx = { id: find("id","uuid"), nro: find("nro","numero"), titulo: find("titulo","title","album"), interprete: find("interprete","artista","artist"), anio: find("ano","year"), anioEdicion: find("ano edicion","year edition","edition year"), formato: find("formato","format"), estado: find("estado","condition"), estadoDisco: find("estadodisco"), estadoCaja: find("estadocaja"), estadoFolleto: find("estadofolleto"), estadoArte: find("estadoarte"), sello: find("sello","label"), genero: find("genero","genre"), catalogo: find("catalogo","catno"), codigo: find("codigo","barcode"), isrc: find("isrc"), edicion: find("edicion"), pais: find("pais"), ubicacion: find("ubicacion"), cantidad: find("cantidad"), adquisicion: find("adquisicion"), valor: find("valor","value"), moneda: find("moneda","currency"), notas: find("notas"), portada: find("portada","cover"), prestadoA: find("prestadoa"), fechaPrestamo: find("fechaprestamo"), fechaDevolucion: find("fechadevolucion"), notasPrestamo: find("notasprestamo") };
  const catObj = Store.get(App.cat);
  function resolveSubId(label){
    if (!label || !catObj) return null;
    const clean = String(label).trim().toLowerCase();
    const sub = (catObj.subcategories || []).find(s => s.label.toLowerCase() === clean);
    return sub ? sub.id : null;
  }
  const nuevos = rows.slice(1).map(r => {
    const g = i => i >= 0 ? (r[i] || "").trim() : "";
    const aRaw = g(idx.anio); const eRaw = g(idx.anioEdicion); const vRaw = g(idx.valor); const rNro = parseInt(g(idx.nro), 10);
    let valor = null; if (vRaw !== ""){ const v = Number(vRaw); if (Number.isFinite(v) && v >= 0) valor = v; }
    const links = {};
    for (const svc of STREAMING_SERVICES){ const v = g(linkIdx[svc.key]); if (v) links[svc.key] = v; }
    const subcatId = resolveSubId(g(subcatIdx));
    return Store.hydrate({ id: g(idx.id) || undefined, links, subcat: subcatId, nro: Number.isFinite(rNro) && rNro >= 1 ? rNro : 0, titulo: upper(g(idx.titulo)), interprete: upper(g(idx.interprete)), anio: aRaw === "" ? null : parseInt(aRaw), anioEdicion: eRaw === "" ? null : parseInt(eRaw), formato: g(idx.formato) || "CD", estado: g(idx.estado) || "Excelente", estadoDisco: g(idx.estadoDisco), estadoCaja: g(idx.estadoCaja), estadoFolleto: g(idx.estadoFolleto), estadoArte: g(idx.estadoArte), sello: upper(g(idx.sello)), genero: upper(g(idx.genero)), catalogo: upper(g(idx.catalogo)), codigo: upper(g(idx.codigo)), isrc: g(idx.isrc), edicion: upper(g(idx.edicion)), pais: upper(g(idx.pais)), ubicacion: upper(g(idx.ubicacion)), cantidad: parseInt(g(idx.cantidad)) || 1, adquisicion: g(idx.adquisicion), valor, moneda: g(idx.moneda) || "ARS", notas: g(idx.notas), portada: g(idx.portada) || null, prestadoA: upper(g(idx.prestadoA)), fechaPrestamo: g(idx.fechaPrestamo), fechaDevolucion: g(idx.fechaDevolucion), notasPrestamo: upper(g(idx.notasPrestamo)) });
  }).filter(c => c.titulo || c.interprete);
  if (!nuevos.length){ Toast.show("No se encontraron CDs", "err"); return; }
  const modo = confirm(`CSV con ${nuevos.length} CDs.\n\n• Aceptar: REEMPLAZAR.\n• Cancelar: AGREGAR.`);
  const list = Store.getCDs(App.cat); const before = JSON.stringify(list);
  if (modo){ list.length = 0; nuevos.forEach(c => list.push(c)); }
  else { let mx = list.reduce((m, c) => Math.max(m, c.nro || 0), 0); for (const cd of nuevos){ if (!cd.nro || cd.nro <= mx) cd.nro = ++mx; else mx = cd.nro; list.push(cd); } }
  Undo.push("importar CSV", () => { const a = Store.getCDs(App.cat); a.length = 0; JSON.parse(before).forEach(x => a.push(x)); Store.persist(); renderTabs(); renderAll(); });
  Store.persist(); renderTabs(); renderAll();
  HistoryLog.log('IMPORT', `CSV importado`, `${nuevos.length} CDs`);
  AutoBackup.markChange("importación CSV");
  Toast.show(`Importados ${nuevos.length} CDs`, "ok");
}
function importFile(file){
  if (!file){ Toast.show("No se recibió archivo", "err"); return; }
  const ext = (file.name || "").toLowerCase().split(".").pop();
  if (ext !== "json" && ext !== "csv"){ if (!confirm(`"${file.name}" no es .json ni .csv. ¿Intentar como JSON?`)) return; }
  const reader = new FileReader();
  reader.onerror = () => Toast.show("No se pudo leer", "err", 9000);
  reader.onload = (e) => {
    const text = String(e.target.result || "");
    if (!text.trim()){ Toast.show("Archivo vacío", "err"); return; }
    if (ext === "csv"){ try { importCSV(file, text); } catch(err){ Toast.show("Error CSV: " + err.message, "err", 6000); } return; }
    const clean = text.replace(/^\uFEFF/, "");
    try { const data = JSON.parse(clean); procesarImportJSON(data); }
    catch(err){ Toast.show("JSON inválido: " + err.message, "err", 9000); }
  };
  try { reader.readAsText(file, "utf-8"); } catch(err){ Toast.show("Error: " + err.message, "err", 6000); }
}
function procesarImportJSON(data){
  if (data && data.categories && typeof data.categories === "object"){
    const cn = Object.keys(data.categories);
    const tc = Object.values(data.categories).reduce((s, c) => s + (c.cds?.length || 0), 0);
    if (!confirm(`Backup COMPLETO.\n\nCategorías: ${cn.length}\nCDs: ${tc}\n\n¿REEMPLAZAR toda la base?`)) return;
    const before = JSON.stringify(Store.categories());
    Store.replaceAll(data); NotFoundList.clear();
    Undo.push("importar backup", () => { Store.replaceAll({ categories: JSON.parse(before) }); ensureValidCat(); renderTabs(); renderAll(); });
    App.artista = null; App.q = ""; App.selected.clear(); App.focusedKey = null; App.subcat = null;
    $("#q").value = ""; $("#searchBox").classList.remove("has-value");
    ensureValidCat(); renderTabs(); renderAll();
    HistoryLog.log('IMPORT', 'Backup importado', `${tc} CDs en ${cn.length} categorías`);
    AutoBackup.markChange("importación backup");
    Toast.show(`Backup importado: ${tc} CDs`, "ok", 4000);
    return;
  }
  if (data && Array.isArray(data.cds)){
    let cat = data.category;
    if (!cat || !Store.get(cat)){ if (!confirm(`¿Crear categoría "${data.label || data.category || 'nueva'}"?`)) return; cat = Store.addCategory({ label: data.label || data.category || "Importada", icon: data.icon || "📀" }); App.cat = cat; }
    const modo = confirm(`Categoría: ${Store.get(cat).label}\nCDs: ${data.cds.length}\n\n• Aceptar: REEMPLAZAR.\n• Cancelar: AGREGAR.`);
    const list = Store.getCDs(cat); const before = JSON.stringify(list); const nuevos = data.cds.map(Store.hydrate);
    if (modo){ list.length = 0; nuevos.forEach(c => list.push(c)); }
    else { let mx = list.reduce((m, c) => Math.max(m, c.nro || 0), 0); for (const cd of nuevos){ if (!cd.nro || cd.nro <= mx) cd.nro = ++mx; else mx = cd.nro; list.push(cd); } }
    Undo.push("importar categoría", () => { const a = Store.getCDs(cat); a.length = 0; JSON.parse(before).forEach(x => a.push(x)); Store.persist(); renderTabs(); renderAll(); });
    Store.persist(); App.cat = cat; App.artista = null;
    ensureValidCat(); renderTabs(); renderAll();
    HistoryLog.log('IMPORT', `Categoría importada`, `${nuevos.length} CDs`);
    AutoBackup.markChange("importación categoría");
    Toast.show("Categoría importada", "ok");
    return;
  }
  if (Array.isArray(data)){
    if (!App.cat || App.cat === ALL_CATS){ Toast.show("Elegí una categoría primero", "warn"); return; }
    const modo = confirm(`Array de ${data.length} CDs.\n\n• Aceptar: REEMPLAZAR.\n• Cancelar: AGREGAR.`);
    const list = Store.getCDs(App.cat); const before = JSON.stringify(list); const nuevos = data.map(Store.hydrate);
    if (modo){ list.length = 0; nuevos.forEach(c => list.push(c)); }
    else { let mx = list.reduce((m, c) => Math.max(m, c.nro || 0), 0); for (const cd of nuevos){ if (!cd.nro || cd.nro <= mx) cd.nro = ++mx; else mx = cd.nro; list.push(cd); } }
    Undo.push("importar array", () => { const a = Store.getCDs(App.cat); a.length = 0; JSON.parse(before).forEach(x => a.push(x)); Store.persist(); renderTabs(); renderAll(); });
    Store.persist(); renderTabs(); renderAll();
    HistoryLog.log('IMPORT', `Array importado`, `${nuevos.length} CDs`);
    AutoBackup.markChange("importación array");
    Toast.show("Importación completada", "ok");
    return;
  }
  Toast.show("Formato no reconocido", "err", 6000);
}
function importarDesdeTexto(t){
  const clean = String(t || "").trim().replace(/^\uFEFF/, "");
  if (!clean){ Toast.show("Pegá el contenido primero", "warn"); return false; }
  try { const data = JSON.parse(clean); procesarImportJSON(data); return true; }
  catch(err){ Toast.show("JSON inválido: " + err.message, "err", 7000); return false; }
}

/* ═══════════════════════════════════════════════════════════════════
   Bulk — acciones sobre selección
   ═══════════════════════════════════════════════════════════════════ */

function bulkDelete(){
  const keys = [...App.selected]; if (!keys.length) return;
  if (!confirm(`¿Eliminar ${keys.length} CDs?`)) return;
  const snap = snapshotAll(); let rem = 0;
  for (const k of keys){ const { cat, id } = parseCDKey(k); const l = Store.getCDs(cat); const i = l.findIndex(c => c.id === id); if (i !== -1){ l.splice(i, 1); rem++; } }
  App.selected.clear();
  Undo.push("eliminar seleccionados", () => restoreAll(snap));
  Store.persist(); renderTabs(); renderAll();
  HistoryLog.log('DELETE', `Eliminación masiva`, `${rem} CDs`);
  AutoBackup.markChange("eliminación masiva");
  Toast.show(`Eliminados ${rem} CDs`, "warn");
}
function bulkSetEstado(){
  const keys = [...App.selected]; if (!keys.length) return;
  const e = prompt("Nuevo estado:", "Excelente"); if (!e) return;
  const snap = snapshotAll();
  for (const k of keys){ const { cat, id } = parseCDKey(k); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd) cd.estado = e; }
  Undo.push("estado masivo", () => restoreAll(snap));
  Store.persist(); renderAll();
  HistoryLog.log('EDIT', `Estado masivo`, `${keys.length} CDs → ${e}`);
  AutoBackup.markChange("actualización masiva estado");
  Toast.show(`Actualizado en ${keys.length} CDs`, "ok");
}
function bulkSetUbicacion(){
  const keys = [...App.selected]; if (!keys.length) return;
  const u = prompt("Nueva ubicación:"); if (u === null) return;
  const snap = snapshotAll();
  for (const k of keys){ const { cat, id } = parseCDKey(k); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd) cd.ubicacion = upper(u); }
  Undo.push("ubicación masiva", () => restoreAll(snap));
  Store.persist(); renderAll();
  HistoryLog.log('EDIT', `Ubicación masiva`, `${keys.length} CDs → ${upper(u)}`);
  AutoBackup.markChange("actualización masiva ubicación");
  Toast.show(`Actualizado en ${keys.length} CDs`, "ok");
}
let _bulkMoveTarget = null;
function bulkMoveCategoria(){
  const keys = [...App.selected]; if (!keys.length){ Toast.show("Seleccioná al menos uno", "warn"); return; }
  const ck = Store.catKeys();
  if (ck.length < 2){ Toast.show("Necesitás al menos 2 categorías", "warn"); return; }
  _bulkMoveTarget = null;
  $("#bulkMoveCount").textContent = keys.length; $("#bulkMoveKeepNro").checked = false; $("#bulkMovePreview").style.display = "none"; $("#bulkMoveConfirm").disabled = true;
  const list = $("#bulkMoveCatList"); list.innerHTML = "";
  const current = new Set(keys.map(k => parseCDKey(k).cat));
  for (const k of ck){
    const cat = Store.get(k); const isCur = current.size === 1 && current.has(k);
    const it = document.createElement("button"); it.type = "button"; it.className = "bulk-move-item"; it.disabled = isCur;
    it.innerHTML = `<span style="font-size:1.3rem">${esc(cat.icon)}</span><span style="flex:1;min-width:0"><span style="display:block;font-weight:600">${esc(cat.label)}</span><span style="display:block;font-size:.7rem;color:var(--muted);margin-top:2px">${cat.cds.length} CD${cat.cds.length === 1 ? "" : "s"}${isCur ? " · (actual)" : ""}</span></span><span class="bulk-move-check" style="width:18px;height:18px;border-radius:50%;border:2px solid var(--line);flex:0 0 auto;transition:.15s"></span>`;
    if (!isCur){ it.addEventListener("click", () => selectBulkMoveTarget(k)); }
    list.appendChild(it);
  }
  $("#bulkMoveModal").classList.add("open");
}
function selectBulkMoveTarget(k){
  _bulkMoveTarget = k;
  const list = $("#bulkMoveCatList");
  const items = [...list.querySelectorAll(".bulk-move-item")];
  const ck = Store.catKeys();
  items.forEach((el, i) => {
    const kk = ck[i]; const sel = kk === k; if (el.disabled) return;
    el.style.borderColor = sel ? "var(--accent)" : "var(--line)";
    el.style.background = sel ? "rgba(79,195,247,.12)" : "rgba(255,255,255,.02)";
    el.style.color = sel ? "var(--accent)" : "var(--txt)";
    const c = el.querySelector(".bulk-move-check");
    if (c){ c.style.borderColor = sel ? "var(--accent)" : "var(--line)"; c.style.background = sel ? "var(--accent)" : "transparent"; c.style.boxShadow = sel ? "inset 0 0 0 3px var(--bg2)" : "none"; }
  });
  $("#bulkMoveConfirm").disabled = false;
  renderBulkMovePreview();
}
function renderBulkMovePreview(){
  const prev = $("#bulkMovePreview"); if (!_bulkMoveTarget){ prev.style.display = "none"; return; }
  const keys = [...App.selected]; const tc = Store.get(_bulkMoveTarget);
  const keepN = $("#bulkMoveKeepNro").checked;
  const tl = Store.getCDs(_bulkMoveTarget);
  const used = new Set(tl.map(c => c.nro));
  let mx = tl.reduce((m, c) => Math.max(m, c.nro || 0), 0);
  const asg = [];
  for (const k of keys){
    const { cat, id } = parseCDKey(k); if (cat === _bulkMoveTarget) continue;
    const cd = Store.getCDs(cat).find(c => c.id === id); if (!cd) continue;
    let nn; if (keepN){ nn = cd.nro; if (used.has(nn)) nn = ++mx; else mx = Math.max(mx, nn); } else nn = ++mx;
    used.add(nn); asg.push({ titulo: cd.titulo, oldNro: cd.nro, newNro: nn });
  }
  if (!asg.length){ prev.style.display = "none"; return; }
  const shown = asg.slice(0, 6); const more = asg.length - shown.length;
  prev.style.display = "block";
  prev.innerHTML = `<div style="font-weight:600;color:var(--txt);margin-bottom:8px">Se moverán <b style="color:var(--accent)">${asg.length}</b> CDs a <b style="color:var(--accent)">${esc(tc.icon)} ${esc(tc.label)}</b></div><div style="display:flex;flex-direction:column;gap:4px;font-size:.78rem">${shown.map(a => `<div style="display:flex;gap:8px;align-items:center"><span style="color:var(--muted);font-variant-numeric:tabular-nums">#${a.oldNro}</span><span style="color:var(--line)">→</span><span style="color:var(--accent);font-variant-numeric:tabular-nums;font-weight:700">#${a.newNro}</span><span style="overflow:hidden;text-overflow:ellipsis">${esc(a.titulo)}</span></div>`).join('')}${more > 0 ? `<div style="color:var(--muted);font-style:italic;padding-top:4px">…y ${more} más</div>` : ''}</div>`;
}
function closeBulkMoveModal(){ $("#bulkMoveModal").classList.remove("open"); _bulkMoveTarget = null; }
function confirmBulkMove(){
  if (!_bulkMoveTarget){ Toast.show("Elegí categoría destino", "warn"); return; }
  const keys = [...App.selected]; const tc = _bulkMoveTarget; const keepN = $("#bulkMoveKeepNro").checked;
  const tl = Store.getCDs(tc); const snap = snapshotAll();
  const used = new Set(tl.map(c => c.nro)); let mx = tl.reduce((m, c) => Math.max(m, c.nro || 0), 0); let moved = 0;
  for (const k of keys){
    const { cat, id } = parseCDKey(k); if (cat === tc) continue;
    const l = Store.getCDs(cat); const i = l.findIndex(c => c.id === id); if (i === -1) continue;
    const cd = l[i]; l.splice(i, 1);
    let nn; if (keepN){ nn = cd.nro; if (used.has(nn)) nn = ++mx; else mx = Math.max(mx, nn); } else nn = ++mx;
    used.add(nn); cd.nro = nn; tl.push(cd); moved++;
  }
  App.selected.clear();
  Undo.push("mover CDs", () => restoreAll(snap));
  Store.persist(); renderTabs(); renderAll();
  HistoryLog.log('EDIT', `Movimiento masivo`, `${moved} CDs → ${Store.get(tc).label}`);
  AutoBackup.markChange("movimiento masivo");
  closeBulkMoveModal();
  if (moved === 0) Toast.show("Ningún CD fue movido", "warn");
  else Toast.show(`Movidos ${moved} CDs a "${Store.get(tc).label}"`, "ok", 3800);
}
let _bulkCoversRunning = false;
async function bulkFetchCovers(){
  if (_bulkCoversRunning){ Toast.show("Ya hay una búsqueda en curso", "warn"); return; }
  const keys = [...App.selected]; if (!keys.length) return;
  if (!confirm(`¿Buscar portadas para ${keys.length} CDs?`)) return;
  _bulkCoversRunning = true; const snap = snapshotAll();
  const bar = $("#selectionBar"); const orig = bar.innerHTML;
  let found = 0, nf = 0, al = 0, idx = 0; const total = keys.length;
  bar.innerHTML = `<span style="flex:1;display:flex;align-items:center;gap:10px"><span class="disc-loader"></span><b>🖼️ Buscando…</b> <span id="bulkCoverProgress">0/${total}</span></span><div style="width:200px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div id="bulkCoverBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--purple));transition:width .2s"></div></div><button type="button" class="btn danger" id="bulkCoverCancel">⏹️ Detener</button>`;
  let cancelled = false;
  const cb = $("#bulkCoverCancel"); if (cb) cb.addEventListener("click", () => { cancelled = true; cb.disabled = true; cb.textContent = "Deteniendo…"; });
  try {
    for (const k of keys){
      if (cancelled) break; if (!$("#bulkCoverProgress")) break;
      idx++;
      const { cat, id } = parseCDKey(k); const cd = Store.getCDs(cat).find(c => c.id === id);
      const pe = $("#bulkCoverProgress"); if (pe) pe.textContent = `${idx}/${total}`;
      const be = $("#bulkCoverBar"); if (be) be.style.width = `${idx/total*100}%`;
      if (!cd) continue;
      if (cd.portada){ al++; continue; }
      const rk = cdKey(cat, cd); const row = findRowByKey(rk);
      if (row && (App.cat === ALL_CATS || cat === App.cat)) row.classList.add("enriching");
      try {
        const info = await enrichFromChain(cd.titulo, cd.interprete, { hints: { anio: cd.anio, pais: cd.pais, sello: cd.sello, catalogo: cd.catalogo, barcode: cd.codigo } });
        if (info && info.portada){ cd.portada = info.portada; cd.portadaSource = info.portadaSource; cd.provenance = cd.provenance || {}; cd.provenance.portada = makeProvenance(info.source, info.confidence); found++; }
        else nf++;
      } catch(e){ nf++; }
      if (row && (App.cat === ALL_CATS || cat === App.cat)) row.classList.remove("enriching");
      await new Promise(r => setTimeout(r, 800));
    }
  } finally {
    Store.persist();
    Undo.push("buscar portadas", () => restoreAll(snap));
    bar.innerHTML = orig; attachSelectionBarEvents();
    renderTabs(); renderAll();
    HistoryLog.log('ENRICH', `Portadas masivas`, `${found} encontradas`);
    AutoBackup.markChange(`búsqueda masiva portadas (${found})`);
    if (cancelled) Toast.show(`Cancelado. ${found} encontradas · ${al} ya tenían · ${nf} sin resultados`, "warn", 6000);
    else Toast.show(`Portadas: ${found} · ${al} ya tenían · ${nf} sin resultados`, "ok", 6000);
    _bulkCoversRunning = false;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Modales auxiliares
   ═══════════════════════════════════════════════════════════════════ */

function abrirPasteModal(){ $("#pasteArea").value = ""; $("#pasteModal").classList.add("open"); }
function cerrarPasteModal(){ $("#pasteModal").classList.remove("open"); }
async function abrirSelectorModerno(){
  if (!window.showOpenFilePicker){ Toast.show("Navegador sin soporte", "warn", 6000); return; }
  try {
    const opts = { multiple: false, types: [{ description: "Backup JSON o CSV", accept: { "application/json": [".json"], "text/csv": [".csv"] } }] };
    if (FileSystemDefault.isSet() && FileSystemDefault.isSupported()){ try { opts.startIn = FileSystemDefault.getHandle(); } catch(e){} }
    const [h] = await window.showOpenFilePicker(opts);
    const f = await h.getFile(); importFile(f);
  } catch(err){ if (err.name === "AbortError") return; Toast.show("Error: " + err.message, "err", 6000); }
}
async function importFromDefaultFolder(){
  if (!FileSystemDefault.isSet()){ Toast.show("Configurá una carpeta primero", "warn"); openFolderConfig(); return; }
  if (FileSystemDefault.getMode() === 'tauri'){
    await openFolderBrowser();
    Toast.show("Elegí el archivo de la lista y tocá 'Restaurar'", "info", 4500);
    return;
  }
  if (!FileSystemDefault.isSupported() || !window.showOpenFilePicker){ Toast.show("Navegador sin soporte", "warn", 5000); abrirSelectorModerno(); return; }
  try {
    const [h] = await window.showOpenFilePicker({ multiple: false, startIn: FileSystemDefault.getHandle(), types: [{ description: "Backup JSON o CSV", accept: { "application/json": [".json"], "text/csv": [".csv"] } }] });
    const f = await h.getFile(); importFile(f);
  } catch(err){ if (err.name === "AbortError") return; Toast.show("Error: " + err.message, "err", 6000); }
}
function switchManualSection(s){ $$("#manualNav button").forEach(b => b.classList.toggle("active", b.dataset.sec === s)); $$(".manual-section").forEach(x => x.classList.toggle("active", x.dataset.sec === s)); const c = $("#manualContent"); if (c) c.scrollTop = 0; }
function openOwnerConfig(){ const m = $("#ownerConfigModal"); if (!m) return; const o = OwnerConfig.get(); $("#ownerNameInput").value = o.name || ""; $("#ownerContactInput").value = o.contact || ""; $("#ownerEmailInput").value = o.email || ""; m.classList.add("open"); }
function closeOwnerConfig(){ $("#ownerConfigModal")?.classList.remove("open"); }
function openExitModal(){
  const st = $("#stTotal")?.textContent || "0";
  $("#exitTotal").textContent = st;
  const lastSaved = $("#fModified")?.textContent?.replace("· ", "") || "Sin datos";
  $("#exitLastSaved").textContent = lastSaved;
  $("#exitExportCheck").checked = false;
  $("#exitConfirm").disabled = true;
  $("#exitModal").classList.add("open");
}
function closeExitModal(){ $("#exitModal").classList.remove("open"); }

function attachSelectionBarEvents(){
  $("#btnSelCancel")?.addEventListener("click", () => {
    App.selected.clear();
    $$("#tbodyCD tr").forEach(tr => { tr.classList.remove("selected"); const cb = tr.querySelector("td.check input"); if (cb) cb.checked = false; });
    $("#checkAll").checked = false; $("#checkAll").indeterminate = false; updateSelectionBar();
    if (GridView.isEnabled()) GridView.render();
  });
  $("#btnSelEliminar")?.addEventListener("click", bulkDelete);
  $("#btnSelEstado")?.addEventListener("click", bulkSetEstado);
  $("#btnSelUbicacion")?.addEventListener("click", bulkSetUbicacion);
  $("#btnSelMover")?.addEventListener("click", bulkMoveCategoria);
  $("#btnSelCover")?.addEventListener("click", bulkFetchCovers);
}

/* ═══════════════════════════════════════════════════════════════════
   Eventos
   ═══════════════════════════════════════════════════════════════════ */

function bindEvents(){
  const q = $("#q"); const onS = debounce(() => { App.q = q.value; renderAll(); }, 140);
  q.addEventListener("input", () => {
    $("#searchBox").classList.toggle("has-value", q.value.length > 0);
    const badge = $("#advModeBadge");
    if (badge) badge.style.display = AdvancedSearch.isAdvanced(q.value) ? "" : "none";
    onS();
  });
  $("#clearQ").addEventListener("click", () => { q.value = ""; App.q = ""; $("#searchBox").classList.remove("has-value"); const b = $("#advModeBadge"); if (b) b.style.display = "none"; renderAll(); q.focus(); });
  $$("#tablaCD thead th[data-key]").forEach(th => { th.addEventListener("click", () => { const k = th.dataset.key; if (App.sortKey === k) App.sortDir *= -1; else { App.sortKey = k; App.sortDir = 1; } renderTabla(); }); });
  $("#btnNuevo").addEventListener("click", () => abrirModal("nuevo"));
  $("#btnNuevaCat").addEventListener("click", () => abrirModalCategoria("crear"));
  $("#btnNuevaCatEmpty")?.addEventListener("click", () => abrirModalCategoria("crear"));
  $("#btnVista").addEventListener("click", () => setView(App.view === "dashboard" ? "table" : "dashboard"));
  $("#btnUndo")?.addEventListener("click", () => Undo.pop());
  $("#btnGrid")?.addEventListener("click", () => GridView.setEnabled(!GridView.isEnabled()));
  $("#fabVerTodos")?.addEventListener("click", () => { App.artista = null; renderAll(); const t = $("#tableView"); if (t) t.scrollIntoView({behavior:"smooth",block:"start"}); Toast.show("Mostrando todos", "ok", 2000); });
  $("#artFilterClear")?.addEventListener("click", () => { App.artista = null; renderAll(); const t = $("#tableView"); if (t) t.scrollIntoView({behavior:"smooth",block:"start"}); Toast.show("Mostrando todos", "ok", 2000); });

  function updateArtSortBtn(){
    const btn = $("#btnArtSort"); if (!btn) return;
    const mode = Store.getPref('artSort', 'count');
    if (mode === 'alpha'){ btn.textContent = '🔤 A-Z'; btn.title = 'Clic para ordenar Z-A'; }
    else if (mode === 'alpha-desc'){ btn.textContent = '🔤 Z-A'; btn.title = 'Clic para ordenar por cantidad'; }
    else { btn.textContent = '🔢 Cantidad'; btn.title = 'Clic para ordenar A-Z'; }
  }
  updateArtSortBtn();
  $("#btnArtSort")?.addEventListener("click", () => {
    const cur = Store.getPref('artSort', 'count');
    const next = cur === 'count' ? 'alpha' : (cur === 'alpha' ? 'alpha-desc' : 'count');
    Store.setPref('artSort', next);
    updateArtSortBtn();
    renderArtistas();
    const msg = next === 'alpha' ? '🔤 Orden A → Z' : next === 'alpha-desc' ? '🔤 Orden Z → A' : '🔢 Orden por cantidad';
    Toast.show(msg, 'info', 1600);
  });

  let rt = null;
  window.addEventListener("resize", () => {
    if (rt) clearTimeout(rt);
    rt = setTimeout(() => { fixMobileViewport(); renderAll(); }, 200);
  });
  window.addEventListener('orientationchange', () => setTimeout(() => { fixMobileViewport(); renderAll(); }, 300));

  $("#btnFiltros").addEventListener("click", () => { const p = $("#filtersPanel"); p.classList.toggle("open"); $("#btnFiltros").classList.toggle("active", p.classList.contains("open")); });
  const fI = { estado:"#fFiltroEstado", formato:"#fFiltroFormato", anioDesde:"#fFiltroAnioDesde", anioHasta:"#fFiltroAnioHasta", ubicacion:"#fFiltroUbicacion", portada:"#fFiltroPortada", prestamo:"#fFiltroPrestamo" };
  for (const k in fI){ $(fI[k]).addEventListener("input", debounce(() => { App.filters[k] = $(fI[k]).value; renderAll(); }, 200)); }
  $("#btnLimpiarFiltros").addEventListener("click", () => { for (const k in fI){ $(fI[k]).value = ""; App.filters[k] = ""; } renderAll(); });
  const di = $("#ddImport"), dim = $("#ddImportMenu");
  $("#btnImportarDropdown")?.addEventListener("click", e => { e.stopPropagation(); dim.style.display = dim.style.display === "none" ? "block" : "none"; di.classList.toggle("open"); });
  document.addEventListener("click", e => { if (!di.contains(e.target)){ dim.style.display = "none"; di.classList.remove("open"); } });
  dim.querySelectorAll("button, [data-act='import-file']").forEach(b => { b.addEventListener("click", () => {
    const a = b.dataset.act; dim.style.display = "none"; di.classList.remove("open");
    if (a === "import-file") $("#fileInput")?.click();
    else if (a === "import-folder") importFromDefaultFolder();
    else if (a === "import-modern") abrirSelectorModerno();
    else if (a === "import-paste") abrirPasteModal();
    else if (a === "folder-config") openFolderConfig();
  }); });
  const de = $("#ddExport"), dem = $("#ddExportMenu");
  $("#btnExportar").addEventListener("click", e => { e.stopPropagation(); dem.style.display = dem.style.display === "none" ? "block" : "none"; de.classList.toggle("open"); });
  document.addEventListener("click", e => { if (!de.contains(e.target)){ dem.style.display = "none"; de.classList.remove("open"); } });
  dem.querySelectorAll("button").forEach(b => { b.addEventListener("click", () => {
    const a = b.dataset.act; dem.style.display = "none"; de.classList.remove("open");
    if (a === "export-full-json") exportFullJSON();
    else if (a === "export-cat-json") exportCatJSON();
    else if (a === "export-cat-csv") exportCatCSV();
    else if (a === "export-cat-md") exportCatMarkdown();
    else if (a === "export-cat-pdf") exportCatPDF();
    else if (a === "folder-browser") openFolderBrowser();
    else if (a === "folder-config") openFolderConfig();
    else if (a === "print") window.print();
  }); });
  const dm = $("#ddMore"), dmm = $("#ddMoreMenu");
  $("#btnMore")?.addEventListener("click", e => { e.stopPropagation(); dmm.style.display = dmm.style.display === "none" ? "block" : "none"; dm.classList.toggle("open"); });
  document.addEventListener("click", e => { if (!dm.contains(e.target)){ dmm.style.display = "none"; dm.classList.remove("open"); } });
  dmm.querySelectorAll("button").forEach(b => { b.addEventListener("click", () => {
    const a = b.dataset.act; dmm.style.display = "none"; dm.classList.remove("open");
    if (a === "owner-config") openOwnerConfig();
    else if (a === "discogs-config") openDiscogsConfig();
    else if (a === "folder-config") openFolderConfig();
    else if (a === "clear-cache"){ if (confirm("¿Vaciar caché?")){ MetadataCache.clear(); ResolvedLinks.clear(); Toast.show("🧹 Caché vaciada", "ok", 3200); } }
    else if (a === "diag-network") openNetworkDiag();
    else if (a === "reload") location.reload();
    else if (a === "show-legal") openLegalModal();
    else if (a === "export-legal-pdf") exportLegalPDF();
    else if (a === "reset") $("#btnReset")?.click();
  }); });
  const hF = (e) => { const f = e.target.files?.[0]; if (!f) return; importFile(f); e.target.value = ""; };
  $("#fileInput")?.addEventListener("change", hF);
  $("#fileInputEmpty")?.addEventListener("change", hF);
  $("#btnImportarModernoEmpty")?.addEventListener("click", abrirSelectorModerno);
  $("#btnPegarEmpty")?.addEventListener("click", abrirPasteModal);
  $("#pasteClose")?.addEventListener("click", cerrarPasteModal);
  $("#pasteCancel")?.addEventListener("click", cerrarPasteModal);
  $("#pasteModal")?.addEventListener("click", e => { if (e.target.id === "pasteModal") cerrarPasteModal(); });
  $("#pasteImport")?.addEventListener("click", () => { if (importarDesdeTexto($("#pasteArea").value)) cerrarPasteModal(); });
  ["dragenter","dragover"].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
  document.addEventListener("drop", e => {
    if (e.target.closest?.("#dropZone")) return;
    e.preventDefault(); e.stopPropagation();
    const dt = e.dataTransfer; if (!dt) return;
    let f = dt.files?.[0]; if (!f && dt.items){ for (const it of dt.items){ if (it.kind === "file"){ f = it.getAsFile(); break; } } }
    if (!f){ Toast.show("No se detectó archivo", "warn"); return; } importFile(f);
  });
  const dz = $("#dropZone");
  if (dz){ dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("hover"); }); dz.addEventListener("dragleave", () => dz.classList.remove("hover")); dz.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove("hover"); const dt = e.dataTransfer; let f = dt?.files?.[0]; if (!f && dt?.items){ for (const it of dt.items){ if (it.kind === "file"){ f = it.getAsFile(); break; } } } if (!f){ Toast.show("No se detectó archivo", "warn"); return; } importFile(f); }); }
  $("#btnCapifSearch")?.addEventListener("click", async () => {
    const t = $("#fTitulo")?.value || '', i = $("#fInterprete")?.value || '', isr = $("#fISRC")?.value || '';
    const qc = [i, t, isr].filter(Boolean).join(' — ');
    window.open('https://repertorio.capif.org.ar/', '_blank', 'noopener');
    if (qc){
      try { await navigator.clipboard.writeText(qc); Toast.show(`🇦🇷 CAPIF abierto · Copiado: ${qc}`, 'ok', 4500); }
      catch(_){ Toast.show(`🇦🇷 CAPIF abierto: ${qc}`, 'ok', 3500); }
    } else {
      Toast.show('🇦🇷 CAPIF abierto (sin datos para buscar)', 'info', 3500);
    }
  });
  $("#ownerConfigClose")?.addEventListener("click", closeOwnerConfig);
  $("#ownerConfigCancel")?.addEventListener("click", closeOwnerConfig);
  $("#ownerConfigModal")?.addEventListener("click", e => { if (e.target.id === "ownerConfigModal") closeOwnerConfig(); });
  $("#ownerConfigSave")?.addEventListener("click", () => { OwnerConfig.set({ name: upper($("#ownerNameInput").value), contact: upper($("#ownerContactInput").value), email: $("#ownerEmailInput").value }); Toast.show("Datos guardados", "ok"); closeOwnerConfig(); });
  $("#ownerConfigClear")?.addEventListener("click", () => { if (!confirm("¿Limpiar datos?")) return; OwnerConfig.clear(); $("#ownerNameInput").value = ""; $("#ownerContactInput").value = ""; $("#ownerEmailInput").value = ""; Toast.show("Datos eliminados", "warn"); });
  $("#discogsConfigClose")?.addEventListener("click", closeDiscogsConfig);
  $("#discogsConfigCancel")?.addEventListener("click", closeDiscogsConfig);
  $("#discogsConfigModal")?.addEventListener("click", e => { if (e.target.id === "discogsConfigModal") closeDiscogsConfig(); });
  $("#discogsTokenToggle")?.addEventListener("click", () => { const i = $("#discogsTokenInput"); i.type = i.type === 'password' ? 'text' : 'password'; });
  $("#discogsSave")?.addEventListener("click", () => {
    const t = $("#discogsTokenInput").value.trim(); const p = $("#discogsProxyInput").value.trim();
    if (!t && !p){ clearDiscogsConfig(); updateDiscogsStatus('idle','Vacío.'); Toast.show('Configuración eliminada','warn'); updateDiscogsProtoHint(); return; }
    const ok = saveDiscogsConfig(t, p);
    if (ok){
      updateDiscogsStatus('ok', t ? '✅ Token guardado.' : 'Sin token.');
      Toast.show('✅ Token guardado','ok');
      updateDiscogsProtoHint();
    } else {
      updateDiscogsStatus('error', 'No se pudo escribir en localStorage (cuota llena). Exportá backup y vaciá caché en ⚙️.');
    }
  });
  $("#discogsTest")?.addEventListener("click", async () => {
    const t = $("#discogsTokenInput").value.trim();
    if (!t){ updateDiscogsStatus('error','Ingresá el token primero.'); return; }
    saveDiscogsConfig(t, $("#discogsProxyInput").value.trim());
    const b = $("#discogsTest");
    const orig = b.textContent;
    b.disabled = true;
    b.textContent = '⏳ Probando…';
    updateDiscogsStatus('warn', 'Conectando…');
    const stat = $("#discogsStatus");
    if (stat) stat.style.whiteSpace = 'pre-line';
    try {
      const me = await testDiscogsConnection(t);
      updateDiscogsStatus('ok', `✅ Token válido · Usuario: ${me.username || me.id || 'ok'}`);
      Toast.show(`✅ Discogs OK — ${me.username || 'token válido'}`, 'ok', 4000);
    } catch(err){
      updateDiscogsStatus('error', `🔴 ${err.message}`);
      Toast.show('❌ Ver detalle en el panel de estado', 'err', 5000);
    } finally {
      b.disabled = false;
      b.textContent = orig;
    }
  });
  $("#discogsTokenClear")?.addEventListener("click", () => { if (!getDiscogsToken() && !getDiscogsConfig().proxy) return; if (confirm('¿Eliminar token y proxy?')){ clearDiscogsConfig(); $("#discogsTokenInput").value = ''; $("#discogsProxyInput").value = ''; updateDiscogsStatus('idle','Eliminado.'); updateDiscogsProtoHint(); Toast.show('Eliminado','warn'); } });
  $("#discogsProxyInput")?.addEventListener("input", updateDiscogsProtoHint);
  $("#folderConfigClose")?.addEventListener("click", closeFolderConfig);
  $("#folderConfigCancel")?.addEventListener("click", closeFolderConfig);
  $("#folderConfigModal")?.addEventListener("click", e => { if (e.target.id === "folderConfigModal") closeFolderConfig(); });
  $("#folderPick")?.addEventListener("click", pickDefaultFolder);
  $("#folderChange")?.addEventListener("click", pickDefaultFolder);
  $("#folderRemove")?.addEventListener("click", removeDefaultFolder);
  $("#folderClearAll")?.addEventListener("click", async () => { if (!confirm("¿Eliminar configuración?")) return; await FileSystemDefault.clear(); FileSystemDefault.refreshBadge(); updateFolderSupportStatus(); Toast.show("Configuración eliminada", "warn"); });
  $("#folderSave")?.addEventListener("click", () => closeFolderConfig());
  $("#folderTestPermission")?.addEventListener("click", async () => { if (!FileSystemDefault.isSet()){ Toast.show("Sin carpeta", "warn"); return; } const ok = await FileSystemDefault.ensureReady("readwrite"); Toast.show(ok ? "✅ Acceso" : "🔐 Autorizá", ok ? "ok" : "warn", 3500); });
  $("#folderBrowserClose")?.addEventListener("click", closeFolderBrowser);
  $("#folderBrowserCancel")?.addEventListener("click", closeFolderBrowser);
  $("#folderBrowserModal")?.addEventListener("click", e => { if (e.target.id === "folderBrowserModal") closeFolderBrowser(); });
  $("#folderRefresh")?.addEventListener("click", refreshFolderList);
  $("#folderUploadNow")?.addEventListener("click", saveBackupToFolder);
  $("#folderChangeFromBrowser")?.addEventListener("click", () => { closeFolderBrowser(); openFolderConfig(); });
  $("#networkDiagClose")?.addEventListener("click", closeNetworkDiag);
  $("#networkDiagCancel")?.addEventListener("click", closeNetworkDiag);
  $("#networkDiagModal")?.addEventListener("click", e => { if (e.target.id === "networkDiagModal") closeNetworkDiag(); });
  $("#networkDiagRun")?.addEventListener("click", runNetworkDiagnostics);
  $("#btnExit")?.addEventListener("click", openExitModal);
  $("#exitClose")?.addEventListener("click", closeExitModal);
  $("#exitCancel")?.addEventListener("click", closeExitModal);
  $("#exitModal")?.addEventListener("click", e => { if (e.target.id === "exitModal") closeExitModal(); });
  $("#exitExportCheck")?.addEventListener("change", e => { $("#exitConfirm").disabled = !e.target.checked; });
  $("#exitConfirm")?.addEventListener("click", async () => {
    if (!$("#exitExportCheck").checked){ Toast.show("Marcá la casilla para exportar y salir","warn"); return; }
    try {
      await exportFullJSON();
      Toast.show("✅ Backup exportado · Ya podés cerrar la pestaña","ok",5500);
      closeExitModal();
      setTimeout(() => {
        try { window.open('', '_self'); window.close(); } catch(_){}
        setTimeout(() => { if (!window.closed){ Toast.show("El navegador no permite cerrar automáticamente.","info",8000); } }, 500);
      }, 800);
    } catch(err){ Toast.show("Error al exportar: "+err.message,"err",6000); }
  });
  $("#exitSkip")?.addEventListener("click", () => {
    if (!confirm("⚠️ Vas a salir SIN exportar.\n\n¿Estás seguro?")) return;
    if (!confirm("🛑 CONFIRMACIÓN FINAL:\n\n¿Salir realmente sin backup?")) return;
    closeExitModal();
    HistoryLog.log('INFO', 'Salida sin exportar', 'Usuario eligió salir sin backup');
    setTimeout(() => { try { window.open('', '_self'); window.close(); } catch(_){} }, 400);
  });
  $("#btnReset").addEventListener("click", () => {
    if (!confirm("⚠️ VACIAR TODO.\n\n¿Seguro?")) return;
    if (!confirm("¿Realmente?")) return;
    Store.resetAll(); NotFoundList.clear(); NotFoundList.persist();
    App.selected.clear(); App.artista = null; App.q = ""; App.focusedKey = null; App.subcat = null;
    $("#q").value = ""; $("#searchBox").classList.remove("has-value");
    Undo.clear(); ensureValidCat(); renderTabs(); renderAll(); AutoBackup.reset();
    HistoryLog.log('DELETE', 'Base vaciada');
    Toast.show("Base vaciada", "warn");
  });
  $("#modalClose").addEventListener("click", cerrarModal);
  $("#btnCancel").addEventListener("click", cerrarModal);
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") cerrarModal(); });
  $$(".modal-tab").forEach(t => t.addEventListener("click", () => switchModalTab(t.dataset.tab)));
  $("#cdForm").addEventListener("submit", guardarCD);
  $("#btnSaveAndNew").addEventListener("click", () => { if (!validarForm()){ Toast.show("Revisá campos", "err"); return; } if (guardarCD()) setTimeout(() => abrirModal("nuevo"), 100); });
  $("#btnOpenCfFromModal")?.addEventListener("click", () => { CustomFields.render(); $("#customFieldsModal").classList.add("open"); });
  $("#viewClose")?.addEventListener("click", cerrarVista);
  $("#viewCloseBtn")?.addEventListener("click", cerrarVista);
  $("#viewModal")?.addEventListener("click", e => { if (e.target.id === "viewModal") cerrarVista(); });
  $("#viewEdit")?.addEventListener("click", () => { const k = $("#viewModal").dataset.editKey; if (!k) return; const { cat, id } = parseCDKey(k); const cd = Store.getCDs(cat).find(c => c.id === id); cerrarVista(); if (cd){ if (App.cat !== ALL_CATS) App.cat = cat; abrirModal("editar", cd); } });
  $("#fCat").addEventListener("change", e => {
    const tc = e.target.value;
    populateSubcatOptions(tc, "");
    if (App.editing && tc === App.editing.cat && App.editing.original){ $("#fNro").value = App.editing.original.nro; return; }
    const cds = Store.getCDs(tc); const mx = cds.reduce((m, c) => Math.max(m, c.nro || 0), 0); $("#fNro").value = mx + 1;
  });
  ["#fTitulo", "#fInterprete"].forEach(s => { const el = $(s); if (el) el.addEventListener("blur", () => scheduleEnrichment(750)); });
  $("#enrichToggle")?.addEventListener("change", e => Store.setPref("enrich", e.target.checked));
  $("#replaceToggle")?.addEventListener("change", e => { Store.setPref("replaceOnEnrich", e.target.checked); Toast.show(e.target.checked ? "🔄 Reemplazará datos" : "Solo completará vacíos", e.target.checked ? "info" : "ok", 3000); });
  $("#btnFetchCover")?.addEventListener("click", fetchCoverManually);
  $("#btnEditCoverUrl")?.addEventListener("click", () => { const w = $("#wrapCoverUrl"); w.style.display = w.style.display === "none" ? "" : "none"; if (w.style.display === "") $("#fCoverUrl").focus(); });
  $("#btnClearCover")?.addEventListener("click", () => { $("#fCoverUrl").value = ""; renderCoverPreview(null, null); });
  $("#fCoverUrl")?.addEventListener("input", e => { const u = e.target.value.trim(); renderCoverPreview(u || null, null); });
  $("#lbClose")?.addEventListener("click", Lightbox.close);
  $("#coverLightbox")?.addEventListener("click", e => { if (e.target.id === "coverLightbox") Lightbox.close(); });
  $("#lbPrev")?.addEventListener("click", e => { e.stopPropagation(); Lightbox.prev(); });
  $("#lbNext")?.addEventListener("click", e => { e.stopPropagation(); Lightbox.next(); });
  $("#projTasa")?.addEventListener("change", e => { $("#projCustomWrap").style.display = e.target.value === "custom" ? "" : "none"; renderProjection(computeDash().valorTotal); });
  ["#projAnios", "#projCustom", "#projBase", "#projManual"].forEach(s => { $(s)?.addEventListener("input", debounce(() => { $("#projManualWrap").style.display = $("#projBase").value === "manual" ? "" : "none"; renderProjection(computeDash().valorTotal); }, 200)); });
  $("#catModalClose").addEventListener("click", cerrarCatModal);
  $("#catCancel").addEventListener("click", cerrarCatModal);
  $("#catModal").addEventListener("click", e => { if (e.target.id === "catModal") cerrarCatModal(); });
  $("#catForm").addEventListener("submit", guardarCategoria);
  $("#catIcon").addEventListener("input", e => { $("#catIconPreview").textContent = e.target.value || "🎵"; });
  const mm = $("#manualModal");
  const am = () => { mm.classList.add("open"); setTimeout(() => $("#manualSearch").focus(), 80); };
  const cm = () => mm.classList.remove("open");
  $("#btnAyuda")?.addEventListener("click", am);
  $("#btnAyudaEmpty")?.addEventListener("click", am);
  $("#manualClose")?.addEventListener("click", cm);
  mm?.addEventListener("click", e => { if (e.target.id === "manualModal") cm(); });
  $$("#manualNav button").forEach(b => b.addEventListener("click", () => switchManualSection(b.dataset.sec)));
  $("#manualSearch")?.addEventListener("input", debounce((e) => {
    const q = norm(e.target.value.trim()); const s = document.querySelector(".manual-section.active"); if (!s) return;
    const bl = s.querySelectorAll("h3, h4, p, li, tr, .manual-step, .callout, pre, table");
    if (!q){ bl.forEach(x => x.style.display = ""); return; }
    bl.forEach(x => { x.style.display = norm(x.textContent).includes(q) ? "" : "none"; });
  }, 180));
  $("#btnEnrichAll")?.addEventListener("click", () => BulkEnrich.open());
  $("#bulkEnrichClose")?.addEventListener("click", () => BulkEnrich.close());
  $("#bulkEnrichCancel")?.addEventListener("click", () => BulkEnrich.close());
  $("#bulkEnrichModal")?.addEventListener("click", e => { if (e.target.id === "bulkEnrichModal") BulkEnrich.close(); });
  $("#bulkEnrichStart")?.addEventListener("click", () => BulkEnrich.run());
  $("#bulkEnrichStop")?.addEventListener("click", () => BulkEnrich.stop());
  $$("#bulkEnrichConfig input[type=checkbox], #bulkEnrichConfig input[type=radio]").forEach(i => i.addEventListener("change", () => BulkEnrich.updatePreview()));
  $("#btnViewNotFoundFromBulk")?.addEventListener("click", () => { BulkEnrich.close(); setTimeout(openNotFoundModal, 200); });
  $("#bulkMoveClose")?.addEventListener("click", closeBulkMoveModal);
  $("#bulkMoveCancel")?.addEventListener("click", closeBulkMoveModal);
  $("#bulkMoveModal")?.addEventListener("click", e => { if (e.target.id === "bulkMoveModal") closeBulkMoveModal(); });
  $("#bulkMoveConfirm")?.addEventListener("click", confirmBulkMove);
  $("#bulkMoveKeepNro")?.addEventListener("change", () => renderBulkMovePreview());
  $("#btnNotFound")?.addEventListener("click", openNotFoundModal);
  $("#notFoundClose")?.addEventListener("click", closeNotFoundModal);
  $("#notFoundCancel")?.addEventListener("click", closeNotFoundModal);
  $("#notFoundModal")?.addEventListener("click", e => { if (e.target.id === "notFoundModal") closeNotFoundModal(); });
  $("#btnPrintNotFound")?.addEventListener("click", printNotFoundList);
  $("#btnExportNotFoundCSV")?.addEventListener("click", exportNotFoundCSV);
  $("#btnExportNotFoundJSON")?.addEventListener("click", exportNotFoundJSON);
  $("#btnClearNotFound")?.addEventListener("click", clearNotFoundList);
  $("#notFoundSearch")?.addEventListener("input", debounce((e) => { App.notFoundFilter = e.target.value; renderNotFoundTable(); }, 180));
  $("#autoBackupClose")?.addEventListener("click", () => AutoBackup.later());
  $("#autoBackupLater")?.addEventListener("click", () => AutoBackup.later());
  $("#autoBackupDo")?.addEventListener("click", () => AutoBackup.doBackup());
  $("#autoBackupModal")?.addEventListener("click", e => { if (e.target.id === "autoBackupModal") AutoBackup.later(); });
  $("#autoBackupToggle")?.addEventListener("change", e => { AutoBackup.setEnabled(e.target.checked); Toast.show(e.target.checked ? "Backup activado" : "Backup desactivado", e.target.checked ? "ok" : "warn", 2500); });
  $("#autoBackupToggleLabel")?.addEventListener("click", e => e.stopPropagation());
  $("#checkAll").addEventListener("change", e => { const c = e.target.checked; $$("#tbodyCD tr").forEach(tr => { const k = tr.dataset.key; if (c) App.selected.add(k); else App.selected.delete(k); tr.classList.toggle("selected", c); const cb = tr.querySelector("td.check input"); if (cb) cb.checked = c; }); updateSelectionBar(); if (GridView.isEnabled()) GridView.render(); });
  $("#themeToggle")?.addEventListener("click", () => ThemeManager.toggle());
  $("#dupClose")?.addEventListener("click", () => $("#duplicatesModal").classList.remove("open"));
  $("#dupCloseBtn")?.addEventListener("click", () => $("#duplicatesModal").classList.remove("open"));
  $("#duplicatesModal")?.addEventListener("click", e => { if (e.target.id === "duplicatesModal") e.currentTarget.classList.remove("open"); });
  $("#dupExportCSV")?.addEventListener("click", () => Duplicates.exportCSV());
  $("#cfClose")?.addEventListener("click", () => $("#customFieldsModal").classList.remove("open"));
  $("#cfCloseBtn")?.addEventListener("click", () => $("#customFieldsModal").classList.remove("open"));
  $("#customFieldsModal")?.addEventListener("click", e => { if (e.target.id === "customFieldsModal") e.currentTarget.classList.remove("open"); });
  $("#cfType")?.addEventListener("change", e => { $("#cfOptionsWrap").style.display = e.target.value === "select" ? "" : "none"; });
  $("#cfAdd")?.addEventListener("click", () => { const n = upper($("#cfName").value); const t = $("#cfType").value; const o = $("#cfOptions").value; if (!n.trim()){ Toast.show("Ingresá nombre", "warn"); return; } if (CustomFields.add({ name: n, type: t, options: o })){ $("#cfName").value = ""; $("#cfOptions").value = ""; CustomFields.render(); Toast.show("Campo agregado", "ok"); HistoryLog.log('CREATE', `Campo personalizado: ${n}`, t); } });
  $("#btnHistory")?.addEventListener("click", () => { HistoryLog.render(); $("#historyModal").classList.add("open"); });
  $("#histClose")?.addEventListener("click", () => $("#historyModal").classList.remove("open"));
  $("#histCloseBtn")?.addEventListener("click", () => $("#historyModal").classList.remove("open"));
  $("#historyModal")?.addEventListener("click", e => { if (e.target.id === "historyModal") e.currentTarget.classList.remove("open"); });
  $("#histFilter")?.addEventListener("change", () => HistoryLog.render());
  $("#histSearch")?.addEventListener("input", debounce(() => HistoryLog.render(), 180));
  $("#histExport")?.addEventListener("click", () => HistoryLog.exportCSV());
  $("#histClear")?.addEventListener("click", () => { if (!confirm("¿Limpiar historial?")) return; HistoryLog.clear(); HistoryLog.render(); Toast.show("Historial limpiado", "warn"); });
  $("#btnScan")?.addEventListener("click", () => {
    $("#scannerModal").classList.add("open");
    $("#scanFallback").style.display = "none"; $("#scanWrap").style.display = "";
    $("#scanManual").value = ""; $("#scanStatus").textContent = "Iniciando cámara…"; $("#scanStatus").className = "scanner-status";
    BarcodeScanner.start((code) => { setTimeout(() => { $("#scannerModal").classList.remove("open"); BarcodeScanner.stop(); abrirModal("nuevo"); setTimeout(() => { $("#fCodigo").value = code; Toast.show(`Código ${code} cargado`, "ok", 4500); }, 200); }, 800); });
  });
  $("#scanClose")?.addEventListener("click", () => { BarcodeScanner.stop(); $("#scannerModal").classList.remove("open"); });
  $("#scanCloseBtn")?.addEventListener("click", () => { BarcodeScanner.stop(); $("#scannerModal").classList.remove("open"); });
  $("#scanStop")?.addEventListener("click", () => { BarcodeScanner.stop(); $("#scanStatus").textContent = "Detenido"; });
  $("#scannerModal")?.addEventListener("click", e => { if (e.target.id === "scannerModal"){ BarcodeScanner.stop(); e.currentTarget.classList.remove("open"); } });
  $("#scanManualSearch")?.addEventListener("click", () => { const c = upper($("#scanManual").value.trim()); if (!c) return; BarcodeScanner.stop(); $("#scannerModal").classList.remove("open"); abrirModal("nuevo"); setTimeout(() => { $("#fCodigo").value = c; Toast.show(`Código ${c} cargado`, "ok", 4500); }, 200); });
  $("#loanClose")?.addEventListener("click", () => $("#loansModal").classList.remove("open"));
  $("#loanCloseBtn")?.addEventListener("click", () => $("#loansModal").classList.remove("open"));
  $("#loansModal")?.addEventListener("click", e => { if (e.target.id === "loansModal") e.currentTarget.classList.remove("open"); });
  $("#loanExportCSV")?.addEventListener("click", () => Loans.exportCSV());
  $("#legalClose")?.addEventListener("click", closeLegalModal);
  $("#legalLater")?.addEventListener("click", closeLegalModal);
  $("#legalModal")?.addEventListener("click", e => { if (e.target.id === "legalModal") closeLegalModal(); });
  $("#legalAceptar")?.addEventListener("click", aceptarLegal);
  $("#legalPDF")?.addEventListener("click", exportLegalPDF);

  attachSelectionBarEvents();
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("beforeunload", (e) => { if (AutoBackup.hasPending()){ e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    if (!el.matches('[data-uppercase]')) return;
    const s = el.selectionStart; const en = el.selectionEnd;
    el.value = el.value.toUpperCase();
    if (typeof s === 'number' && typeof en === 'number'){ try { el.setSelectionRange(s, en); } catch(_){} }
  });
}

function handleKeydown(e){
  const ctrl = e.ctrlKey || e.metaKey;
  const modalOpen = $("#modal").classList.contains("open");
  const viewOpen = $("#viewModal")?.classList.contains("open");
  const pasteOpen = $("#pasteModal").classList.contains("open");
  const catOpen = $("#catModal").classList.contains("open");
  const manualOpen = $("#manualModal").classList.contains("open");
  const bulkOpen = $("#bulkEnrichModal").classList.contains("open");
  const abOpen = $("#autoBackupModal").classList.contains("open");
  const nfOpen = $("#notFoundModal").classList.contains("open");
  const diOpen = $("#discogsConfigModal")?.classList.contains("open");
  const owOpen = $("#ownerConfigModal")?.classList.contains("open");
  const fcOpen = $("#folderConfigModal")?.classList.contains("open");
  const fbOpen = $("#folderBrowserModal")?.classList.contains("open");
  const lbOpen = $("#coverLightbox").classList.contains("open");
  const bmOpen = $("#bulkMoveModal")?.classList.contains("open");
  const ndOpen = $("#networkDiagModal")?.classList.contains("open");
  const dpOpen = $("#duplicatesModal")?.classList.contains("open");
  const cfOpen = $("#customFieldsModal")?.classList.contains("open");
  const hiOpen = $("#historyModal")?.classList.contains("open");
  const scOpen = $("#scannerModal")?.classList.contains("open");
  const loOpen = $("#loansModal")?.classList.contains("open");
  const exOpen = $("#exitModal")?.classList.contains("open");
  const alOpen = $("#albumConfirmModal")?.classList.contains("open");
  const lgOpen = $("#legalModal")?.classList.contains("open");
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);

  if (lbOpen){ if (e.key === "Escape"){ e.preventDefault(); Lightbox.close(); return; } if (e.key === "ArrowLeft"){ e.preventDefault(); Lightbox.prev(); return; } if (e.key === "ArrowRight"){ e.preventDefault(); Lightbox.next(); return; } return; }
  if (e.key === "F1"){ e.preventDefault(); const m = $("#manualModal"); if (m.classList.contains("open")) m.classList.remove("open"); else m.classList.add("open"); return; }
  if (e.key === "Escape"){
    if (viewOpen){ cerrarVista(); return; }
    if (modalOpen){ cerrarModal(); return; }
    if (pasteOpen){ cerrarPasteModal(); return; }
    if (catOpen){ cerrarCatModal(); return; }
    if (manualOpen){ $("#manualModal").classList.remove("open"); return; }
    if (bulkOpen){ BulkEnrich.close(); return; }
    if (abOpen){ AutoBackup.later(); return; }
    if (nfOpen){ closeNotFoundModal(); return; }
    if (diOpen){ closeDiscogsConfig(); return; }
    if (owOpen){ closeOwnerConfig(); return; }
    if (fcOpen){ closeFolderConfig(); return; }
    if (fbOpen){ closeFolderBrowser(); return; }
    if (bmOpen){ closeBulkMoveModal(); return; }
    if (ndOpen){ closeNetworkDiag(); return; }
    if (dpOpen){ $("#duplicatesModal").classList.remove("open"); return; }
    if (cfOpen){ $("#customFieldsModal").classList.remove("open"); return; }
    if (hiOpen){ $("#historyModal").classList.remove("open"); return; }
    if (scOpen){ BarcodeScanner.stop(); $("#scannerModal").classList.remove("open"); return; }
    if (loOpen){ $("#loansModal").classList.remove("open"); return; }
    if (exOpen){ closeExitModal(); return; }
    if (alOpen){ $("#albumConfirmClose")?.click(); return; }
    if (lgOpen){ closeLegalModal(); return; }
    cerrarMenuCategoria(); cerrarMenuSubcategoria(); App.artista = null; App.q = ""; $("#q").value = ""; $("#searchBox").classList.remove("has-value"); renderAll(); return;
  }
  if (modalOpen){ if (ctrl && e.key === "Enter"){ e.preventDefault(); $("#btnSaveAndNew").click(); } return; }
  if (viewOpen || pasteOpen || catOpen || manualOpen || bulkOpen || abOpen || nfOpen || diOpen || owOpen || fcOpen || fbOpen || bmOpen || ndOpen || dpOpen || cfOpen || hiOpen || scOpen || loOpen || exOpen || alOpen || lgOpen) return;
  if (typing) return;
  if (ctrl && e.shiftKey && e.key.toLowerCase() === "q"){ e.preventDefault(); openExitModal(); return; }
  if (ctrl && e.shiftKey && e.key.toLowerCase() === "d"){ e.preventDefault(); Duplicates.render(); $("#duplicatesModal").classList.add("open"); return; }
  if (ctrl && e.shiftKey && e.key.toLowerCase() === "l"){ e.preventDefault(); Loans.render(); $("#loansModal").classList.add("open"); return; }
  if (ctrl && e.shiftKey && e.key.toLowerCase() === "h"){ e.preventDefault(); HistoryLog.render(); $("#historyModal").classList.add("open"); return; }
  if (ctrl && e.shiftKey && e.key.toLowerCase() === "t"){ e.preventDefault(); ThemeManager.toggle(); return; }
  if (ctrl && e.key.toLowerCase() === "n"){ e.preventDefault(); abrirModal("nuevo"); return; }
  if (ctrl && e.key.toLowerCase() === "k"){ e.preventDefault(); abrirModalCategoria("crear"); return; }
  if (ctrl && e.key.toLowerCase() === "e"){ e.preventDefault(); BulkEnrich.open(); return; }
  if (ctrl && e.key.toLowerCase() === "s"){ e.preventDefault(); exportFullJSON(); return; }
  if (ctrl && e.key.toLowerCase() === "f"){ e.preventDefault(); $("#btnFiltros").click(); return; }
  if (ctrl && e.key.toLowerCase() === "z"){ e.preventDefault(); Undo.pop(); return; }
  if (ctrl && e.key.toLowerCase() === "d"){ e.preventDefault(); setView(App.view === "dashboard" ? "table" : "dashboard"); return; }
  if (ctrl && e.key.toLowerCase() === "g"){ e.preventDefault(); GridView.setEnabled(!GridView.isEnabled()); return; }
  const rows = $$("#tbodyCD tr"); if (!rows.length) return;
  let idx = rows.findIndex(r => r.dataset.key === App.focusedKey);
  if (e.key === "ArrowDown"){ e.preventDefault(); idx = Math.min(idx + 1, rows.length - 1); if (idx < 0) idx = 0; App.focusedKey = rows[idx].dataset.key; updateFocusedRow(); }
  else if (e.key === "ArrowUp"){ e.preventDefault(); idx = Math.max(idx - 1, 0); App.focusedKey = rows[idx].dataset.key; updateFocusedRow(); }
  else if (e.key === "Enter" && App.focusedKey){ e.preventDefault(); const { cat, id } = parseCDKey(App.focusedKey); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd){ if (App.cat !== ALL_CATS) App.cat = cat; abrirModal("editar", cd); } }
  else if ((e.key === "Delete" || e.key === "Backspace") && App.focusedKey){ e.preventDefault(); const { cat, id } = parseCDKey(App.focusedKey); const cd = Store.getCDs(cat).find(c => c.id === id); if (cd) eliminarCD(cd); }
  else if (e.key === " " && App.focusedKey){ e.preventDefault(); const k = App.focusedKey; const c = !App.selected.has(k); toggleSelect(k, c); const tr = rows.find(r => r.dataset.key === k); if (tr) tr.querySelector("td.check input").checked = c; }
}

/* ═══════════════════════════════════════════════════════════════════
   Init + legacy corrector + arranque
   ═══════════════════════════════════════════════════════════════════ */

async function initV6(){
  ThemeManager.init();
  DuplicateChecker.invalidate();
  try {
    const manifest = { name: 'Discografía — Colección de CDs', short_name: 'Discografía', description: 'Gestor profesional de colección', start_url: './', display: 'standalone', background_color: '#0e1116', theme_color: '#4fc3f7', icons: [{ src: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fc3f7"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><circle cx="256" cy="256" r="240" fill="url(#g)"/><circle cx="256" cy="256" r="90" fill="#0e1116"/><circle cx="256" cy="256" r="30" fill="#4fc3f7"/></svg>`), sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }] };
    const mb = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const mu = URL.createObjectURL(mb);
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = mu; document.head.appendChild(l);
  } catch(e){}
  try {
    if ('serviceWorker' in navigator && location.protocol !== 'file:'){
      // v7.0.12: cache name actualizado
      const sw = `const CACHE='discografia-v7012';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./']).catch(()=>{})));self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(caches.match(e.request).then(c=>{const f=fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(cc=>cc.put(e.request,r.clone()));return r;}).catch(()=>c);return c||f;}));});`;
      const sb = new Blob([sw], { type: 'application/javascript' }); const su = URL.createObjectURL(sb);
      navigator.serviceWorker.register(su).then(reg => {
        try { reg.update(); } catch(e){}
      }).catch(e => console.warn('SW:', e));
    }
  } catch(e){}
  HistoryLog.log('INFO', `App iniciada v${APP_VERSION}`, `${Store.total()} CDs · ${Store.catKeys().length} categorías`);
}

function runLegacyCorrector(){
  const TITULOS_RAW = {
    "MISTFITS":"Misfits","BREACK AWAY":"Break Away","JURCTION":"Junction",
    "ANOTHER TIME,ANOTHER PLEAC":"Another Time, Another Place","BITTERR-SWEET":"Bitter Sweet",
    "LANGHING DOWN CRYING":"Laughing Down Crying","UMPLUGGED deluxe":"Unplugged (Deluxe)",
    "SACRED SONG WITH ROBERT FRIP":"Sacred Song (with Robert Fripp)",
    "WOLD PEACE IS NONE OF YOUR BU":"World Peace Is None of Your Business",
    "KILL UNLE":"Kill Uncle","BUBBLE GOM MAMA CASS COPIA":"Bubble Gum (Mama Cass)",
    "BHOTHER WHERE YOU BOUND":"Brother Where You Bound","WINS OF CHANGE":"Winds of Change",
    "PHANTOM POWWER":"Phantom Power","EXTENDER VERSIONS":"Extended Versions",
    "TEH BIRDS,THE BEES y THE":"The Birds, The Bees & The Monkees","PEACEFUL WOLD":"Peaceful World",
    "WOLD FALLING DOWN":"World Falling Down","A NEW WOLD RECORDS":"A New World Record",
    "ROBIN´S REGN":"Robin's Reign","BRING ON THE NIGTH":"Bring on the Night",
    "COMO CONEGUIR CHICAS":"Cómo Conseguir Chicas","DEMACIADAS MANERAS DE NO…":"Demasiadas Maneras de No…",
    "STRAWWBERRIES MEAN LOVE":"Strawberries Mean Love","MEET THE SEARCHRES":"Meet the Searchers",
    "FIESTA MOUNSTRO":"Fiesta Monstruo","BOOBLEG S.VOL 2 KSAN 95 FM LIVE79":"Bootleg Series Vol. 2 KSAN 95 FM Live '79",
    "HOW DARE YUO !":"How Dare You!","THAT THING YUO DO!":"That Thing You Do!",
    "PAUL YUONG E Q-TIPS":"Paul Young & Q-Tips","PET SOUNDS 50 ANIVERSARY":"Pet Sounds 50th Anniversary",
    "LIVE IN LAS VEGAS 50 ANIVERSARIO":"Live in Las Vegas 50th Anniversary",
    "ON AIR LIVE AT THE BBC VOLUMEN 2":"On Air – Live at the BBC Volume 2",
    "THE TRA LA DAYS ARE OVER":"The Tra-La Days Are Over","EGIPT STATION":"Egypt Station",
    "LIVE AT QUEVEC":"Live at Quebec","LAS OTRAS CARAS DE LA ALTA SOC":"Las Otras Caras de la Alta Sociedad",
    "JUST AN OLD FASHIONED LOVE S":"Just an Old Fashioned Love Song","SO PARA CONTRARIAR":"Só Para Contrariar",
    "OGRANDE ENCONTRO DE":"O Grande Encontro de","LIVE AT THE PALAIS COPIA":"Live at the Palais",
    "LOOKING BACK WITH LOVE COPIA":"Looking Back with Love","AT THE MOVIES COPIA":"At the Movies",
    "SINGS COPIA":"Sings","LIVE COPIA":"Live","RARITIES VOL. 4 (COPIA)":"Rarities Vol. 4",
    "RARITIES VOL. 9 (COPIA)":"Rarities Vol. 9","RARITIES VOL. 10 (COPIA)":"Rarities Vol. 10",
    "FREEDOM WIND COPIA":"Freedom Wind","FOREVER CHANGES COPIA":"Forever Changes",
    "MONTAGE COPIA":"Montage","THE VERY BEST OF COPIA":"The Very Best Of",
    "THE RUTLES COPIA":"The Rutles","INCENSE AND PEPPERMINTS COPIA":"Incense and Peppermints",
    "SHADOWS COPIA":"Shadows","ALEXANDRE PIRES COPIA":"Alexandre Pires","ESTRELLA COPIA":"Estrella",
    "COPIA SIN NOMBRE":"Sin título"
  };
  const INTERPRETES_RAW = {
    "JOHNNY RIVRES":"Johnny Rivers","PAUL WILLIANS":"Paul Williams","ROY ORBINSON":"Roy Orbison",
    "MAMA CASS ELIOT":"Mama Cass Elliot","THE MONTION PICTURE":"The Motion Picture",
    "ENANANITOS VERDES":"Enanitos Verdes","LOS FABULSOS CADILLACS":"Los Fabulosos Cadillacs",
    "LEO MASIAH":"Leo Masliah","LUIS ALBERTO SPINETTTA":"Luis Alberto Spinetta",
    "GAL COSTA CANTA TOM JOBIN":"Gal Costa canta Tom Jobim",
    "JOBIN VINICIUS TOQUINHO MIUCHA":"Jobim, Vinicius, Toquinho & Miúcha",
    "TOM JOBIN":"Tom Jobim"
  };
  const ESTADOS_EN_ES = {
    "Mint (M)":"Como nuevo (M)","Near Mint (NM)":"Casi nuevo (NM)","Excellent (EX)":"Excelente (EX)",
    "Very Good (VG)":"Muy bueno (VG)","Good (G)":"Bueno (G)","Fair (F)":"Regular (F)","Poor (P)":"Malo (P)"
  };
  const _n = s => String(s || '').trim().toUpperCase();
  const TITULOS = {};     for (const k in TITULOS_RAW)     TITULOS[_n(k)]     = TITULOS_RAW[k];
  const INTERPRETES = {}; for (const k in INTERPRETES_RAW) INTERPRETES[_n(k)] = INTERPRETES_RAW[k];

  const cats = Store.categories();
  const snapshot = JSON.stringify(cats);
  let total = 0;

  for (const catKey in cats){
    const cds = cats[catKey]?.cds;
    if (!Array.isArray(cds)) continue;
    for (const cd of cds){
      const tN = _n(cd.titulo), iN = _n(cd.interprete);
      if (TITULOS[tN] && TITULOS[tN] !== cd.titulo){ cd.titulo = TITULOS[tN]; total++; }
      if (INTERPRETES[iN] && INTERPRETES[iN] !== cd.interprete){ cd.interprete = INTERPRETES[iN]; total++; }
      if (cd.titulo){
        const antes = cd.titulo;
        cd.titulo = cd.titulo.replace(/\s*\(COPIA\)\s*$/i,'').replace(/\s+COPIA\s*$/i,'').trim();
        if (cd.titulo !== antes) total++;
      }
      if (cd.titulo && /´/.test(cd.titulo)){ cd.titulo = cd.titulo.replace(/´/g,"'"); total++; }
      if (cd.interprete && /´/.test(cd.interprete)){ cd.interprete = cd.interprete.replace(/´/g,"'"); total++; }
      for (const campo of ['estadoDisco','estadoCaja','estadoFolleto','estadoArte']){
        const v = cd[campo];
        if (v && ESTADOS_EN_ES[v]){ cd[campo] = ESTADOS_EN_ES[v]; total++; }
      }
      if (cd.titulo && cd.titulo !== cd.titulo.toUpperCase()){ cd.titulo = cd.titulo.toUpperCase(); total++; }
      if (cd.interprete && cd.interprete !== cd.interprete.toUpperCase()){ cd.interprete = cd.interprete.toUpperCase(); total++; }
      if (cd.sello && cd.sello !== cd.sello.toUpperCase()){ cd.sello = cd.sello.toUpperCase(); total++; }
      if (cd.genero && cd.genero !== cd.genero.toUpperCase()){ cd.genero = cd.genero.toUpperCase(); total++; }
      if (cd.catalogo && cd.catalogo !== cd.catalogo.toUpperCase()){ cd.catalogo = cd.catalogo.toUpperCase(); total++; }
      if (cd.edicion && cd.edicion !== cd.edicion.toUpperCase()){ cd.edicion = cd.edicion.toUpperCase(); total++; }
      if (cd.pais && cd.pais !== cd.pais.toUpperCase()){ cd.pais = cd.pais.toUpperCase(); total++; }
      if (cd.ubicacion && cd.ubicacion !== cd.ubicacion.toUpperCase()){ cd.ubicacion = cd.ubicacion.toUpperCase(); total++; }
      if (cd.prestadoA && cd.prestadoA !== cd.prestadoA.toUpperCase()){ cd.prestadoA = cd.prestadoA.toUpperCase(); total++; }
      if (cd.notasPrestamo && cd.notasPrestamo !== cd.notasPrestamo.toUpperCase()){ cd.notasPrestamo = cd.notasPrestamo.toUpperCase(); total++; }
    }
  }

  if (total > 0){
    try { localStorage.setItem('discografia_db_v3_BACKUP_' + Date.now(), snapshot); } catch(e){}
    Store.persist();
    console.log(`%c✅ ${total} correcciones automáticas aplicadas`, "color:#5ddc9a;font-weight:bold;font-size:14px");
  } else {
    console.log('%cℹ️ Corrector: nada que cambiar.', "color:#8b97a8");
  }
  return total;
}

function fixMobileViewport(){
  const isMobile = window.matchMedia('(max-width:768px)').matches;
  document.documentElement.classList.toggle('is-mobile', isMobile);
  document.body.classList.toggle('is-mobile', isMobile);
  if (isMobile){
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    document.body.style.minHeight = '100dvh';
  } else {
    document.body.style.overflowY = '';
    document.body.style.height = '';
    document.body.style.minHeight = '';
  }
}

async function init(){
  App.q = ""; App.artista = null; App.subcat = null;
  App.filters = { estado: "", formato: "", anioDesde: "", anioHasta: "", ubicacion: "", portada: "", prestamo: "" };
  Store.load();
  fixMobileViewport();

  const corrected = runLegacyCorrector();
  if (corrected > 0) setTimeout(() => Toast.show(`✅ ${corrected} correcciones aplicadas automáticamente`, "ok", 4000), 800);

  NotFoundList.load();
  OwnerConfig.load();
  MetadataCache.load();
  CustomFields.load();
  HistoryLog.load();
  OwnerConfig.render();
  MB_USER_AGENT = buildMBUserAgent();
  ensureValidCat();
  renderTabs(); renderAll(); bindEvents();
  Undo.updateBadge();
  AutoBackup.syncToggle(); AutoBackup.updateBadge();
  try { await FileSystemDefault.load(); FileSystemDefault.refreshBadge(); } catch(e){ console.warn("Folder load:", e); }
  console.log(`%c💿 Discografía v${APP_VERSION} — ${DEFAULT_AUTHOR} · ${DEFAULT_PHONE}`, "color:#4fc3f7;font-weight:bold;font-size:15px");
  console.log(`%c   Modo carpeta: ${FileSystemDefault.getMode()}`, "color:#8b97a8");
  console.log(`%c   Viewport: ${window.innerWidth}×${window.innerHeight} · ${window.matchMedia('(max-width:768px)').matches ? 'MÓVIL' : 'DESKTOP'}`, "color:#8b97a8");
  if (!getDiscogsToken()) setTimeout(() => Toast.show("💡 Sin token de Discogs. Menú ⚙️ → 🎚️ Configurar Discogs.", "info", 8000), 1500);
  await initV6();
  if (Store.isEmpty) Toast.show("Base vacía. Creá tu primera categoría con Ctrl+K 📁", "warn", 6000);
  maybeShowLegalOnFirstRun();
}

init();