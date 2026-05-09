/* ============================================
   Linke Settings Page Controller
   ============================================ */

class SettingsApp {
    constructor() {
        this.currentSection = 'profile';
        this.user = null;
        this.init();
    }

    async init() {
        lucide.createIcons();
        this.bindEvents();
        this.loadTheme();
        await this.loadUser();
        this.loadProfileData();
    }

    bindEvents() {
        document.getElementById('sidebarToggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.toggleMobileSidebar());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        // Settings nav
        document.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.addEventListener('click', () => this.switchSection(btn.dataset.section));
        });
    }

    async loadUser() {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                this.user = await res.json();
                document.getElementById('userName').textContent = this.user.username || 'User';
                document.getElementById('userAvatar').textContent = (this.user.username || 'U').slice(0, 2).toUpperCase();
                document.getElementById('avatarPreview').textContent = (this.user.username || 'U').slice(0, 2).toUpperCase();
            }
        } catch (err) {
            console.error('Failed to load user:', err);
        }
    }

    loadProfileData() {
        if (!this.user) return;
        document.getElementById('displayName').value = this.user.username || '';
        document.getElementById('username').value = this.user.username || '';
        document.getElementById('email').value = this.user.email || '';
    }

    switchSection(section) {
        // Update nav
        document.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });

        // Update content
        document.querySelectorAll('.settings-section').forEach(sec => {
            sec.classList.toggle('active', sec.id === `section-${section}`);
        });

        this.currentSection = section;
        lucide.createIcons();
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

// Global functions for inline onclick handlers
window.handleAvatarUpload = function(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast('File too large. Max 2MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('avatarPreview');
        preview.innerHTML = `<img src="${e.target.result}" alt="Avatar">`;
        showToast('Avatar updated!', 'success');
    };
    reader.readAsDataURL(file);
};

window.saveProfile = async function() {
    const data = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        bio: document.getElementById('bio').value
    };

    try {
        // In production: POST /api/users/me
        showToast('Profile saved successfully!', 'success');
    } catch (err) {
        showToast('Failed to save profile', 'error');
    }
};

window.resetProfile = function() {
    if (confirm('Discard changes?')) {
        window.settingsApp.loadProfileData();
        showToast('Changes discarded', 'info');
    }
};

window.changePassword = async function() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current || !newPass || !confirm) {
        showToast('Please fill all fields', 'error');
        return;
    }
    if (newPass.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    if (newPass !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    showToast('Password updated!', 'success');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
};

window.toggle2FA = function() {
    const toggle = document.getElementById('toggle2FA');
    toggle.classList.toggle('active');
    const enabled = toggle.classList.contains('active');
    showToast(enabled ? '2FA enabled' : '2FA disabled', enabled ? 'success' : 'info');
};

window.toggleSwitch = function(el) {
    el.classList.toggle('active');
};

window.deactivateAccount = function() {
    if (confirm('Deactivate your account? You can reactivate later by logging in.')) {
        showToast('Account deactivated', 'info');
    }
};

window.deleteAccount = function() {
    if (confirm('⚠️ PERMANENTLY delete your account? This cannot be undone!')) {
        if (prompt('Type DELETE to confirm:') === 'DELETE') {
            showToast('Account deleted', 'success');
            setTimeout(() => window.location.href = '/', 2000);
        }
    }
};

window.logout = async function() {
    try {
        await fetch('/logout', { method: 'POST' });
    } catch (e) {}
    window.location.href = '/pages/login.html';
};

// Toast system
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
    window.settingsApp = new SettingsApp();
});