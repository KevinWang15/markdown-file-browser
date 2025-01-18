# Markdown File Browser

This project allows you to browse and view multiple Markdown files stored in a `./docs` directory, export the currently viewed Markdown file as a PDF, and features live reloading of Markdown content.

## Major Features

- **File Listing**: Automatically list all `.md` files in `./docs` when visiting the root URL `/`.
- **Markdown Rendering**: Uses [`markdown-to-jsx`](https://github.com/probablyup/markdown-to-jsx) for flexible and efficient Markdown rendering.
- **Syntax Highlighting**: Integrates with `react-syntax-highlighter` for code block highlighting.
- **PDF Export**: Easily generate a PDF of the currently viewed Markdown page.
- **Live Reload**: Automatically updates the rendered Markdown content when the source file changes, without losing your scroll position.
- **Development Flexibility**: Run server and client independently for development. Enjoy hot reloading from the React dev server at `http://localhost:3000`.

## Getting Started

### Prerequisites

- **Node.js** and **npm** (or **yarn**)

You can verify Node.js is installed by running:
```bash
node -v
```

### Setup

1. **Install Dependencies**:
   ```bash
   npm install
   cd client
   npm install
   cd ..
   ```

2. **Create a `docs` Directory**:
   ```bash
   mkdir docs
   echo "# Hello World" > docs/README.md
   ```

### Running the Project

#### Production-Like Mode
1. **Build the Client App**:
   ```bash
   cd client
   npm run build
   cd ..
   ```
   This creates a production build in `client/build`.

2. **Start the Server**:
   ```bash
   npm start
   ```
   The server starts at `http://localhost:5050` and opens your browser.

#### Development Mode
You can run the server and the React dev server separately for a better development experience:

- **In one terminal (project root)**:
  ```bash
  npm start
  ```
  This starts the server at `http://localhost:5050`.

- **In another terminal (client directory)**:
  ```bash
  cd client
  npm start
  ```
  This starts the React development server at `http://localhost:3000`.

Visiting `http://localhost:3000` now provides hot-reload, enabling faster iterative development and styling tweaks using `markdown-to-jsx`.

## Live Reload

**How It Works:**

1. The server uses `chokidar` to watch for changes in the `./docs` directory.
2. When a Markdown file is modified, the server notifies connected clients using Server-Sent Events (SSE).
3. The client, upon receiving the notification, fetches the updated content if it's currently viewing the changed file.
4. The new content is rendered without a full page reload, maintaining the user's scroll position.

**Benefits:**
- Instant updates: See your changes immediately as you edit Markdown files.
- Seamless experience: No need to manually refresh the page.
- Maintained context: Keeps your scroll position, making it easy to review changes.

## Export to PDF

**How It Works:**

1. Navigate to any Markdown file, for example `http://localhost:5050/README.md`.
2. On the top of the page, you'll find a **"Save to PDF"** button.
3. Clicking this button triggers an API call to the server, where Puppeteer:
    - Launches a headless browser.
    - Loads your current page as it would appear to a user.
    - Hides the "Save to PDF" button (so it doesn't appear in the PDF).
    - Waits for the content to fully render.
    - Exports a clean, styled PDF version of your Markdown content.
4. Your browser will prompt you to download the generated PDF.

**Why is This Awesome?**
- Ensures a pixel-perfect, WYSIWYG-style PDF of your Markdown content.
- Perfect for documentation, articles, guides, or knowledge bases.
- Eliminates the need for separate PDF generation tooling—do it all from the browser.

## How It Works Internally

- **Server (`index.js`)**:
    - Uses `chokidar` to watch for file changes in `./docs`.
    - Implements an SSE endpoint (`/sse`) to notify clients of file changes.
    - `GET /api/markdown`: returns a list of `.md` files in `./docs`.
    - `GET /api/markdown/:file`: returns the contents of a specific `.md` file.
    - `GET /api/export/pdf?file=<filename>.md`: launches Puppeteer, navigates to `<filename>.md`, and returns a PDF of the rendered page.

- **Client (`client/src/App.js`)**:
    - Establishes an SSE connection to receive file change notifications.
    - When a change is detected for the current file:
        1. Stores the current scroll position relative to the closest heading.
        2. Fetches and renders the updated content.
        3. Restores the scroll position after rendering.
    - `/` (root): Fetches `/api/markdown` and displays the list of `.md` files.
    - `/<filename>.md`: Fetches `/api/markdown/<filename>.md` and displays the file's content.
    - "Save to PDF" button: Calls `/api/export/pdf` to retrieve a generated PDF file.

`markdown-to-jsx` provides a simple yet powerful way to customize Markdown rendering through its `options` prop and component overrides system. You can easily add custom components, override default element rendering, and apply custom styling that will be reflected in both the browser view and exported PDFs.

## Customization

- **Adding Markdown Files**: Add `.md` files to `./docs` to make them automatically appear in the listing.
- **URL Paths**: Navigate directly to `/<filename>.md` to view a specific file.
- **Rendering Styles**: Modify `App.js` or add custom components through `markdown-to-jsx`'s `options.overrides` to change the appearance of rendered Markdown.
- **PDF Styles**: Since Puppeteer uses print styles for generating PDFs, you can leverage `@media print` CSS rules to fine-tune the PDF appearance.

## Troubleshooting

- **No Files?** Ensure `.md` files are placed inside `./docs`.
- **File Not Found**: Confirm the filename in the URL matches an existing `.md` file exactly.
- **PDF Generation Issues**: Ensure Puppeteer is installed correctly. Run `npm install puppeteer`. Also, check that Chromium can run in your environment (especially on some Linux servers).
- **Live Reload Not Working**: Ensure the server has read permissions for the `./docs` directory and that file changes are being detected by `chokidar`.

## License

This project is licensed under the [MIT License](./LICENSE).