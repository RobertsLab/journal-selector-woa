/* Wiley Journal Finder
 *
 * Loads JOURNALS + SUBJECTS from journals.js, then provides:
 *   - tiered keyword relevance scoring
 *   - filters: type, license, currency, max APC, subject contains, search
 *   - sort: relevance / title / APC asc / APC desc
 */

"use strict";

// --- Theme keyword bundles -------------------------------------------------

const THEMES = [
  {
    id: "marine",
    label: "Marine",
    weight: 5,
    keywords: ["marine", "ocean", "oceanograph", "sea ", "seawater", "estuar", "coastal", "intertidal", "reef"],
    on: true,
  },
  {
    id: "aquaculture",
    label: "Aquaculture",
    weight: 5,
    keywords: ["aquaculture", "fisheries", "fishery", "shellfish", "mariculture", "hatchery"],
    on: true,
  },
  {
    id: "invertebrates",
    label: "Invertebrates",
    weight: 4,
    keywords: ["mollusc", "mollusk", "bivalve", "oyster", "clam", "mussel", "coral", "invertebrate", "crustacean"],
    on: true,
  },
  {
    id: "climate",
    label: "Climate / Env. change",
    weight: 4,
    keywords: ["climate", "global change", "environmental", "warming", "acidification", "hypoxia", "salinity", "stress", "pollution"],
    on: true,
  },
  {
    id: "ecology",
    label: "Ecology / Conservation",
    weight: 3,
    keywords: ["ecology", "ecological", "conservation", "biodiversity", "restoration", "applied ecology"],
    on: true,
  },
  {
    id: "physiology",
    label: "Physiology",
    weight: 3,
    keywords: ["physiology", "physiological", "comparative biology", "performance", "metabol", "respiration"],
    on: true,
  },
  {
    id: "genomics",
    label: "Genomics",
    weight: 3,
    keywords: ["genom", "transcriptom", "molecular ecology", "evolutionary", "evolution", "bioinformat"],
    on: true,
  },
  {
    id: "epigenetics",
    label: "Epigenetics",
    weight: 4,
    keywords: ["epigen", "methylation", "noncoding", "non-coding", "chromatin", "small rna", "mirna"],
    on: true,
  },
  {
    id: "microbiome",
    label: "Microbiome",
    weight: 3,
    keywords: ["microbiome", "microbial", "microbiology", "host-microbe", "symbio"],
    on: false,
  },
  {
    id: "applied",
    label: "Restoration / Fisheries",
    weight: 3,
    keywords: ["restoration", "fisheries", "sustainability", "sustainable", "management"],
    on: true,
  },
];

const SUBJECT_BONUS_TOKENS = [
  "aquaculture",
  "marine",
  "fisheries",
  "fish science",
  "oceanograph",
  "ecology",
  "conservation",
  "environmental",
  "evolutionary",
  "comparative biology",
];

// UW / BTAA Wiley open-access agreement (2026-2027).
// Hybrid OA: covered for articles ACCEPTED by Dec 31, 2027.
// Gold OA:   covered for manuscripts SUBMITTED by Aug 31, 2026.
const BTAA = {
  hybridDeadline: new Date("2027-12-31T23:59:59"),
  goldDeadline:   new Date("2026-08-31T23:59:59"),
};

function coverageFor(j, today = new Date()) {
  if (j.type === "hybrid") {
    const covered = today <= BTAA.hybridDeadline;
    return {
      covered,
      label: covered ? "BTAA covered" : "Agreement ended",
      note: covered
        ? "Hybrid OA: no APC if accepted by Dec 31, 2027"
        : "Hybrid OA window has closed",
    };
  }
  const covered = today <= BTAA.goldDeadline;
  return {
    covered,
    label: covered ? "BTAA covered" : "APC applies",
    note: covered
      ? "Gold OA: no APC if SUBMITTED by Aug 31, 2026"
      : "Gold OA central coverage ended; allocation may also be exhausted",
  };
}

function daysBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// --- State -----------------------------------------------------------------

const STATE = {
  themes: Object.fromEntries(THEMES.map(t => [t.id, t.on])),
  freeKeywords: "",
  search: "",
  type: "both",
  license: "any",
  currency: "usd",
  maxApc: 6000,
  maxApcUncapped: true,
  subject: "",
  sortBy: "relevance",
  hideZero: true,
  btaaOnly: false,
  useEffectiveApc: true,
  pageSize: 50,
  shown: 50,
};

const CURRENCY_SYMBOL = { usd: "$", gbp: "\u00A3", eur: "\u20AC" };
const CURRENCY_LABEL = { usd: "USD", gbp: "GBP", eur: "EUR" };

// --- Utilities -------------------------------------------------------------

function tokenize(text) {
  return (text || "").toLowerCase();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHaystack(j) {
  return tokenize(`${j.title} ${j.subject}`);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatApc(value, currency) {
  if (value == null) return null;
  const sym = CURRENCY_SYMBOL[currency] || "";
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${sym}${formatted}`;
}

// --- Scoring ---------------------------------------------------------------

function scoreJournal(j, enabledThemes, freeKeywordList) {
  const hay = j._hay || buildHaystack(j);
  const subjectLower = (j.subject || "").toLowerCase();
  let score = 0;
  const matched = new Set();

  for (const theme of THEMES) {
    if (!enabledThemes[theme.id]) continue;
    for (const kw of theme.keywords) {
      if (hay.includes(kw)) {
        score += theme.weight;
        matched.add(kw.trim());
      }
    }
  }

  for (const kw of freeKeywordList) {
    if (!kw) continue;
    const re = new RegExp(`\\b${escapeRegExp(kw)}`, "i");
    if (re.test(hay)) {
      score += 2;
      matched.add(kw);
    }
  }

  for (const tok of SUBJECT_BONUS_TOKENS) {
    if (subjectLower.includes(tok)) {
      score += 3;
    }
  }

  return { score, matched: Array.from(matched) };
}

// --- Filtering -------------------------------------------------------------

function effectiveApc(j, currency) {
  const raw = j[currency];
  if (STATE.useEffectiveApc && j._coverage && j._coverage.covered) return 0;
  return raw;
}

function passesFilters(j) {
  if (STATE.type !== "both" && j.type !== STATE.type) return false;

  if (STATE.btaaOnly && !(j._coverage && j._coverage.covered)) return false;

  if (STATE.license !== "any") {
    const lic = (j.license || "").toUpperCase();
    if (!lic.includes(STATE.license.toUpperCase())) return false;
  }

  if (STATE.subject) {
    const s = (j.subject || "").toLowerCase();
    if (!s.includes(STATE.subject.toLowerCase())) return false;
  }

  if (STATE.search) {
    const q = STATE.search.toLowerCase();
    if (!j._hay.includes(q)) return false;
  }

  if (!STATE.maxApcUncapped) {
    const apc = effectiveApc(j, STATE.currency);
    if (apc == null) return false;
    if (apc > STATE.maxApc) return false;
  }

  return true;
}

// --- Rendering -------------------------------------------------------------

function highlightMatches(text, terms) {
  if (!terms || !terms.length) return escapeHtml(text);
  const escaped = escapeHtml(text);
  let result = escaped;
  const sorted = [...new Set(terms.map(t => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    const re = new RegExp(`(${escapeRegExp(escapeHtml(term))})`, "ig");
    result = result.replace(re, "<mark>$1</mark>");
  }
  return result;
}

function renderCard(item) {
  const j = item.journal;
  const { score, matched } = item;
  const currency = STATE.currency;
  const rawApc = j[currency];
  const cov = j._coverage;
  const isCovered = cov && cov.covered;

  let apcHtml;
  if (rawApc == null) {
    apcHtml = `<div class="apc-missing">APC not listed</div>`;
  } else if (isCovered) {
    apcHtml = `
      <div class="apc-row">
        <span class="apc-strike">${formatApc(rawApc, currency)}</span>
        <span class="apc free">$0 <small>via BTAA</small></span>
      </div>
    `;
  } else {
    apcHtml = `<div class="apc">${formatApc(rawApc, currency)} <small>${CURRENCY_LABEL[currency]}</small></div>`;
  }

  const titleHtml = j.url
    ? `<a href="${escapeHtml(j.url)}" target="_blank" rel="noopener noreferrer">${highlightMatches(j.title, matched)}</a>`
    : highlightMatches(j.title, matched);

  const subjectHtml = j.subject
    ? `<span>${highlightMatches(j.subject, matched)}</span>`
    : "";

  const licenseHtml = j.license
    ? `<span>${escapeHtml(j.license).replace(/\n/g, " / ")}</span>`
    : "";

  const issnHtml = j.issn ? `<span class="sep">ISSN ${escapeHtml(j.issn)}</span>` : "";

  const matchedChips = matched.length
    ? `<div class="matches">${matched.slice(0, 8).map(m => `<span class="match-chip">${escapeHtml(m)}</span>`).join("")}</div>`
    : "";

  const typeBadge = j.type === "gold"
    ? `<span class="badge gold">Gold OA</span>`
    : `<span class="badge hybrid">Hybrid</span>`;

  const coverageBadge = cov
    ? `<span class="coverage ${isCovered ? "covered" : "uncovered"}" title="${escapeHtml(cov.note)}">${escapeHtml(cov.label)}</span>`
    : "";

  const coverageNote = cov && cov.note
    ? `<div class="coverage-note">${escapeHtml(cov.note)}</div>`
    : "";

  const zeroClass = score === 0 ? " zero" : "";

  return `
    <li class="card${zeroClass}">
      <div>
        <p class="card-title">${titleHtml}</p>
        <div class="card-sub">
          ${subjectHtml}
          ${licenseHtml ? `<span class="sep">&middot;</span>${licenseHtml}` : ""}
          ${issnHtml ? `<span class="sep">&middot;</span>${issnHtml}` : ""}
        </div>
        ${matchedChips}
      </div>
      <div class="card-right">
        ${typeBadge}
        ${coverageBadge}
        ${apcHtml}
        ${coverageNote}
        <div class="score">relevance <strong>${score}</strong></div>
      </div>
    </li>
  `;
}

// --- Main computation ------------------------------------------------------

function compute() {
  const freeList = STATE.freeKeywords
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const scored = [];
  for (const j of JOURNALS) {
    if (!j._hay) j._hay = buildHaystack(j);
    if (!passesFilters(j)) continue;
    const { score, matched } = scoreJournal(j, STATE.themes, freeList);
    if (STATE.hideZero && STATE.sortBy === "relevance" && score === 0) continue;
    scored.push({ journal: j, score, matched });
  }

  switch (STATE.sortBy) {
    case "title":
      scored.sort((a, b) => a.journal.title.localeCompare(b.journal.title));
      break;
    case "apcAsc":
      scored.sort((a, b) => {
        const av = effectiveApc(a.journal, STATE.currency);
        const bv = effectiveApc(b.journal, STATE.currency);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return av - bv;
      });
      break;
    case "apcDesc":
      scored.sort((a, b) => {
        const av = effectiveApc(a.journal, STATE.currency);
        const bv = effectiveApc(b.journal, STATE.currency);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return bv - av;
      });
      break;
    case "relevance":
    default:
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.journal.title.localeCompare(b.journal.title);
      });
      break;
  }

  return scored;
}

function render() {
  const results = compute();
  const total = results.length;
  STATE.shown = Math.min(STATE.shown, Math.max(STATE.pageSize, total));

  const list = document.getElementById("resultList");
  const slice = results.slice(0, STATE.shown);
  list.innerHTML = slice.map(renderCard).join("");

  const status = document.getElementById("status");
  if (total === 0) {
    status.textContent = "No journals match the current filters.";
  } else {
    status.textContent = `${total.toLocaleString()} journal${total === 1 ? "" : "s"} match. Showing ${slice.length.toLocaleString()}.`;
  }

  const loadMoreWrap = document.getElementById("loadMoreWrap");
  if (slice.length < total) {
    loadMoreWrap.hidden = false;
  } else {
    loadMoreWrap.hidden = true;
  }

  const counts = document.getElementById("counts");
  const hybridCount = JOURNALS.filter(j => j.type === "hybrid").length;
  const goldCount = JOURNALS.length - hybridCount;
  const coveredCount = JOURNALS.filter(j => j._coverage && j._coverage.covered).length;
  counts.innerHTML = `
    Data: <strong>${JOURNALS.length.toLocaleString()}</strong> journals
    (Hybrid <strong>${hybridCount.toLocaleString()}</strong>,
    Gold <strong>${goldCount.toLocaleString()}</strong>)<br/>
    Subjects: <strong>${SUBJECTS.length.toLocaleString()}</strong><br/>
    BTAA-covered today: <strong>${coveredCount.toLocaleString()}</strong>
  `;
}

function renderAgreementStats() {
  const host = document.getElementById("agreementStats");
  if (!host) return;
  const today = new Date();

  const hybridDays = daysBetween(today, BTAA.hybridDeadline);
  const goldDays = daysBetween(today, BTAA.goldDeadline);

  const hybridExpired = hybridDays < 0;
  const goldExpired = goldDays < 0;

  const hybridText = hybridExpired
    ? `Ended ${formatDate(BTAA.hybridDeadline)}`
    : `${hybridDays.toLocaleString()} day${hybridDays === 1 ? "" : "s"} left (by ${formatDate(BTAA.hybridDeadline)})`;
  const goldText = goldExpired
    ? `Ended ${formatDate(BTAA.goldDeadline)}`
    : `${goldDays.toLocaleString()} day${goldDays === 1 ? "" : "s"} left (by ${formatDate(BTAA.goldDeadline)})`;

  host.innerHTML = `
    <span class="stat${hybridExpired ? " expired" : ""}">
      <span class="stat-label">Hybrid OA &middot; accept by</span>
      <span class="stat-value">${hybridText}</span>
    </span>
    <span class="stat${goldExpired ? " expired" : ""}">
      <span class="stat-label">Gold OA &middot; submit by</span>
      <span class="stat-value">${goldText}</span>
    </span>
  `;
}

// --- UI wiring -------------------------------------------------------------

function buildThemeChips() {
  const host = document.getElementById("themeChips");
  host.innerHTML = THEMES.map(t => `
    <button
      type="button"
      class="chip"
      data-id="${t.id}"
      aria-pressed="${STATE.themes[t.id] ? "true" : "false"}"
      title="Adds keywords: ${t.keywords.join(", ")}"
    >
      <span>${escapeHtml(t.label)}</span>
      <span class="chip-weight">x${t.weight}</span>
    </button>
  `).join("");

  host.addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const id = btn.dataset.id;
    STATE.themes[id] = !STATE.themes[id];
    btn.setAttribute("aria-pressed", STATE.themes[id] ? "true" : "false");
    STATE.shown = STATE.pageSize;
    render();
  });
}

function fillSubjectDatalist() {
  const list = document.getElementById("subjectList");
  list.innerHTML = SUBJECTS.map(s => `<option value="${escapeHtml(s)}"></option>`).join("");
}

function updateMaxApcLabel() {
  const label = document.getElementById("maxApcLabel");
  const sym = CURRENCY_SYMBOL[STATE.currency] || "";
  if (STATE.maxApcUncapped) {
    label.textContent = "no cap";
  } else {
    label.textContent = `${sym}${STATE.maxApc.toLocaleString()}`;
  }
}

function wireControls() {
  document.getElementById("freeKeywords").addEventListener("input", e => {
    STATE.freeKeywords = e.target.value;
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("searchBox").addEventListener("input", e => {
    STATE.search = e.target.value.trim();
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("typeFilter").addEventListener("change", e => {
    STATE.type = e.target.value;
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("licenseFilter").addEventListener("change", e => {
    STATE.license = e.target.value;
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("currency").addEventListener("change", e => {
    STATE.currency = e.target.value;
    updateMaxApcLabel();
    render();
  });

  const maxApcInput = document.getElementById("maxApc");
  maxApcInput.addEventListener("input", e => {
    const v = Number(e.target.value);
    STATE.maxApc = v;
    STATE.maxApcUncapped = v >= Number(e.target.max);
    updateMaxApcLabel();
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("subjectFilter").addEventListener("input", e => {
    STATE.subject = e.target.value.trim();
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("sortBy").addEventListener("change", e => {
    STATE.sortBy = e.target.value;
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("hideZero").addEventListener("change", e => {
    STATE.hideZero = e.target.checked;
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("btaaOnly").addEventListener("change", e => {
    STATE.btaaOnly = e.target.checked;
    STATE.shown = STATE.pageSize;
    render();
  });

  document.getElementById("useEffectiveApc").addEventListener("change", e => {
    STATE.useEffectiveApc = e.target.checked;
    render();
  });

  document.getElementById("loadMoreBtn").addEventListener("click", () => {
    STATE.shown += STATE.pageSize;
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    for (const t of THEMES) STATE.themes[t.id] = t.on;
    STATE.freeKeywords = "";
    STATE.search = "";
    STATE.type = "both";
    STATE.license = "any";
    STATE.currency = "usd";
    STATE.maxApc = 6000;
    STATE.maxApcUncapped = true;
    STATE.subject = "";
    STATE.sortBy = "relevance";
    STATE.hideZero = true;
    STATE.btaaOnly = false;
    STATE.useEffectiveApc = true;
    STATE.shown = STATE.pageSize;
    document.getElementById("freeKeywords").value = "";
    document.getElementById("searchBox").value = "";
    document.getElementById("typeFilter").value = "both";
    document.getElementById("licenseFilter").value = "any";
    document.getElementById("currency").value = "usd";
    document.getElementById("maxApc").value = 6000;
    document.getElementById("subjectFilter").value = "";
    document.getElementById("sortBy").value = "relevance";
    document.getElementById("hideZero").checked = true;
    document.getElementById("btaaOnly").checked = false;
    document.getElementById("useEffectiveApc").checked = true;
    for (const btn of document.querySelectorAll(".chip")) {
      const id = btn.dataset.id;
      btn.setAttribute("aria-pressed", STATE.themes[id] ? "true" : "false");
    }
    updateMaxApcLabel();
    render();
  });
}

// --- Init ------------------------------------------------------------------

function init() {
  const today = new Date();
  for (const j of JOURNALS) {
    j._hay = buildHaystack(j);
    j._coverage = coverageFor(j, today);
  }
  buildThemeChips();
  fillSubjectDatalist();
  wireControls();
  updateMaxApcLabel();
  renderAgreementStats();
  document.getElementById("freeKeywords").value = "";
  render();
}

document.addEventListener("DOMContentLoaded", init);
