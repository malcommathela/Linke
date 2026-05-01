lucide.createIcons();

// Prefill email from ?email=...
const params = new URLSearchParams(window.location.search);
const emailParam = params.get("email");
const emailInput = document.getElementById("email");
if (emailParam) {
    emailInput.value = emailParam;
}
const displayemail = document.getElementById("emailDisplay");
displayemail.textContent = emailParam;

const inputs = document.querySelectorAll(".code-input");
const submitBtn = document.getElementById("submit-btn");
const messageEl = document.getElementById("message");

function getCodeFromInputs() {
    let code = "";
    inputs.forEach((inp) => {
        code += inp.value.trim();
    });
    return code;
}

inputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
        const val = e.target.value.replace(/[^0-9]/g, "");
        e.target.value = val;

        if (val.length === 1) {
            e.target.classList.add("filled");
            if (index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        } else {
            e.target.classList.remove("filled");
        }
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && e.target.value === "" && index > 0) {
            inputs[index - 1].focus();
        }
        if (e.key === "Enter") {
            submitBtn.click();
        }
    });

    input.addEventListener("focus", () => {
        input.select();
    });

    input.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasteData = e.clipboardData
            .getData("text")
            .replace(/[^0-9]/g, "")
            .split("");
        pasteData.forEach((char, i) => {
            if (index + i < inputs.length) {
                inputs[index + i].value = char;
                inputs[index + i].classList.add("filled");
            }
        });
        const nextEmpty = Array.from(inputs).findIndex(
            (inp) => inp.value === ""
        );
        if (nextEmpty !== -1) {
            inputs[nextEmpty].focus();
        } else {
            inputs[inputs.length - 1].focus();
        }
    });
});

// Handle submit: call /verify-email with email + code
submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const code = getCodeFromInputs();

    if (!email) {
        messageEl.textContent = "Missing email (no ?email= in URL).";
        return;
    }
    if (code.length !== 6) {
        messageEl.textContent = "Please enter the 6-digit code.";
        return;
    }

    messageEl.textContent = "Verifying...";

    try {
        const res = await fetch("/verify-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code }),
        });

        const data = await res.json();
        messageEl.style.color = res.ok ? "#0a0" : "#d00";
        messageEl.textContent = data.message || "Error";
    } catch (err) {
        console.error(err);
        messageEl.style.color = "#d00";
        messageEl.textContent = "Network error, please try again.";
    }
});

// Optional: wire "Resend code" to your /signup or /resend endpoint later
document
    .getElementById("resend-btn")
    .addEventListener("click", async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            messageEl.textContent = "Missing email (no ?email= in URL).";
            messageEl.style.color = "#d00";
            return;
        }

        messageEl.textContent = "Sending new code...";
        messageEl.style.color = "#333";

        try {
            const res = await fetch("/resend-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();
            messageEl.style.color = res.ok ? "#0a0" : "#d00";
            messageEl.textContent = data.message || (res.ok ? "Code resent" : "Error");
        } catch (err) {
            console.error(err);
            messageEl.style.color = "#d00";
            messageEl.textContent = "Network error, please try again.";
        }
    });