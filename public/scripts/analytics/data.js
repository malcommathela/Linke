/* ============================================
   Data Store Module
   Simulates API responses with range-based data
   ============================================ */

export class DataStore {
    constructor() {
        this.cache = new Map();
        this.baseData = {
            '24h': {
                stats: {
                    clicks: { value: 1240, change: 8.5, up: true },
                    visitors: { value: 890, change: 12.3, up: true },
                    ctr: { value: 72.1, change: 3.2, up: true, suffix: '%' },
                    bounce: { value: 28.5, change: 1.5, up: false, suffix: '%' }
                },
                lineChart: [20, 35, 28, 42, 38, 55, 48, 62, 58, 75, 68, 82, 78, 95, 88, 102, 98, 115, 108, 125, 118, 135, 128, 142],
                pieChart: [
                    { label: 'Direct', value: 45, color: 'var(--accent-teal)' },
                    { label: 'Social', value: 30, color: 'var(--accent-blue)' },
                    { label: 'Email', value: 15, color: 'var(--accent-gold)' },
                    { label: 'Referral', value: 10, color: 'var(--accent-coral)' }
                ],
                topLinks: [
                    { url: 'linke.io/lom67h', height: 88 },
                    { url: 'linke.io/uj879a', height: 72 },
                    { url: 'linke.io/ge4kz3', height: 60 },
                    { url: 'linke.io/zy4kz3', height: 45 },
                    { url: 'linke.io/selcan', height: 32 },
                    { url: 'linke.io/s3l45n', height: 20 }
                ],
                countries: [
                    { name: 'United States', flag: 'us', value: 520, percent: 42, width: 80, color: 'var(--accent-teal)' },
                    { name: 'United Kingdom', flag: 'gb', value: 210, percent: 17, width: 48, color: 'var(--accent-blue)' },
                    { name: 'Germany', flag: 'de', value: 150, percent: 12, width: 35, color: 'var(--accent-gold)' },
                    { name: 'Canada', flag: 'ca', value: 110, percent: 9, width: 25, color: 'var(--accent-coral)' },
                    { name: 'France', flag: 'fr', value: 75, percent: 6, width: 18, color: 'var(--accent-teal)' }
                ],
                devices: [
                    { name: 'Mobile', icon: 'smartphone', value: 720, percent: 58, width: 58, color: 'var(--accent-teal)', bg: 'var(--badge-bg)' },
                    { name: 'Desktop', icon: 'monitor', value: 380, percent: 31, width: 31, color: 'var(--accent-blue)', bg: 'rgba(74,124,255,0.1)' },
                    { name: 'Tablet', icon: 'tablet', value: 140, percent: 11, width: 11, color: 'var(--accent-gold)', bg: 'rgba(212,168,67,0.1)' }
                ],
                referrers: [
                    { name: 'Dribbble', abbr: 'Dr', value: 280, percent: 23, width: 42, color: '#EA4C89', bg: 'rgba(234,76,137,0.1)' },
                    { name: 'GitHub', abbr: 'Gh', value: 210, percent: 17, width: 30, color: 'var(--text-primary)', bg: 'rgba(26,26,26,0.1)' },
                    { name: 'Behance', abbr: 'Be', value: 160, percent: 13, width: 22, color: '#1769FF', bg: 'rgba(23,105,255,0.1)' },
                    { name: 'Upwork', abbr: 'Up', value: 120, percent: 10, width: 16, color: '#14A800', bg: 'rgba(20,168,0,0.1)' }
                ]
            },
            '7d': {
                stats: {
                    clicks: { value: 8420, change: 15.2, up: true },
                    visitors: { value: 6120, change: 11.8, up: true },
                    ctr: { value: 70.5, change: 4.1, up: true, suffix: '%' },
                    bounce: { value: 30.2, change: 0.8, up: false, suffix: '%' }
                },
                lineChart: [30, 42, 38, 55, 48, 62, 58, 75, 68, 82, 78, 95, 88, 102, 98, 115, 108, 125, 118, 135, 128, 148, 138, 158, 148, 168, 158, 178, 168, 188],
                pieChart: [
                    { label: 'Direct', value: 42, color: 'var(--accent-teal)' },
                    { label: 'Social', value: 28, color: 'var(--accent-blue)' },
                    { label: 'Email', value: 18, color: 'var(--accent-gold)' },
                    { label: 'Referral', value: 12, color: 'var(--accent-coral)' }
                ],
                topLinks: [
                    { url: 'linke.io/lom67h', height: 90 },
                    { url: 'linke.io/uj879a', height: 75 },
                    { url: 'linke.io/ge4kz3', height: 62 },
                    { url: 'linke.io/zy4kz3', height: 50 },
                    { url: 'linke.io/selcan', height: 38 },
                    { url: 'linke.io/s3l45n', height: 24 }
                ],
                countries: [
                    { name: 'United States', flag: 'us', value: 3520, percent: 42, width: 82, color: 'var(--accent-teal)' },
                    { name: 'United Kingdom', flag: 'gb', value: 1420, percent: 17, width: 50, color: 'var(--accent-blue)' },
                    { name: 'Germany', flag: 'de', value: 980, percent: 12, width: 36, color: 'var(--accent-gold)' },
                    { name: 'Canada', flag: 'ca', value: 720, percent: 9, width: 26, color: 'var(--accent-coral)' },
                    { name: 'France', flag: 'fr', value: 480, percent: 6, width: 19, color: 'var(--accent-teal)' }
                ],
                devices: [
                    { name: 'Mobile', icon: 'smartphone', value: 4880, percent: 58, width: 58, color: 'var(--accent-teal)', bg: 'var(--badge-bg)' },
                    { name: 'Desktop', icon: 'monitor', value: 2520, percent: 30, width: 30, color: 'var(--accent-blue)', bg: 'rgba(74,124,255,0.1)' },
                    { name: 'Tablet', icon: 'tablet', value: 1020, percent: 12, width: 12, color: 'var(--accent-gold)', bg: 'rgba(212,168,67,0.1)' }
                ],
                referrers: [
                    { name: 'Dribbble', abbr: 'Dr', value: 1920, percent: 23, width: 44, color: '#EA4C89', bg: 'rgba(234,76,137,0.1)' },
                    { name: 'GitHub', abbr: 'Gh', value: 1420, percent: 17, width: 32, color: 'var(--text-primary)', bg: 'rgba(26,26,26,0.1)' },
                    { name: 'Behance', abbr: 'Be', value: 1080, percent: 13, width: 24, color: '#1769FF', bg: 'rgba(23,105,255,0.1)' },
                    { name: 'Upwork', abbr: 'Up', value: 820, percent: 10, width: 18, color: '#14A800', bg: 'rgba(20,168,0,0.1)' }
                ]
            },
            '30d': {
                stats: {
                    clicks: { value: 18420, change: 24.5, up: true },
                    visitors: { value: 12580, change: 18.2, up: true },
                    ctr: { value: 68.4, change: 5.3, up: true, suffix: '%' },
                    bounce: { value: 32.1, change: 2.1, up: false, suffix: '%' }
                },
                lineChart: [45, 52, 48, 65, 72, 68, 85, 92, 88, 95, 102, 98, 110, 125, 118, 135, 142, 138, 155, 162, 158, 175, 182, 178, 195, 202, 198, 215, 222, 218],
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
            },
            '90d': {
                stats: {
                    clicks: { value: 52400, change: 31.2, up: true },
                    visitors: { value: 38200, change: 25.8, up: true },
                    ctr: { value: 66.8, change: 3.5, up: true, suffix: '%' },
                    bounce: { value: 34.5, change: 1.2, up: false, suffix: '%' }
                },
                lineChart: [55, 62, 58, 75, 82, 78, 95, 102, 98, 115, 122, 118, 135, 142, 138, 155, 162, 158, 175, 182, 178, 195, 202, 198, 215, 222, 218, 235, 242, 238, 255, 262, 258, 275, 282, 278, 295, 302, 298, 315, 322, 318, 335, 342, 338, 355, 362, 358, 375, 382, 378, 395, 402, 398, 415, 422, 418, 435, 442, 438, 455, 462, 458, 475, 482, 478, 495, 502, 498, 515, 522, 518, 535, 542, 538, 555, 562, 558, 575, 582, 578, 595, 602, 598, 615, 622, 618, 635, 642, 638],
                pieChart: [
                    { label: 'Direct', value: 38, color: 'var(--accent-teal)' },
                    { label: 'Social', value: 32, color: 'var(--accent-blue)' },
                    { label: 'Email', value: 18, color: 'var(--accent-gold)' },
                    { label: 'Referral', value: 12, color: 'var(--accent-coral)' }
                ],
                topLinks: [
                    { url: 'linke.io/lom67h', height: 95 },
                    { url: 'linke.io/uj879a', height: 82 },
                    { url: 'linke.io/ge4kz3', height: 70 },
                    { url: 'linke.io/zy4kz3', height: 55 },
                    { url: 'linke.io/selcan', height: 42 },
                    { url: 'linke.io/s3l45n', height: 28 }
                ],
                countries: [
                    { name: 'United States', flag: 'us', value: 23580, percent: 45, width: 85, color: 'var(--accent-teal)' },
                    { name: 'United Kingdom', flag: 'gb', value: 8900, percent: 17, width: 52, color: 'var(--accent-blue)' },
                    { name: 'Germany', flag: 'de', value: 6280, percent: 12, width: 38, color: 'var(--accent-gold)' },
                    { name: 'Canada', flag: 'ca', value: 4710, percent: 9, width: 28, color: 'var(--accent-coral)' },
                    { name: 'France', flag: 'fr', value: 3140, percent: 6, width: 20, color: 'var(--accent-teal)' }
                ],
                devices: [
                    { name: 'Mobile', icon: 'smartphone', value: 32480, percent: 62, width: 62, color: 'var(--accent-teal)', bg: 'var(--badge-bg)' },
                    { name: 'Desktop', icon: 'monitor', value: 15720, percent: 30, width: 30, color: 'var(--accent-blue)', bg: 'rgba(74,124,255,0.1)' },
                    { name: 'Tablet', icon: 'tablet', value: 4200, percent: 8, width: 8, color: 'var(--accent-gold)', bg: 'rgba(212,168,67,0.1)' }
                ],
                referrers: [
                    { name: 'Dribbble', abbr: 'Dr', value: 12050, percent: 23, width: 45, color: '#EA4C89', bg: 'rgba(234,76,137,0.1)' },
                    { name: 'GitHub', abbr: 'Gh', value: 8900, percent: 17, width: 32, color: 'var(--text-primary)', bg: 'rgba(26,26,26,0.1)' },
                    { name: 'Behance', abbr: 'Be', value: 6820, percent: 13, width: 24, color: '#1769FF', bg: 'rgba(23,105,255,0.1)' },
                    { name: 'Upwork', abbr: 'Up', value: 5240, percent: 10, width: 18, color: '#14A800', bg: 'rgba(20,168,0,0.1)' }
                ]
            },
            '1y': {
                stats: {
                    clicks: { value: 198500, change: 42.8, up: true },
                    visitors: { value: 145200, change: 38.5, up: true },
                    ctr: { value: 64.2, change: 2.8, up: true, suffix: '%' },
                    bounce: { value: 36.8, change: 0.5, up: false, suffix: '%' }
                },
                lineChart: Array.from({ length: 90 }, (_, i) => 80 + i * 2.2 + Math.sin(i * 0.3) * 15),
                pieChart: [
                    { label: 'Direct', value: 35, color: 'var(--accent-teal)' },
                    { label: 'Social', value: 35, color: 'var(--accent-blue)' },
                    { label: 'Email', value: 20, color: 'var(--accent-gold)' },
                    { label: 'Referral', value: 10, color: 'var(--accent-coral)' }
                ],
                topLinks: [
                    { url: 'linke.io/lom67h', height: 98 },
                    { url: 'linke.io/uj879a', height: 85 },
                    { url: 'linke.io/ge4kz3', height: 75 },
                    { url: 'linke.io/zy4kz3', height: 60 },
                    { url: 'linke.io/selcan', height: 48 },
                    { url: 'linke.io/s3l45n', height: 32 }
                ],
                countries: [
                    { name: 'United States', flag: 'us', value: 89320, percent: 45, width: 85, color: 'var(--accent-teal)' },
                    { name: 'United Kingdom', flag: 'gb', value: 33740, percent: 17, width: 52, color: 'var(--accent-blue)' },
                    { name: 'Germany', flag: 'de', value: 23820, percent: 12, width: 38, color: 'var(--accent-gold)' },
                    { name: 'Canada', flag: 'ca', value: 17860, percent: 9, width: 28, color: 'var(--accent-coral)' },
                    { name: 'France', flag: 'fr', value: 11910, percent: 6, width: 20, color: 'var(--accent-teal)' }
                ],
                devices: [
                    { name: 'Mobile', icon: 'smartphone', value: 123070, percent: 62, width: 62, color: 'var(--accent-teal)', bg: 'var(--badge-bg)' },
                    { name: 'Desktop', icon: 'monitor', value: 59550, percent: 30, width: 30, color: 'var(--accent-blue)', bg: 'rgba(74,124,255,0.1)' },
                    { name: 'Tablet', icon: 'tablet', value: 15880, percent: 8, width: 8, color: 'var(--accent-gold)', bg: 'rgba(212,168,67,0.1)' }
                ],
                referrers: [
                    { name: 'Dribbble', abbr: 'Dr', value: 45650, percent: 23, width: 45, color: '#EA4C89', bg: 'rgba(234,76,137,0.1)' },
                    { name: 'GitHub', abbr: 'Gh', value: 33740, percent: 17, width: 32, color: 'var(--text-primary)', bg: 'rgba(26,26,26,0.1)' },
                    { name: 'Behance', abbr: 'Be', value: 25800, percent: 13, width: 24, color: '#1769FF', bg: 'rgba(23,105,255,0.1)' },
                    { name: 'Upwork', abbr: 'Up', value: 19850, percent: 10, width: 18, color: '#14A800', bg: 'rgba(20,168,0,0.1)' }
                ]
            }
        };
    }

    /**
     * Fetch data for a given time range
     * Returns cached data or generates new dataset
     */
    getData(range) {
        if (this.cache.has(range)) {
            return this.cache.get(range);
        }

        const data = this.baseData[range] || this.baseData['30d'];
        this.cache.set(range, data);
        return data;
    }

    /**
     * Clear cache for a range (useful for refresh)
     */
    clearCache(range = null) {
        if (range) {
            this.cache.delete(range);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Simulate async API call
     */
    async fetchAsync(range) {
        // Simulate network latency
        await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
        return this.getData(range);
    }
}