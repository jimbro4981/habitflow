# 🌊 HabitFlow

**A private, offline-first habit tracker PWA.** Build better habits with streak tracking, visual analytics, and a beautiful dark/light interface — all without sending a single byte to the cloud.

---

## ✨ Features

- **Daily Habit Tracking** — Check off habits each day with satisfying animations
- **Streak Counting** — Stay motivated with automatic streak calculation
- **Calendar View** — See your completion history at a glance
- **Statistics & Analytics** — Heatmaps, charts, and completion rates
- **Dark & Light Themes** — Beautiful violet-tinted UI with smooth theme transitions
- **Offline-First PWA** — Install on your home screen, works without internet
- **100% Private** — All data stored locally in your browser via LocalStorage

---

## 🚀 Getting Started

### Serve Locally

```bash
npx http-server . -p 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Install on Android

1. Open the app in **Google Chrome**
2. Tap the **⋮ menu** (top right)
3. Select **"Add to Home Screen"**
4. Tap **"Add"** to confirm

The app will appear on your home screen and launch in standalone mode.

### Install on iOS

1. Open the app in **Safari**
2. Tap the **Share** button
3. Select **"Add to Home Screen"**

---

## 🌐 Deploy to GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings → Pages**
3. Under **Source**, select the `main` branch and `/ (root)` folder
4. Click **Save**
5. Your app will be live at `https://<username>.github.io/<repo-name>/`

---

## 🔒 Privacy

HabitFlow is designed with privacy as a core principle:

- **No cloud storage** — All data lives in your browser's LocalStorage
- **No analytics or tracking** — Zero third-party scripts
- **No account required** — Just open and start tracking
- **No network requests** — Works entirely offline after first load

Your habits are your business. Period.

---

## 🛠 Tech Stack

- Vanilla HTML, CSS, JavaScript
- Progressive Web App (PWA) with Service Worker
- LocalStorage for data persistence
- CSS Custom Properties for theming
- Google Fonts (Inter)

---

## 📁 Project Structure

```
habits/
├── index.html          # App shell
├── manifest.json       # PWA manifest
├── README.md           # This file
├── css/
│   ├── index.css       # Design system & reset
│   ├── themes.css      # Light & dark theme tokens
│   └── components.css  # UI component styles
├── js/
│   └── app.js          # Application logic (coming soon)
├── icons/
│   ├── icon-192.png    # PWA icon 192×192
│   └── icon-512.png    # PWA icon 512×512
└── sw.js               # Service worker (coming soon)
```

---

*Built with ❤️ for better habits.*
