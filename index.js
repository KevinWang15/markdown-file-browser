import express from "express";
import path from "path";
import {dirname, join, resolve} from "path";
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
    existsSync,
    renameSync,
    statSync
} from "fs";
import open from "open";
import cors from "cors";
import {fileURLToPath} from "url";
import puppeteer from "puppeteer";
import chokidar from "chokidar";
import * as mermaid from "@mermaid-js/mermaid-cli";
import PQueue from 'p-queue';
import {tmpdir} from "os";
import crypto from 'crypto';

// Create a queue with concurrency limit of 5
const renderQueue = new PQueue({concurrency: 5});

// Ensure cache directory exists
const CACHE_DIR = './cache';
mkdirSync(CACHE_DIR, {recursive: true});

// Calculate SHA-256 checksum of diagram code
function calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// Get cache file path for a checksum
function getCacheFilePath(checksum) {
    return path.join(CACHE_DIR, `${checksum}.png`);
}

// Mermaid render cache using Map
const mermaidCache = new Map();

// Helper function to generate temporary file paths
const getTempFilePaths = () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mermaid-"));
    const inputPath = join(tempDir, "input.mmd");
    const outputPath = join(tempDir, "output.png");
    return {tempDir, inputPath, outputPath};
};

let sseConnections = []; // Will store SSE client connections
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docsDir = resolve(__dirname, "docs");

// Initialize a watcher for your docs directory
const watcher = chokidar.watch(docsDir, {ignoreInitial: true});

// When a file in ./docs changes, notify all SSE clients
watcher.on("change", (filePath) => {
    const changedFile = filePath.split(/[/\\]/).pop(); // just get the filename
    console.log(`[chokidar] File changed: ${changedFile}`);

    // Send event to all SSE clients
    sseConnections.forEach((res) => {
        res.write(`event: file-changed\ndata: ${changedFile}\n\n`);
    });
});

const app = express();

app.use(cors());

// Serve the React build output
app.use(express.static(join(__dirname, "client", "build")));

// Endpoint to list all markdown files
app.get("/api/markdown", (req, res) => {
    const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
    res.json({files});
});

// Endpoint to get a specific markdown file content
app.get("/api/markdown/:file", (req, res) => {
    const {file} = req.params;
    if (!file.endsWith(".md")) {
        return res.status(400).json({error: "File must be a .md file"});
    }
    const filePath = resolve(docsDir, file);
    try {
        const content = readFileSync(filePath, "utf-8");
        res.json({content});
    } catch (error) {
        res.status(404).json({error: "File not found"});
    }
});

// endpoint to export current page as PDF
app.get("/api/export/pdf", async (req, res) => {
    const fileParam = req.query.file;
    if (!fileParam || !fileParam.endsWith(".md")) {
        return res.status(400).json({error: "Invalid file parameter"});
    }

    const urlToRender = `http://localhost:${process.env.PORT || 5050}/${fileParam}#mermaid-server-side-rendering`;

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new", // or true if older version supports
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await page.goto(urlToRender, {waitUntil: "networkidle0"});

        // Instead of page.waitForTimeout(), use a generic timeout:
        await new Promise((resolve) => setTimeout(resolve, 500));
        await page.evaluate(() => {
            const mainContent = document.querySelector("#main-content");
            document.body.innerHTML = "";
            document.body.appendChild(mainContent);
        });
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            selector: "#main-content",
            margin: {
                top: "30px",
                right: "20px",
                bottom: "50px",
                left: "20px",
            },
            displayHeaderFooter: true,
            headerTemplate: "<div></div>", // empty header
            footerTemplate: `  
        <div style="  
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;  
            font-size: 10px;  
            padding-left: 40px;  
            padding-right: 40px;  
            width: 100%;  
            display: flex;  
            justify-content: space-between;   
        ">  
            <div style="color:#666; font-weight: bold">${await page.title()}</div>  
            <div style="opacity: 0.7;color:#AAA" class="pageNumber"></div>  
        </div>  
    `,
        });

        await browser.close();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileParam.replace(".md", ".pdf")}"`,
        );
        // Use res.end to ensure we're sending raw binary:
        res.end(pdfBuffer, "binary");
    } catch (err) {
        if (browser) await browser.close();
        console.error(err);
        res.status(500).json({error: "Failed to generate PDF"});
    }
});

// Endpoint to render mermaid diagrams
app.get("/api/render-mermaid/:encodedDiagram(*)", async (req, res) => {
    try {
        const diagramCode = Buffer.from(
            req.params.encodedDiagram,
            "base64"
        ).toString("utf-8");

        // Calculate checksum for the diagram code
        const checksum = calculateChecksum(diagramCode);
        const cacheFilePath = getCacheFilePath(checksum);

        // Check file cache first
        if (existsSync(cacheFilePath)) {
            console.log("[Mermaid] File cache hit");
            const cachedImage = readFileSync(cacheFilePath);
            res.contentType("image/png");
            res.send(cachedImage);
            return;
        }

        console.log("[Mermaid] Cache miss, queuing render task...");
        console.log(`[Mermaid] Queue size: ${renderQueue.size}, Running: ${renderQueue.pending}`);

        // Add render task to queue
        const renderedImage = await renderQueue.add(async () => {
            console.log("[Mermaid] Starting render from queue...");

            // Create temporary files
            const {tempDir, inputPath, outputPath} = getTempFilePaths();

            try {
                // Write diagram code to input file
                writeFileSync(inputPath, diagramCode);

                // Render using mermaid-cli
                await mermaid.run(inputPath, outputPath, {
                    parseMMDOptions: {
                        viewport: {
                            width: 5000,
                            height: 5000,
                            deviceScaleFactor: 4,
                        },
                    },
                });

                // Verify the output file exists and has content
                const stats = statSync(outputPath);
                if (stats.size === 0) {
                    throw new Error('Generated image is empty');
                }

                // Read the output PNG
                const image = readFileSync(outputPath);

                // Save to cache with atomic write
                const tempCachePath = `${cacheFilePath}.tmp`;
                writeFileSync(tempCachePath, image);
                try {
                    renameSync(tempCachePath, cacheFilePath);
                    console.log('[Mermaid] Successfully saved to file cache');
                } catch (cacheError) {
                    console.error('[Mermaid] Failed to save to cache:', cacheError);
                    try {
                        rmSync(tempCachePath, {force: true});
                    } catch (cleanupError) {
                        console.error('[Mermaid] Failed to cleanup temp cache file:', cleanupError);
                    }
                }

                return image;
            } finally {
                // Clean up temporary files
                try {
                    rmSync(tempDir, {recursive: true});
                } catch (cleanupError) {
                    console.error('[Mermaid] Failed to cleanup temp directory:', cleanupError);
                }
            }
        });

        // Send response
        res.contentType("image/png");
        res.send(renderedImage);
    } catch (error) {
        console.error("[Mermaid] Render error:", error);
        res.status(500).send("Error rendering diagram");
    }
});

app.get("/sse", (req, res) => {
    // Mandatory headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Push this response object into our global array
    sseConnections.push(res);

    // Remove the response when the client disconnects
    req.on("close", () => {
        sseConnections = sseConnections.filter((conn) => conn !== res);
    });
});

// Fallback: serve the React app for any other route
app.get("*", (req, res) => {
    res.sendFile(join(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 5050;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    open(`http://localhost:${port}`);
});
