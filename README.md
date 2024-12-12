# Markdown File Browser

This project allows you to browse and view multiple Markdown files stored in a `./docs` directory, and now **export the currently viewed Markdown file as a PDF** via a single click!

## Major Features

- **File Listing**: Automatically list all `.md` files in `./docs` when visiting the root URL `/`.
- **Markdown Rendering**: Uses [`react-markdown`](https://github.com/remarkjs/react-markdown) for flexible and customizable Markdown rendering.
- **Syntax Highlighting**: Integrates with `react-syntax-highlighter` for code block highlighting.
- **PDF Export**: Easily generate a PDF of the currently viewed Markdown page. This feature uses Puppeteer to render the page headlessly, ensuring the PDF looks just like what you see in the browser—except the "Save to PDF" button is automatically hidden to produce a clean, professional PDF.
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

Visiting `http://localhost:3000` now provides hot-reload, enabling faster iterative development and styling tweaks using `react-markdown`.

### New: Export to PDF

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

### How It Works Internally

- **Server (`index.js`)**:
    - `GET /api/markdown`: returns a list of `.md` files in `./docs`.
    - `GET /api/markdown/:file`: returns the contents of a specific `.md` file.
    - **`GET /api/export/pdf?file=<filename>.md`**: launches Puppeteer, navigates to `<filename>.md`, and returns a PDF of the rendered page.

- **Client (`client/src/App.js`)**:
    - `/` (root): Fetches `/api/markdown` and displays the list of `.md` files.
    - `/<filename>.md`: Fetches `/api/markdown/<filename>.md` and displays the file’s content.
    - **"Save to PDF" button**: Calls `/api/export/pdf` to retrieve a generated PDF file.

Because we use `react-markdown`, you can customize the Markdown rendering extensively. Add custom renderers, plugins, or styling to achieve the desired look, which will also be reflected in the exported PDF.

### Customization

- **Adding Markdown Files**: Add `.md` files to `./docs` to make them automatically appear in the listing.
- **URL Paths**: Navigate directly to `/<filename>.md` to view a specific file.
- **Rendering Styles**: Modify `App.js` or add `react-markdown` plugins and custom renderers to change the appearance of rendered Markdown.
- **PDF Styles**: Since Puppeteer uses print styles for generating PDFs, you can leverage `@media print` CSS rules to fine-tune the PDF appearance.

### Troubleshooting

- **No Files?** Ensure `.md` files are placed inside `./docs`.
- **File Not Found**: Confirm the filename in the URL matches an existing `.md` file exactly.
- **PDF Generation Issues**: Ensure Puppeteer is installed correctly. Run `npm install puppeteer`. Also, check that Chromium can run in your environment (especially on some Linux servers).
- **Binary PDF Output**: We return the PDF as binary data. Make sure you’re not trying to parse it as JSON.

### License

This project is licensed under the [MIT License](./LICENSE).