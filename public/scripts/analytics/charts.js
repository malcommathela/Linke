/* ============================================
   Linke Analytics — Real Data Edition
   Fetches from /api/analytics/overview
   ============================================ */

class AnalyticsApp {
    constructor() {
        this.currentRange = '30d';
        this.modules = {};
        this.user = null;
        this.init();
    }

    async init() {
        lucide.createIcons();
        this.bindEvents();
        this.loadTheme();

        // Load user first
        await this.loadUser();

        // Then load modules and data
        await this.loadModules();
        await this.fetchData();
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

    bindEvents() {
        document.getElementById('sidebarToggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => this.toggleMobileSidebar());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        document.querySelectorAll('.date-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setDateRange(e.target));
        });
    }

    async loadModules() {
        try {
            const [{ ChartRenderer }, { DataStore }] = await Promise.all([
                import('./analytics/charts.js'),
                import('./analytics/data.js')
            ]);
            this.modules.charts = new ChartRenderer();
            this.modules.data = new DataStore();
        } catch (err) {
            console.error('Module load error:', err);
        }
    }

    async fetchData() {
        // Show skeletons
        this.showSkeletons();

        try {
            // Fetch real data from API
            const res = await fetch(`/api/analytics/overview?range=${this.currentRange}`);

            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/pages/login.html';
                    return;
                }
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            // Update usage stats
            this.updateUsageStats(data.totalUrls, data.stats.clicks.value);

            // Render all sections with real data
            this.renderStats(data.stats);
            this.renderLineChart(data.lineChart);
            this.renderPieChart(data.pieChart);
            this.renderTopLinks(data.topLinks);
            this.renderGeoTable(data.countries);
            this.renderDeviceTable(data.devices);
            this.renderReferrerTable(data.referrers);

            // Fade out skeletons
            this.markLoaded();

        } catch (err) {
            console.error('Fetch error:', err);
            // Fallback to demo data if API fails
            const fallback = this.getFallbackData();
            this.renderStats(fallback.stats);
            this.renderLineChart(fallback.lineChart);
            this.renderPieChart(fallback.pieChart);
            this.renderTopLinks(fallback.topLinks);
            this.renderGeoTable(fallback.countries);
            this.renderDeviceTable(fallback.devices);
            this.renderReferrerTable(fallback.referrers);
            this.markLoaded();
        }
    }

    updateUsageStats(urlCount, clickCount) {
        const linkPct = Math.min((urlCount / 30) * 100, 100);
        const clickPct = Math.min((clickCount / 100000) * 100, 100);

        document.getElementById('linkUsage').textContent = `${urlCount} of 30`;
        document.getElementById('linkProgress').style.width = `${linkPct}%`;
        document.getElementById('clickUsage').textContent = `${clickCount >= 1000 ? (clickCount / 1000).toFixed(1) + 'k' : clickCount} of 100k`;
        document.getElementById('clickProgress').style.width = `${clickPct}%`;
    }

    showSkeletons() {
        document.querySelectorAll('.stat-card, .chart-card, .table-card').forEach(card => {
            card.classList.remove('is-loaded');
        });
    }

    getFallbackData() {
        return {
            stats: {
                clicks: { value: 18420, change: 24.5, up: true },
                visitors: { value: 12580, change: 18.2, up: true },
                ctr: { value: 68.4, change: 5.3, up: true, suffix: '%' },
                bounce: { value: 32.1, change: 2.1, up: false, suffix: '%' }
            },
            lineChart: [45,52,48,65,72,68,85,92,88,95,102,98,110,125,118,135,142,138,155,162,158,175,182,178,195,202,198,215,222,218],
            pieChart: [
                { label: 'Direct', value: 40, color: 'var(--accent-teal)' },
                { label: 'Social', value: 25, color: 'var(--accent-blue)' },
                { label: 'Email', value: 15, color: 'var(--accent-gold)' },
                { label: 'Referral', value: 10, color: 'var(--accent-coral)' }
            ],
            topLinks: [
                { url: 'linke.io/lom67h', height: 92 },
                { url: 'linke.io/uj879a', height: 78 },
                { url: 'linke.io/ge4kz3', height: 65 },
                { url: 'linke.io/zy4kz3', height: 48 },
                { url: 'linke.io/selcan', height: 35 },
                { url: 'linke.io/s3l45n', height: 22 }
            ],
            countries: [
                { name: 'United States', flag: 'us', value: 8420, percent: 45, width: 85, color: 'var(--accent-teal)' },
                { name: 'United Kingdom', flag: 'gb', value: 3210, percent: 17, width: 52, color: 'var(--accent-blue)' },
                { name: 'Germany', flag: 'de', value: 2180, percent: 12, width: 38, color: 'var(--accent-gold)' },
                { name: 'Canada', flag: 'ca', value: 1650, percent: 9, width: 28, color: 'var(--accent-coral)' },
                { name: 'France', flag: 'fr', value: 1120, percent: 6, width: 20, color: 'var(--accent-teal)' }
            ],
            devices: [
                { name: 'Mobile', icon: 'smartphone', value: 11420, percent: 62, width: 62, color: 'var(--accent-teal)', bg: 'var(--badge-bg)' },
                { name: 'Desktop', icon: 'monitor', value: 5520, percent: 30, width: 30, color: 'var(--accent-blue)', bg: 'rgba(74,124,255,0.1)' },
                { name: 'Tablet', icon: 'tablet', value: 1480, percent: 8, width: 8, color: 'var(--accent-gold)', bg: 'rgba(212,168,67,0.1)' }
            ],
            referrers: [
                { name: 'Dribbble', abbr: 'Dr', value: 4230, percent: 23, width: 45, color: '#EA4C89', bg: 'rgba(234,76,137,0.1)' },
                { name: 'GitHub', abbr: 'Gh', value: 3120, percent: 17, width: 32, color: 'var(--text-primary)', bg: 'rgba(26,26,26,0.1)' },
                { name: 'Behance', abbr: 'Be', value: 2340, percent: 13, width: 24, color: '#1769FF', bg: 'rgba(23,105,255,0.1)' },
                { name: 'Upwork', abbr: 'Up', value: 1890, percent: 10, width: 18, color: '#14A800', bg: 'rgba(20,168,0,0.1)' }
            ]
        };
    }

    renderStats(stats) {
        const container = document.getElementById('statsRow');
        const config = {
            clicks: { label: 'Total Clicks', icon: 'mouse-pointer-click', iconClass: 'teal' },
            visitors: { label: 'Unique Visitors', icon: 'users', iconClass: 'blue' },
            ctr: { label: 'Avg. CTR', icon: 'target', iconClass: 'gold' },
            bounce: { label: 'Bounce Rate', icon: 'activity', iconClass: 'coral' }
        };

        Object.entries(stats).forEach(([key, data]) => {
            const card = container.querySelector(`[data-stat="${key}"]`);
            if (!card) return;

            const cfg = config[key];
            const suffix = data.suffix || '';
            const isDecimal = data.value % 1 !== 0;
            const displayValue = isDecimal ? data.value.toFixed(1) : data.value.toLocaleString();
            const changeClass = data.up ? 'up' : 'down';
            const changeIcon = data.up ? 'trending-up' : 'trending-down';
            const changeSign = data.up ? '+' : '-';

            card.innerHTML = `
                <div class="stat-header">
                    <span class="stat-label">${cfg.label}</span>
                    <div class="stat-icon ${cfg.iconClass}">
                        <i data-lucide="${cfg.icon}" style="width: 16px; height: 16px;"></i>
                    </div>
                </div>
                <div class="stat-value" data-target="${data.value}" data-suffix="${suffix}">0${suffix}</div>
                <span class="stat-change ${changeClass}">
                    <i data-lucide="${changeIcon}" style="width: 12px; height: 12px;"></i>
                    ${changeSign}${data.change}%
                </span>
            `;

            card.classList.remove('skeleton-card');
        });

        this.animateCounters();
        lucide.createIcons();
    }

    animateCounters() {
        document.querySelectorAll('.stat-value[data-target]').forEach(el => {
            const target = parseFloat(el.dataset.target);
            const suffix = el.dataset.suffix || '';
            const isDecimal = target % 1 !== 0;
            const duration = 1500;
            const start = performance.now();

            function update(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                const current = target * ease;

                el.textContent = (isDecimal ? current.toFixed(1) : Math.floor(current).toLocaleString()) + suffix;

                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
        });
    }

    renderLineChart(data) {
        const container = document.getElementById('lineChartContainer');
        const maxVal = Math.max(...data, 1);
        const width = 700;
        const height = 220;
        const padding = 20;
        const chartH = height - padding * 2;
        const chartW = width - padding * 2;
        const stepX = chartW / (data.length - 1);

        let pathD = `M ${padding} ${height - padding - (data[0] / maxVal) * chartH}`;
        let areaD = `M ${padding} ${height - padding} L ${padding} ${height - padding - (data[0] / maxVal) * chartH}`;

        for (let i = 1; i < data.length; i++) {
            const x = padding + i * stepX;
            const y = height - padding - (data[i] / maxVal) * chartH;
            pathD += ` L ${x} ${y}`;
            areaD += ` L ${x} ${y}`;
        }
        areaD += ` L ${width - padding} ${height - padding} Z`;

        let pointsHTML = '';
        data.forEach((val, i) => {
            const x = padding + i * stepX;
            const y = height - padding - (val / maxVal) * chartH;
            pointsHTML += `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent-teal)" stroke="var(--card-bg)" stroke-width="2" class="chart-point" data-day="${i + 1}" data-value="${val}" style="opacity:0; transition: opacity 0.3s ease; cursor: pointer;" />`;
        });

        container.innerHTML = `
            <svg class="line-chart-svg" viewBox="0 0 700 220" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--accent-teal)" stop-opacity="0.2"/>
                        <stop offset="100%" stop-color="var(--accent-teal)" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                <line x1="0" y1="55" x2="700" y2="55" stroke="var(--border-light)" stroke-width="1" stroke-dasharray="4"/>
                <line x1="0" y1="110" x2="700" y2="110" stroke="var(--border-light)" stroke-width="1" stroke-dasharray="4"/>
                <line x1="0" y1="165" x2="700" y2="165" stroke="var(--border-light)" stroke-width="1" stroke-dasharray="4"/>
                <path fill="url(#areaGradient)" d="${areaD}" opacity="0">
                    <animate attributeName="opacity" to="1" dur="0.8s" fill="freeze" />
                </path>
                <path fill="none" stroke="var(--accent-teal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="${pathD}" stroke-dasharray="2000" stroke-dashoffset="2000">
                    <style>
                        @keyframes drawLine {
                            to { stroke-dashoffset: 0; }
                        }
                    </style>
                </path>
                <g>${pointsHTML}</g>
            </svg>
            <div class="chart-tooltip" id="chartTooltip"></div>
        `;

        setTimeout(() => {
            container.querySelectorAll('.chart-point').forEach((pt, i) => {
                setTimeout(() => pt.style.opacity = '1', i * 30 + 500);
            });
        }, 600);

        const tooltip = container.querySelector('#chartTooltip');
        container.querySelectorAll('.chart-point').forEach(pt => {
            pt.addEventListener('mouseenter', () => {
                pt.setAttribute('r', '6');
                tooltip.textContent = `Day ${pt.dataset.day}: ${pt.dataset.value} clicks`;
                tooltip.classList.add('show');
                const rect = pt.getBoundingClientRect();
                const cRect = container.getBoundingClientRect();
                tooltip.style.left = (rect.left - cRect.left - tooltip.offsetWidth / 2 + 4) + 'px';
                tooltip.style.top = (rect.top - cRect.top - tooltip.offsetHeight - 8) + 'px';
            });
            pt.addEventListener('mouseleave', () => {
                pt.setAttribute('r', '4');
                tooltip.classList.remove('show');
            });
        });
    }

    renderPieChart(data) {
        const container = document.getElementById('pieSkeleton');
        const total = data.reduce((a, b) => a + b.value, 0) || 1;
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;

        const circles = data.map(slice => {
            const sliceLength = (slice.value / total) * circumference;
            const gap = circumference - sliceLength;
            const circle = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${slice.color}" stroke-width="20" stroke-dasharray="${sliceLength.toFixed(1)} ${gap.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" stroke-linecap="round" />`;
            offset += sliceLength;
            return circle;
        }).join('');

        const legend = data.map(slice => `
            <div class="pie-legend-item">
                <div class="pie-legend-dot" style="background: ${slice.color};"></div>
                <span>${slice.label}</span>
                <span class="pie-legend-value">${slice.value}%</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="pie-chart-container">
                <svg class="pie-chart-svg" viewBox="0 0 100 100">
                    ${circles}
                </svg>
            </div>
            <div class="pie-legend">${legend}</div>
        `;
    }

    renderTopLinks(links) {
        const container = document.getElementById('topLinksChart');
        container.classList.remove('skeleton-bars');
        container.innerHTML = links.map(link => `
            <div class="bar-item">
                <div class="bar-fill" style="height: 0%;" data-height="${link.height}"></div>
                <span class="bar-label">${link.url}</span>
            </div>
        `).join('');

        setTimeout(() => {
            container.querySelectorAll('.bar-fill').forEach((bar, i) => {
                setTimeout(() => bar.style.height = bar.dataset.height + '%', i * 100 + 300);
            });
        }, 100);
    }

    renderGeoTable(countries) {
        const container = document.getElementById('geoTable');
        container.classList.remove('skeleton-table');
        container.innerHTML = countries.map(c => `
            <div class="table-row">
                <img src="https://flagcdn.com/w40/${c.flag}.png" alt="${c.flag.toUpperCase()}" class="table-flag" loading="lazy" onerror="this.style.display='none'">
                <span class="table-name">${c.name}</span>
                <div class="table-bar-container">
                    <div class="table-bar-fill" style="width: 0%; background: ${c.color};" data-width="${c.width}"></div>
                </div>
                <span class="table-value">${c.value.toLocaleString()}</span>
                <span class="table-percent">${c.percent}%</span>
            </div>
        `).join('');

        setTimeout(() => {
            container.querySelectorAll('.table-bar-fill').forEach((bar, i) => {
                setTimeout(() => bar.style.width = bar.dataset.width + '%', i * 80 + 400);
            });
        }, 100);
    }

    renderDeviceTable(devices) {
        const container = document.getElementById('deviceTable');
        container.classList.remove('skeleton-table');
        container.innerHTML = devices.map(d => `
            <div class="table-row">
                <div class="device-icon" style="background: ${d.bg}; color: ${d.color};">
                    <i data-lucide="${d.icon}" style="width: 18px; height: 18px;"></i>
                </div>
                <span class="table-name">${d.name}</span>
                <div class="table-bar-container">
                    <div class="table-bar-fill" style="width: 0%; background: ${d.color};" data-width="${d.width}"></div>
                </div>
                <span class="table-value">${d.value.toLocaleString()}</span>
                <span class="table-percent">${d.percent}%</span>
            </div>
        `).join('');

        lucide.createIcons();
        setTimeout(() => {
            container.querySelectorAll('.table-bar-fill').forEach((bar, i) => {
                setTimeout(() => bar.style.width = bar.dataset.width + '%', i * 80 + 400);
            });
        }, 100);
    }

    renderReferrerTable(referrers) {
        const container = document.getElementById('referrerTable');
        container.classList.remove('skeleton-table');
        container.innerHTML = referrers.map(r => `
            <div class="table-row">
                <div class="device-icon" style="background: ${r.bg}; color: ${r.color};">
                    <span style="font-weight: 700; font-size: 12px;">${r.abbr}</span>
                </div>
                <span class="table-name">${r.name}</span>
                <div class="table-bar-container">
                    <div class="table-bar-fill" style="width: 0%; background: ${r.color};" data-width="${r.width}"></div>
                </div>
                <span class="table-value">${r.value.toLocaleString()}</span>
                <span class="table-percent">${r.percent}%</span>
            </div>
        `).join('');

        setTimeout(() => {
            container.querySelectorAll('.table-bar-fill').forEach((bar, i) => {
                setTimeout(() => bar.style.width = bar.dataset.width + '%', i * 80 + 400);
            });
        }, 100);
    }

    markLoaded() {
        document.querySelectorAll('.stat-card, .chart-card, .table-card').forEach(card => {
            card.classList.add('is-loaded');
        });
    }

    async setDateRange(btn) {
        document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentRange = btn.dataset.range;
        await this.fetchData();
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

document.addEventListener('DOMContentLoaded', () => {
    window.analyticsApp = new AnalyticsApp();
});