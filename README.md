# 🔗 Linke

**Linke** is a modern URL shortener built for simplicity, speed, and analytics-friendly workflows. It provides secure authentication, an intuitive dashboard, and powerful link management features — all wrapped in a clean UI.

---

## 🚀 Features

### 🔐 Authentication

* Secure user signup with password hashing
* Email verification via one-time codes
* JWT-based authentication with HTTP-only cookies

### 📊 Dashboard

* Responsive UI with light/dark mode
* Create, search, and manage short links
* Quick actions (copy, access, future editing support)
* Basic analytics:

  * Click count
  * Link status
  * Created date

### 🔗 Core Functionality

* Short URLs: `https://<domain>/<code>`
* Fast server-side redirects
* Click tracking and expiry handling
* Automatic QR code generation
* Open Graph-based live link previews

---

## 🧪 Status

> **Beta (v0.1.0 – Linke Beta)**
> This project is currently in early beta. Core features are functional, but improvements and refinements are ongoing.

---

## 🛠️ Tech Stack

*(Customize this based on your actual stack)*

* Frontend: React / Next.js
* Backend: Node.js / Express
* Database: PostgreSQL / MongoDB
* Auth: JWT + Cookies
* Styling: Tailwind CSS (or your choice)

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/linke.git
cd linke
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=
JWT_SECRET=
EMAIL_SERVICE_API_KEY=
APP_URL=http://localhost:3000
```

### 4. Run the development server

```bash
npm run dev
```

---

## 📌 Roadmap

* ✏️ Edit existing links
* 📈 Advanced analytics (geo, device, referrer)
* 👥 Team collaboration
* 🔒 Custom domains
* 📊 Improved dashboard insights

---

## 🐞 Reporting Issues

Found a bug or have a suggestion?

* Open an issue on GitHub
* Provide clear steps to reproduce
* Include screenshots/logs if possible

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a pull request

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 💬 Feedback

Your feedback helps shape Linke’s future.
If you’re using the beta, let us know what works — and what doesn’t.

---

**Built with simplicity in mind.** 🚀
