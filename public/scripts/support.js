/* ============================================
   Linke Support Page Controller
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
            }
        } catch (err) {
            console.error('Failed to load user:', err);
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

// Submit ticket
window.submitTicket = async function() {
    const subject = document.getElementById('ticketSubject').value.trim();
    const category = document.getElementById('ticketCategory').value;
    const message = document.getElementById('ticketMessage').value.trim();

    if (!subject || !category || !message) {
        showToast('Please fill all fields', 'error');
        return;
    }

    // In production: POST /api/tickets
    showToast('Ticket submitted! We ll respond within 24 hours.', 'success');

    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketCategory').value = '';
    document.getElementById('ticketMessage').value = '';
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