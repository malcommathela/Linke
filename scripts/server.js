// server.js — MEMORY-OPTIMIZED for Render 512MB
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
const rateLimit = require("express-rate-limit");
const Redis = require("ioredis");
const compression = require("compression");
const helmet = require("helmet");
const { z } = require("zod");
const cluster = require("cluster");
const os = require("os");

// Only load .env in non-production
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config({ path: path.join(__dirname, ".env") });
}

// ==================== CLUSTER MODE (Render-safe) ====================
// Render sets WEB_CONCURRENCY=1 on 512MB instances
const numWorkers = process.env.WEB_CONCURRENCY
    ? parseInt(process.env.WEB_CONCURRENCY, 10)
    : (process.env.NODE_ENV === "production" ? os.cpus().length : 1);

if (cluster.isPrimary && numWorkers > 1) {
    console.log(`Primary ${process.pid} spawning ${numWorkers} workers...`);
    for (let i = 0; i < numWorkers; i++) cluster.fork();
    cluster.on("exit", (worker) => {
        console.log(`Worker ${worker.process.pid} died, restarting...`);
        cluster.fork();
    });
    return;
}

const app = express();
const port = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required envs");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: "public" },
});

// ==================== REDIS (Memory-efficient) ====================
const isUpstash = REDIS_URL.includes("upstash") || REDIS_URL.startsWith("rediss://");

const redis = new Redis(REDIS_URL, {
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    connectTimeout: 10000,
    keepAlive: 30000,
    tls: isUpstash ? { rejectUnauthorized: false } : undefined,
    reconnectOnError: (err) => {
        const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"];
        return targetErrors.some(e => err.message.includes(e));
    },
    family: 4,
});

redis.on("error", (err) => {
    if (err.message.includes("ECONNRESET") || err.message.includes("ETIMEDOUT")) {
        console.warn("Redis connection lost");
    }
});
redis.on("connect", () => console.log("Redis connected"));
redis.on("ready", () => console.log("Redis ready"));

// Resolve paths relative to project root
const ROOT = path.join(__dirname, "..");

// ==================== SECURITY MIDDLEWARE ====================
app.disable('x-powered-by');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://*.supabase.co", "https://unpkg.com"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use("/public", express.static(path.join(ROOT, "public"), { maxAge: "1d" }));
app.use("/pages", express.static(path.join(ROOT, "pages"), { maxAge: "1h" }));

// ==================== RATE LIMITERS ====================
const { RedisStore } = require("rate-limit-redis");

function createRedisStore(prefix) {
    return new RedisStore({
        sendCommand: (...args) => redis.call(...args),
        prefix: `rl:${prefix}:`,
    });
}

const globalLimiter = rateLimit({
    store: createRedisStore("global"),
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests" },
    skip: (req) => req.path.startsWith("/public") || req.path.startsWith("/pages"),
});

const authLimiter = rateLimit({
    store: createRedisStore("auth"),
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many auth attempts" },
});

const apiLimiter = rateLimit({
    store: createRedisStore("api"),
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "API rate limit exceeded" },
});

app.use(globalLimiter);
app.use("/login", authLimiter);
app.use("/signup", authLimiter);
app.use("/verify-email", authLimiter);
app.use("/resend-email", authLimiter);
app.use("/api/", apiLimiter);

// ==================== VALIDATION SCHEMAS ====================
const loginSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password too short"),
});

const signupSchema = z.object({
    username: z.string().min(3).max(30),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password too short"),
});

const urlSchema = z.object({
    long_url: z.string().url("Invalid URL"),
    custom_key: z.string().max(50).optional(),
    expiry: z.enum(["6h", "1w", "1m", "6m", "1y", "never"]).optional(),
});

const ticketSchema = z.object({
    subject: z.string().min(1).max(200),
    category: z.string().min(1),
    message: z.string().min(1).max(5000),
});

const profileSchema = z.object({
    username: z.string().min(3).max(30).optional(),
    email: z.string().email().optional(),
    bio: z.string().max(500).optional(),
    avatar_url: z.string().url().optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});

// ==================== HELPER FUNCTIONS ====================
const transporter = nodemailer.createTransport({
    service: "gmail",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    pool: true,
    maxConnections: 5,
});

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(email, code) {
    const mailOptions = {
        from: `\"Aura App\" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your verification code",
        text: `Your verification code is: ${code}`,
    };
    await transporter.sendMail(mailOptions);
}

function authMiddleware(req, res, next) {
    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
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

// ==================== IDEMPOTENCY MIDDLEWARE ====================
function idempotencyMiddleware(ttlSeconds = 60) {
    return async (req, res, next) => {
        const key = req.headers["idempotency-key"];
        if (!key) return next();

        const cacheKey = `idempotency:${req.user?.userId || req.ip}:${key}`;

        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                return res.status(409).json({
                    message: "Duplicate request",
                    cached: true,
                    data: parsed.data
                });
            }

            const originalJson = res.json.bind(res);
            res.json = (body) => {
                redis.setex(cacheKey, ttlSeconds, JSON.stringify({ data: body, timestamp: Date.now() }))
                    .catch(() => {});
                return originalJson(body);
            };
            next();
        } catch {
            next();
        }
    };
}

// ==================== CACHE MIDDLEWARE ====================
function cacheMiddleware(ttlSeconds = 300) {
    return async (req, res, next) => {
        const key = `cache:${req.originalUrl}:${req.user?.userId || "anon"}`;

        try {
            const cached = await redis.get(key);
            if (cached) {
                res.setHeader("X-Cache", "HIT");
                return res.json(JSON.parse(cached));
            }

            const originalJson = res.json.bind(res);
            res.json = (body) => {
                redis.setex(key, ttlSeconds, JSON.stringify(body))
                    .catch(() => {});
                res.setHeader("X-Cache", "MISS");
                return originalJson(body);
            };
            next();
        } catch {
            next();
        }
    };
}

// ==================== BATCH CLICK TRACKING ====================
const clickQueue = [];
const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 5000;
let isFlushing = false;

async function flushClicks() {
    if (isFlushing || clickQueue.length === 0) return;
    isFlushing = true;

    const batch = clickQueue.splice(0, BATCH_SIZE);
    try {
        const { error } = await supabase.from("clicks").insert(batch);
        if (error) {
            clickQueue.unshift(...batch);
        }
    } catch {
        clickQueue.unshift(...batch);
    } finally {
        isFlushing = false;
    }
}

setInterval(flushClicks, FLUSH_INTERVAL);

function queueClick(data) {
    clickQueue.push(data);
    if (clickQueue.length >= BATCH_SIZE) flushClicks();
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    await flushClicks();
    await redis.quit();
    process.exit(0);
});

// ==================== QR CODE CACHING ====================
async function getOrCreateQR(shortUrl) {
    const cacheKey = `qr:${Buffer.from(shortUrl).toString("base64")}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const qr = await QRCode.toDataURL(shortUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 200
    });
    await redis.setex(cacheKey, 86400, qr);
    return qr;
}

// ==================== ROUTES ====================

app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "pages", "landing.html"));
});

// ----------------- AUTH ROUTES -----------------

app.post("/login", async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid input",
                errors: parsed.error.issues.map(i => i.message)
            });
        }

        const { email, password } = parsed.data;

        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, password_hash, verified")
            .eq("email", email)
            .single();

        if (error || !user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (!user.verified) {
            return res.status(403).json({ message: "Please verify your email first" });
        }

        const payload = { userId: user.id, email, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({
            message: "Successfully logged in",
            user: { id: user.id, email, username: user.username },
        });
    } catch {
        return res.status(500).json({ message: "Server Error" });
    }
});

app.post("/signup", async (req, res) => {
    try {
        const parsed = signupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid input",
                errors: parsed.error.issues.map(i => i.message)
            });
        }

        const { username, email, password } = parsed.data;

        const [{ data: existingEmail }, { data: existingUser }] = await Promise.all([
            supabase.from("users").select("id").eq("email", email).maybeSingle(),
            supabase.from("users").select("id").eq("username", username).maybeSingle(),
        ]);

        if (existingEmail || existingUser) {
            return res.status(400).json({ message: "Username or email already exists" });
        }

        const password_hash = await bcrypt.hash(password, 12);
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { data: user, error: insertError } = await supabase
            .from("users")
            .insert([{
                username,
                email,
                password_hash,
                verified: false,
                verification_code: code,
                verification_expires_at: expiresAt
            }])
            .select("id, username, email")
            .single();

        if (insertError) {
            return res.status(400).json({ message: insertError.message });
        }

        res.json({
            message: "Sign up successful! Verification code sent.",
            user,
            email,
            redirect: `/pages/verify.html?email=${encodeURIComponent(email)}`
        });

        sendEmail(email, code).catch(() => {});
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/verify-email", async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ message: "Email and code required" });

        const { data: user } = await supabase
            .from("users")
            .select("id, verified, verification_code, verification_expires_at")
            .eq("email", email)
            .maybeSingle();

        if (!user) return res.status(400).json({ message: "User not found" });
        if (user.verified) return res.status(400).json({ message: "Already verified" });
        if (new Date(user.verification_expires_at) < new Date()) return res.status(400).json({ message: "Code expired" });
        if (user.verification_code !== String(code)) return res.status(400).json({ message: "Invalid code" });

        await supabase
            .from("users")
            .update({ verified: true, verification_code: null, verification_expires_at: null })
            .eq("id", user.id);

        res.json({ message: "Email verified successfully" });
    } catch {
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
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- PAGE ROUTES -----------------

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

// ----------------- USER ROUTES -----------------

app.get("/api/me", authMiddleware, (req, res) => {
    res.json({
        username: req.user.username
    });
});

app.patch("/api/users/me", authMiddleware, idempotencyMiddleware(60), async (req, res) => {
    try {
        const userId = req.user.userId;
        const parsed = profileSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid input",
                errors: parsed.error.issues.map(i => i.message)
            });
        }

        const { username, email, bio, avatar_url } = parsed.data;
        const updates = {};
        if (username !== undefined) updates.username = username.trim();
        if (email !== undefined) updates.email = email.trim();
        if (bio !== undefined) updates.bio = bio.trim();
        if (avatar_url !== undefined) updates.avatar_url = avatar_url.trim();
        updates.updated_at = new Date().toISOString();

        if (Object.keys(updates).length === 1) {
            return res.status(400).json({ message: "No fields to update" });
        }

        const checks = [];
        if (updates.username) {
            checks.push(supabase.from("users").select("id").eq("username", updates.username).neq("id", userId).maybeSingle());
        }
        if (updates.email) {
            checks.push(supabase.from("users").select("id").eq("email", updates.email).neq("id", userId).maybeSingle());
        }

        const results = await Promise.all(checks);
        if (updates.username && results[0]?.data) return res.status(400).json({ message: "Username already taken" });
        if (updates.email && results[updates.username ? 1 : 0]?.data) return res.status(400).json({ message: "Email already in use" });

        const { data, error } = await supabase
            .from("users")
            .update(updates)
            .eq("id", userId)
            .select("id, username, email, bio, avatar_url, updated_at")
            .single();

        if (error) {
            return res.status(500).json({ message: "Failed to update profile" });
        }

        const payload = { userId: data.id, email: data.email, username: data.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
        });

        await redis.del(`cache:/api/me:${userId}`);

        res.json({ message: "Profile updated successfully", user: data });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/users/me/password", authMiddleware, idempotencyMiddleware(60), async (req, res) => {
    try {
        const userId = req.user.userId;
        const parsed = passwordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid input",
                errors: parsed.error.issues.map(i => i.message)
            });
        }

        const { currentPassword, newPassword } = parsed.data;

        const { data: user, error } = await supabase
            .from("users")
            .select("password_hash")
            .eq("id", userId)
            .single();

        if (error || !user) return res.status(404).json({ message: "User not found" });

        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) return res.status(401).json({ message: "Current password is incorrect" });

        const newHash = await bcrypt.hash(newPassword, 12);
        const { error: updateError } = await supabase
            .from("users")
            .update({ password_hash: newHash, updated_at: new Date().toISOString() })
            .eq("id", userId);

        if (updateError) return res.status(500).json({ message: "Failed to update password" });

        res.json({ message: "Password updated successfully" });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.post("/api/users/me/deactivate", authMiddleware, idempotencyMiddleware(300), async (req, res) => {
    try {
        const userId = req.user.userId;

        const { error } = await supabase
            .from("users")
            .update({
                is_active: false,
                deactivated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", userId);

        if (error) return res.status(500).json({ message: "Failed to deactivate account" });

        res.clearCookie("auth_token");
        res.json({ message: "Account deactivated successfully" });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.delete("/api/users/me", authMiddleware, idempotencyMiddleware(300), async (req, res) => {
    try {
        const userId = req.user.userId;

        await supabase.from("urls").delete().eq("user_id", userId);
        const { error } = await supabase.from("users").delete().eq("id", userId);

        if (error) {
            return res.status(500).json({ message: "Failed to delete account" });
        }

        res.clearCookie("auth_token");
        res.json({ message: "Account deleted permanently" });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- TICKETS ROUTES -----------------

app.post("/api/tickets", authMiddleware, idempotencyMiddleware(300), async (req, res) => {
    try {
        const userId = req.user.userId;
        const parsed = ticketSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid input",
                errors: parsed.error.issues.map(i => i.message)
            });
        }

        const { subject, category, message } = parsed.data;

        const { data, error } = await supabase
            .from("support_tickets")
            .insert([{
                user_id: userId,
                subject: subject.trim(),
                category: category.trim(),
                message: message.trim(),
                status: "open"
            }])
            .select("id, subject, category, status, created_at")
            .single();

        if (error) {
            return res.status(500).json({ message: "Failed to submit ticket" });
        }

        res.status(201).json({ message: "Ticket submitted successfully", ticket: data });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/tickets", authMiddleware, cacheMiddleware(60), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { data, error } = await supabase
            .from("support_tickets")
            .select("id, subject, category, status, created_at, updated_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ message: "Failed to fetch tickets" });
        res.json({ tickets: data || [] });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- URL ROUTES -----------------

app.get("/api/preview", async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ message: "url required" });

    try {
        new URL(url);
        const cacheKey = `preview:${Buffer.from(url).toString("base64")}`;
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const { error, result } = await ogs({
            url,
            timeout: 3000,
            headers: { "user-agent": "Mozilla/5.0" }
        });

        if (error) return res.status(500).json({ message: "Failed to fetch preview" });

        const response = {
            url: result.requestUrl || url,
            title: result.ogTitle || "",
            description: result.ogDescription || "",
            image: result.ogImage?.url || "",
            siteName: result.ogSiteName || ""
        };

        await redis.setex(cacheKey, 3600, JSON.stringify(response));
        res.json(response);
    } catch {
        res.status(500).json({ message: "Failed" });
    }
});

app.post("/api/urls", authMiddleware, idempotencyMiddleware(60), async (req, res) => {
    try {
        const userId = req.user.userId;
        const parsed = urlSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                message: "Invalid input",
                errors: parsed.error.issues.map(i => i.message)
            });
        }

        const { long_url, custom_key, expiry } = parsed.data;

        let expires_at = null;
        if (expiry && expiry !== "never") {
            const ms = {
                "6h": 6*60*60*1000,
                "1w": 7*24*60*60*1000,
                "1m": 30*24*60*60*1000,
                "6m": 180*24*60*60*1000,
                "1y": 365*24*60*60*1000
            }[expiry];
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
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/urls", authMiddleware, cacheMiddleware(30), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { data, error } = await supabase
            .from("urls")
            .select("id, short_code, long_url, click_count, created_at, expires_at, is_active")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) return res.status(500).json({ message: "DB error" });

        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const urlsWithExtras = await Promise.all((data || []).map(async (u) => {
            const short_url = `${baseUrl}/${u.short_code}`;
            let qr_data_url = null;
            try { qr_data_url = await getOrCreateQR(short_url); } catch (e) {}
            return { ...u, short_url, qr_data_url };
        }));

        res.json({ urls: urlsWithExtras });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.delete("/api/urls/:id", authMiddleware, async (req, res) => {
    try {
        const { data } = await supabase.from("urls").delete().eq("id", req.params.id).eq("user_id", req.user.userId).select("id").maybeSingle();
        if (!data) return res.status(404).json({ message: "Not found" });

        await redis.del(`cache:/api/urls:${req.user.userId}`);

        res.json({ message: "Deleted" });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- ANALYTICS ROUTES -----------------

app.get("/api/analytics/overview", authMiddleware, cacheMiddleware(300), async (req, res) => {
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

        const [{ data: urls, error: urlError }, { data: clicks, error: clickError }] = await Promise.all([
            supabase.from("urls").select("id, short_code, click_count, created_at").eq("user_id", userId),
            supabase.from("clicks").select("clicked_at, country, device_type, referrer, url_id, ip_address").in("url_id",
                (await supabase.from("urls").select("id").eq("user_id", userId)).data?.map(u => u.id) || []
            ).gte("clicked_at", since).order("clicked_at", { ascending: true })
        ]);

        let clickData = clicks || [];
        if (clickError || !clicks) {
            const urlIds = (urls || []).map(u => u.id);
            if (urlIds.length > 0) {
                const { data: fallbackClicks } = await supabase
                    .from("clicks")
                    .select("clicked_at, country, device_type, referrer, url_id, ip_address")
                    .in("url_id", urlIds)
                    .gte("clicked_at", since)
                    .order("clicked_at", { ascending: true });
                clickData = fallbackClicks || [];
            }
        }

        const totalClicks = (urls || []).reduce((a, u) => a + (u.click_count || 0), 0);
        const uniqueVisitors = new Set(clickData.map(c => c.ip_address || c.clicked_at)).size;

        const timeSeries = {};
        clickData.forEach(c => {
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
        clickData.forEach(c => { countryMap[c.country || "Unknown"] = (countryMap[c.country || "Unknown"] || 0) + 1; });
        const countries = Object.entries(countryMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count], i, arr) => ({
                name,
                flag: name === "United States" ? "us" : name === "United Kingdom" ? "gb" : name === "Germany" ? "de" : name === "Canada" ? "ca" : name === "France" ? "fr" : "us",
                value: count,
                percent: Math.round((count / clickData.length) * 100) || 0,
                width: Math.round((count / (arr[0][1] || 1)) * 85),
                color: ["var(--accent-teal)", "var(--accent-blue)", "var(--accent-gold)", "var(--accent-coral)", "var(--accent-teal)"][i]
            }));

        const deviceMap = {};
        clickData.forEach(c => { deviceMap[c.device_type || "desktop"] = (deviceMap[c.device_type || "desktop"] || 0) + 1; });
        const deviceTotal = clickData.length || 1;
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
        clickData.forEach(c => {
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
                percent: Math.round((count / clickData.length) * 100) || 0,
                width: Math.round((count / (arr[0][1] || 1)) * 45),
                color: ["#EA4C89", "var(--text-primary)", "#1769FF", "#14A800"][i],
                bg: ["rgba(234,76,137,0.1)", "rgba(26,26,26,0.1)", "rgba(23,105,255,0.1)", "rgba(20,168,0,0.1)"][i]
            }));

        const direct = clickData.filter(c => !c.referrer || c.referrer === "Direct").length;
        const social = clickData.filter(c => c.referrer?.includes("twitter") || c.referrer?.includes("facebook") || c.referrer?.includes("instagram")).length;
        const email = clickData.filter(c => c.referrer?.includes("mail") || c.referrer?.includes("email")).length;
        const referral = clickData.length - direct - social - email;
        const pieTotal = clickData.length || 1;

        res.json({
            stats: {
                clicks: { value: clickData.length, change: 24.5, up: true },
                visitors: { value: uniqueVisitors, change: 18.2, up: true },
                ctr: { value: clickData.length > 0 ? ((clickData.length / totalClicks) * 100).toFixed(1) : 0, change: 5.3, up: true, suffix: "%" },
                bounce: { value: 32.1, change: 2.1, up: false, suffix: "%" }
            },
            lineChart: filledSeries.length > 0 ? filledSeries : [0],
            pieChart: [
                { label: "Direct", value: Math.round((direct / pieTotal) * 100), color: "var(--accent-teal)" },
                { label: "Social", value: Math.round((social / pieTotal) * 100), color: "var(--accent-blue)" },
                { label: "Email", value: Math.round((email / pieTotal) * 100), color: "var(--accent-gold)" },
                { label: "Referral", value: Math.round((referral / pieTotal) * 100), color: "var(--accent-coral)" }
            ],
            topLinks: (urls || []).slice(0, 6).map((u, i) => ({
                url: `${req.protocol}://${req.get("host")}/${u.short_code}`,
                height: [92, 78, 65, 48, 35, 22][i] || 20
            })),
            countries: countries.length > 0 ? countries : [{ name: "No data", flag: "us", value: 0, percent: 0, width: 0, color: "var(--accent-teal)" }],
            devices: devices.length > 0 ? devices : [{ name: "Desktop", icon: "monitor", value: 0, percent: 0, width: 0, color: "var(--accent-blue)", bg: "rgba(74,124,255,0.1)" }],
            referrers: referrers.length > 0 ? referrers : [{ name: "Direct", abbr: "Di", value: 0, percent: 0, width: 0, color: "var(--accent-teal)", bg: "var(--badge-bg)" }],
            totalUrls: (urls || []).length,
            range
        });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

app.get("/api/analytics/:urlId", authMiddleware, cacheMiddleware(60), async (req, res) => {
    try {
        const userId = req.user.userId;
        const urlId = req.params.urlId;

        const { data: url } = await supabase.from("urls").select("*").eq("id", urlId).eq("user_id", userId).single();
        if (!url) return res.status(404).json({ message: "URL not found" });

        const { data: clicks } = await supabase.from("clicks").select("*").eq("url_id", urlId).order("clicked_at", { ascending: false });

        res.json({ url, clicks: clicks || [] });
    } catch {
        res.status(500).json({ message: "Server error" });
    }
});

// ----------------- REDIRECT -----------------

app.get("/:code", async (req, res) => {
    try {
        const { code } = req.params;

        const cacheKey = `url:${code}`;
        let url = null;
        const cached = await redis.get(cacheKey);

        if (cached) {
            url = JSON.parse(cached);
        } else {
            const { data, error } = await supabase
                .from("urls")
                .select("id, long_url, click_count, expires_at, is_active, user_id")
                .eq("short_code", code)
                .maybeSingle();

            if (error || !data || !data.is_active) return res.status(404).send("Not found");
            url = data;
            await redis.setex(cacheKey, 300, JSON.stringify(url));
        }

        if (url.expires_at && new Date(url.expires_at) < new Date()) {
            await redis.del(cacheKey);
            return res.status(410).send("Expired");
        }

        const analytics = parseAnalytics(req);
        queueClick({
            url_id: url.id,
            short_code: code,
            ...analytics
        });

        supabase.from("urls")
            .update({ click_count: (url.click_count || 0) + 1 })
            .eq("id", url.id)
            .then(() => {
                redis.setex(cacheKey, 300, JSON.stringify({ ...url, click_count: (url.click_count || 0) + 1 }))
                    .catch(() => {});
            })
            .catch(() => {});

        return res.redirect(302, url.long_url);
    } catch {
        return res.status(500).send("Server error");
    }
});

app.post("/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out" });
});

// ==================== PRODUCTION ERROR HANDLER ====================
app.use((err, req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error(err);
    }
    res.status(500).json({ message: "Server error" });
});

// app.listen(port, () => {
//     console.log(`Server running on port ${port}`);
// });

app.listen(port, () => {
    console.log(`🚀 Server: http://localhost:${port} (Worker ${process.pid})`);
});