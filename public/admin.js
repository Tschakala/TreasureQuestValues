let adminToken = '';
let adminItems = [];
let editingItemId = null;

const adminLoginPanel = document.getElementById('admin-login-panel');
const adminLoginForm = document.getElementById('admin-login-form');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginError = document.getElementById('admin-login-error');
const adminPanel = document.getElementById('admin-panel');
const adminLogout = document.getElementById('admin-logout');
const adminForm = document.getElementById('admin-form');
const adminNameInput = document.getElementById('admin-name');
const adminValueInput = document.getElementById('admin-value');
const adminExistCountInput = document.getElementById('admin-exist-count');
const adminDemandInput = document.getElementById('admin-demand');
const adminRarityInput = document.getElementById('admin-rarity');
const adminPentagonRarityInput = document.getElementById('admin-pentagon-rarity');
const adminImageUrlInput = document.getElementById('admin-image-url');
const adminItemList = document.getElementById('admin-item-list');
const adminItemSearchInput = document.getElementById('admin-item-search');
const adminFormSubmit = document.getElementById('admin-form-submit');
const adminFormCancel = document.getElementById('admin-form-cancel');
const adminUploadFile = document.getElementById('admin-upload-file');
const adminUploadBtn = document.getElementById('admin-upload-btn');
const adminUploadStatus = document.getElementById('admin-upload-status');

// Real in-game rarity (how rare an item is to find for a player). Independent from demand
// and from the purely visual pentagon color below.
const RARITIES = ['Common', 'Rare', 'Very Rare', 'Extinct'];

function normalizeRarity(rarity) {
  const value = String(rarity || '').trim().toLowerCase();
  const match = RARITIES.find((option) => option.toLowerCase() === value);
  return match || 'Common';
}

// Purely visual pentagon color - has nothing to do with the real Rarity above.
const PENTAGON_RARITIES = ['Ultimate', 'Mythical', 'Legendary', 'Rare', 'Common', 'Unique'];

function normalizePentagonRarity(pentagonRarity) {
  const value = String(pentagonRarity || '').trim().toLowerCase();
  const match = PENTAGON_RARITIES.find((option) => option.toLowerCase() === value);
  return match || 'Common';
}

function formatValue(value) {
  return Number(value).toFixed(1);
}

function normalizeDemand(demand) {
  const value = String(demand || '').trim().toLowerCase();

  if (value === 'lack of circulation') return 'Lack of Circulation';
  if (value === 'very low') return 'Very Low';
  if (value === 'low') return 'Low';
  if (value === 'high') return 'High';
  if (value === 'very high') return 'Very High';

  return 'Medium';
}

function getDemandBadgeClass(demand) {
  const normalized = normalizeDemand(demand);
  return normalized.toLowerCase().replace(/\s+/g, '-');
}

function renderItemImage(item) {
  const url = (item.imageUrl || '').trim();
  const pentagonRarity = normalizePentagonRarity(item.pentagonRarity);

  const pentagon = `<svg class="rarity-pentagon rarity-pentagon-${pentagonRarity.toLowerCase()}" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,2 95.65,35.17 78.21,88.83 21.79,88.83 4.35,35.17" /></svg>`;

  const image = url
    ? `<img class="card-image" src="${url}" alt="${item.name}" loading="lazy" onerror="this.classList.add('card-image-error')" />`
    : '<div class="card-image card-image-placeholder">?</div>';

  return `<div class="card-image-wrap">${pentagon}${image}</div>`;
}

function hasImage(item) {
  return Boolean((item.imageUrl || '').trim());
}

function adminHeaders(extra = {}) {
  return {'x-admin-token': adminToken,...extra};
}

async function fetchItems(search = '') {
  const url = search ? `/api/items?search=${encodeURIComponent(search)}` : '/api/items';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load items.');
  return response.json();
}

async function loadAndRenderAdminItems() {
  adminItems = await fetchItems('');
  renderAdminTable();
}

function renderAdminTable() {
  adminItemList.innerHTML = '';

  const query = adminItemSearchInput.value.trim().toLowerCase();
  const filtered = query === '?'
    ? adminItems.filter((item) => !hasImage(item))
    : query
      ? adminItems.filter((item) => item.name.toLowerCase().includes(query))
      : adminItems;

  const sortedFiltered = filtered.sort((a, b) => b.value - a.value);

  sortedFiltered.forEach((item) => {
    const demand = normalizeDemand(item.demand);
    const demandClass = getDemandBadgeClass(item.demand);
    const rarity = normalizeRarity(item.rarity);
    const pentagonRarity = normalizePentagonRarity(item.pentagonRarity);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${renderItemImage(item)}</td>
      <td>${item.name}</td>
      <td>${formatValue(item.value)}</td>
      <td>${item.existCount ?? 0}</td>
      <td><span class="demand-badge demand-${demandClass}">${demand}</span></td>
      <td>${rarity}</td>
      <td>${pentagonRarity}</td>
      <td>
        <div class="admin-actions">
          <button type="button" class="ghost-btn" data-action="edit" data-id="${item.id}">Edit</button>
          <button type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;
    adminItemList.appendChild(row);
  });
}

function getItemById(id) {
  return adminItems.find((item) => item.id === id);
}

function startEditItem(id) {
  const item = getItemById(id);
  if (!item) return;

  editingItemId = id;
  adminNameInput.value = item.name;
  adminValueInput.value = item.value;
  adminExistCountInput.value = item.existCount ?? 0;
  adminDemandInput.value = normalizeDemand(item.demand);
  adminRarityInput.value = normalizeRarity(item.rarity);
  adminPentagonRarityInput.value = normalizePentagonRarity(item.pentagonRarity);
  adminImageUrlInput.value = item.imageUrl || '';
  adminFormSubmit.textContent = 'Save Changes';
  adminFormCancel.classList.remove('hidden');
  adminNameInput.focus();
}

function stopEditItem() {
  editingItemId = null;
  adminForm.reset();
  adminFormSubmit.textContent = 'Save Item';
  adminFormCancel.classList.add('hidden');
}

function showAdminPanel() {
  adminLoginPanel.classList.add('hidden');
  adminPanel.classList.remove('hidden');
}

function showLoginPanel() {
  adminPanel.classList.add('hidden');
  adminLoginPanel.classList.remove('hidden');
  adminPasswordInput.value = '';
  adminPasswordInput.focus();
}

adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const password = adminPasswordInput.value.trim();
  adminLoginError.textContent = '';

  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      password
    })
  }).catch(() => null);

  if (!response || !response.ok) {
    adminLoginError.textContent = 'Falsches Passwort.';
    return;
  }

  const data = await response.json();

  adminToken = data.token;

  showAdminPanel();
  await loadAndRenderAdminItems();
});

adminLogout.addEventListener('click', () => {
  adminToken = '';
  stopEditItem();
  showLoginPanel();
});

adminForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = adminNameInput.value.trim();
  const value = Number(adminValueInput.value);
  const existCount = Number(adminExistCountInput.value || 0);
  const demand = adminDemandInput.value;
  const rarity = adminRarityInput.value;
  const pentagonRarity = adminPentagonRarityInput.value;
  const imageUrl = adminImageUrlInput.value.trim();

  if (!name || Number.isNaN(value) || value < 0) {
    return;
  }

  const isEditing = Boolean(editingItemId);
  const url = isEditing ? `/api/items/${editingItemId}` : '/api/items';
  const method = isEditing ? 'PUT' : 'POST';

  console.log({
    name,
    value,
    demand,
    rarity,
    pentagonRarity
  });

  const response = await fetch(url, {
    method,
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name, value, existCount, demand, rarity, pentagonRarity, imageUrl })
  });

  if (!response.ok) {
    alert(isEditing ? 'Aktualisieren fehlgeschlagen. Admin-Passwort korrekt?' : 'Speichern fehlgeschlagen. Admin-Passwort korrekt?');
    return;
  }

  stopEditItem();
  await loadAndRenderAdminItems();
});

adminFormCancel.addEventListener('click', () => {
  stopEditItem();
});

adminItemSearchInput.addEventListener('input', () => {
  renderAdminTable();
});

adminItemList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === 'edit') {
    startEditItem(id);
    return;
  }

  const response = await fetch(`/api/items/${id}`, {
    method: 'DELETE',
    headers: adminHeaders()
  });

  if (!response.ok) {
    alert('Löschen fehlgeschlagen. Admin-Passwort korrekt?');
    return;
  }

  if (editingItemId === id) {
    stopEditItem();
  }

  await loadAndRenderAdminItems();
});

adminUploadBtn.addEventListener('click', async () => {
  const file = adminUploadFile.files[0];
  if (!file) {
    adminUploadStatus.textContent = 'Bitte zuerst eine Datei auswählen.';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  adminUploadStatus.textContent = 'Lade hoch...';

  try {
    const response = await fetch('/api/items/upload', {
      method: 'POST',
      headers: adminHeaders(),
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      adminUploadStatus.textContent = `Fehler: ${result.error || 'Upload fehlgeschlagen.'}`;
      return;
    }

    adminUploadStatus.textContent = `${result.inserted} Item(s) erfolgreich hochgeladen.`;
    adminUploadFile.value = '';
    await loadAndRenderAdminItems();
  } catch {
    adminUploadStatus.textContent = 'Upload fehlgeschlagen. Server erreichbar?';
  }
});

showLoginPanel();
