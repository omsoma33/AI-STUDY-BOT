# 🧠 AI's Second Brain — AI Study Buddy

A beautiful, fully client-side AI-powered study tool built with vanilla HTML, CSS, and JavaScript. Uses the Anthropic Claude API directly from the browser.

## ✨ Features

| Tab | What it does |
|-----|-------------|
| 💬 **Chat** | Ask Claude anything — explanations, homework help, problem-solving |
| 📝 **Notes** | Write and save notes locally; AI can summarize them |
| 🃏 **Flashcards** | Paste any topic → AI generates a flip-card deck |
| 🎯 **Quiz Me** | Enter a topic → AI creates a multiple-choice quiz with explanations |
| 📄 **Summarize** | Paste any text → get concise, bullet, detailed, or ELI5 summaries |

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/ai-study-buddy.git
cd ai-study-buddy
```

### 2. Open in browser
No build step needed — just open `index.html` in any modern browser:
```bash
open index.html
# or drag index.html into your browser
```

### 3. Enter your API key
On first launch, you'll be prompted for your [Anthropic API key](https://console.anthropic.com). It's stored in `localStorage` — never sent anywhere except Anthropic's API.

## 🗂️ Project Structure
```
ai-study-buddy/
├── index.html        # App shell + all tabs
├── css/
│   └── style.css     # Dark theme, responsive layout
├── js/
│   └── app.js        # All app logic + Claude API calls
└── README.md
```

## 🔧 Configuration

Edit the top of `js/app.js` to change the model:
```js
const MODEL = 'claude-opus-4-5'; // or claude-haiku-3-5-20251001 for faster/cheaper
```

## 📦 Deploying

Since it's pure static HTML, you can deploy anywhere:

- **GitHub Pages**: Settings → Pages → Deploy from branch `main`, folder `/root`
- **Netlify / Vercel**: Drag & drop the folder
- **Any static host**: Upload the files as-is

## 🔑 API Key Security

Your API key is stored in your browser's `localStorage`. For production or shared deployments, consider adding a backend proxy so the key isn't exposed client-side.

## 🛠️ Built With

- Vanilla HTML / CSS / JavaScript (no frameworks, no build tools)
- [Anthropic Claude API](https://docs.anthropic.com)
- [Google Fonts](https://fonts.google.com) — Syne + DM Sans

## 📄 License

MIT
