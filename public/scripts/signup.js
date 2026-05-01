lucide.createIcons();

function goBack() {
    window.history.back();
}

function goToLogin() {
    window.location.href = 'login.html';
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.getElementById('togglePassword');
    const strengthBadge = document.getElementById('strengthBadge');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.innerHTML = '<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>';
    } else {
        passwordInput.type = 'password';
        toggleBtn.innerHTML = '<i data-lucide="eye" style="width: 18px; height: 18px;"></i>';
    }
    lucide.createIcons();
}

// Password strength indicator
document.getElementById('password').addEventListener('input', (e) => {
    const badge = document.getElementById('strengthBadge');
    const val = e.target.value;

    if (val.length > 0) {
        badge.classList.add('show');
        if (val.length < 6) {
            badge.textContent = 'Weak';
            badge.style.color = 'var(--accent-coral)';
        } else if (val.length < 10) {
            badge.textContent = 'Medium';
            badge.style.color = 'var(--accent-gold)';
        } else {
            badge.textContent = 'Strong ✓';
            badge.style.color = 'var(--accent-teal)';
        }
    } else {
        badge.classList.remove('show');
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("signupForm");
    const messageEl = document.getElementById("message"); // or whatever you use

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const username = formData.get("username");
        const email = formData.get("email");
        const password = formData.get("password");

        try {
            const res = await fetch("/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                messageEl.textContent = data.message || "Sign up failed";
                messageEl.style.color = "red";
                return;
            }

            // Show message briefly
            messageEl.textContent = data.message || "Sign up successful";
            messageEl.style.color = "green";

            // Redirect to verify page, optionally pass email as query param
            setTimeout(() => {
                window.location.href = `/pages/verify.html?email=${encodeURIComponent(email)}`;
            }, 1000);

        } catch (err) {
            console.error(err);
            messageEl.textContent = "Network error";
            messageEl.style.color = "red";
        }
    });
});
