// -------------------- INITIAL SETUP --------------------

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    initTheme();
    initDashboard();
});

let activeMenuId = null;
let deleteTargetId = null;

// Fetch user info + links + panel wiring
async function initDashboard() {
    await loadCurrentUser();
    await loadLinks();
    initCreatePanel();
}

// -------------------- CURRENT USER --------------------

async function loadCurrentUser() {
    try {
        const res = await fetch('/api/me').then(r => r.json()).then(console.log);
        if (!res.ok) return;

        const data = await res.json();
        const nameEl = document.querySelector(".user-name");
        const avatarEl = document.querySelector(".user-avatar");

        if (nameEl && data.username) {
            nameEl.textContent = data.username;
        }

        if (avatarEl && data.username) {
            const initials = data.username
                .split(" ")
                .map((p) => p[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
            avatarEl.textContent = initials || data.username[0].toUpperCase();
        }
    } catch (err) {
        console.error("Failed to load current user:", err);
    }
}

// -------------------- TOASTS --------------------

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const iconName = type === "success" ? "check-circle" : "alert-circle";
    toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
    <span>${message}</span>
  `;

    container.appendChild(toast);
    lucide.createIcons();

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// -------------------- LINKS: API + RENDER --------------------

// Load links from backend
async function loadLinks() {
    try {
        const res = await fetch("/api/urls", {
            method: "GET",
            headers: { Accept: "application/json" },
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || "Failed to load links", "error");
            return;
        }
        console.log("urls from API:", data.urls);
        renderLinksFromApi(data.urls || []);
    } catch (err) {
        console.error(err);
        showToast("Network error while loading links", "error");
    }
}

// Render cards using API data
function renderLinksFromApi(urls) {
    const container = document.getElementById("linksContainer");
    const emptyState = document.getElementById("emptyState");
    const pagination = document.getElementById("pagination");

    if (!container) return;

    if (!urls.length) {
        container.innerHTML = "";
        if (emptyState) emptyState.classList.add("show");
        if (pagination) pagination.style.display = "none";
        return;
    }

    if (emptyState) emptyState.classList.remove("show");
    if (pagination) pagination.style.display = "flex";

    container.innerHTML = urls
        .map((u) => {
            const shortUrl = u.short_url || `${window.location.origin}/${u.short_code}`;
            const dest = u.long_url;
            const faviconClass = getFaviconClass(dest);
            const faviconText = getFaviconText(dest);
            const clicks = u.click_count ?? 0;
            const statusText = formatStatus(u);
            const dateText = formatDate(u.created_at);
            const qrDataUrl = u.qr_data_url || "";

            return `
        <div class="link-card"
             data-id="${u.id}"
             data-short="${shortUrl}"
             data-long="${dest}"
             data-qr="${qrDataUrl}">
          <div class="link-favicon ${faviconClass}">${faviconText}</div>

          <div class="link-info">
            <div class="link-short">
              <a href="${shortUrl}" rel="noopener noreferrer">${shortUrl}</a>
              <div class="link-actions-inline">
                <button class="link-action-btn" onclick="copyLink('${shortUrl}', event)" title="Copy">
                  <i data-lucide="copy" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="link-action-btn" onclick="showQr('${qrDataUrl}', event)" title="QR Code">
                  <i data-lucide="qr-code" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="link-action-btn" onclick="editLinkItem('${u.id}', event)" title="Edit">
                  <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                </button>
              </div>
            </div>
            <div class="link-dest">
              <i data-lucide="arrow-right" style="width: 12px; height: 12px; color: var(--text-muted);"></i>
              <a href="${dest}" target="_blank" rel="noopener noreferrer">${dest}</a>
            </div>
          </div>

          <div class="link-stats">
            <div class="link-stat">
              <i data-lucide="users" style="width: 14px; height: 14px;"></i>
              ${clicks.toLocaleString()} Clicks
            </div>
            <div class="link-stat">
              <i data-lucide="clock-3" style="width: 14px; height: 14px;"></i>
              ${statusText}
            </div>
          </div>

          <div class="link-date">${dateText}</div>

          <div class="link-menu" onclick="toggleLinkMenu('${u.id}', event)">
            <i data-lucide="more-vertical" style="width: 16px; height: 16px;"></i>

            <div class="link-menu-dropdown" id="menu-${u.id}">
              <button class="link-menu-item" onclick="copyLinkItem('${u.id}', event)">
                <i data-lucide="copy"></i>
                Copy link
              </button>
              <button class="link-menu-item" onclick="editLinkItem('${u.id}', event)">
                <i data-lucide="pencil"></i>
                Edit link
              </button>
              <button class="link-menu-item" onclick="showQRCode('${u.id}', event)">
                <i data-lucide="qr-code"></i>
                QR code
              </button>
              <div class="link-menu-divider"></div>
              <button class="link-menu-item danger" onclick="confirmDelete('${u.id}', event)">
                <i data-lucide="trash-2"></i>
                Delete link
              </button>
            </div>
          </div>
        </div>
      `;
        })
        .join("");

    lucide.createIcons();
}

// Helpers to mimic original favicon behavior
function getFaviconClass(url) {
    if (!url) return "";
    const u = url.toLowerCase();
    if (u.includes("github.com")) return "github";
    if (u.includes("dribbble.com")) return "dribbble";
    if (u.includes("behance.net")) return "behance";
    if (u.includes("upwork.com")) return "upwork";
    if (u.includes("mobbin.com")) return "mobbin";
    return "readcv";
}

function getFaviconText(url) {
    try {
        const host = new URL(url).hostname.replace("www.", "");
        return host[0]?.toUpperCase() || "L";
    } catch {
        return "L";
    }
}

function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatStatus(u) {
    if (!u.is_active) return "Inactive";
    if (u.expires_at && new Date(u.expires_at) < new Date()) return "Expired";
    return "Active";
}

function showQr(dataUrl, event) {
    event.stopPropagation();
    if (!dataUrl) {
        showToast("QR code not available", "error");
        return;
    }
    const modal = document.getElementById("qrModal");
    const img = document.getElementById("qrModalImage");
    img.src = dataUrl;
    modal.classList.add("show");
}

function closeQrModal(event) {
    if (!event || event.target === document.getElementById("qrModal")) {
        document.getElementById("qrModal").classList.remove("show");
    }
}

// -------------------- FILTER (SEARCH) --------------------

async function filterLinks() {
    const query = document.getElementById("searchInput").value.toLowerCase();

    try {
        const res = await fetch("/api/urls");
        const data = await res.json();
        if (!res.ok) return;

        const urls = data.urls || [];
        const filtered = urls.filter(
            (u) =>
                (u.short_code && u.short_code.toLowerCase().includes(query)) ||
                (u.long_url && u.long_url.toLowerCase().includes(query))
        );

        renderLinksFromApi(filtered);
    } catch (err) {
        console.error(err);
    }
}

// -------------------- CARD ACTIONS --------------------

function copyLink(shortUrl, event) {
    event.stopPropagation();
    navigator.clipboard.writeText(shortUrl).then(
        () => showToast("Link copied to clipboard!", "success"),
        () => showToast("Failed to copy", "error")
    );
}

// menu‑based copy using card data attributes
function copyLinkItem(id, event) {
    event.stopPropagation();
    closeAllMenus();

    const card = document.querySelector(`.link-card[data-id="${id}"]`);
    if (!card) return;

    const shortUrl = card.getAttribute("data-short");
    if (!shortUrl) return;

    navigator.clipboard.writeText(shortUrl).then(
        () => showToast("Link copied to clipboard!", "success"),
        () => showToast("Failed to copy", "error")
    );
}

// edit prefill using create panel
function editLinkItem(id, event) {
    event.stopPropagation();
    closeAllMenus();

    const card = document.querySelector(`.link-card[data-id="${id}"]`);
    if (!card) return;

    const longUrl = card.getAttribute("data-long");
    const shortUrl = card.getAttribute("data-short");

    const urlInput = document.getElementById("createUrl");
    const keyInput = document.getElementById("createKey");
    const previewKey = document.getElementById("previewKey");

    if (urlInput) urlInput.value = longUrl || "";
    if (keyInput && shortUrl) {
        const key = shortUrl.split("/").pop();
        keyInput.value = key;
        if (previewKey) previewKey.textContent = key || "new-link";
    }

    openCreatePanel();
    showToast("Edit mode – update your link details", "success");
}

// QR from menu using existing modal
function showQRCode(id, event) {
    event.stopPropagation();
    closeAllMenus();

    const card = document.querySelector(`.link-card[data-id="${id}"]`);
    if (!card) return;

    const dataUrl = card.getAttribute("data-qr");
    showQr(dataUrl, event);
}

function closeAllMenus() {
    if (activeMenuId) {
        const menu = document.getElementById(`menu-${activeMenuId}`);
        if (menu) menu.classList.remove("show");
        activeMenuId = null;
    }
}

function toggleLinkMenu(id, event) {
    event.stopPropagation();

    const menu = document.getElementById(`menu-${id}`);
    if (!menu) return;

    // Close previously open menu if it's a different one
    if (activeMenuId && activeMenuId !== id) {
        const oldMenu = document.getElementById(`menu-${activeMenuId}`);
        if (oldMenu) oldMenu.classList.remove("show");
    }

    const isOpen = menu.classList.contains("show");
    if (isOpen) {
        menu.classList.remove("show");
        activeMenuId = null;
    } else {
        menu.classList.add("show");
        activeMenuId = id;
    }

    lucide.createIcons();
}

// -------------------- CREATE PANEL & QR --------------------

function initCreatePanel() {
    const keyInput = document.getElementById("createKey");
    const previewKey = document.getElementById("previewKey");
    const urlInput = document.getElementById("createUrl");
    const previewContent = document.getElementById("previewContent");

    if (keyInput && previewKey) {
        keyInput.addEventListener("input", (e) => {
            const value = e.target.value.trim();
            previewKey.textContent = value || "new-link";
            renderQrPattern(value || "new-link");
        });
    }

    if (urlInput && previewContent) {
        let previewTimeout;
        urlInput.addEventListener("input", () => {
            const value = urlInput.value.trim();
            if (!value) {
                previewContent.textContent = "Enter a URL to see preview";
                previewContent.innerHTML = "Enter a URL to see preview";
                return;
            }

            previewContent.textContent = "Loading preview...";

            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(() => {
                fetch(`/api/preview?url=${encodeURIComponent(value)}`)
                    .then((res) => res.json())
                    .then((data) => {
                        if (data.message && !data.title && !data.description) {
                            previewContent.textContent = "Could not load preview";
                            return;
                        }

                        const title = data.title || data.siteName || "Link preview";
                        const desc = data.description || data.url || "";
                        const image = data.image;

                        previewContent.innerHTML = `
              <div style="display:flex; gap:12px; align-items:flex-start;">
                ${
                            image
                                ? `<img src="${image}" style="width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0;">`
                                : ""
                        }
                <div style="text-align:left;">
                  <div style="font-weight:600;margin-bottom:4px;">${title}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${desc}</div>
                  <div style="font-size:11px;color:var(--accent-teal);">${data.url}</div>
                </div>
              </div>
            `;
                    })
                    .catch((err) => {
                        console.error(err);
                        previewContent.textContent = "Could not load preview";
                    });
            }, 500); // debounce
        });
    }

    renderQrPattern("new-link");
}

function openCreatePanel() {
    document.getElementById("createPanelOverlay").classList.add("show");
    document.getElementById("createPanel").classList.add("show");
}

function closeCreatePanel() {
    document.getElementById("createPanelOverlay").classList.remove("show");
    document.getElementById("createPanel").classList.remove("show");
}

async function createLink() {
    const urlInput = document.getElementById("createUrl");
    const keyInput = document.getElementById("createKey");
    const expirySelect = document.getElementById("createExpiry");

    const long_url = urlInput?.value.trim();
    const custom_key = keyInput?.value.trim();
    const expiry = expirySelect?.value || "never";

    if (!long_url) {
        showToast("Please enter a destination URL", "error");
        urlInput?.focus();
        return;
    }

    try {
        const res = await fetch("/api/urls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ long_url, custom_key, expiry }),
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.message || "Failed to create link", "error");
            return;
        }

        showToast("Link created successfully!", "success");
        closeCreatePanel();
        urlInput.value = "";
        keyInput.value = "";
        document.getElementById("previewKey").textContent = "new-link";
        renderQrPattern("new-link");
        await loadLinks();
    } catch (err) {
        console.error(err);
        showToast("Network error creating link", "error");
    }
}

async function deleteLink(id) {
    try {
        const req = await fetch(`/api/urls/${id}`, { method: "DELETE" });
        const data = await req.json();

        if (!req.ok) {
            console.log(data.message || "Delete failed");
            showToast(data.message || "Failed to delete link", "error");
            return;
        }

        showToast("Link deleted", "success");
        await loadLinks();
    } catch (err) {
        console.error(err);
        showToast("Network error deleting link", "error");
    }
}

// Simple QR‑pattern (visual only)
function renderQrPattern(seed) {
    const pattern = document.getElementById("qrPattern");
    if (!pattern) return;

    const cells = [];
    const hash = simpleHash(seed);
    for (let i = 0; i < 49; i++) {
        const isFilled = ((hash + i * 31) % 2) === 0;
        cells.push(`<div class="qr-cell ${isFilled ? "" : "empty"}"></div>`);
    }
    pattern.innerHTML = cells.join("");
}

function simpleHash(str) {
    let hash = 0;
    if (!str.length) return hash;
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return Math.abs(hash);
}

// -------------------- THEME TOGGLE --------------------

function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById("themeIcon");
    const isDark = html.getAttribute("data-theme") === "dark";

    if (isDark) {
        html.removeAttribute("data-theme");
        icon.setAttribute("data-lucide", "moon");
        localStorage.setItem("theme", "light");
    } else {
        html.setAttribute("data-theme", "dark");
        icon.setAttribute("data-lucide", "sun");
        localStorage.setItem("theme", "dark");
    }
    lucide.createIcons();
}

function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        const icon = document.getElementById("themeIcon");
        if (icon) icon.setAttribute("data-lucide", "sun");
        lucide.createIcons();
    }
}

// -------------------- SIDEBAR & NAV --------------------

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const icon = document.getElementById("sidebarToggleIcon");
    sidebar.classList.toggle("collapsed");

    if (sidebar.classList.contains("collapsed")) {
        icon.setAttribute("data-lucide", "chevron-right");
    } else {
        icon.setAttribute("data-lucide", "chevron-left");
    }
    lucide.createIcons();
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("mobile-open");
}

function setActiveNav(el) {
    document.querySelectorAll(".nav-item").forEach((item) =>
        item.classList.remove("active")
    );
    el.classList.add("active");
    if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.remove("mobile-open");
    }
    return false;
}

// -------------------- UPGRADE MODAL --------------------

function showUpgradeModal() {
    document.getElementById("upgradeModal").classList.add("show");
}

function closeUpgradeModal(event) {
    if (!event || event.target === document.getElementById("upgradeModal")) {
        document.getElementById("upgradeModal").classList.remove("show");
    }
}

// -------------------- KEYBOARD SHORTCUTS + CLICK OUTSIDE --------------------

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeCreatePanel();
        closeUpgradeModal();
        closeQrModal(e);
        closeDeleteModal();
        closeAllMenus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const search = document.getElementById("searchInput");
        if (search) search.focus();
    }
});

document.addEventListener("click", (e) => {
    if (activeMenuId && !e.target.closest(".link-menu")) {
        closeAllMenus();
    }
});

// -------------------- DELETE CONFIRM MODAL --------------------

function confirmDelete(id, event) {
    event.stopPropagation();
    closeAllMenus();

    deleteTargetId = id;

    const modal = document.createElement("div");
    modal.className = "delete-modal show";
    modal.id = "deleteModal";

    modal.innerHTML = `
      <div class="delete-card" onclick="event.stopPropagation()">
        <div class="delete-icon">
          <i data-lucide="trash-2" style="width: 28px; height: 28px;"></i>
        </div>
        <h3 class="delete-title">Delete Link?</h3>
        <p class="delete-desc">
          This action cannot be undone. The link will stop working immediately.
        </p>
        <div class="delete-actions">
          <button class="btn btn-ghost" onclick="closeDeleteModal()">Cancel</button>
          <button class="btn btn-danger" onclick="executeDelete()">Delete Link</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();
}

function closeDeleteModal() {
    const modal = document.getElementById("deleteModal");
    if (modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.remove(), 300);
    }
    deleteTargetId = null;
}

async function executeDelete() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    deleteTargetId = null;

    await deleteLink(id);
    closeDeleteModal();
}