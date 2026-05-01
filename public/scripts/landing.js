// Initialize Lucide icons
document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
});

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// URL Shortener functionality
function generateShortCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function shortenUrl() {
    const input = document.getElementById('urlInput');
    const btnText = document.getElementById('btnText');
    const resultBox = document.getElementById('resultBox');
    const shortUrl = document.getElementById('shortUrl');

    if (!input.value.trim()) {
        showToast('Please enter a URL first', 'error');
        input.focus();
        return;
    }

    // Simulate loading
    btnText.textContent = 'Creating...';
    document.getElementById('shortenBtn').disabled = true;

    setTimeout(() => {
        const code = generateShortCode();
        shortUrl.textContent = `linke.io/${code}`;
        resultBox.classList.add('show');
        btnText.textContent = 'Create';
        document.getElementById('shortenBtn').disabled = false;

        // Re-render icons in result box
        lucide.createIcons();
    }, 800);
}

function copyUrl() {
    const url = document.getElementById('shortUrl').textContent;
    navigator.clipboard.writeText(`https://${url}`).then(() => {
        const copyBtn = document.getElementById('copyBtn');
        const copyText = document.getElementById('copyText');

        copyBtn.classList.add('copied');
        copyText.textContent = 'Copied!';

        showToast('Link copied to clipboard!');

        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyText.textContent = 'Copy';
        }, 2000);
    });
}

function showQR() {
    showToast('QR Code generated! (Demo feature)');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Enter key support
document.getElementById('urlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        shortenUrl();
    }
});

// Scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => {
    observer.observe(el);
});

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Counter animation for stats
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        const target = counter.textContent;
        const isPercentage = target.includes('%');
        const isDecimal = target.includes('.');
        const numericValue = parseFloat(target.replace(/[^0-9.]/g, ''));
        const suffix = target.replace(/[0-9.]/g, '');

        let current = 0;
        const increment = numericValue / 60;
        const duration = 1500;
        const stepTime = duration / 60;

        const timer = setInterval(() => {
            current += increment;
            if (current >= numericValue) {
                current = numericValue;
                clearInterval(timer);
            }

            if (isDecimal) {
                counter.textContent = current.toFixed(1) + suffix;
            } else {
                counter.textContent = Math.floor(current) + suffix;
            }
        }, stepTime);
    });
}

// Trigger counter animation when stats section is visible
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const statsSection = document.querySelector('.stats-section');
if (statsSection) {
    statsObserver.observe(statsSection);
}

function goToSignUp() {
    window.location.href = '/pages/signup.html';
}

function goToLogin() {
    window.location.href = '/pages/login.html';
}