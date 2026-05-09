/* ============================================
   Linke Support Page Controller — FULLY FUNCTIONAL
   ============================================ */

class SupportApp {
    constructor() {
        this.user = null;
        this.init();
    }

    async init() {
        lucide.createIcons();
        this.bindEvents();
        this.loadTheme();
        await this.loadUser();
        await this.loadUsageStats();
    }

    bindEvents() {
        document.getElementById('sidebarToggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.toggleMobileSidebar());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    }

    async loadUser() {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                this.user = await res.json();
                document.getElementById('userName').textContent = this.user.username || 'User';
                document.getElementById('userAvatar').textContent = (this.user.username || 'U').slice(0, 2).toUpperCase();
            } else if (res.status === 401) {
                window.location.href = '/pages/login.html';
            }
        } catch (err) {
            console.error('Failed to load user:', err);
            showToast('Failed to load user data', 'error');
        }
    }

    async loadUsageStats() {
        try {
            const res = await fetch('/api/urls');
            if (res.ok) {
                const data = await res.json();
                const urls = data.urls || [];
                const totalClicks = urls.reduce((sum, u) => sum + (u.click_count || 0), 0);

                const linkCount = urls.length;
                const linkLimit = 30;
                const linkPercent = Math.min((linkCount / linkLimit) * 100, 100);

                document.getElementById('linkUsage').textContent = `${linkCount} of ${linkLimit}`;
                document.getElementById('linkProgress').style.width = `${linkPercent}%`;

                const clickLimit = 100000;
                const clickPercent = Math.min((totalClicks / clickLimit) * 100, 100);

                document.getElementById('clickUsage').textContent = `${totalClicks.toLocaleString()} of ${clickLimit.toLocaleString()}`;
                document.getElementById('clickProgress').style.width = `${clickPercent}%`;
            }
        } catch (err) {
            console.error('Failed to load usage stats:', err);
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const icon = document.getElementById('sidebarToggleIcon');
        sidebar.classList.toggle('collapsed');
        icon.setAttribute('data-lucide', sidebar.classList.contains('collapsed') ? 'chevron-right' : 'chevron-left');
        lucide.createIcons();
    }

    toggleMobileSidebar() {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    }

    toggleTheme() {
        const html = document.documentElement;
        const icon = document.getElementById('themeIcon');
        const isDark = html.getAttribute('data-theme') === 'dark';

        if (isDark) {
            html.removeAttribute('data-theme');
            icon.setAttribute('data-lucide', 'moon');
            localStorage.setItem('theme', 'light');
        } else {
            html.setAttribute('data-theme', 'dark');
            icon.setAttribute('data-lucide', 'sun');
            localStorage.setItem('theme', 'dark');
        }
        lucide.createIcons();
    }

    loadTheme() {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeIcon')?.setAttribute('data-lucide', 'sun');
            lucide.createIcons();
        }
    }
}

// FAQ accordion
window.toggleFAQ = function(btn) {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');

    // Close all others
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));

    // Toggle current
    if (!isOpen) {
        item.classList.add('open');
    }

    // Re-render icons
    lucide.createIcons();
};

// Search/filter FAQs
window.filterFAQs = function(query) {
    const items = document.querySelectorAll('.faq-item');
    const lower = query.toLowerCase();

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(lower) ? '' : 'none';
    });
};

// Chat widget placeholder
window.openChat = function() {
    showToast('Live chat coming soon! Email us at support@linke.io', 'info');
};

// Submit ticket — FULLY FUNCTIONAL
window.submitTicket = async function() {
    const subject = document.getElementById('ticketSubject').value.trim();
    const category = document.getElementById('ticketCategory').value;
    const message = document.getElementById('ticketMessage').value.trim();

    if (!subject) {
        showToast('Please enter a subject', 'error');
        return;
    }
    if (!category) {
        showToast('Please select a category', 'error');
        return;
    }
    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }
    if (message.length < 10) {
        showToast('Message must be at least 10 characters', 'error');
        return;
    }

    const btn = document.querySelector('.ticket-card .btn-primary');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Sending...`;
    btn.disabled = true;
    lucide.createIcons();

    try {
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, category, message })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Ticket submitted! We\'ll respond within 24 hours.', 'success');
            document.getElementById('ticketSubject').value = '';
            document.getElementById('ticketCategory').value = '';
            document.getElementById('ticketMessage').value = '';
        } else {
            showToast(data.message || 'Failed to submit ticket', 'error');
        }
    } catch (err) {
        console.error('Submit ticket error:', err);
        showToast('Network error. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        lucide.createIcons();
    }
};

window.logout = async function() {
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/pages/login.html';
};

// Toast system (shared)
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const colors = {
        success: 'var(--accent-teal)',
        error: 'var(--accent-coral)',
        info: 'var(--accent-blue)'
    };
    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        info: 'info'
    };

    toast.style.cssText = `
        background: var(--card-bg);
        border: 1.5px solid ${colors[type]};
        border-radius: 12px;
        padding: 14px 20px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        box-shadow: var(--shadow-medium);
        animation: fadeInUp 0.3s ease;
        cursor: pointer;
        z-index: 9999;
    `;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" style="width: 18px; height: 18px; color: ${colors[type]};"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    toast.addEventListener('click', () => toast.remove());
};

document.addEventListener('DOMContentLoaded', () => {
    window.supportApp = new SupportApp();
});