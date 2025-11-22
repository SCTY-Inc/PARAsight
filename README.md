# PARAsight: Intelligent tab management

Automatically classify and organize your Safari tabs/bookmarks into PARA (Projects, Areas, Resources, Archive) using AI.

## What is PARA?

PARA is a method for organizing digital information into four categories:
- **Projects**: Time-bounded outcomes with specific steps and deadlines
- **Areas**: Ongoing responsibilities requiring continuous attention
- **Resources**: Reference material, learning content, or inspiration
- **Archive**: No future value, completed, or no longer relevant

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google Gemini API

1. Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Configure Convex

1. Run `npx convex dev` to create a new Convex project
2. Note the deployment URL

### 4. Set Environment Variables

Set your Gemini API key in Convex:

```bash
npx convex env set GEMINI_API_KEY your_gemini_api_key
```

### 5. Run Development Server

```bash
# Terminal 1: Run Convex backend
npx convex dev

# Terminal 2: Run Next.js frontend
npm run dev
```

## Usage

### Export Safari Tabs to Apple Notes

1. In Safari, select your tabs
2. Copy the URLs
3. Paste into Apple Notes (one URL per line)

### Import into Parasight

1. Copy your URLs from Apple Notes
2. Paste into the Parasight web interface
3. Optionally add a category/note (e.g., "AI Research", "Mac Tools")
4. Click "Process URLs"

The system will:
1. Fetch the title and description for each URL
2. Classify it into PARA categories using AI
3. Extract relevant tags
4. Display it in the appropriate column

## Architecture

- **Backend**: Convex (database + serverless functions)
- **AI**: Google Gemini 2.5 Flash-Lite with structured outputs
- **Web Scraping**: Cheerio for extracting page metadata
- **Frontend**: Next.js + React

## Folder Structure

```
parasight/
├── convex/
│   ├── schema.ts          # Database schema (links table)
│   ├── urlActions.ts      # URL fetching and classification
│   ├── linkMutations.ts   # Database mutations
│   └── links.ts           # Public queries
├── src/
│   ├── app/
│   │   ├── page.tsx       # 4-column PARA browser
│   │   ├── layout.tsx     # Convex provider
│   │   └── globals.css    # Styles
│   └── components/
│       ├── LinkCard.tsx   # Link display component
│       └── UrlInput.tsx   # URL input form
```

## Features

- Automatic URL metadata extraction (title, description)
- AI-powered PARA classification
- Tag generation
- Deduplication (ignores tracking parameters)
- Clean, 4-column interface organized by PARA category
