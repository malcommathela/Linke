/* ============================================
   Linke Settings Page Controller — FULLY FUNCTIONAL
   ============================================ */

class SettingsApp {
    constructor() {
        this.currentSection = 'profile';
        this.user = null;
        this.originalData = {};
        this.init();
    }

    async init() {
        lucide.createIcons();
        this.bindEvents();
        this.loadTheme();
        await this.loadUser();
        await this.loadProfileData();
        await this.loadUsageStats();
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
            } else if (res.status === 401) {
                window.location.href = '/pages/login.html';
            }
        } catch (err) {
            console.error('Failed to load user:', err);
            showToast('Failed to load user data', 'error');
        }
    }

    async loadProfileData() {
        if (!this.user) return;

        try {
            // Fetch full user profile from users table
            const res = await fetch(`/api/me`);
            if (res.ok) {
                const data = await res.json();
                this.user = { ...this.user, ...data };

                // Store original data for reset
                this.originalData = {
                    displayName: this.user.username || '',
                    username: this.user.username || '',
                    email: this.user.email || '',
                    bio: this.user.bio || ''
                };

                document.getElementById('displayName').value = this.originalData.displayName;
                document.getElementById('username').value = this.originalData.username;
                document.getElementById('email').value = this.originalData.email;
                document.getElementById('bio').value = this.originalData.bio || 'URL shortener enthusiast. Building things on the web.';

                // Update avatar preview
                const avatarPreview = document.getElementById('avatarPreview');
                if (this.user.avatar_url) {
                    avatarPreview.innerHTML = `<img src="${this.user.avatar_url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
                } else {
                    avatarPreview.textContent = (this.user.username || 'U').slice(0, 2).toUpperCase();
                }
            }
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
    }

    async loadUsageStats() {
        try {
            const res = await fetch('/api/urls');
            if (res.ok) {
                const data = await res.json();
                const urls = data.urls || [];
                const totalClicks = urls.reduce((sum, u) => sum + (u.click_count || 0), 0);

                // Update links usage
                const linkCount = urls.length;
                const linkLimit = 30;
                const linkPercent = Math.min((linkCount / linkLimit) * 100, 100);

                document.getElementById('linkUsage').textContent = `${linkCount} of ${linkLimit}`;
                document.getElementById('linkProgress').style.width = `${linkPercent}%`;

                // Update clicks usage
                const clickLimit = 100000;
                const clickPercent = Math.min((totalClicks / clickLimit) * 100, 100);

                document.getElementById('clickUsage').textContent = `${totalClicks.toLocaleString()} of ${clickLimit.toLocaleString()}`;
                document.getElementById('clickProgress').style.width = `${clickPercent}%`;
            }
        } catch (err) {
            console.error('Failed to load usage stats:', err);
        }
    }

    switchSection(section) {
        document.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });

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
        preview.innerHTML = `<img src="${e.target.result}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;

        // Store base64 for saving later
        window.tempAvatarBase64 = e.target.result;
        showToast('Avatar selected. Save profile to apply.', 'info');
    };
    reader.readAsDataURL(file);
};

window.saveProfile = async function() {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const bio = document.getElementById('bio').value.trim();
    const displayName = document.getElementById('displayName').value.trim();

    if (!username || !email) {
        showToast('Username and email are required', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }

    const updates = {
        username: username || displayName,
        email: email,
        bio: bio
    };

    // Include avatar if uploaded
    if (window.tempAvatarBase64) {
        updates.avatar_url = window.tempAvatarBase64;
    }

    try {
        const res = await fetch('/api/users/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Profile saved successfully!', 'success');
            window.tempAvatarBase64 = null;

            // Update UI with new data
            if (data.user) {
                document.getElementById('userName').textContent = data.user.username || 'User';
                document.getElementById('userAvatar').textContent = (data.user.username || 'U').slice(0, 2).toUpperCase();
            }
        } else {
            showToast(data.message || 'Failed to save profile', 'error');
        }
    } catch (err) {
        console.error('Save profile error:', err);
        showToast('Network error. Please try again.', 'error');
    }
};

window.resetProfile = function() {
    if (confirm('Discard changes?')) {
        const app = window.settingsApp;
        if (app && app.originalData) {
            document.getElementById('displayName').value = app.originalData.displayName;
            document.getElementById('username').value = app.originalData.username;
            document.getElementById('email').value = app.originalData.email;
            document.getElementById('bio').value = app.originalData.bio || 'URL shortener enthusiast. Building things on the web.';

            // Reset avatar
            const preview = document.getElementById('avatarPreview');
            preview.textContent = (app.user?.username || 'U').slice(0, 2).toUpperCase();
            window.tempAvatarBase64 = null;
        }
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

    try {
        const res = await fetch('/api/users/me/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Password updated successfully!', 'success');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showToast(data.message || 'Failed to update password', 'error');
        }
    } catch (err) {
        console.error('Change password error:', err);
        showToast('Network error. Please try again.', 'error');
    }
};

window.toggle2FA = function() {
    const toggle = document.getElementById('toggle2FA');
    toggle.classList.toggle('active');
    const enabled = toggle.classList.contains('active');
    showToast(enabled ? '2FA enabled (demo)' : '2FA disabled (demo)', enabled ? 'success' : 'info');
};

window.toggleSwitch = function(el) {
    el.classList.toggle('active');
};

window.deactivateAccount = async function() {
    if (!confirm('Deactivate your account? You can reactivate later by logging in.')) return;

    try {
        const res = await fetch('/api/users/me/deactivate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Account deactivated. Redirecting...', 'info');
            setTimeout(() => window.location.href = '/pages/login.html', 2000);
        } else {
            showToast(data.message || 'Failed to deactivate account', 'error');
        }
    } catch (err) {
        console.error('Deactivate error:', err);
        showToast('Network error. Please try again.', 'error');
    }
};

window.deleteAccount = async function() {
    if (!confirm('⚠️ PERMANENTLY delete your account? This cannot be undone!')) return;
    if (prompt('Type DELETE to confirm:') !== 'DELETE') {
        showToast('Deletion cancelled', 'info');
        return;
    }

    try {
        const res = await fetch('/api/users/me', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Account deleted permanently. Redirecting...', 'success');
            setTimeout(() => window.location.href = '/', 2000);
        } else {
            showToast(data.message || 'Failed to delete account', 'error');
        }
    } catch (err) {
        console.error('Delete account error:', err);
        showToast('Network error. Please try again.', 'error');
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
    window.settingsApp = new SettingsApp();
});