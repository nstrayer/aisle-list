# AIsle-List

A smart grocery list app that uses AI to read your handwritten lists and organize items by store aisle.

**[Try it now](https://nickstrayer.me/aisle-list/)**

## How It Works

1. **Snap a photo** of your handwritten grocery list
2. **AI reads it** - Claude identifies items, meal plans, crossed-out items, and notes
3. **Choose what to include** - Select which sections you want on your final list
4. **Shop by aisle** - Items are automatically organized by store section (produce, dairy, meat, etc.)

## Features

- **Handwriting recognition** - Works with messy handwriting, multiple columns, and mixed formats
- **Smart categorization** - Distinguishes between grocery items, meal plans, and notes
- **Store-optimized** - Groups items by typical grocery store layout to minimize backtracking
- **List history** - Auto-saves lists so you can revisit previous shopping trips
- **Works offline** - Install as a PWA on your phone for quick access
- **Privacy-first** - Your API key and images stay on your device

## Installation

Install on your iPhone or Android:

1. Open [nickstrayer.me/aisle-list](https://nickstrayer.me/aisle-list/) in your browser
2. **iOS**: Tap Share > "Add to Home Screen"
3. **Android**: Tap the menu > "Install app" or "Add to Home Screen"

## Requirements

You'll need an [Anthropic API key](https://console.anthropic.com/) to use this app. The app calls the Claude API directly from your browser - no server involved.

## Development

```bash
npm install
npm run dev
```

Built with React, Vite, Tailwind CSS, and the Anthropic SDK.

## License

MIT
