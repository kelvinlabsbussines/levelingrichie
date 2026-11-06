
"use strict";

/* =====================================================
   LIFE LEVELING
   HTML MATCHED VERSION
   JSONBin Free - No Versioning - No LocalStorage
===================================================== */

/* 1. CONFIG */

const CONFIG = {
  BIN_ID: "6aede42fac6210605a728eda",
  MASTER_KEY: "$2a$10$GYyTXmKaxHsAvlZNxbH.BerfTlcPLJ2xAzf5LSBQ7fRtdkxJGjFEC",
  API_URL: "https://api.jsonbin.io/v3/b",

  MAX_LEVEL: 100,
  FIRST_TARGET: 1000000,
  FINAL_TARGET: 60000000000,

  CHALLENGE_START: "2026-11-06T00:00:00",
  CHALLENGE_END: "2031-11-06T23:59:59",

  REQUEST_TIMEOUT: 15000,
  SAVE_DELAY: 800
};


/* 2. STATE */

let appData = null;
let isConnected = false;
let saveTimer = null;
let saveQueue = Promise.resolve();
let saveRevision = 0;
let sidebarIsOpen = false;


/* 3. DEFAULT DATA */

function createDefaultData() {
  return {
    appName: "Life Leveling",
    version: 1,

    currentLevel: 1,
    wealth: 0,
    totalIncome: 0,
    totalExpense: 0,

    transactions: [],
    strategies: [],
    quests: [],
    activities: [],

    settings: {
      challengeStart: CONFIG.CHALLENGE_START,
      challengeEnd: CONFIG.CHALLENGE_END
    },

    updatedAt: new Date().toISOString()
  };
}


/* 4. UTILITIES */

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 9);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}


/* 5. NORMALIZE */

function normalizeData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Format data JSONBin tidak valid.");
  }

  const defaults = createDefaultData();

  return {
    ...defaults,
    ...data,

    currentLevel: clamp(
      Number(data.currentLevel) || 1,
      1,
      CONFIG.MAX_LEVEL
    ),

    wealth: Math.max(0, Number(data.wealth) || 0),
    totalIncome: Math.max(0, Number(data.totalIncome) || 0),
    totalExpense: Math.max(0, Number(data.totalExpense) || 0),

    transactions: Array.isArray(data.transactions)
      ? data.transactions : [],

    strategies: Array.isArray(data.strategies)
      ? data.strategies : [],

    quests: Array.isArray(data.quests)
      ? data.quests : [],

    activities: Array.isArray(data.activities)
      ? data.activities : [],

    settings: {
      ...defaults.settings,
      ...(data.settings || {})
    }
  };
}


/* 6. STATUS */

function setStatus(message, type = "info") {
  const element = document.getElementById("connectionStatus");

  if (element) {
    element.textContent = message;

    const indicator = element.parentElement?.querySelector(
      ".status-indicator"
    );

    if (indicator) {
      indicator.style.background =
        type === "success" ? "#22c55e" :
        type === "error" ? "#ef4444" :
        type === "saving" ? "#eab308" : "#999";
    }
  }

  const sidebarStatus = document.querySelector(
    ".system-status"
  );

  if (sidebarStatus) {
    const text = sidebarStatus.querySelector("span:last-child");
    const indicator = sidebarStatus.querySelector(".status-indicator");

    if (text) {
      text.textContent =
        type === "success" ? "JSONBin Connected" :
        type === "error" ? "Connection Failed" :
        type === "saving" ? "Saving Data..." : "Connecting...";
    }

    if (indicator) {
      indicator.style.background =
        type === "success" ? "#22c55e" :
        type === "error" ? "#ef4444" :
        type === "saving" ? "#eab308" : "#999";
    }
  }
}


/* 7. JSONBIN REQUEST */

async function jsonBinRequest(url, options = {}) {
  if (
    !CONFIG.MASTER_KEY ||
    CONFIG.MASTER_KEY === "TEMPEL_X_MASTER_KEY_DI_SINI"
  ) {
    throw new Error("Masukkan X-Master-Key pada script.js.");
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    CONFIG.REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,

      headers: {
        "X-Master-Key": CONFIG.MASTER_KEY,
        ...(options.headers || {})
      }
    });

    const raw = await response.text();
    let result = {};

    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("Respons JSONBin tidak valid.");
    }

    if (!response.ok) {
      throw new Error(
        result.message || `JSONBin HTTP ${response.status}`
      );
    }

    return result;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Koneksi JSONBin timeout.");
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


/* 8. LOAD */

async function loadData() {
  setStatus("Menghubungkan...", "saving");

  const result = await jsonBinRequest(
    `${CONFIG.API_URL}/${CONFIG.BIN_ID}/latest`,
    { method: "GET" }
  );

  if (!result.record) {
    throw new Error("Record JSONBin tidak ditemukan.");
  }

  appData = normalizeData(result.record);
  isConnected = true;

  setStatus("JSONBin Connected", "success");

  renderApp();

  return appData;
}


/* 9. SAVE - FREE PLAN */

async function saveData() {
  if (!appData || !isConnected) {
    throw new Error("Aplikasi belum terhubung.");
  }

  const revision = saveRevision;

  const snapshot = JSON.parse(JSON.stringify(appData));
  snapshot.updatedAt = new Date().toISOString();

  setStatus("Menyimpan data...", "saving");

  const result = await jsonBinRequest(
    `${CONFIG.API_URL}/${CONFIG.BIN_ID}`,
    {
      method: "PUT",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(snapshot)
    }
  );

  if (!result.record) {
    throw new Error("JSONBin tidak mengonfirmasi penyimpanan.");
  }

  if (revision === saveRevision) {
    appData.updatedAt = snapshot.updatedAt;
    setStatus("JSONBin Connected", "success");
  }

  return true;
}


/* 10. SAVE QUEUE */

function scheduleSave() {
  if (!appData || !isConnected) return;

  saveRevision++;
  clearTimeout(saveTimer);

  setStatus("Menunggu penyimpanan...", "saving");

  saveTimer = setTimeout(() => {
    const revision = saveRevision;

    saveQueue = saveQueue
      .then(() => {
        if (revision !== saveRevision) return;
        return saveData();
      })
      .catch(error => {
        console.error("Save error:", error);
        showNotification(
          "Gagal menyimpan: " + error.message,
          "error"
        );
      });

  }, CONFIG.SAVE_DELAY);
}


/* 11. NOTIFICATION */

function showNotification(message, type = "success") {
  let box = document.getElementById("appNotification");

  if (!box) {
    box = document.createElement("div");
    box.id = "appNotification";

    Object.assign(box.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "99999",
      maxWidth: "340px",
      padding: "14px 18px",
      borderRadius: "12px",
      background: "#151a17",
      color: "#fff",
      border: "1px solid #245c3b",
      boxShadow: "0 10px 35px rgba(0,0,0,.35)",
      fontSize: "14px"
    });

    document.body.appendChild(box);
  }

  box.textContent = message;

  box.style.borderColor =
    type === "error" ? "#dc4545" : "#20a45a";

  box.style.display = "block";

  clearTimeout(box.hideTimer);

  box.hideTimer = setTimeout(() => {
    box.style.display = "none";
  }, 3500);
}


/* 12. ACTIVITY */

function addActivity(title, description = "") {
  appData.activities.unshift({
    id: createId(),
    title,
    description,
    date: new Date().toISOString()
  });

  appData.activities = appData.activities.slice(0, 30);
}


/* 13. LEVEL */

function getLevelTarget(level) {
  const safeLevel = clamp(
    Number(level) || 1,
    1,
    CONFIG.MAX_LEVEL
  );

  const ratio = CONFIG.FINAL_TARGET / CONFIG.FIRST_TARGET;

  return Math.round(
    CONFIG.FIRST_TARGET *
    Math.pow(
      ratio,
      (safeLevel - 1) / (CONFIG.MAX_LEVEL - 1)
    )
  );
}

function getLevelTitle(level) {
  if (level >= 100) return "Wealth Legend";
  if (level >= 90) return "Empire Builder";
  if (level >= 75) return "Elite Investor";
  if (level >= 60) return "Business Master";
  if (level >= 45) return "Entrepreneur";
  if (level >= 30) return "Wealth Builder";
  if (level >= 15) return "Rising Player";
  if (level >= 5) return "Growth Seeker";

  return "New Player";
}

function getLevelProgress() {
  const level = appData.currentLevel;

  const currentTarget = getLevelTarget(level);

  if (level >= CONFIG.MAX_LEVEL) {
    return {
      currentTarget,
      nextTarget: currentTarget,
      percentage: 100
    };
  }

  const nextTarget = getLevelTarget(level + 1);

  const percentage = clamp(
    (
      (appData.wealth - currentTarget) /
      (nextTarget - currentTarget)
    ) * 100,
    0,
    100
  );

  return {
    currentTarget,
    nextTarget,
    percentage
  };
}

function changeLevel(amount) {
  const oldLevel = appData.currentLevel;

  const newLevel = clamp(
    oldLevel + amount,
    1,
    CONFIG.MAX_LEVEL
  );

  if (oldLevel === newLevel) {
    showNotification("Level sudah mencapai batas.", "error");
    return;
  }

  appData.currentLevel = newLevel;

  addActivity(
    amount > 0 ? "Level Up" : "Level Down",
    `Level ${oldLevel} menjadi Level ${newLevel}`
  );

  renderApp();
  scheduleSave();

  showNotification(`Level sekarang ${newLevel}`);
}


/* 14. COUNTDOWN */

function updateCountdown() {
  const element = document.getElementById("countdownTimer");
  if (!element) return;

  const endDate = new Date(
    appData?.settings?.challengeEnd || CONFIG.CHALLENGE_END
  );

  const difference = endDate - new Date();

  if (difference <= 0) {
    element.textContent = "Challenge selesai";
    return;
  }

  const days = Math.floor(difference / 86400000);
  const hours = Math.floor((difference / 3600000) % 24);
  const minutes = Math.floor((difference / 60000) % 60);
  const seconds = Math.floor((difference / 1000) % 60);

  element.textContent =
    `${days} Hari ${hours} Jam ${minutes} Menit ${seconds} Detik`;
}


/* 15. DASHBOARD RENDER */

function renderDashboard() {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText("totalWealth", formatRupiah(appData.wealth));
  setText("totalIncome", formatRupiah(appData.totalIncome));
  setText("totalExpense", formatRupiah(appData.totalExpense));

  setText("currentLevel", appData.currentLevel);

  const progress = getLevelProgress();

  setText("levelCounter", appData.currentLevel);
  setText("levelTitle", getLevelTitle(appData.currentLevel));

  setText(
    "levelDescription",
    `Kumpulkan kekayaan untuk mencapai target Level ${Math.min(appData.currentLevel + 1, 100)}.`
  );

  setText(
    "progressPercentage",
    `${progress.percentage.toFixed(1)}%`
  );

  setText(
    "currentWealthLabel",
    formatRupiah(appData.wealth)
  );

  setText(
    "nextLevelTarget",
    formatRupiah(progress.nextTarget)
  );

  const bar = document.getElementById("levelProgressBar");

  if (bar) {
    bar.style.width = `${progress.percentage}%`;
  }

  renderActivities();
  renderActiveQuests();
}


/* 16. ACTIVITY LIST */

function renderActivities() {
  const container = document.getElementById("recentActivityList");
  if (!container) return;

  if (!appData.activities.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <p>No activities yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = appData.activities
    .slice(0, 8)
    .map(item => `
      <div class="activity-item">
        <div class="activity-info">
          <strong>${escapeHTML(item.title)}</strong>
          <p>${escapeHTML(item.description)}</p>
          <small>${formatDate(item.date)}</small>
        </div>
      </div>
    `)
    .join("");
}


/* 17. QUEST SUMMARY */

function renderQuestSummary() {
  const total = appData.quests.length;

  const completed = appData.quests.filter(
    quest => quest.status === "completed"
  ).length;

  const pending = total - completed;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText("totalQuests", total);
  setText("completedQuests", completed);
  setText("pendingQuests", pending);
}


/* 18. ACTIVE QUESTS */

function renderActiveQuests() {
  const container = document.getElementById("activeQuestList");
  if (!container) return;

  const active = appData.quests
    .filter(quest => quest.status !== "completed")
    .slice()
    .reverse();

  const visibleQuests = active.slice(0, 5);

  if (!visibleQuests.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-bullseye"></i>
        <p>No active challenges.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = visibleQuests
    .map(quest => `
      <div class="quest-item">
        <div>
          <strong>${escapeHTML(quest.title)}</strong>
          <p>${escapeHTML(quest.description || "")}</p>
          <small>Reward: ${formatRupiah(quest.reward)}</small>
        </div>

        <button
          class="btn btn-secondary"
          type="button"
          data-action="complete-quest"
          data-id="${escapeHTML(quest.id)}"
        >
          Selesaikan
        </button>
      </div>
    `)
    .join("");
}


/* 19. QUEST PAGE */

function renderQuestPage() {
  const container = document.getElementById("questPageList");
  if (!container) return;

  renderQuestSummary();

  if (!appData.quests.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-flag"></i>
        <p>No quests created yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = appData.quests
    .map(quest => {
      const completed = quest.status === "completed";

      return `
        <div class="quest-item ${completed ? "completed" : ""}">
          <div>
            <strong>${escapeHTML(quest.title)}</strong>
            <p>${escapeHTML(quest.description)}</p>
            <small>Reward: ${formatRupiah(quest.reward)}</small>
            <small>Status: ${completed ? "Completed" : "In Progress"}</small>
          </div>

          <div class="quest-actions">
            ${
              !completed
                ? `
                  <button
                    class="btn btn-secondary"
                    type="button"
                    data-action="complete-quest"
                    data-id="${escapeHTML(quest.id)}"
                  >
                    Selesaikan
                  </button>
                `
                : ""
            }

            <button
              class="btn btn-secondary"
              type="button"
              data-action="delete-quest"
              data-id="${escapeHTML(quest.id)}"
            >
              Hapus
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}


/* 20. STRATEGY */

function renderStrategies() {
  const container = document.getElementById("strategyList");
  if (!container) return;

  if (!appData.strategies.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-chess"></i>
        <p>No strategies created yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = appData.strategies
    .map(strategy => `
      <div class="strategy-item">
        <div>
          <strong>${escapeHTML(strategy.title)}</strong>
          <p>${escapeHTML(strategy.description)}</p>
          <small>${escapeHTML(strategy.category || "Umum")}</small>
          <small>${formatDate(strategy.createdAt)}</small>
        </div>

        <button
          class="btn btn-secondary"
          type="button"
          data-action="delete-strategy"
          data-id="${escapeHTML(strategy.id)}"
        >
          Hapus
        </button>
      </div>
    `)
    .join("");
}


/* 21. INCOME */

function addIncome() {
  const title = prompt("Nama sumber pemasukan:");
  if (!title?.trim()) return;

  const amount = Number(prompt("Nominal pemasukan:"));

  if (!Number.isFinite(amount) || amount <= 0) {
    showNotification("Nominal tidak valid.", "error");
    return;
  }

  appData.totalIncome += amount;
  appData.wealth += amount;

  appData.transactions.unshift({
    id: createId(),
    type: "income",
    title: title.trim(),
    amount,
    date: new Date().toISOString()
  });

  addActivity(
    "Pemasukan baru",
    `${title.trim()} +${formatRupiah(amount)}`
  );

  renderApp();
  scheduleSave();

  showNotification("Pemasukan berhasil ditambahkan.");
}


/* 22. EXPENSE */

function addExpense() {
  const title = prompt("Nama pengeluaran:");
  if (!title?.trim()) return;

  const amount = Number(prompt("Nominal pengeluaran:"));

  if (!Number.isFinite(amount) || amount <= 0) {
    showNotification("Nominal tidak valid.", "error");
    return;
  }

  if (
    amount > appData.wealth &&
    !confirm("Pengeluaran lebih besar dari kekayaan. Lanjutkan?")
  ) return;

  appData.totalExpense += amount;
  appData.wealth = Math.max(0, appData.wealth - amount);

  appData.transactions.unshift({
    id: createId(),
    type: "expense",
    title: title.trim(),
    amount,
    date: new Date().toISOString()
  });

  addActivity(
    "Pengeluaran baru",
    `${title.trim()} -${formatRupiah(amount)}`
  );

  renderApp();
  scheduleSave();

  showNotification("Pengeluaran berhasil ditambahkan.");
}


/* 23. ADJUST WEALTH */

function adjustWealth() {
  const amount = Number(
    prompt("Masukkan total kekayaan terbaru:")
  );

  if (!Number.isFinite(amount) || amount < 0) {
    showNotification("Nominal tidak valid.", "error");
    return;
  }

  const oldWealth = appData.wealth;

  appData.wealth = amount;

  addActivity(
    "Penyesuaian kekayaan",
    `${formatRupiah(oldWealth)} menjadi ${formatRupiah(amount)}`
  );

  renderApp();
  scheduleSave();

  showNotification("Kekayaan diperbarui.");
}


/* 24. ADD STRATEGY */

function addStrategy() {
  const title = prompt("Nama strategi:");
  if (!title?.trim()) return;

  const description = prompt("Deskripsi strategi:");
  const category = prompt(
    "Kategori: Keuangan / Bisnis / Investasi",
    "Keuangan"
  );

  appData.strategies.unshift({
    id: createId(),
    title: title.trim(),
    description: (description || "").trim(),
    category: (category || "Umum").trim(),
    createdAt: new Date().toISOString()
  });

  addActivity("Strategi baru", title.trim());

  renderApp();
  scheduleSave();

  showNotification("Strategi berhasil ditambahkan.");
}


/* 25. ADD QUEST */

function addQuest() {
  const title = prompt("Nama quest:");
  if (!title?.trim()) return;

  const description = prompt("Deskripsi quest:");

  const reward = Number(
    prompt("Reward uang (isi 0 jika tidak ada):", "0")
  );

  if (!Number.isFinite(reward) || reward < 0) {
    showNotification("Reward tidak valid.", "error");
    return;
  }

  appData.quests.unshift({
    id: createId(),
    title: title.trim(),
    description: (description || "").trim(),
    reward,
    status: "active",
    createdAt: new Date().toISOString(),
    completedAt: null
  });

  addActivity("Quest baru", title.trim());

  renderApp();
  scheduleSave();

  showNotification("Quest berhasil dibuat.");
}


/* 26. COMPLETE QUEST */

function completeQuest(id) {
  const quest = appData.quests.find(
    item => item.id === id
  );

  if (!quest || quest.status === "completed") return;

  if (!confirm(`Selesaikan quest "${quest.title}"?`)) return;

  quest.status = "completed";
  quest.completedAt = new Date().toISOString();

  const reward = Number(quest.reward) || 0;

  if (reward > 0) {
    appData.wealth += reward;
    appData.totalIncome += reward;

    appData.transactions.unshift({
      id: createId(),
      type: "income",
      title: `Reward quest: ${quest.title}`,
      amount: reward,
      date: new Date().toISOString()
    });
  }

  addActivity("Quest selesai", quest.title);

  renderApp();
  scheduleSave();

  showNotification("Quest berhasil diselesaikan.");
}


/* 27. DELETE QUEST */

function deleteQuest(id) {
  const quest = appData.quests.find(
    item => item.id === id
  );

  if (!quest) return;

  if (!confirm(`Hapus quest "${quest.title}"?`)) return;

  appData.quests = appData.quests.filter(
    item => item.id !== id
  );

  addActivity("Quest dihapus", quest.title);

  renderApp();
  scheduleSave();

  showNotification("Quest berhasil dihapus.");
}


/* 28. DELETE STRATEGY */

function deleteStrategy(id) {
  const strategy = appData.strategies.find(
    item => item.id === id
  );

  if (!strategy) return;

  if (!confirm(`Hapus strategi "${strategy.title}"?`)) return;

  appData.strategies = appData.strategies.filter(
    item => item.id !== id
  );

  addActivity("Strategi dihapus", strategy.title);

  renderApp();
  scheduleSave();

  showNotification("Strategi berhasil dihapus.");
}


/* 29. NAVIGATION - MATCH HTML ID */

function navigateTo(pageName) {
  const validPages = ["dashboard", "strategy", "quests"];

  if (!validPages.includes(pageName)) return;

  document.querySelectorAll(".page-content").forEach(page => {
    page.classList.toggle(
      "hidden",
      page.id !== pageName
    );
  });

  document.querySelectorAll(".nav-link[data-page]").forEach(link => {
    link.classList.toggle(
      "active",
      link.dataset.page === pageName
    );
  });

  const titles = {
    dashboard: "Dashboard",
    strategy: "Strategi Keuangan & Bisnis Model",
    quests: "Quest & Challenge"
  };

  const title = document.getElementById("pageTitle");

  if (title) title.textContent = titles[pageName];

  if (pageName === "quests") renderQuestPage();
  if (pageName === "strategy") renderStrategies();

  closeSidebar();
}


/* 30. SIDEBAR MOBILE */

function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  sidebar?.classList.add("active");
  overlay?.classList.add("active");

  sidebarIsOpen = true;
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  sidebar?.classList.remove("active");
  overlay?.classList.remove("active");

  sidebarIsOpen = false;
}

function toggleSidebar() {
  sidebarIsOpen ? closeSidebar() : openSidebar();
}


/* 31. EVENTS */

function bindEvents() {
  document.querySelectorAll(".nav-link[data-page]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  document.getElementById("levelUpButton")
    ?.addEventListener("click", () => changeLevel(1));

  document.getElementById("levelDownButton")
    ?.addEventListener("click", () => changeLevel(-1));

  document.getElementById("addStrategyButton")
    ?.addEventListener("click", addStrategy);

  document.getElementById("addQuestButton")
    ?.addEventListener("click", addQuest);

  document.getElementById("menuToggle")
    ?.addEventListener("click", toggleSidebar);

  document.getElementById("sidebarOverlay")
    ?.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSidebar();
  });

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button || !appData) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    switch (action) {
      case "add-income":
        addIncome();
        break;

      case "add-expense":
        addExpense();
        break;

      case "adjust-wealth":
        adjustWealth();
        break;

      case "complete-quest":
        completeQuest(id);
        break;

      case "delete-quest":
        deleteQuest(id);
        break;

      case "delete-strategy":
        deleteStrategy(id);
        break;
    }
  });
}


/* 32. DASHBOARD QUICK ACTIONS */

function createQuickActions() {
  if (document.getElementById("lifeQuickActions")) return;

  const activity = document.getElementById("recentActivityList");
  const card = activity?.closest(".content-card");

  if (!card) return;

  const panel = document.createElement("div");

  panel.id = "lifeQuickActions";
  panel.className = "content-card";

  panel.innerHTML = `
    <div class="content-card-header">
      <div>
        <h3>Quick Financial Actions</h3>
        <p>Catat pemasukan dan pengeluaranmu.</p>
      </div>
      <i class="fa-solid fa-wallet"></i>
    </div>

    <div class="quick-action-buttons">
      <button class="btn btn-primary" type="button" data-action="add-income">
        + Pemasukan
      </button>

      <button class="btn btn-secondary" type="button" data-action="add-expense">
        - Pengeluaran
      </button>

      <button class="btn btn-secondary" type="button" data-action="adjust-wealth">
        Atur Kekayaan
      </button>
    </div>
  `;

  card.parentElement.insertBefore(panel, card);
}


/* 33. RENDER ALL */

function renderApp() {
  if (!appData) return;

  const date = document.getElementById("currentDate");

  if (date) {
    date.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  renderDashboard();
  renderQuestPage();
  renderStrategies();
  updateCountdown();
}


/* 34. CONNECTION ERROR */

function showConnectionError(message) {
  isConnected = false;

  setStatus("Connection Failed", "error");

  let screen = document.getElementById("jsonBinErrorScreen");

  if (!screen) {
    screen = document.createElement("div");
    screen.id = "jsonBinErrorScreen";

    Object.assign(screen.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99998",
      background: "#080b09",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      textAlign: "center"
    });

    document.body.appendChild(screen);
  }

  screen.innerHTML = `
    <div style="max-width:480px;width:100%">
      <h2 style="color:#35c875">JSONBin Connection Failed</h2>

      <p style="color:#b8c5bc;line-height:1.7">
        Life Leveling tidak dapat memuat data.
      </p>

      <div style="
        background:#171d19;
        border:1px solid #343f37;
        border-radius:12px;
        padding:14px;
        margin:20px 0;
        color:#ff8585;
        overflow-wrap:anywhere;
        text-align:left;
        font-size:13px
      ">
        ${escapeHTML(message)}
      </div>

      <button
        id="reconnectButton"
        type="button"
        style="
          border:0;
          border-radius:9px;
          padding:13px 22px;
          background:#19a65b;
          color:white;
          font-weight:700;
          cursor:pointer
        "
      >
        Coba Hubungkan Lagi
      </button>
    </div>
  `;

  document.querySelector(".app-container")?.style.setProperty(
    "visibility",
    "hidden"
  );
}


/* 35. HIDE ERROR */

function hideConnectionError() {
  document.getElementById("jsonBinErrorScreen")?.remove();

  document.querySelector(".app-container")?.style.removeProperty(
    "visibility"
  );
}


/* 36. RECONNECT */

async function reconnectToJSONBin() {
  const button = document.getElementById("reconnectButton");

  if (button) {
    button.disabled = true;
    button.textContent = "Menghubungkan...";
  }

  try {
    await loadData();
    hideConnectionError();

    showNotification("JSONBin berhasil terhubung.");

  } catch (error) {
    console.error(error);
    showConnectionError(error.message);

  } finally {
    const retry = document.getElementById("reconnectButton");

    if (retry) {
      retry.disabled = false;
      retry.textContent = "Coba Hubungkan Lagi";
    }
  }
}


/* 37. INITIALIZE */

async function initializeApp() {
  bindEvents();

  try {
    await loadData();

    hideConnectionError();
    createQuickActions();

    setInterval(updateCountdown, 1000);

    console.log("Life Leveling initialized successfully.");

  } catch (error) {
    console.error("Life Leveling error:", error);
    showConnectionError(error.message);
  }
}


/* 38. START */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
