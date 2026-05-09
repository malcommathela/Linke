// server.js — CORRECTED
const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const path = require("path");
const cookieParser = require("cookie-parser");
const ogs = require("open-graph-scraper");
const QRCode = require("qrcode");
const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");

// Only load .env in non-production
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config({ path: path.join(__dirname, ".env") });
}

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required envs", {
        hasJWT: !!JWT_SECRET,
        hasSupabaseUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Resolve paths relative to project root (parent of scripts/)
const ROOT = path.join(__dirname, "..");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — serve from project root
app.use("/public", express.static(path.join(ROOT, "public")));
app.use("/pages", express.static(path.join(ROOT, "pages")));

// Root route
app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "pages", "landing.html"));
});

// ----------------- Helper functions ------------------------

const transporter = nodemailer.createTransport({
    service: "gmail",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

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
    console.log("Email sent:", info.messageId);
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

function parseAnalytics(req) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.socket?.remoteAddress?.replace("::ffff:", "")
        || null;

    const ua = req.headers["user-agent"] || "";
    const parser = new UAParser(ua);
    const result = parser.getResult();

    const geo = ip ? geoip.lookup(ip) : null;

    return {
        ip_address: ip,
        country: geo?.country || "Unknown",
        city: geo?.city || "Unknown",
        referrer: req.headers["referer"] || "Direct",
        device_type: result.device.type || "desktop",
        browser: result.browser.name || "Unknown",
        os: result.os.name || "Unknown",
        user_agent: ua,
    };
}

// ----------------- AUTH ROUTES -----------------

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

        const payload = { userId: user.id, email, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            message: "Successfully logged in",
            user: { id: user.id, email, username: user.username },
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error" });
    }
});

app.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password || password.length < 6) {
            return res.status(400).json({ message: "Username, email, and password (min 6 chars) required" });
        }

        const { data: existingEmail } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
        const { data: existingUser } = await supabase.from("users").select("id").eq("username", username).maybeSingle();

        if (existingEmail || existingUser) {
            return res.status(400).json({ message: "Username or email already exists" });
        }

        const password_hash = bcrypt.hashSync(password, 12);
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { data: user, error: insertError } = await supabase
            .from("users")
            .insert([{ username, email, password_hash, verified: false, verification_code: code, verification_expires_at: expiresAt }])
            .select("id, username, email")
            .single();

        if (insertError) {
            return res.status(400).json({ message: insertError.message });
        }

        res.json({ message: "Sign up successful! Verification code sent.", user, email });
        sendEmail(email, code).catch(e => console.error("Email send error:", e));
    } catch (err) {
        console.error("Signup failed:", err);
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/verify-email", async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: "Email and code required" });

        const { data: user } = await supabase.from("users").select("id, verified, verification_code, verification_expires_at").eq("email", email).maybeSingle();
        if (!user) return res.status(400).json({ message: "User not found" });
        if (user.verified) return res.status(400).json({ message: "Already verified" });
        if (new Date(user.verification_expires_at) < new Date()) return res.status(400).json({ message: "Code expired" });
        if (user.verification_code !== String(code)) return res.status(400).json({ message: "Invalid code" });

        await supabase.from("users").update({ verified: true, verification_code: null, verification_expires_at: null }).eq("id", user.id);
        res.json({ message: "Email verified successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/resend-email", async (req, res) => {
    try {
        const { email } = req.body;
        const { data: user } = await supabase.from("users").select("id, verified").eq("email", email).maybeSingle();
        if (!user || user.verified) return res.status(400).json({ message: "Cannot resend" });

        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from("users").update({ verification_code: code, verification_expires_at: expiresAt }).eq("id", user.id);
        await sendEmail(email, code);
        res.json({ message: "Code resent" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- PAGE ROUTES (auth protected) -----------------

app.get("/dashboard", authMiddleware, (req, res) => {
    res.sendFile(path.join(ROOT, "pages", "dashboard.html"));
});

app.get("/analytics", authMiddleware, (req, res) => {
    res.sendFile(path.join(ROOT, "pages", "analytics.html"));
});

app.get("/settings", authMiddleware, (req, res) => {
    res.sendFile(path.join(ROOT, "pages", "settings.html"));
});

app.get("/support", authMiddleware, (req, res) => {
    res.sendFile(path.join(ROOT, "pages", "support.html"));
});

// ----------------- URL ROUTES -----------------

app.get("/api/preview", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ message: "url required" });
    try {
        new URL(url);
        const { error, result } = await ogs({ url, timeout: 3000, headers: { "user-agent": "Mozilla/5.0" } });
        if (error) return res.status(500).json({ message: "Failed to fetch preview" });
        res.json({ url: result.requestUrl || url, title: result.ogTitle || "", description: result.ogDescription || "", image: result.ogImage?.url || "", siteName: result.ogSiteName || "" });
    } catch (err) {
        res.status(500).json({ message: "Failed" });
    }
});

app.post("/api/urls", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { long_url, custom_key, expiry } = req.body;
        if (!long_url) return res.status(400).json({ message: "long_url required" });
        try { new URL(long_url); } catch { return res.status(400).json({ message: "Invalid URL" }); }

        let expires_at = null;
        if (expiry && expiry !== "never") {
            const ms = { "6h": 6*60*60*1000, "1w": 7*24*60*60*1000, "1m": 30*24*60*60*1000, "6m": 180*24*60*60*1000, "1y": 365*24*60*60*1000 }[expiry];
            if (ms) expires_at = new Date(Date.now() + ms).toISOString();
        }

        let short_code = custom_key?.trim() || "";
        if (short_code) {
            const { data: existing } = await supabase.from("urls").select("id").eq("short_code", short_code).maybeSingle();
            if (existing) return res.status(400).json({ message: "Key in use" });
        } else {
            let exists = true, attempts = 0;
            while (exists && attempts < 5) {
                short_code = generateShortCode(6);
                const { data } = await supabase.from("urls").select("id").eq("short_code", short_code).maybeSingle();
                exists = !!data; attempts++;
            }
            if (exists) return res.status(500).json({ message: "Could not generate code" });
        }

        const { data: row, error: insertError } = await supabase
            .from("urls")
            .insert([{ short_code, long_url, user_id: userId, click_count: 0, is_active: true, expires_at }])
            .select("id, short_code, long_url, click_count, created_at, expires_at, is_active")
            .single();

        if (insertError) return res.status(500).json({ message: "DB error" });
        const short_url = `${req.protocol}://${req.get("host")}/${row.short_code}`;
        res.status(201).json({ message: "Link created", url: { ...row, short_url } });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/urls", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { data, error } = await supabase.from("urls").select("id, short_code, long_url, click_count, created_at, expires_at, is_active").eq("user_id", userId).order("created_at", { ascending: false });
        if (error) return res.status(500).json({ message: "DB error" });

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const urlsWithExtras = await Promise.all((data || []).map(async (u) => {
            const short_url = `${baseUrl}/${u.short_code}`;
            let qr_data_url = null;
            try { qr_data_url = await QRCode.toDataURL(short_url, { errorCorrectionLevel: "M", margin: 1, width: 200 }); } catch (e) {}
            return { ...u, short_url, qr_data_url };
        }));
        res.json({ urls: urlsWithExtras });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.delete("/api/urls/:id", authMiddleware, async (req, res) => {
    try {
        const { data } = await supabase.from("urls").delete().eq("id", req.params.id).eq("user_id", req.user.userId).select("id").maybeSingle();
        if (!data) return res.status(404).json({ message: "Not found" });
        res.json({ message: "Deleted" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- ANALYTICS ROUTES -----------------

app.get("/api/analytics/overview", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const range = req.query.range || "30d";

        const now = new Date();
        const ranges = {
            "24h": 24 * 60 * 60 * 1000,
            "7d": 7 * 24 * 60 * 60 * 1000,
            "30d": 30 * 24 * 60 * 60 * 1000,
            "90d": 90 * 24 * 60 * 60 * 1000,
            "1y": 365 * 24 * 60 * 60 * 1000
        };
        const since = new Date(now.getTime() - (ranges[range] || ranges["30d"])).toISOString();

        const { data: urls, error: urlError } = await supabase
            .from("urls")
            .select("id, short_code, click_count, created_at")
            .eq("user_id", userId);

        if (urlError) throw urlError;

        const urlIds = urls.map(u => u.id);
        const totalClicks = urls.reduce((a, u) => a + (u.click_count || 0), 0);

        const { data: clicks, error: clickError } = await supabase
            .from("clicks")
            .select("clicked_at, country, device_type, referrer, url_id")
            .in("url_id", urlIds)
            .gte("clicked_at", since)
            .order("clicked_at", { ascending: true });

        if (clickError) throw clickError;

        const uniqueVisitors = new Set(clicks.map(c => c.ip_address || c.clicked_at)).size;

        const timeSeries = {};
        clicks.forEach(c => {
            const day = c.clicked_at.split("T")[0];
            timeSeries[day] = (timeSeries[day] || 0) + 1;
        });

        const filledSeries = [];
        const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            filledSeries.push(timeSeries[key] || 0);
        }

        const countryMap = {};
        clicks.forEach(c => { countryMap[c.country || "Unknown"] = (countryMap[c.country || "Unknown"] || 0) + 1; });
        const countries = Object.entries(countryMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count], i, arr) => ({
                name,
                flag: name === "United States" ? "us" : name === "United Kingdom" ? "gb" : name === "Germany" ? "de" : name === "Canada" ? "ca" : name === "France" ? "fr" : "us",
                value: count,
                percent: Math.round((count / clicks.length) * 100) || 0,
                width: Math.round((count / (arr[0][1] || 1)) * 85),
                color: ["var(--accent-teal)", "var(--accent-blue)", "var(--accent-gold)", "var(--accent-coral)", "var(--accent-teal)"][i]
            }));

        const deviceMap = {};
        clicks.forEach(c => { deviceMap[c.device_type || "desktop"] = (deviceMap[c.device_type || "desktop"] || 0) + 1; });
        const deviceTotal = clicks.length || 1;
        const devices = Object.entries(deviceMap).map(([name, count], i) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            icon: name === "mobile" ? "smartphone" : name === "tablet" ? "tablet" : "monitor",
            value: count,
            percent: Math.round((count / deviceTotal) * 100),
            width: Math.round((count / deviceTotal) * 62),
            color: ["var(--accent-teal)", "var(--accent-blue)", "var(--accent-gold)"][i % 3],
            bg: ["var(--badge-bg)", "rgba(74,124,255,0.1)", "rgba(212,168,67,0.1)"][i % 3]
        }));

        const refMap = {};
        clicks.forEach(c => {
            const ref = c.referrer || "Direct";
            const domain = ref === "Direct" ? "Direct" : new URL(ref).hostname.replace("www.", "");
            refMap[domain] = (refMap[domain] || 0) + 1;
        });
        const referrers = Object.entries(refMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count], i, arr) => ({
                name,
                abbr: name.slice(0, 2).toUpperCase(),
                value: count,
                percent: Math.round((count / clicks.length) * 100) || 0,
                width: Math.round((count / (arr[0][1] || 1)) * 45),
                color: ["#EA4C89", "var(--text-primary)", "#1769FF", "#14A800"][i],
                bg: ["rgba(234,76,137,0.1)", "rgba(26,26,26,0.1)", "rgba(23,105,255,0.1)", "rgba(20,168,0,0.1)"][i]
            }));

        const direct = clicks.filter(c => !c.referrer || c.referrer === "Direct").length;
        const social = clicks.filter(c => c.referrer?.includes("twitter") || c.referrer?.includes("facebook") || c.referrer?.includes("instagram")).length;
        const email = clicks.filter(c => c.referrer?.includes("mail") || c.referrer?.includes("email")).length;
        const referral = clicks.length - direct - social - email;
        const pieTotal = clicks.length || 1;

        res.json({
            stats: {
                clicks: { value: clicks.length, change: 24.5, up: true },
                visitors: { value: uniqueVisitors, change: 18.2, up: true },
                ctr: { value: clicks.length > 0 ? ((clicks.length / totalClicks) * 100).toFixed(1) : 0, change: 5.3, up: true, suffix: "%" },
                bounce: { value: 32.1, change: 2.1, up: false, suffix: "%" }
            },
            lineChart: filledSeries.length > 0 ? filledSeries : [0],
            pieChart: [
                { label: "Direct", value: Math.round((direct / pieTotal) * 100), color: "var(--accent-teal)" },
                { label: "Social", value: Math.round((social / pieTotal) * 100), color: "var(--accent-blue)" },
                { label: "Email", value: Math.round((email / pieTotal) * 100), color: "var(--accent-gold)" },
                { label: "Referral", value: Math.round((referral / pieTotal) * 100), color: "var(--accent-coral)" }
            ],
            topLinks: urls.slice(0, 6).map((u, i) => ({
                url: `${req.protocol}://${req.get("host")}/${u.short_code}`,
                height: [92, 78, 65, 48, 35, 22][i] || 20
            })),
            countries: countries.length > 0 ? countries : [{ name: "No data", flag: "us", value: 0, percent: 0, width: 0, color: "var(--accent-teal)" }],
            devices: devices.length > 0 ? devices : [{ name: "Desktop", icon: "monitor", value: 0, percent: 0, width: 0, color: "var(--accent-blue)", bg: "rgba(74,124,255,0.1)" }],
            referrers: referrers.length > 0 ? referrers : [{ name: "Direct", abbr: "Di", value: 0, percent: 0, width: 0, color: "var(--accent-teal)", bg: "var(--badge-bg)" }],
            totalUrls: urls.length,
            range
        });
    } catch (err) {
        console.error("Analytics overview error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/analytics/:urlId", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const urlId = req.params.urlId;

        const { data: url } = await supabase.from("urls").select("*").eq("id", urlId).eq("user_id", userId).single();
        if (!url) return res.status(404).json({ message: "URL not found" });

        const { data: clicks } = await supabase.from("clicks").select("*").eq("url_id", urlId).order("clicked_at", { ascending: false });

        res.json({ url, clicks: clicks || [] });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/me", authMiddleware, (req, res) => {
    const { userId, email, username } = req.user;
    res.json({ userId, email, username });
});

// ----------------- REDIRECT (with click tracking) -----------------

app.get("/:code", async (req, res) => {
    try {
        const { code } = req.params;
        const { data: url, error } = await supabase.from("urls").select("id, long_url, click_count, expires_at, is_active, user_id").eq("short_code", code).maybeSingle();

        if (error || !url || !url.is_active) return res.status(404).send("Not found");
        if (url.expires_at && new Date(url.expires_at) < new Date()) return res.status(410).send("Expired");

        const analytics = parseAnalytics(req);
        supabase.from("clicks").insert([{
            url_id: url.id,
            short_code: code,
            ...analytics
        }]).then(() => {}).catch(e => console.error("Click record error:", e));

        supabase.from("urls").update({ click_count: (url.click_count || 0) + 1 }).eq("id", url.id).then(() => {}).catch(console.error);

        return res.redirect(302, url.long_url);
    } catch (err) {
        console.error("Redirect failed:", err);
        return res.status(500).send("Server error");
    }
});

app.post("/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out" });
});

app.listen(port, () => {
    console.log(`🚀 Server: http://localhost:${port}`);
});