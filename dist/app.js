const tabs = [...document.querySelectorAll('.day-tab')];
const panels = [...document.querySelectorAll('.day-panel')];
const chinaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
function todayDate() {
  const parts = Object.fromEntries(chinaDate.formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function todayDay() {
  const date = todayDate();
  return date < '2026-10-03' ? '03' : date > '2026-10-06' ? '06' : date.slice(-2);
}
function hashDay() { return window.location.hash.match(/^#day-(03|04|05|06)$/)?.[1]; }
function selectDay(day, { focus = false, updateHash = true } = {}) {
  const selected = tabs.find(tab => tab.dataset.day === day);
  if (!selected) return;
  tabs.forEach(tab => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  panels.forEach(panel => { panel.hidden = panel.id !== `day-${day}`; });
  if (focus) selected.focus({ preventScroll: true });
  const strip = selected.parentElement;
  const bounds = strip.getBoundingClientRect();
  const tabBounds = selected.getBoundingClientRect();
  if (tabBounds.left < bounds.left) strip.scrollLeft -= bounds.left - tabBounds.left;
  else if (tabBounds.right > bounds.right) strip.scrollLeft += tabBounds.right - bounds.right;
  try {
    sessionStorage.setItem('dongji-selected-day', day);
    sessionStorage.setItem('dongji-selected-date', todayDate());
  } catch (_) {}
  if (updateHash) {
    try { window.history.replaceState(null, '', `#day-${day}`); } catch (_) {}
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectDay(tab.dataset.day));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectDay(tabs[next].dataset.day, { focus: true });
  });
});
let pageDate = todayDate();
let initialDay = todayDay();
let linkedDay = hashDay();
let staleLinkedDay = false;
try {
  const savedDay = sessionStorage.getItem('dongji-selected-day');
  const savedDate = sessionStorage.getItem('dongji-selected-date');
  if (savedDate === pageDate && tabs.some(tab => tab.dataset.day === savedDay)) initialDay = savedDay;
  else if (savedDate && savedDate < pageDate && linkedDay === savedDay) {
    linkedDay = null;
    staleLinkedDay = true;
  }
} catch (_) {}
selectDay(linkedDay || initialDay, { updateHash: staleLinkedDay });
window.addEventListener('hashchange', () => {
  const day = hashDay();
  if (day) selectDay(day, { updateHash: false });
});
document.getElementById('today-button')?.addEventListener('click', () => selectDay(todayDay()));
document.getElementById('print-plan')?.addEventListener('click', () => {
  saveNotes();
  window.print();
});

// Keep verified static map URLs; provide a search fallback for older markup.
document.querySelectorAll('[data-map]').forEach(link => {
  if (!link.getAttribute('href') || link.getAttribute('href') === '#') {
    const city = link.dataset.city || '舟山';
    const params = new URLSearchParams({ keyword: link.dataset.map, city, view: 'map', callnative: '1', src: 'dongji-trip-2026' });
    link.href = `https://uri.amap.com/search?${params}`;
  }
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});

const checks = [...document.querySelectorAll('[data-check]')];
const progress = document.getElementById('check-progress');
const reviewed = document.getElementById('check-reviewed');
const dailyLabels = { 'ship-status': '船班', traffic: '返杭路况', restaurant: '当日用餐安排' };
const reviewTime = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
let reviews = {};
let checklistDate = todayDate();
try {
  let stored = JSON.parse(localStorage.getItem('dongji-trip-checks-v2') || 'null');
  if (!stored) {
    const previous = JSON.parse(localStorage.getItem('dongji-trip-checks') || 'null');
    const oldIndexes = { 'dog-size': 0, 'dog-ship': 3, hotels: 5, rental: 6, 'dog-kit': 1, health: 2, personal: 8, offline: 9 };
    stored = Array.isArray(previous) ? Object.fromEntries(Object.entries(oldIndexes).map(([key, index]) => [key, Boolean(previous[index])])) : {};
  }
  checks.forEach(check => { if (!(check.dataset.check in dailyLabels)) check.checked = Boolean(stored[check.dataset.check]); });
} catch (_) { /* Checklist remains usable without browser storage. */ }
try {
  const saved = JSON.parse(localStorage.getItem('dongji-trip-reviews-v1') || '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) reviews = saved;
} catch (_) {}
function updateProgress() {
  if (progress) progress.textContent = `已完成 ${checks.filter(check => check.checked).length} / ${checks.length} 项`;
  document.querySelectorAll('[data-check-status]').forEach(status => {
    const checked = Boolean(checks.find(check => check.dataset.check === status.dataset.checkStatus)?.checked);
    status.textContent = checked ? '已核对' : '待核对';
    status.classList.toggle('booked', checked);
    status.classList.toggle('pending', !checked);
  });
  if (reviewed) {
    const times = Object.entries(dailyLabels).filter(([key]) => Number.isFinite(reviews[key]?.reviewedAt)).map(([key, label]) => {
      const record = reviews[key];
      const current = record.checked && record.date === todayDate();
      return `${label}：${reviewTime.format(new Date(record.reviewedAt))}${current ? '（今日已核对）' : '（需重新核对）'}`;
    });
    reviewed.textContent = times.length ? times.join('；') : '每日复核仅当日有效，尚未记录核对时间。';
  }
}
function restoreDailyChecks() {
  checklistDate = todayDate();
  checks.forEach(check => {
    const key = check.dataset.check;
    if (key in dailyLabels) check.checked = Boolean(reviews[key]?.checked && reviews[key].date === checklistDate);
  });
  updateProgress();
}
checks.forEach(check => check.addEventListener('change', () => {
  const key = check.dataset.check;
  if (key in dailyLabels) reviews[key] = { checked: check.checked, date: todayDate(), reviewedAt: check.checked ? Date.now() : reviews[key]?.reviewedAt };
  try {
    localStorage.setItem('dongji-trip-checks-v2', JSON.stringify(Object.fromEntries(checks.filter(item => !(item.dataset.check in dailyLabels)).map(item => [item.dataset.check, item.checked]))));
    localStorage.setItem('dongji-trip-reviews-v1', JSON.stringify(reviews));
  } catch (_) {}
  restoreDailyChecks();
}));
restoreDailyChecks();
function refreshDailyChecks() {
  const date = todayDate();
  if (checklistDate !== date) restoreDailyChecks();
  if (pageDate !== date) {
    pageDate = date;
    selectDay(todayDay());
  }
}
window.addEventListener('focus', refreshDailyChecks);
document.addEventListener('visibilitychange', refreshDailyChecks);
window.setInterval(refreshDailyChecks, 60000);

const notes = [...document.querySelectorAll('[data-note]')];
const notesStatus = document.getElementById('notes-status');
const notesHint = '重要信息另存截图，PDF 可带走记录。';
let savedNotes = {};
try {
  const stored = JSON.parse(localStorage.getItem('dongji-trip-notes-v1') || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) savedNotes = stored;
  notes.forEach(note => {
    const value = savedNotes[note.dataset.note];
    if (typeof value === 'string') note.value = note.maxLength > 0 ? value.slice(0, note.maxLength) : value;
  });
  if (notesStatus) notesStatus.textContent = `输入时自动保存在本机浏览器；${notesHint}`;
} catch (_) {
  if (notesStatus) notesStatus.textContent = `浏览器无法读取确认记录，请另行保存；${notesHint}`;
}
function syncPrintNotes() {
  notes.forEach(note => {
    const label = note.closest('label');
    if (!label) return;
    let printed = label.querySelector('.print-note');
    if (!printed) {
      printed = document.createElement('p');
      printed.className = 'print-note';
      label.appendChild(printed);
    }
    printed.textContent = note.value.trim() ? note.value : '待填写';
  });
}
function saveNotes() {
  notes.forEach(note => { savedNotes[note.dataset.note] = note.value; });
  syncPrintNotes();
  try {
    localStorage.setItem('dongji-trip-notes-v1', JSON.stringify(savedNotes));
    if (notesStatus) notesStatus.textContent = `输入时自动保存在本机浏览器；${notesHint}`;
  } catch (_) {
    if (notesStatus) notesStatus.textContent = `浏览器无法保存确认记录，请复制到备忘录；${notesHint}`;
  }
}
syncPrintNotes();
notes.forEach(note => {
  note.addEventListener('input', saveNotes);
  note.addEventListener('change', saveNotes);
});
window.addEventListener('beforeprint', saveNotes);
