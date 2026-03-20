# Feel Sketch

Group 5 Project 2

A React web app that turns emotions and memories into animated p5.js sketches. Chat with an AI to describe a feeling or memory, then refine the generated sketch in real time.

## Setup

1. **Clone the repo** (if you haven’t already):

   ```bash
   git clone <repo-url>
   cd feel-sketch
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Add your Anthropic API key**  
   Create a file named `.env` in the project root (same folder as `package.json`) with:
   ```bash
   ANTHROPIC_API_KEY=your_key_here
   ```
   Get a key from [Anthropic](https://console.anthropic.com/). The app reads this on the server; do not commit `.env`.

## Run the project

You need two processes: the API server and the React app.

1. **Start the API server** (in one terminal):

   ```bash
   npm run dev:server
   ```

   Leave it running. You should see: `Feel Sketch API server listening on http://localhost:8787`

2. **Start the React app** (in a second terminal):

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (usually `http://localhost:5173`) in your browser.

3. In the app, keep **Response mode** on **Live AI** and start describing a memory or feeling. After the short intake, say **“go”** to generate your first sketch; the preview updates on the right.

## Scripts

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `npm run dev`        | Start Vite dev server (React app)   |
| `npm run dev:server` | Start Node API server (for Live AI) |
| `npm run build`      | Build for production (`dist/`)      |
| `npm run preview`    | Preview the production build        |

## Notes

- **Test mode:** In the UI, you can switch **Response mode** to **“Wrong answer”** to try the flow without using the API.
- **New conversation:** Use **New Chat** to clear the chat and start over.
