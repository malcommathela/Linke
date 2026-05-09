document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    // Prefill email from ?email=...
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");

    // Try to find email input, or create a hidden one if missing
    let emailInput = document.getElementById("email");

    if (!emailInput) {
        // Create hidden input if not present in HTML
        emailInput = document.createElement("input");
        emailInput.type = "hidden";
        emailInput.id = "email";
        document.body.appendChild(emailInput);
    }

    if (emailParam) {
        emailInput.value = emailParam;
    }

    const displayemail = document.getElementById("emailDisplay");
    if (displayemail && emailParam) {
        displayemail.textContent = emailParam;
    }

    const inputs = document.querySelectorAll(".code-input");
    const submitBtn = document.getElementById("submit-btn");
    const messageEl = document.getElementById("message");

    // Guard: required elements must exist
    if (!submitBtn || !messageEl || inputs.length === 0) {
        console.error("verify.js: Required elements not found on this page.");
        return;
    }

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
            messageEl.textContent = "Missing email. Please check the verification link.";
            messageEl.style.color = "#d00";
            return;
        }
        if (code.length !== 6) {
            messageEl.textContent = "Please enter the 6-digit code.";
            messageEl.style.color = "#d00";
            return;
        }

        messageEl.textContent = "Verifying...";
        messageEl.style.color = "#333";

        try {
            const res = await fetch("/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code }),
            });

            const data = await res.json();
            messageEl.style.color = res.ok ? "#0a0" : "#d00";
            messageEl.textContent = data.message || "Error";

            if (res.ok) {
                // Redirect to login after successful verification
                setTimeout(() => {
                    window.location.href = "/pages/login.html";
                }, 1500);
            }
        } catch (err) {
            console.error(err);
            messageEl.style.color = "#d00";
            messageEl.textContent = "Network error, please try again.";
        }
    });

    // Wire "Resend code" to /resend-email endpoint
    const resendBtn = document.getElementById("resend-btn");
    if (resendBtn) {
        resendBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) {
                messageEl.textContent = "Missing email. Please check the verification link.";
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
    }
});