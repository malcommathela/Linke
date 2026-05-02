const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const path = require("path");
const {hash} = require("bcrypt");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const fetch = require("node-fetch");
const ogs = require("open-graph-scraper");
const QRCode = require("qrcode");


const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


app.use(cookieParser());
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
function authMiddleware(req, res, next) {
    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).redirect("/pages/login.html");
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("JWT verify error:", err);
        return res.status(401).redirect("/pages/login.html");
    }
}
function generateShortCode(length = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "pages", "landing.html"));
});

// --------- Routes ---------


// GET /api/preview?url=<encoded>
app.get("/api/preview", async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({ message: "url query is required" });
    }

    try {
        // Basic validation first
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ message: "Invalid URL" });
        }

        const options = {
            url,
            timeout: 3000,
            headers: {
                "user-agent": "Mozilla/5.0",
            },
        };

        const { error, result } = await ogs(options);

        if (error) {
            console.error("OG scrape error:", result?.error || result);
            return res.status(500).json({ message: "Failed to fetch preview" });
        }

        // Normalize response shape similar to previous approach
        res.json({
            url: result.requestUrl || url,
            title: result.ogTitle || "",
            description: result.ogDescription || "",
            image: (result.ogImage && result.ogImage.url) || "",
            siteName: result.ogSiteName || "",
        });
    } catch (err) {
        console.error("Preview failed", err);
        res.status(500).json({ message: "Failed to fetch preview" });
    }
});
app.post("/api/urls", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { long_url, custom_key, expiry } = req.body;

        if (!long_url || typeof long_url !== "string") {
            return res.status(400).json({ message: "long_url is required" });
        }

        // Basic URL validation
        try {
            new URL(long_url);
        } catch {
            return res.status(400).json({ message: "Invalid URL format" });
        }

        // Compute expires_at from expiry string
        let expires_at = null;
        if (expiry && expiry !== "never") {
            const now = Date.now();
            let ms = 0;
            switch (expiry) {
                case "6h":
                    ms = 6 * 60 * 60 * 1000;
                    break;
                case "1w":
                    ms = 7 * 24 * 60 * 60 * 1000;
                    break;
                case "1m":
                    ms = 30 * 24 * 60 * 60 * 1000;
                    break;
                case "6m":
                    ms = 180 * 24 * 60 * 60 * 1000;
                    break;
                case "1y":
                    ms = 365 * 24 * 60 * 60 * 1000;
                    break;
            }
            if (ms > 0) {
                expires_at = new Date(now + ms).toISOString();
            }
        }

        let short_code = custom_key?.trim() || "";
        if (short_code) {
            // Check custom key not taken
            const { data: existing, error: keyError } = await supabase
                .from("urls")
                .select("id")
                .eq("short_code", short_code)
                .maybeSingle();

            if (keyError) {
                console.error("Custom key check error:", keyError);
                return res.status(500).json({ message: "DB error" });
            }

            if (existing) {
                return res.status(400).json({ message: "That key is already in use" });
            }
        } else {
            // Generate random short code, ensure uniqueness
            let exists = true;
            const maxAttempts = 5;
            let attempts = 0;

            while (exists && attempts < maxAttempts) {
                attempts += 1;
                short_code = generateShortCode(6);

                const { data, error } = await supabase
                    .from("urls")
                    .select("id")
                    .eq("short_code", short_code)
                    .maybeSingle();

                if (error) {
                    console.error("Error checking short_code:", error);
                    return res.status(500).json({ message: "DB error" });
                }

                exists = !!data;
            }

            if (exists) {
                return res.status(500).json({ message: "Could not generate unique code" });
            }
        }

        const { data: row, error: insertError } = await supabase
            .from("urls")
            .insert([
                {
                    short_code,
                    long_url,
                    user_id: userId,
                    click_count: 0,
                    is_active: true,
                    expires_at,
                },
            ])
            .select("id, short_code, long_url, click_count, created_at, expires_at, is_active")
            .single();

        if (insertError) {
            console.error("Insert url error:", insertError);
            return res.status(500).json({ message: "DB insert error" });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const short_url = `${baseUrl}/${row.short_code}`;

        res.status(201).json({
            message: "Link created",
            url: { ...row, short_url },
        });
    } catch (err) {
        console.error("Create url failed:", err);
        res.status(500).json({ message: "Server error" });
    }
});
app.get("/dashboard", authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "pages", "dashboard.html"));
});
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, password_hash, verified")
            .eq("email", email)
            .single();

        if (error || !user) {
            return res.status(401).json({ message: "User not found" });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid password" });
        }

        if (!user.verified) {
            return res.status(403).json({ message: "Please verify your email first" });
        }

        // Create JWT payload
        const payload = {
            userId: user.id,
            email,
            username: user.username,
        };

        // Sign token (e.g. expires in 1 day)
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

        // Set httpOnly cookie
        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: false,        // true in production with HTTPS
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });

        return res.status(200).json({
            message: "Successfully logged in",
            user: {
                id: user.id,
                email,
                username: user.username,
            },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});
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
app.get("/api/urls", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const { data, error } = await supabase
            .from("urls")
            .select("id, short_code, long_url, click_count, created_at, expires_at, is_active")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Get urls error:", error);
            return res.status(500).json({ message: "DB error" });
        }

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const urls = data || [];

        const urlsWithExtras = await Promise.all(
            urls.map(async (u) => {
                const short_url = `${baseUrl}/${u.short_code}`;

                // Generate base64 PNG data URL for QR code
                let qr_data_url = null;
                try {
                    qr_data_url = await QRCode.toDataURL(short_url, {
                        errorCorrectionLevel: "M",
                        margin: 1,
                        width: 200,
                    });
                } catch (e) {
                    console.error("QR generation failed for", short_url, e);
                }

                return { ...u, short_url, qr_data_url };
            })
        );

        res.json({ urls: urlsWithExtras });
    } catch (err) {
        console.error("Get urls failed:", err);
        res.status(500).json({ message: "Server error" });
    }
});
app.get("/api/me", authMiddleware, (req, res) => {
    const { userId, email, username } = req.user;
    res.json({ userId, email, username });
});
// Redirect short codes (same behavior as the 4000 server)
app.get("/:code", async (req, res) => {
    try {
        const { code } = req.params;

        const { data: url, error } = await supabase
            .from("urls")
            .select("long_url, click_count, expires_at, is_active")
            .eq("short_code", code)
            .maybeSingle();

        if (error) {
            console.error("Lookup error:", error);
            return res.status(500).send("Server error");
        }

        if (!url || !url.is_active) {
            return res.status(404).send("Not found");
        }

        if (url.expires_at && new Date(url.expires_at) < new Date()) {
            return res.status(410).send("This link has expired");
        }

        // Increment clicks in background
        supabase
            .from("urls")
            .update({ click_count: (url.click_count || 0) + 1 })
            .eq("short_code", code)
            .then(() => {})
            .catch(console.error);

        return res.redirect(302, url.long_url);
    } catch (err) {
        console.error("Redirect failed:", err);
        return res.status(500).send("Server error");
    }
});
app.listen(port, () => {
    console.log(`🚀 Server: http://localhost:${port}`);
});