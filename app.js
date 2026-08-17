/* =========================================================
   MI BIBLIOTECA — lógica de la aplicación
   Base de datos: array de libros guardado en localStorage,
   exportable/importable como archivo .json (books.json)
   ========================================================= */

const STORAGE_KEY = "mi_biblioteca_books_v1";
const DATA_FILE = "books.json"; // se intenta cargar al arrancar si localStorage está vacío

let books = [];
let currentTab = "reading";
let editingId = null;
let selectedStatus = "quiero_leer";
let selectedRating = 0;
let searchDebounce = null;
let currentFilter = "all";
let currentViewMode = "grid";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------------- INIT ---------------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadBooks();
  renderAll();
  bindEvents();
}

async function loadBooks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      books = JSON.parse(saved);
      return;
    } catch (e) { /* fall through */ }
  }
  // primera vez: intenta cargar books.json de al lado del index.html
  try {
    const res = await fetch(DATA_FILE, { cache: "no-store" });
    if (res.ok) {
      books = await res.json();
      saveBooks();
    } else {
      books = [];
    }
  } catch (e) {
    books = [];
  }
}

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function uid() {
  return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

/* ---------------- RENDER ---------------- */
function renderAll() {
  renderGrid("leido_leyendo", "gridReading", "emptyReading");
  renderGrid("quiero_leer", "gridWishlist", "emptyWishlist");
  renderShelf();
}

function renderGrid(group, gridId, emptyId) {
  const grid = $("#" + gridId);
  const empty = $("#" + emptyId);
  let list;
  if (group === "leido_leyendo") {
    list = books.filter(b => b.status === "leido" || b.status === "leyendo");
    if (currentFilter !== "all") {
      list = list.filter(b => b.status === currentFilter);
    }
  } else {
    list = books.filter(b => b.status === "quiero_leer");
  }

  grid.innerHTML = "";

  if (currentViewMode === "list") {
    grid.classList.add("view-list");
  } else {
    grid.classList.remove("view-list");
  }

  if (list.length === 0) {
    if (group === "leido_leyendo") {
      if (currentFilter === "leyendo") {
        empty.innerHTML = "No tienes ningún libro en estado <strong>Leyendo</strong> en este momento.";
      } else if (currentFilter === "leido") {
        empty.innerHTML = "No tienes ningún libro en estado <strong>Leído</strong> en este momento.";
      } else {
        empty.innerHTML = "Aún no has añadido ningún libro leído. Pulsa el botón <strong>+</strong> para empezar tu estantería.";
      }
    }
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.forEach(book => {
    grid.appendChild(buildCard(book));
  });
}

function buildCard(book) {
  const card = document.createElement("div");
  card.className = "book-card status-" + book.status;

  const cover = document.createElement("div");
  cover.className = "book-cover";
  if (book.cover) {
    cover.style.backgroundImage = `url(${book.cover})`;
  } else {
    cover.textContent = book.title || "Sin título";
  }
  const flag = document.createElement("span");
  flag.className = "status-flag " + book.status;
  flag.textContent = book.status === "leido" ? "Leído" : book.status === "leyendo" ? "Leyendo" : "Pendiente";
  cover.appendChild(flag);
  card.appendChild(cover);

  const body = document.createElement("div");
  body.className = "book-body";

  const infoMain = document.createElement("div");
  infoMain.className = "book-info-main";

  const title = document.createElement("div");
  title.className = "book-title";
  title.textContent = book.title || "Sin título";
  infoMain.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "book-meta";
  meta.textContent = [book.author, book.year, book.publisher].filter(Boolean).join(" · ");
  infoMain.appendChild(meta);

  const stars = document.createElement("div");
  const filled = book.rating || 0;
  stars.className = "book-stars" + (filled === 0 ? " empty" : "");
  stars.textContent = filled === 0 ? "☆☆☆☆☆" : "★".repeat(filled) + "☆".repeat(5 - filled);
  infoMain.appendChild(stars);

  if (book.comments) {
    const c = document.createElement("div");
    c.className = "book-comments";
    c.textContent = book.comments;
    infoMain.appendChild(c);
  }

  body.appendChild(infoMain);

  const footer = document.createElement("div");
  footer.className = "book-footer";

  if (book.status !== "quiero_leer") {
    const label = document.createElement("label");
    label.className = "finished-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = book.status === "leido";
    cb.addEventListener("change", () => {
      book.status = cb.checked ? "leido" : "leyendo";
      saveBooks();
      renderAll();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode("Terminado"));
    footer.appendChild(label);
  } else {
    footer.appendChild(document.createElement("span"));
  }

  const editBtn = document.createElement("button");
  editBtn.className = "edit-link";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", () => openModal(book.id));
  footer.appendChild(editBtn);

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}

/* ---------------- SHELF (recomendaciones) ---------------- */
async function renderShelf() {
  const track = $("#shelfTrack");
  track.innerHTML = "";

  const favorites = books.filter(b => b.status === "leido" && (b.rating || 0) >= 4);
  const source = favorites.length ? favorites : books;

  if (source.length === 0) {
    track.innerHTML = `<div class="spine placeholder">Añade libros a tu biblioteca<br>para ver recomendaciones aquí</div>`;
    return;
  }

  // toma hasta 3 autores/géneros distintos de tus favoritos como semillas
  const seeds = [...new Set(source.map(b => b.author).filter(Boolean))].slice(0, 3);
  if (seeds.length === 0) {
    track.innerHTML = `<div class="spine placeholder">Añade autor o género a tus libros<br>para ver recomendaciones</div>`;
    return;
  }

  track.innerHTML = `<div class="spine placeholder">Buscando<br>recomendaciones...</div>`;

  try {
    const results = [];
    for (const author of seeds) {
      const res = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=6&fields=title,author_name,cover_i`);
      if (!res.ok) continue;
      const data = await res.json();
      (data.docs || []).forEach(d => results.push(d));
    }
    // filtra libros que ya tenemos
    const ownedTitles = new Set(books.map(b => (b.title || "").toLowerCase()));
    const filtered = results.filter(d => d.title && !ownedTitles.has(d.title.toLowerCase()));
    const unique = [];
    const seenTitles = new Set();
    for (const d of filtered) {
      const key = d.title.toLowerCase();
      if (!seenTitles.has(key)) { seenTitles.add(key); unique.push(d); }
      if (unique.length >= 12) break;
    }

    track.innerHTML = "";
    if (unique.length === 0) {
      track.innerHTML = `<div class="spine placeholder">No encontramos recomendaciones<br>nuevas por ahora</div>`;
      return;
    }
    unique.forEach((d, i) => {
      const spine = document.createElement("div");
      spine.className = "spine";
      spine.style.setProperty("--tilt", (i % 2 === 0 ? "-1.5deg" : "1.5deg"));
      if (d.cover_i) {
        spine.style.backgroundImage = `url(https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg)`;
      } else {
        spine.style.background = "linear-gradient(160deg, var(--wood-light), var(--wood))";
      }
      const info = document.createElement("div");
      info.className = "spine-info";
      info.innerHTML = `<span class="spine-title">${escapeHtml(d.title)}</span><span class="spine-sub">${escapeHtml((d.author_name || [])[0] || "")}</span>`;
      spine.appendChild(info);
      track.appendChild(spine);
    });
  } catch (e) {
    track.innerHTML = `<div class="spine placeholder">No se pudieron cargar<br>recomendaciones ahora mismo</div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* ---------------- MODAL ---------------- */
function openModal(bookId) {
  editingId = bookId || null;
  const overlay = $("#modalOverlay");
  const book = bookId ? books.find(b => b.id === bookId) : null;

  $("#modalTitle").textContent = book ? "Editar libro" : "Añadir libro";
  $("#btnDelete").hidden = !book;
  $("#searchInput").value = "";
  $("#autocompleteList").hidden = true;

  $("#titleInput").value = book?.title || "";
  $("#yearInput").value = book?.year || "";
  $("#authorInput").value = book?.author || "";
  $("#publisherInput").value = book?.publisher || "";
  $("#genreInput").value = book?.genre || "";
  $("#commentsInput").value = book?.comments || "";
  $("#coverUrlInput").value = "";

  setCoverPreview(book?.cover || "");

  selectedStatus = book?.status || (currentTab === "wishlist" ? "quiero_leer" : "leido");
  updateStatusUI();

  selectedRating = book?.rating || 0;
  updateStarsUI();

  overlay.hidden = false;
}

function closeModal() {
  $("#modalOverlay").hidden = true;
  editingId = null;
}

function setCoverPreview(url) {
  const img = $("#coverImg");
  const placeholder = $("#coverPlaceholder");
  if (url) {
    img.src = url;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.hidden = true;
    placeholder.hidden = false;
  }
  $("#coverPreview").dataset.cover = url || "";
}

function updateStatusUI() {
  $$(".status-opt").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.status === selectedStatus);
  });
}

function updateStarsUI() {
  $$(".star").forEach(btn => {
    const val = Number(btn.dataset.val);
    btn.classList.toggle("filled", val <= selectedRating);
  });
}

function saveFromModal() {
  const title = $("#titleInput").value.trim();
  if (!title) {
    showToast("Escribe al menos el título del libro");
    return;
  }
  const cover = $("#coverUrlInput").value.trim() || $("#coverPreview").dataset.cover || "";

  const data = {
    title,
    year: $("#yearInput").value.trim(),
    author: $("#authorInput").value.trim(),
    publisher: $("#publisherInput").value.trim(),
    genre: $("#genreInput").value.trim(),
    cover,
    status: selectedStatus,
    rating: selectedStatus === "quiero_leer" ? 0 : selectedRating,
    comments: selectedStatus === "quiero_leer" ? "" : $("#commentsInput").value.trim(),
  };

  if (editingId) {
    const idx = books.findIndex(b => b.id === editingId);
    books[idx] = { ...books[idx], ...data };
  } else {
    books.push({ id: uid(), ...data });
  }
  saveBooks();
  renderAll();
  closeModal();
  showToast("Libro guardado");
}

function deleteCurrent() {
  if (!editingId) return;
  books = books.filter(b => b.id !== editingId);
  saveBooks();
  renderAll();
  closeModal();
  showToast("Libro eliminado");
}

/* ---------------- BÚSQUEDA / AUTOCOMPLETE ---------------- */
function handleSearchInput(e) {
  const q = e.target.value.trim();
  clearTimeout(searchDebounce);
  if (q.length < 3) {
    $("#autocompleteList").hidden = true;
    return;
  }
  searchDebounce = setTimeout(() => runSearch(q), 400);
}

async function runSearch(q) {
  const list = $("#autocompleteList");
  list.hidden = false;
  list.innerHTML = `<div class="ac-empty">Buscando...</div>`;
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=title,author_name,first_publish_year,publisher,subject,cover_i`);
    const data = await res.json();
    const docs = data.docs || [];
    if (docs.length === 0) {
      list.innerHTML = `<div class="ac-empty">Sin resultados. Puedes rellenar los campos a mano y añadir una foto.</div>`;
      return;
    }
    list.innerHTML = "";
    docs.forEach(d => {
      const item = document.createElement("div");
      item.className = "ac-item";
      const coverUrl = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg` : "";
      item.innerHTML = `
        ${coverUrl ? `<img src="${coverUrl}" alt="">` : `<div style="width:32px;height:46px;background:var(--paper-deep);flex-shrink:0;"></div>`}
        <div class="ac-text">
          <div>${escapeHtml(d.title)}</div>
          <div class="ac-author">${escapeHtml((d.author_name || [])[0] || "Autor desconocido")} · ${d.first_publish_year || "—"}</div>
        </div>`;
      item.addEventListener("click", () => selectSearchResult(d));
      list.appendChild(item);
    });
  } catch (e) {
    list.innerHTML = `<div class="ac-empty">No se pudo buscar. Rellena los campos a mano.</div>`;
  }
}

function selectSearchResult(d) {
  $("#titleInput").value = d.title || "";
  $("#authorInput").value = (d.author_name || [])[0] || "";
  $("#yearInput").value = d.first_publish_year || "";
  $("#publisherInput").value = (d.publisher || [])[0] || "";
  $("#genreInput").value = (d.subject || [])[0] || "";
  if (d.cover_i) {
    setCoverPreview(`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`);
  }
  $("#autocompleteList").hidden = true;
  $("#searchInput").value = "";
}

/* ---------------- FOTO DE PORTADA (cámara) ---------------- */
function handleCameraInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setCoverPreview(reader.result);
  reader.readAsDataURL(file);
}

/* ---------------- IMPORT / EXPORT JSON ---------------- */
function exportJson() {
  const blob = new Blob([JSON.stringify(books, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "books.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Archivo books.json descargado");
}

function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error("formato inválido");
      books = parsed;
      saveBooks();
      renderAll();
      showToast("Biblioteca importada correctamente");
    } catch (err) {
      showToast("El archivo no tiene un formato válido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

/* ---------------- TOAST ---------------- */
let toastTimer = null;
function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

/* ---------------- EVENTOS ---------------- */
function bindEvents() {
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      currentTab = tab.dataset.tab;
      $$(".tab-panel").forEach(p => p.classList.remove("active"));
      $("#panel-" + tab.dataset.tab).classList.add("active");

      const filterGroup = $("#filterGroup");
      if (currentTab === "wishlist") {
        filterGroup.style.display = "none";
      } else {
        filterGroup.style.display = "flex";
      }
    });
  });

  $("#btnAdd").addEventListener("click", () => openModal(null));
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });

  // Eventos de Filtro de Estado
  $$(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderAll();
    });
  });

  // Eventos de Alternar Modo de Vista (Cuadrícula / Lista)
  $("#btnViewGrid").addEventListener("click", () => {
    $("#btnViewGrid").classList.add("active");
    $("#btnViewList").classList.remove("active");
    currentViewMode = "grid";
    renderAll();
  });

  $("#btnViewList").addEventListener("click", () => {
    $("#btnViewList").classList.add("active");
    $("#btnViewGrid").classList.remove("active");
    currentViewMode = "list";
    renderAll();
  });

  $("#searchInput").addEventListener("input", handleSearchInput);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#searchInput") && !e.target.closest("#autocompleteList")) {
      $("#autocompleteList").hidden = true;
    }
  });

  $("#coverCamera").addEventListener("change", handleCameraInput);
  $("#coverUrlInput").addEventListener("input", (e) => setCoverPreview(e.target.value.trim()));

  $$(".status-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedStatus = btn.dataset.status;
      updateStatusUI();
    });
  });

  $$(".star").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedRating = Number(btn.dataset.val);
      updateStarsUI();
    });
  });
  $("#starClear").addEventListener("click", () => { selectedRating = 0; updateStarsUI(); });

  $("#btnSave").addEventListener("click", saveFromModal);
  $("#btnDelete").addEventListener("click", deleteCurrent);

  $("#btnExport").addEventListener("click", exportJson);
  $("#fileImport").addEventListener("change", importJson);

  $("#shelfPrev").addEventListener("click", () => {
    $("#shelfTrack").scrollBy({ left: -260, behavior: "smooth" });
  });
  $("#shelfNext").addEventListener("click", () => {
    $("#shelfTrack").scrollBy({ left: 260, behavior: "smooth" });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modalOverlay").hidden) closeModal();
  });
}
