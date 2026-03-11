# Qærn Wiki — Deployment Guide

A real-time collaborative wiki for your TTRPG campaign, built with React + Firebase + Vite.

## Features
- **Accounts** — email/password sign-up with display names
- **Presence bubbles** — see who's reading or editing in real time (Google Docs style)
- **Real-time sync** — article changes appear instantly for all users via Firestore
- **Changelog** — every create/edit/delete is logged with who did it and when
- **Full rich-text editor** — bold, italic, fonts, sizes, colors, tables, image embeds
- **Infobox editor** — add/remove/reorder infobox fields
- **Edit indicators** — orange dot on sidebar + banner on article when someone is editing

---

## Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, name it (e.g. `qaern-wiki`), click through the setup
3. Once created, click **Web** (</>) to add a web app, name it anything, click **Register app**
4. Copy the `firebaseConfig` object — you'll need it in Step 3

---

## Step 2 — Enable Firebase Services

In the Firebase console, enable these three services:

### Authentication
- Sidebar → **Authentication** → **Get started**
- Click **Email/Password** → Enable → Save

### Firestore Database
- Sidebar → **Firestore Database** → **Create database**
- Choose **Start in production mode** (you'll add rules in Step 4)
- Pick any region → Done

### Realtime Database
- Sidebar → **Realtime Database** → **Create database**
- Choose any region, start in **locked mode** → Done
- Copy the database URL (looks like `https://your-project-default-rtdb.firebaseio.com`)

---

## Step 3 — Configure the App

Open `src/firebase.js` and replace the placeholder values with your actual Firebase config:

```js
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "qaern-wiki.firebaseapp.com",
  databaseURL:       "https://qaern-wiki-default-rtdb.firebaseio.com",
  projectId:         "qaern-wiki",
  storageBucket:     "qaern-wiki.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
}
```

---

## Step 4 — Apply Security Rules

### Firestore Rules
1. Firebase console → Firestore → **Rules** tab
2. Replace the contents with what's in `firestore.rules` in this project
3. Click **Publish**

### Realtime Database Rules
1. Firebase console → Realtime Database → **Rules** tab
2. Replace the contents with what's in `database.rules.json` in this project
3. Click **Publish**

---

## Step 5 — Deploy to Vercel

### Install and run locally first (optional)
```bash
npm install
npm run dev
```
Visit `http://localhost:5173` — create an account, then click **Seed Default Articles** to populate the wiki.

### Deploy to Vercel
1. Push this folder to a GitHub repository
2. Go to [https://vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Framework preset: **Vite** (auto-detected)
5. No environment variables needed (Firebase config is in the source)
6. Click **Deploy** → done!

Your wiki will be live at `https://your-project.vercel.app`

---

## Step 6 — First-Time Setup

1. Open the deployed URL
2. Click **Create Account** and sign up
3. You'll see **"The wiki is empty. Seed it with the default Qærn articles"**
4. Click **Seed Default Articles** — this populates Firestore with all starter content
5. Share the URL with your players — they can sign up and start editing!

---

## Usage Notes

- **Presence bubbles** appear in the top bar — hover them to see who's who
- An **orange dot** on the sidebar and a banner on the article appear when someone is actively editing
- **Changelog** (📋 button) shows the last 50 edits with who made them
- All edits are **immediately visible** to everyone — no refresh needed
- The wiki remembers who last edited each article and when (shown at article bottom)

---

## Customization

- **Add categories**: edit the `CATEGORIES` array in `src/WikiApp.jsx`
- **Change fonts**: edit `CONTENT_FONTS` in `src/WikiApp.jsx`
- **Admin controls** (delete protection, roles, etc.): update `firestore.rules`
- **Article seeding**: edit `src/seedData.js` to change the default starter articles

---

## File Structure

```
qaern-wiki/
├── index.html
├── vite.config.js
├── package.json
├── firestore.rules          ← Firestore security rules
├── database.rules.json      ← Realtime DB rules (presence)
└── src/
    ├── main.jsx             ← Entry point + global styles
    ├── firebase.js          ← Firebase config (FILL THIS IN)
    ├── AuthContext.jsx      ← Auth provider (login/register/logout)
    ├── AuthScreen.jsx       ← Login/register UI
    ├── usePresence.js       ← Real-time presence tracking
    ├── WikiApp.jsx          ← Main wiki app
    └── seedData.js          ← Default article content
```
