const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const path = require("path");
const {hash} = require("bcrypt");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this";
const SUPABASE_URL = "https://iwgkjkeifvzmyebximoo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3Z2tqa2VpZnZ6bXllYnhpbW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODY5OTcsImV4cCI6MjA4ODU2Mjk5N30.NV3RmNqGtQRHeF2Gv2IXklbMeLXpSgUBxug2zZXutgY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/pages", express.static(path.join(__dirname, "..", "pages")));

// --------- Email transport ---------
const transporter = nodemailer.createTransport({
    service: "gmail",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(email, code) {
    const mailOptions = {
        from: `"Aura App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your verification code",
        text: `Your verification code is: ${code}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId, info.envelope);
}

// --------- Routes ---------
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "pages", "landing.html"));
});

app.post("/login", async (req, res) => {
    try {
        const {email, password} = req.body;
        if (!email || !password) {
            return res.status(401).json({message: "Email and password is required"});
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("id, password_hash, verified")
            .eq("email", email)
            .single();

        if (error || !user) {return res.status(401).json({message: "User Not Found"});}

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({message: "Invalid Password"});
        }

        return res.status(200).json({message: "Successfully logged in"});
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({message: "Server Error"});
    }

})


// Signup: create user, store code in same table, send email
app.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password || password.length < 6) {
            return res.status(400).json({
                message: "Username, email, and password (min 6 chars) required",
            });
        }

        // Unique checks
        const { data: existingEmail, error: emailCheckError } = await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (emailCheckError) {
            console.error("Email check error:", emailCheckError);
            return res.status(500).json({ message: "Server error" });
        }

        const { data: existingUser, error: userCheckError } = await supabase
            .from("users")
            .select("id")
            .eq("username", username)
            .maybeSingle();

        if (userCheckError) {
            console.error("Username check error:", userCheckError);
            return res.status(500).json({ message: "Server error" });
        }

        if (existingEmail || existingUser) {
            return res.status(400).json({ message: "Username or email already exists" });
        }

        const password_hash = bcrypt.hashSync(password, 12);

        // Generate verification code and expiry
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Insert user with verification fields
        const { data: user, error: insertError } = await supabase
            .from("users")
            .insert([
                {
                    username,
                    email,
                    password_hash,
                    verified: false,
                    verification_code: code,
                    verification_expires_at: expiresAt,
                },
            ])
            .select("id, username, email")
            .single();

        if (insertError) {
            console.error("Insert error:", insertError);
            return res.status(400).json({ message: insertError.message });
        }

        res.json({
            message: "Sign up successful! Verification code is being sent to your email.",
            user,
            email,
        });

        sendEmail(email, code).catch(e => {
            console.error("Email send error:", e);
        });

    } catch (err) {
        console.error("Signup failed:", err);
        res.status(500).json({ message: "Server error" });
    }
});
// Verify code: read from same users table
app.post("/verify-email", async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: "Email and code are required" });
        }

        // Find user by email with verification fields
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, verified, verification_code, verification_expires_at")
            .eq("email", email)
            .maybeSingle();

        if (userError || !user) {
            console.error("User fetch error:", userError);
            return res.status(400).json({ message: "User not found" });
        }

        if (user.verified) {
            return res.status(400).json({ message: "User already verified" });
        }

        if (!user.verification_code || !user.verification_expires_at) {
            return res.status(400).json({ message: "No verification code found" });
        }

        if (new Date(user.verification_expires_at) < new Date()) {
            return res.status(400).json({ message: "Verification code expired" });
        }

        if (user.verification_code !== String(code)) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        // Mark user as verified and clear code
        const { error: updateError } = await supabase
            .from("users")
            .update({
                verified: true,
                verification_code: null,
                verification_expires_at: null,
            })
            .eq("id", user.id);

        if (updateError) {
            console.error("Update verified error:", updateError);
            return res.status(500).json({ message: "Could not verify user" });
        }

        res.json({ message: "Email verified successfully" });
    } catch (err) {
        console.error("Verify failed:", err);
        res.status(500).json({ message: "Server error" });
    }
});
app.post("/resend-email", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Get user by email
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, verified, verification_expires_at")
            .eq("email", email)
            .maybeSingle();

        if (userError) {
            console.error("Resend: user fetch error:", userError);
            return res.status(500).json({ message: "Server error" });
        }

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (user.verified) {
            return res.status(400).json({ message: "User already verified" });
        }

        // Optional: simple cooldown (e.g., 60 seconds)
        if (user.verification_expires_at) {
            const expiresAtDate = new Date(user.verification_expires_at);
            const now = new Date();
            const secondsSinceLastCode =
                (now.getTime() - expiresAtDate.getTime()) / 1000;
            if (secondsSinceLastCode < 60) {
                return res.status(429).json({
                    message: "Please wait a bit before requesting another code",
                });
            }
        }

        // New code + expiry (10 minutes from now)
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
            .from("users")
            .update({
                verification_code: code,
                verification_expires_at: expiresAt,
            })
            .eq("id", user.id);

        if (updateError) {
            console.error("Resend: update error:", updateError);
            return res.status(500).json({ message: "Could not update verification code" });
        }

        try {
            await sendEmail(email, code);
        } catch (e) {
            console.error("Resend: email send error:", e);
            return res.status(500).json({ message: "Could not send verification email" });
        }

        res.json({
            message: "Verification code has been resent to your email.",
        });
    } catch (err) {
        console.error("Resend failed:", err);
        res.status(500).json({ message: "Server error" });
    }
});
app.listen(port, () => {
    console.log(`🚀 Server: http://localhost:${port}`);
});