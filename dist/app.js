const tabs = [...document.querySelectorAll('.day-tab')];
const panels = [...document.querySelectorAll('.day-panel')];
function selectDay(day, focus = false) {
  tabs.forEach(tab => {
    const active = tab.dataset.day === day;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });
  panels.forEach(panel => { panel.hidden = panel.id !== `day-${day}`; });
  try { sessionStorage.setItem('dongji-selected-day', day); } catch (_) {}
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectDay(tab.dataset.day));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectDay(tabs[next].dataset.day, true);
  });
});
const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todayMatch = today.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
let initialDay = '03';
if (todayMatch && todayMatch[3] === '2026' && todayMatch[1] === '10' && Number(todayMatch[2]) >= 3 && Number(todayMatch[2]) <= 6) initialDay = todayMatch[2];
try { initialDay = sessionStorage.getItem('dongji-selected-day') || initialDay; } catch (_) {}
if (tabs.some(tab => tab.dataset.day === initialDay)) selectDay(initialDay);

// High-level map searches avoid stale route coordinates; the traveler checks the exact result before navigation.
document.querySelectorAll('[data-map]').forEach(link => {
  const city = link.dataset.city || '舟山';
  const params = new URLSearchParams({ keyword: link.dataset.map, city, view: 'map', callnative: '1', src: 'dongji-trip-2026' });
  link.href = `https://uri.amap.com/search?${params}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});

const checks = [...document.querySelectorAll('[data-check]')];
const progress = document.getElementById('check-progress');
function updateProgress() { progress.textContent = `已完成 ${checks.filter(check => check.checked).length} / ${checks.length} 项`; }
try {
  let stored = JSON.parse(localStorage.getItem('dongji-trip-checks-v2') || 'null');
  if (!stored) {
    const previous = JSON.parse(localStorage.getItem('dongji-trip-checks') || 'null');
    const oldIndexes = { 'dog-size': 0, 'dog-ship': 3, hotels: 5, rental: 6, 'dog-kit': 1, health: 2, personal: 8, offline: 9, 'ship-status': 7, restaurant: 11 };
    stored = Array.isArray(previous) ? Object.fromEntries(Object.entries(oldIndexes).map(([key, index]) => [key, Boolean(previous[index])])) : {};
  }
  checks.forEach(check => { check.checked = Boolean(stored[check.dataset.check]); });
} catch (_) { /* Checklist remains usable without browser storage. */ }
checks.forEach(check => check.addEventListener('change', () => {
  updateProgress();
  try { localStorage.setItem('dongji-trip-checks-v2', JSON.stringify(Object.fromEntries(checks.map(item => [item.dataset.check, item.checked])))); } catch (_) {}
}));
updateProgress();
