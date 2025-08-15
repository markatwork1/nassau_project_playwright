// app.js

// ——— DOM references ———
const testNumberInput    = document.getElementById("testNumber");
const bucketSelect       = document.getElementById("bucketSelect");
const noteTextDiv        = document.getElementById("noteText");
const saveNoteBtn        = document.getElementById("saveNoteBtn");

const bucketNameInput    = document.getElementById("bucketName");
const bucketKeywordInput = document.getElementById("bucketKeyword");
const addBucketBtn       = document.getElementById("addBucketBtn");

const bucketList         = document.getElementById("bucketList");
const searchInput        = document.getElementById("searchTestNumberInput");
const searchBtn          = document.getElementById("searchTestBtn");

const viewAllBtn         = document.getElementById("viewAllTestNumbersBtn");
const downloadCsvBtn     = document.getElementById("downloadTestNumbersCsvBtn");
const viewStatsBtn       = document.getElementById("viewBucketStatsBtn");

const bucketViewSec      = document.getElementById("bucketViewSection");
const bucketViewName     = document.getElementById("bucketViewName");
const bucketNotesDiv     = document.getElementById("bucketNotesContainer");
const backBtn            = document.getElementById("backToMainBtn");

const searchSec          = document.getElementById("searchResultsSection");
const searchInfo         = document.getElementById("searchResultsInfo");
const searchTableBody    = document.querySelector("#searchResultsTable tbody");

const allTestsSec        = document.getElementById("allTestNumbersSection");
const allTestsInfo       = document.getElementById("allTestNumbersInfo");
const allTestsTableBody  = document.querySelector("#allTestNumbersTable tbody");

const statsSec           = document.getElementById("bucketStatsSection");
const ctxBucketChart     = document.getElementById("bucketChart").getContext("2d");
const ctxPieChart        = document.getElementById("pieChart").getContext("2d");

const deletedList        = document.getElementById("deletedBucketList");
const toggleThemeBtn     = document.getElementById("toggleThemeBtn");

// ——— State ———
let buckets        = [];
let notes          = [];
let deletedBuckets = [];
let bucketChart    = null;
let pieChart       = null;

// ---------- Fetch & initialize data ----------
async function fetchData() {
  try {
    const res  = await fetch("/api/data");
    const data = await res.json();
    buckets        = data.buckets;
    notes          = data.notes;
    deletedBuckets = data.deletedBuckets || [];
    renderBuckets();
    populateBucketDropdown();
    renderBucketChart();
    renderPieChart();
    renderDeletedList();
  } catch {
    alert("Could not load data");
  }
}

// ========== Initialize App ==========
window.addEventListener("DOMContentLoaded", () => {
  // Apply saved theme on initial load
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  // Then fetch the application data
  fetchData();
});

// ---------- Render bucket list on left panel ----------
function renderBuckets() {
  bucketList.innerHTML = "";
  buckets.forEach(b => {
    const li = document.createElement("li");

    const title = document.createElement("span");
    title.className = "bucket-title";
    title.textContent = b.name;
    title.onclick = () => showSection("viewBucket", b);
    li.appendChild(title);

    if (b.name !== "Uncategorized") {
      const rm = document.createElement("button");
      rm.textContent = "Remove";
      rm.classList.add("delete-btn");
      rm.style.marginLeft = "10px";
      rm.onclick = () => {
        if (confirm(`Remove bucket "${b.name}"?`)) {
          removeBucket(b.name);
        }
      };
      li.appendChild(rm);
    }

    bucketList.appendChild(li);
  });
}

// ---------- Populate bucket dropdown in note form ----------
function populateBucketDropdown() {
  bucketSelect.innerHTML = "";
  buckets.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.name;
    opt.textContent = b.name;
    bucketSelect.appendChild(opt);
  });
}

// ---------- Render “Recently Deleted Buckets” list ----------
function renderDeletedList() {
  deletedList.innerHTML = "";
  deletedBuckets.forEach(db => {
    const li = document.createElement("li");
    li.textContent = db.name;

    const restoreBtn = document.createElement("button");
    restoreBtn.textContent = "Restore";
    restoreBtn.classList.add("restore-btn");
    restoreBtn.style.marginLeft = "10px";
    restoreBtn.onclick = () => restoreDeletedBucket(db.name);

    li.appendChild(restoreBtn);
    deletedList.appendChild(li);
  });
}

// ---------- Add & Remove Bucket ----------
addBucketBtn.onclick = async () => {
  const name = bucketNameInput.value.trim();
  const kw   = bucketKeywordInput.value.trim();
  if (!name) return alert("Enter a bucket name");
  await fetch("/api/buckets", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ name, keyword: kw })
  });
  bucketNameInput.value = bucketKeywordInput.value = "";
  fetchData();
};

async function removeBucket(name) {
  await fetch(`/api/buckets/${encodeURIComponent(name)}`, { method: "DELETE" });
  fetchData();
}

// ---------- Restore a deleted bucket ----------
async function restoreDeletedBucket(name) {
  await fetch("/api/deletedBuckets/restore", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ name })
  });
  fetchData();
}

// ---------- Save a Note ----------
saveNoteBtn.onclick = async () => {
  const tn   = testNumberInput.value.trim();
  const html = noteTextDiv.innerHTML.trim();
  const bn   = bucketSelect.value;
  if (!tn || !html) return alert("Enter test number & note");
  await fetch("/api/notes", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ testNumber: tn, noteText: html, bucketName: bn })
  });
  alert(`Saved to "${bn}"`);
  testNumberInput.value = "";
  noteTextDiv.innerHTML  = "";
  fetchData();
};

// ---------- Section Navigation ----------
viewAllBtn.onclick   = () => showSection("allTests");
viewStatsBtn.onclick = () => showSection("stats");
searchBtn.onclick    = () => showSection("search");
backBtn.onclick      = () => showSection("main");

function showSection(mode, bucket) {
  [bucketViewSec, searchSec, allTestsSec, statsSec].forEach(s => s.classList.add("hidden"));

  switch (mode) {
    case "viewBucket":
      bucketViewSec.classList.remove("hidden");
      renderBucketDetail(bucket);
      break;
    case "search":
      searchSec.classList.remove("hidden");
      doSearch();
      break;
    case "allTests":
      allTestsSec.classList.remove("hidden");
      renderAllTests();
      break;
    case "stats":
      statsSec.classList.remove("hidden");
      renderBucketChart();
      renderPieChart();
      break;
    default:
      break;
  }
}

// ---------- Render a single bucket’s notes ----------
function renderBucketDetail(b) {
  bucketViewName.textContent = b.name;
  const list = notes
    .filter(n => n.bucketName === b.name)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  bucketNotesDiv.innerHTML = "";
  list.forEach(n => {
    const div = document.createElement("div");
    div.className = "note-item";
    div.innerHTML = `
      <div>[${formatDate(n.timestamp)}] — ${n.testNumber}</div>
      <div>${n.noteText}</div>
    `;
    const dl = document.createElement("button");
    dl.className = "download-btn btn-secondary";
    dl.textContent = "Download as TXT";
    dl.onclick = () => downloadNoteTxt(n);
    div.appendChild(dl);
    bucketNotesDiv.appendChild(div);
  });
}

// ---------- Search functionality ----------
function doSearch() {
  const q = searchInput.value.trim();
  const results = notes.filter(n => n.testNumber.toLowerCase().includes(q.toLowerCase()));

  searchTableBody.innerHTML = "";
  searchInfo.textContent = results.length
    ? `Found ${results.length} note(s) for "${q}"`
    : `No notes for "${q}"`;

  results.forEach(n => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(n.timestamp)}</td>
      <td>${n.testNumber}</td>
      <td class="bucket-title">${n.bucketName}</td>
    `;
    tr.querySelector(".bucket-title").onclick = () => showSection("viewBucket", { name: n.bucketName });
    searchTableBody.appendChild(tr);
  });
}

// ---------- All Test Numbers & CSV ----------
function renderAllTests() {
  const map = {};
  notes.forEach(n => {
    if (!map[n.testNumber]) map[n.testNumber] = { count: 0, buckets: new Set() };
    map[n.testNumber].count++;
    map[n.testNumber].buckets.add(n.bucketName);
  });

  const rows = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  allTestsTableBody.innerHTML = "";
  allTestsInfo.textContent = `Total unique test numbers: ${rows.length}`;

  rows.forEach(([tn, data]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${tn}</td>
      <td${data.count > 1 ? ' style="color:red;font-weight:bold"' : ''}>${data.count}</td>
      <td>${[...data.buckets].join(", ")}</td>
    `;
    allTestsTableBody.appendChild(tr);
  });
}

downloadCsvBtn.onclick = () => {
  const map = {};
  notes.forEach(n => {
    if (!map[n.testNumber]) map[n.testNumber] = { count: 0, buckets: new Set() };
    map[n.testNumber].count++;
    map[n.testNumber].buckets.add(n.bucketName);
  });

  const rows = [["Test Number","Count","Buckets"]];
  Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([tn, d]) => {
      rows.push([
        `"${tn.replace(/"/g, '""')}"`,
        d.count,
        `"${[...d.buckets].join(", ").replace(/"/g,'""')}"`
      ]);
    });

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `all_test_numbers_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ---------- THEME-AWARE CHARTS ----------
function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function renderBucketChart() {
  const counts = buckets.map(b => ({
    name: b.name,
    count: notes.filter(n => n.bucketName === b.name).length
  }));
  const labels = counts.map(c => c.name);
  const data   = counts.map(c => c.count);
  
  const chartTextColor = isDarkMode() ? '#e8e6e3' : '#6c757d';
  const gridColor = isDarkMode() ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  if (bucketChart) bucketChart.destroy();

  bucketChart = new Chart(ctxBucketChart, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Notes Count',
        data,
        backgroundColor: 'rgba(0, 123, 255, 0.7)',
        borderColor: 'rgba(0, 123, 255, 1)',
        borderWidth: 1,
        barPercentage: 0.6,
        categoryPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 16/9,
      scales: {
        x: {
          title: { display: true, text: 'Bucket', color: chartTextColor },
          ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, color: chartTextColor },
          grid: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Notes', color: chartTextColor },
          ticks: { stepSize: 1, color: chartTextColor },
          grid: { color: gridColor }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} notes` } }
      }
    }
  });
}

function renderPieChart() {
  const counts = buckets.map(b => ({
    name: b.name,
    count: notes.filter(n => n.bucketName === b.name).length
  }));
  const labels = counts.map(c => c.name);
  const data   = counts.map(c => c.count);
  const chartTextColor = isDarkMode() ? '#e8e6e3' : '#6c757d';

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctxPieChart, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) =>
          `hsl(${(i / labels.length) * 360}, 70%, 55%)`
        ),
        borderColor: isDarkMode() ? '#212529' : '#ffffff',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 16/9,
      plugins: {
        legend: {
            position: 'right',
            labels: { color: chartTextColor }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} notes` } }
      }
    }
  });
}

// ---------- Utilities ----------
function downloadNoteTxt(n) {
  const txt =
    `Timestamp: ${formatDate(n.timestamp)}\n` +
    `Test Number: ${n.testNumber}\n` +
    `Note:\n${n.noteText.replace(/<div>/g, '\n').replace(/<\/div>/g, '')}\n`; // Basic HTML cleanup
  const blob = new Blob([txt], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${n.testNumber}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(iso) {
  const d = new Date(iso);
  return (
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ` +
    `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  );
}

// ===== Dark Mode Toggle =====
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggleThemeBtn.textContent = 'Light Mode ☀️';
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    toggleThemeBtn.textContent = 'Dark Mode 🌙';
    localStorage.setItem('theme', 'light');
  }

  // Re-render charts only if they are visible and have been initialized
  if (typeof Chart !== 'undefined' && notes.length > 0 && !statsSec.classList.contains('hidden')) {
    renderBucketChart();
    renderPieChart();
  }
}

toggleThemeBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.hasAttribute('data-theme') ? 'dark' : 'light';
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});