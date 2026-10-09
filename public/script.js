// API Configuration - use same origin (no need to specify port/protocol)
const API_BASE_URL = '';

// Mobile menu
const menuToggle = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');

menuToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  mobileMenu.classList.toggle('active');
});

// Close menu when clicking on a tab or link
document.querySelectorAll('.mobile-menu .tab, .mobile-menu .ghost-btn').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    mobileMenu.classList.remove('active');
  });
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (mobileMenu.classList.contains('active') && 
      !mobileMenu.contains(e.target) && 
      !menuToggle.contains(e.target)) {
    mobileMenu.classList.remove('active');
  }
});

const valueGrid = document.getElementById('value-grid');
const itemCountBadge = document.getElementById('item-count-badge');
const itemSearchInput = document.getElementById('item-search');
const sortSelect = document.getElementById('sort-select');
const noResultsMessage = document.getElementById('no-results');
const offerList = document.getElementById('offer-list');
const counterList = document.getElementById('counter-list');
const offerCountBadge = document.getElementById('offer-count');
const counterCountBadge = document.getElementById('counter-count');
const offerTotalBox = document.getElementById('offer-total');
const counterTotalBox = document.getElementById('counter-total');
const tradeResult = document.getElementById('trade-result');
const itemPickerModal = document.getElementById('item-picker-modal');
const pickerTitle = document.getElementById('picker-title');
const pickerClose = document.getElementById('picker-close');
const pickerSearchInput = document.getElementById('picker-search');
const pickerGrid = document.getElementById('picker-grid');
const pickerNoResults = document.getElementById('picker-no-results');
const itemDetailModal = document.getElementById('item-detail-modal');
const detailClose = document.getElementById('detail-close');
const detailTitle = document.getElementById('detail-title');
const detailImage = document.getElementById('detail-image');
const detailCurrentValue = document.getElementById('detail-current-value');
const detailDemand = document.getElementById('detail-demand');
const detailExist = document.getElementById('detail-exist');
let detailChartCanvas = document.getElementById('detail-chart');
const tabs = Array.from(document.querySelectorAll('.tab'));
const tabPanels = {
  list: document.getElementById('tab-list'),
  calc: document.getElementById('tab-calc')
};
const resetBtn = document.getElementById('reset-btn');

let items = [];
let allItems = [];
let offerItems = [];
let counterItems = [];
let currentPickerSide = null;
let currentSort = 'value-desc';
let detailChart = null;
let detailItemId = null;
let detailUpdateInterval = null;
let selectedTimeFilter = '1D';

function formatValue(value) {
  return Number(value).toFixed(1);
}

function formatExistCount(existCount) {
  const count = existCount ?? 0;
  return count === 0 ? 'N/A' : count;
}

function sortItems(itemsToSort, sortType) {
  const sorted = [...itemsToSort];

  switch (sortType) {
    case 'value-desc':
      sorted.sort((a, b) => b.value - a.value);
      break;
    case 'value-asc':
      sorted.sort((a, b) => a.value - b.value);
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'demand-low':
      const demandOrder = {'Lack of Circulation': 0, 'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5};
      sorted.sort((a, b) => {
        const demandA = demandOrder[normalizeDemand(a.demand)];
        const demandB = demandOrder[normalizeDemand(b.demand)];
        return demandA - demandB;
      });
      break;
    case 'demand-high':
      const demandOrderHigh = {'Very High': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'Very Low': 4, 'Lack of Circulation': 5};
      sorted.sort((a, b) => {
        const demandA = demandOrderHigh[normalizeDemand(a.demand)];
        const demandB = demandOrderHigh[normalizeDemand(b.demand)];
        return demandA - demandB;
      });
      break;
    case 'exist-desc':
      sorted.sort((a, b) => {
        const aCount = a.existCount ?? 0;
        const bCount = b.existCount ?? 0;
        if ((aCount === 0) !== (bCount === 0)) {
          return aCount === 0 ? 1 : -1;
        }
        return bCount - aCount;
      });
      break;
    case 'exist-asc':
      sorted.sort((a, b) => {
        const aCount = a.existCount ?? 0;
        const bCount = b.existCount ?? 0;
        if ((aCount === 0) !== (bCount === 0)) {
          return aCount === 0 ? 1 : -1;
        }
        return aCount - bCount;
      });
      break;
    default:
      sorted.sort((a, b) => b.value - a.value);
  }

  return sorted;
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

// Real in-game rarity (how rare an item is to find for a player). Shown as a small,
// colorless text on item cards - completely independent from demand and from the
// purely visual pentagon color below.
const RARITIES = ['Common', 'Rare', 'Very Rare', 'Extinct'];

function normalizeRarity(rarity) {
  const value = String(rarity || '').trim().toLowerCase();
  const match = RARITIES.find((option) => option.toLowerCase() === value);
  return match || 'Common';
}

// Purely visual pentagon rarity, set in the separate admin "Rarity" tab. It has no relation
// to demand or any other data - its only effect is the colored pentagon behind the item image.
const PENTAGON_RARITIES = ['Ultimate', 'Mythical', 'Legendary', 'Rare', 'Common', 'Unique'];

function normalizePentagonRarity(pentagonRarity) {
  const value = String(pentagonRarity || '').trim().toLowerCase();
  const match = PENTAGON_RARITIES.find((option) => option.toLowerCase() === value);
  return match || 'Common';
}

function renderItemImage(item) {
  const url = (item.imageUrl || '').trim();
  const pentagonRarity = normalizePentagonRarity(item.pentagonRarity);
  // Regular pentagon, vertices computed around its own center so all 5 sides and corners
  // are perfectly symmetric - rendered as an SVG outline so the stroke stays a uniform
  // width on every side and scales cleanly with the card size.
  const pentagon = `<svg class="rarity-pentagon rarity-pentagon-${pentagonRarity.toLowerCase()}" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,2 95.65,35.17 78.21,88.83 21.79,88.83 4.35,35.17" /></svg>`;
  const image = url
    ? `<img class="card-image" src="${url}" alt="${item.name}" loading="lazy" onerror="this.classList.add('card-image-error')" />`
    : '<div class="card-image card-image-placeholder">?</div>';
  return `<div class="card-image-wrap">${pentagon}${image}</div>`;
}

async function fetchItems(search = '') {
  const url = search ? `${API_BASE_URL}/api/items?search=${encodeURIComponent(search)}` : `${API_BASE_URL}/api/items`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load items.');
  return response.json();
}

async function loadAndRenderItems(search = '') {
  items = await fetchItems(search);
  renderPublicItems();
  await refreshAllItemsCache();
}

async function refreshAllItemsCache() {
  allItems = await fetchItems('');
}

function renderPublicItems() {
  valueGrid.innerHTML = '';

  const sortedItems = sortItems(items, currentSort);

  sortedItems.forEach((item) => {
    const demand = normalizeDemand(item.demand);
    const demandClass = getDemandBadgeClass(item.demand);
    const rarity = normalizeRarity(item.rarity);
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      ${renderItemImage(item)}
      <div class="card-body">
        <h3>${item.name}</h3>
        <span class="demand-badge demand-${demandClass}">${demand}</span>
        <div class="card-value">${formatValue(item.value)}</div>
        <div class="card-rarity-text">${rarity}</div>
        <div class="card-exist-count">Exist: ${formatExistCount(item.existCount)}</div>
      </div>
    `;
    card.addEventListener('click', () => openItemDetail(item.id));
    valueGrid.appendChild(card);
  });

  itemCountBadge.textContent = `${items.length} Items`;
  noResultsMessage.classList.toggle('hidden', items.length !== 0);
}

function getItemById(id) {
  return allItems.find((item) => item.id === id);
}

function updateTradeTotals() {
  const offerTotal = offerItems.reduce((sum, item) => sum + item.value * item.qty, 0);
  const counterTotal = counterItems.reduce((sum, item) => sum + item.value * item.qty, 0);

  offerTotalBox.textContent = formatValue(offerTotal);
  counterTotalBox.textContent = formatValue(counterTotal);

  if (offerTotal === 0 && counterTotal === 0) {
    tradeResult.textContent = 'Choose some items first.';
    return;
  }

  const diff = Math.abs(offerTotal - counterTotal);
  tradeResult.textContent = offerTotal > counterTotal
    ? `Your side is ${formatValue(diff)} higher.`
    : offerTotal < counterTotal
      ? `The other side is ${formatValue(diff)} higher.`
      : 'Both sides are equal.';
}

function renderTradeList(target, listElement, side) {
  const addTileHtml = `
    <button class="add-tile" type="button" data-side="${side}">
      <span class="add-tile-icon">+</span>
      <span>Add Items</span>
    </button>
  `;

  const sortedTarget = sortItems(target, currentSort);

  const tilesHtml = sortedTarget
    .map(
      (entry) => {
        const demand = normalizeDemand(entry.demand);
        const demandClass = getDemandBadgeClass(entry.demand);
        const rarity = normalizeRarity(entry.rarity);
        return `
        <div class="trade-item-tile">
          <button class="trade-item-remove" type="button" data-side="${entry.side}" data-id="${entry.id}">✕</button>
          ${renderItemImage(entry)}
          <div class="trade-item-name">${entry.name}</div>
          <span class="demand-badge demand-${demandClass}">${demand}</span>
          <div class="trade-item-value">${formatValue(entry.value)} each</div>
          <div class="card-rarity-text">${rarity}</div>
          <div class="trade-item-qty">
            <button type="button" data-action="dec" data-side="${entry.side}" data-id="${entry.id}">−</button>
            <input type="number" min="1" value="${entry.qty}" data-side="${entry.side}" data-id="${entry.id}" class="qty-input" />
            <button type="button" data-action="inc" data-side="${entry.side}" data-id="${entry.id}">+</button>
          </div>
        </div>
      `;
      }
    )
    .join('');

  listElement.innerHTML = addTileHtml + tilesHtml;
}

function addTradeEntry(side, itemId, qty = 1) {
  const item = getItemById(itemId);
  if (!item || qty < 1) return;

  const target = side === 'offer' ? offerItems : counterItems;
  const existing = target.find((entry) => entry.id === itemId);

  if (existing) {
    existing.qty += qty;
  } else {
    target.push({ ...item, qty, side });
  }

  renderTradeList(offerItems, offerList, 'offer');
  renderTradeList(counterItems, counterList, 'counter');
  updateCountBadges();
  updateTradeTotals();
}

function changeTradeQty(side, itemId, delta) {
  const target = side === 'offer' ? offerItems : counterItems;
  const entry = target.find((item) => item.id === itemId);
  if (!entry) return;

  entry.qty += delta;

  if (entry.qty <= 0) {
    removeTradeEntry(side, itemId);
    return;
  }

  renderTradeList(offerItems, offerList, 'offer');
  renderTradeList(counterItems, counterList, 'counter');
  updateTradeTotals();
}

function removeTradeEntry(side, itemId) {
  if (side === 'offer') {
    offerItems = offerItems.filter((entry) => entry.id !== itemId);
  } else {
    counterItems = counterItems.filter((entry) => entry.id !== itemId);
  }

  renderTradeList(offerItems, offerList, 'offer');
  renderTradeList(counterItems, counterList, 'counter');
  updateCountBadges();
  updateTradeTotals();
}

function updateCountBadges() {
  offerCountBadge.textContent = offerItems.reduce((sum, item) => sum + item.qty, 0);
  counterCountBadge.textContent = counterItems.reduce((sum, item) => sum + item.qty, 0);
}

function resetCalculator() {
  offerItems = [];
  counterItems = [];
  renderTradeList(offerItems, offerList, 'offer');
  renderTradeList(counterItems, counterList, 'counter');
  updateCountBadges();
  updateTradeTotals();
}

async function openItemDetail(itemId) {
  const item = getItemById(itemId);
  if (!item) return;

  // Clean up any existing chart before opening new detail
  if (detailChart) {
    try {
      detailChart.destroy();
    } catch (err) {
      console.error('Error destroying existing chart:', err);
    }
    detailChart = null;
  }
  if (detailUpdateInterval) clearInterval(detailUpdateInterval);

  detailItemId = itemId;
  detailTitle.textContent = item.name;
  detailCurrentValue.textContent = formatValue(item.value);
  detailDemand.textContent = normalizeDemand(item.demand);
  detailExist.textContent = formatExistCount(item.existCount);

  const imageUrl = (item.imageUrl || '').trim();

  detailImage.src = '';
  detailImage.alt = '';

  if (imageUrl) {
    detailImage.src = imageUrl;
    detailImage.alt = item.name;
    detailImage.style.display = 'block';
  } else {
    detailImage.style.display = 'none';
  }

  itemDetailModal.classList.remove('hidden');
  await updateDetailChart();

  // Only set up interval if modal is still open (wasn't closed while chart was loading)
  if (detailItemId === itemId && !itemDetailModal.classList.contains('hidden')) {
    if (detailUpdateInterval) clearInterval(detailUpdateInterval);
    detailUpdateInterval = setInterval(updateDetailChart, 3000);
  }
}

function closeItemDetail() {
  detailItemId = null;
  itemDetailModal.classList.add('hidden');
  if (detailUpdateInterval) {
    clearInterval(detailUpdateInterval);
    detailUpdateInterval = null;
  }
  if (detailChart) {
    try {
      detailChart.destroy();
    } catch (err) {
      console.error('Error destroying chart:', err);
    }
    detailChart = null;
  }

  // Recreate canvas element to reset Chart.js state
  const canvasParent = detailChartCanvas.parentElement;
  detailChartCanvas.remove();
  const newCanvas = document.createElement('canvas');
  newCanvas.id = 'detail-chart';
  newCanvas.className = 'detail-chart';
  canvasParent.appendChild(newCanvas);
  detailChartCanvas = newCanvas;
}

async function updateDetailChart() {
  if (!detailItemId) return;

  const item = getItemById(detailItemId);
  if (!item) return;

  detailCurrentValue.textContent = formatValue(item.value);

  try {
    const response = await fetch(`${API_BASE_URL}/api/items/${detailItemId}/history`);
    let history = await response.json();

    // Ensure we have at least one data point
    if (!Array.isArray(history) || history.length === 0) {
      history = [{ value: item.value, recorded_at: new Date().toISOString() }];
    }

    // Filter history based on selected time period
    const now = new Date();
    const filtered = history.filter(h => {
      const date = new Date(h.recorded_at);
      const diff = now - date;
      const days = diff / (1000 * 60 * 60 * 24);

      switch (selectedTimeFilter) {
        case '1D': return days <= 1;
        case '1W': return days <= 7;
        case '1M': return days <= 30;
        case '3M': return days <= 90;
        case '1Y': return days <= 365;
        case 'ALL': return true;
        default: return true;
      }
    });

    // Ensure at least one data point
    const dataToShow = filtered.length > 0 ? filtered : history.slice(-1);

    const labels = dataToShow.map(h => {
      const date = new Date(h.recorded_at);
      return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = dataToShow.map(h => h.value);

    if (detailChart) {
      detailChart.data.labels = labels;
      detailChart.data.datasets[0].data = values;
      detailChart.update();
    } else {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? '#e8e8e8' : '#1f2937';
      const gridColor = isDark ? '#3a3a3a' : '#d8e1ef';

      try {
        detailChart = new Chart(detailChartCanvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Value',
                data: values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 0,
                fill: true,
                pointRadius: 5,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7,
                tension: 0.3
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                displayColors: false
              }
            },
            scales: {
              x: {
                grid: { color: gridColor },
                ticks: { color: textColor }
              },
              y: {
                grid: { color: gridColor },
                ticks: { color: textColor }
              }
            }
          }
        });
      } catch (err) {
        console.error('Error creating chart:', err);
      }
    }
  } catch (err) {
    console.error('Failed to load item history:', err);
  }
}


let searchDebounce;
itemSearchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    loadAndRenderItems(itemSearchInput.value.trim()).catch(() => {
      noResultsMessage.textContent = 'Could not load items.';
      noResultsMessage.classList.remove('hidden');
    });
  }, 200);
});

sortSelect.addEventListener('change', () => {
  currentSort = sortSelect.value;
  renderPublicItems();
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const nextTab = tab.dataset.tab;

    tabs.forEach((button) => button.classList.remove('active'));
    tab.classList.add('active');

    Object.entries(tabPanels).forEach(([key, panel]) => {
      panel.classList.toggle('active', key === nextTab);
    });
  });
});

function openPicker(side) {
  currentPickerSide = side;
  pickerTitle.textContent = side === 'offer' ? 'Add to My Items' : 'Add to Other Player';
  pickerSearchInput.value = '';
  itemPickerModal.classList.remove('hidden');
  renderPickerGrid('');
  pickerSearchInput.focus();
}

function closePicker() {
  currentPickerSide = null;
  itemPickerModal.classList.add('hidden');
}

function renderPickerGrid(filterText) {
  const query = filterText.trim().toLowerCase();
  const filtered = query
    ? allItems.filter((item) => item.name.toLowerCase().includes(query))
    : allItems;

  const sortedFiltered = sortItems(filtered, currentSort);

  pickerGrid.innerHTML = sortedFiltered
    .map(
      (item) => {
        const demand = normalizeDemand(item.demand);
        const demandClass = getDemandBadgeClass(item.demand);
        const rarity = normalizeRarity(item.rarity);
        return `
          <div class="picker-card card" data-id="${item.id}">
            ${renderItemImage(item)}
            <div class="card-body">
              <h3>${item.name}</h3>
              <span class="demand-badge demand-${demandClass}">
                ${demand}
              </span>
              <div class="card-value">
                ${formatValue(item.value)}
              </div>
              <div class="card-rarity-text">
                ${rarity}
              </div>
              <div class="card-exist-count">
                Exist: ${formatExistCount(item.existCount)}
              </div>
            </div>
          </div>
        `;
      }
    )
    .join('');

  pickerNoResults.classList.toggle('hidden', sortedFiltered.length !== 0);
}

pickerSearchInput.addEventListener('input', () => {
  renderPickerGrid(pickerSearchInput.value);
});

pickerGrid.addEventListener('click', (event) => {
  const button = event.target.closest('.picker-card');
  if (!button || !currentPickerSide) return;
  addTradeEntry(currentPickerSide, button.dataset.id, 1);
});

pickerClose.addEventListener('click', closePicker);

itemPickerModal.addEventListener('click', (event) => {
  if (event.target === itemPickerModal) {
    closePicker();
  }
});

detailClose.addEventListener('click', closeItemDetail);

itemDetailModal.addEventListener('click', (event) => {
  if (event.target === itemDetailModal) {
    closeItemDetail();
  }
});

document.addEventListener('click', (event) => {
  const filterBtn = event.target.closest('.filter-btn');
  if (filterBtn) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    filterBtn.classList.add('active');
    selectedTimeFilter = filterBtn.dataset.filter;
    updateDetailChart();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!itemPickerModal.classList.contains('hidden')) {
      closePicker();
    }
    if (!itemDetailModal.classList.contains('hidden')) {
      closeItemDetail();
    }
  }
});

function handleTradeGridClick(event) {
  const addTile = event.target.closest('.add-tile');
  if (addTile) {
    openPicker(addTile.dataset.side);
    return;
  }

  const removeBtn = event.target.closest('.trade-item-remove');
  if (removeBtn) {
    removeTradeEntry(removeBtn.dataset.side, removeBtn.dataset.id);
    return;
  }

  const qtyBtn = event.target.closest('[data-action]');
  if (qtyBtn) {
    const delta = qtyBtn.dataset.action === 'inc' ? 1 : -1;
    changeTradeQty(qtyBtn.dataset.side, qtyBtn.dataset.id, delta);
  }
}

function handleQtyInputChange(event) {
  const input = event.target.closest('.qty-input');
  if (!input) return;

  let newQty = parseInt(input.value, 10);
  if (isNaN(newQty) || newQty < 1) {
    newQty = 1;
  }

  const target = input.dataset.side === 'offer' ? offerItems : counterItems;
  const entry = target.find((item) => item.id === input.dataset.id);
  if (!entry) return;

  entry.qty = newQty;
  renderTradeList(offerItems, offerList, 'offer');
  renderTradeList(counterItems, counterList, 'counter');
  updateTradeTotals();
}

offerList.addEventListener('click', handleTradeGridClick);
counterList.addEventListener('click', handleTradeGridClick);
offerList.addEventListener('change', handleQtyInputChange);
counterList.addEventListener('change', handleQtyInputChange);

resetBtn.addEventListener('click', resetCalculator);

loadAndRenderItems()
  .then(() => {
    renderTradeList(offerItems, offerList, 'offer');
    renderTradeList(counterItems, counterList, 'counter');
    updateCountBadges();
    updateTradeTotals();
  })
  .catch(() => {
    noResultsMessage.textContent = 'Could not load items from server.';
    noResultsMessage.classList.remove('hidden');
  });

setInterval(refreshAllItemsCache, 5000);
