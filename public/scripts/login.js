lucide.createIcons();

function goBack() {
    window.history.back();
}

function goToSignUp() {
    window.location.href = 'signup.html';
}

// Optional: toggle password visibility if you want it client-side
const togglePasswordBtn = document.getElementById("togglePassword");
const passwordInput = document.getElementById("password");
if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
        const type =
            passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);
    });
}

document.addEventListener("DOMContentLoaded", ()=> {
    const form = document.getElementById("login-form");
    const messageEl = document.getElementById("login-message");

    form.addEventListener("submit", async e => {
        e.preventDefault();

        const formData = new FormData(form);
        const email = formData.get("email");
        const password = formData.get("password");

        try {
            const req = await fetch("/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({email, password}),
            })

            const data = await req.json();
            if (!req.ok) {
                messageEl.textContent = data.message || "Login error";
                messageEl.style.color = "red";
                return;
            }

            messageEl.textContent = data.message || "Sign up successful";
            messageEl.style.color = "green";
        }
        catch (err) {
            console.error(err);
            messageEl.textContent = "Network error";
            messageEl.style.color = "red";
        }
    })
});