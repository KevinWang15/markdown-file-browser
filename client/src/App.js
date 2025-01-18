import React, { useEffect, useState } from "react";
import Markdown from "markdown-to-jsx";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { github } from "react-syntax-highlighter/dist/esm/styles/hljs";
import mermaid from "mermaid";
import { Tooltip } from "react-tooltip";
import "./styles.css";
import * as AllLanguages from "react-syntax-highlighter/dist/esm/languages/hljs";
import treeview from "./highlighters/treeview";
import pathex from "./highlighters/pathex";
import apiEndpoints from "./highlighters/api-endpoints";
import { Download, Loader, Menu } from "lucide-react";
import frontMatter from "front-matter";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  securityLevel: "loose",
  themeCSS: `
    .node rect { fill: #fff; }
    `,
});

Object.entries(AllLanguages).forEach(([name, language]) => {
  SyntaxHighlighter.registerLanguage(name, language);
});

SyntaxHighlighter.registerLanguage("treeview", treeview);
SyntaxHighlighter.registerLanguage("path-ex", pathex);
SyntaxHighlighter.registerLanguage("api-endpoints", apiEndpoints);

// Mermaid render cache
const mermaidRenderCache = new Map();

// Mermaid rendering component
const MermaidDiagram = ({ chart }) => {
  const [svg, setSvg] = useState("");
  const [id] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    (async () => {
      try {
        // Check cache first
        if (mermaidRenderCache.has(chart)) {
          console.log("[Mermaid] Using cached render");
          setSvg(mermaidRenderCache.get(chart));
          return;
        }

        console.log("[Mermaid] Cache miss, rendering:", id);
        const { svg: renderedSvg } = await mermaid.render(id, chart);

        // Cache the result
        mermaidRenderCache.set(chart, renderedSvg);

        setSvg(renderedSvg);
      } catch (error) {
        console.error("[Mermaid] Render error:", error);
        setSvg(`<pre>Error rendering diagram: ${error.message}</pre>`);
      }
    })();
  }, [chart, id]);

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
};

// Code block component
const CodeBlock = ({ className, children }) => {
  // Check if this is a code block by detecting if children contains newlines
  // This helps distinguish between inline code and code blocks without language specification
  const isCodeBlock = typeof children === 'string' && children.includes('\n');

  if(!isCodeBlock){
    return <code>{children}</code>;
  }

  const language = className ? className.replace("lang-", "") : "";

  if (language === "mermaid") {
    return <MermaidDiagram chart={children} />;
  }

  return (
    <SyntaxHighlighter language={language} style={github}>
      {children}
    </SyntaxHighlighter>
  );
};

// TOC Overlay Component
const TOCOverlay = ({ toc, onNavigate, currentSection }) => {
  return (
    <div
      className="toc-overlay"
      role="navigation"
      aria-label="Table of Contents"
    >
      <h3>Table of Contents</h3>
      <ul>
        {toc.map((item, index) => (
          <li
            key={index}
            className={`toc-item level-${item.level} ${currentSection === item.id ? "active" : ""}`}
          >
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.node);
              }}
              tabIndex="0"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

function App() {
  const [markdown, setMarkdown] = useState("");
  const [metadata, setMetadata] = useState({});
  const [files, setFiles] = useState([]);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const pathname = window.location.pathname;

  const [toc, setToc] = useState([]);
  const [currentSection, setCurrentSection] = useState(null);

  // Get XPath of closest heading
  const getClosestHeadingXPath = () => {
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let closestHeading = null;
    let minDistance = Infinity;
    let relativePosition = 0;

    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      const distance = Math.abs(rect.top);
      if (distance < minDistance) {
        minDistance = distance;
        closestHeading = heading;
        relativePosition = window.scrollY - heading.offsetTop;
      }
    });

    if (!closestHeading) return null;

    // Generate XPath
    const xpath = getXPath(closestHeading);
    console.log("[Scroll] Found closest heading:", {
      xpath,
      relativePosition,
      text: closestHeading.textContent,
    });

    return { xpath, relativePosition };
  };

  // Generate XPath for an element
  const getXPath = (element) => {
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let idx = 0;
      let sibling = element;
      while (sibling) {
        if (sibling.nodeName === element.nodeName) idx++;
        sibling = sibling.previousElementSibling;
      }
      const tagName = element.nodeName.toLowerCase();
      parts.unshift(`${tagName}[${idx}]`);
      element = element.parentNode;
    }
    return "/" + parts.join("/");
  };

  // Restore scroll position using XPath
  const restoreScrollPosition = (scrollInfo) => {
    if (!scrollInfo) return;

    console.log("[Scroll] Attempting to restore using:", scrollInfo);

    try {
      const element = document.evaluate(
        scrollInfo.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue;

      if (element) {
        const newScrollPosition =
          element.offsetTop + scrollInfo.relativePosition;
        console.log("[Scroll] Restoring to position:", newScrollPosition);
        window.scrollTo(0, newScrollPosition);
      } else {
        console.log("[Scroll] Target element not found");
      }
    } catch (error) {
      console.log("[Scroll] Error restoring position:", error);
    }
  };

  useEffect(() => {
    if (pathname !== "/") {
      if (navigator.webdriver) {
        // if running inside puppeteer
        return;
      }

      const sse = new EventSource("/sse");

      sse.addEventListener("file-changed", (event) => {
        const changedFileName = event.data;
        const currentFile = pathname.slice(1);

        if (changedFileName === currentFile) {
          const scrollInfo = getClosestHeadingXPath();
          console.log("[Refresh] Stored scroll info:", scrollInfo);

          fetch(`/api/markdown/${currentFile}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.content) {
                // Parse the front matter using front-matter
                const parsed = frontMatter(data.content);

                // Set the document title from front matter or default to file name
                if (parsed.attributes && parsed.attributes.title) {
                  document.title = parsed.attributes.title;
                  setMetadata(parsed.attributes);
                } else {
                  document.title = currentFile;
                  setMetadata({});
                }

                // Set the markdown content without front matter
                setMarkdown(parsed.body);

                // Wait for markdown to be fully rendered
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    console.log("[Render] Content rendered, restoring scroll");
                    restoreScrollPosition(scrollInfo);
                  });
                });
              }
            });
        }
      });

      return () => {
        sse.close();
      };
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/") {
      // Fetch the list of files
      fetch("/api/markdown")
        .then((res) => res.json())
        .then((data) => {
          setFiles(data.files);
        });
    } else {
      // Fetch the specific file
      const fileName = pathname.slice(1); // remove leading '/'
      fetch(`/api/markdown/${fileName}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.content) {
            // Parse the front matter using front-matter
            const parsed = frontMatter(data.content);

            // Set the document title from front matter or default to file name
            if (parsed.attributes && parsed.attributes.title) {
              document.title = parsed.attributes.title;
              setMetadata(parsed.attributes); // Store metadata
            } else {
              document.title = fileName;
              setMetadata({});
            }

            // Set the markdown content without front matter
            setMarkdown(parsed.body);
          } else {
            setMarkdown(`# Error\nCould not load ${fileName}`);
            setMetadata({});
          }
        });
    }
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const mainContent = document.getElementById("main-content");
      if (!mainContent) {
        return;
      }

      const headings = mainContent.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const scrollPosition = window.scrollY + 100; // Adjust as needed

      let current = null;

      headings.forEach((heading) => {
        if (heading.offsetTop <= scrollPosition) {
          current = heading.id;
        }
      });

      if (current !== currentSection) {
        setCurrentSection(current);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [currentSection]);

  // Extract TOC from rendered HTML using ref
  useEffect(() => {
    const extractTOC = () => {
      const mainContent = document.getElementById("main-content");

      if (!mainContent) return;
      const headings = mainContent.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const tocItems = [];

      headings.forEach((heading) => {
        const level = parseInt(heading.tagName.substring(1));
        const text = heading.textContent;
        tocItems.push({ level, text, node: heading });
      });

      setToc(tocItems);
    };

    extractTOC();
  }, [markdown]); // Run whenever markdown changes

  useEffect(() => {
    const updateActiveTOC = () => {
      let activeIndex = -1;
      const threshold = 100; // Adjust threshold as needed

      for (let i = 0; i < toc.length; i++) {
        const { node } = toc[i];
        const rect = node.getBoundingClientRect();

        if (rect.top <= threshold) {
          activeIndex = i;
        } else {
          break;
        }
      }

      // Remove 'active' class from all ToC items
      const tocRoot = document.getElementsByClassName("toc-overlay")[0];
      if (!tocRoot) {
        return;
      }
      const tocListItems = tocRoot.querySelectorAll(".toc-item");
      tocListItems.forEach((item) => item.classList.remove("active"));

      // Add 'active' class to the current ToC item
      if (activeIndex !== -1 && tocListItems[activeIndex]) {
        tocListItems[activeIndex].classList.add("active");
      }
    };

    // Set up setInterval to check active heading every 100ms
    const intervalId = setInterval(() => {
      updateActiveTOC();
    }, 100);

    // Initial call to set active ToC item
    updateActiveTOC();

    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [toc]);

  const handleNavigate = (node) => {
    if (node) {
      const mainContent = document.getElementById("main-content");
      mainContent.scrollTo({
        top:
          node.getBoundingClientRect().top + node.parentElement.scrollTop - 20,
        behavior: "smooth",
      });
    }
  };

  const handleExportPDF = async () => {
    setLoadingPDF(true);
    const fileName = pathname.slice(1);
    try {
      const response = await fetch(
        `/api/export/pdf?file=${encodeURIComponent(fileName)}`,
      );
      if (!response.ok) {
        alert("Failed to generate PDF");
        setLoadingPDF(false);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(".md", ".pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("An error occurred while generating PDF");
    }
    setLoadingPDF(false);
  };

  if (pathname === "/") {
    return (
      <div className="container">
        <h1>Available Markdown Files</h1>
        <ul>
          {files.map((file) => (
            <li key={file}>
              <a href={`/${file}`}>{file}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Side Button Bar */}
      <div className="side-button-bar">
        {toc.length > 0 && (
          <div className="toc-button-container">
            <button className="toc-button">
              <Menu size={24} />
            </button>
            <div className="toc-overlay-container">
              <TOCOverlay
                toc={toc}
                onNavigate={handleNavigate}
                currentSection={currentSection}
              />
            </div>
          </div>
        )}

        {/* Save PDF Button */}
        <button
          className="save-pdf-button"
          onClick={handleExportPDF}
          disabled={loadingPDF}
          data-tooltip-id="save-pdf-button"
          data-tooltip-content="Save to PDF"
        >
          {loadingPDF ? (
            <Loader className="spinner" size={24} />
          ) : (
            <Download size={24} />
          )}
        </button>
        <Tooltip id="save-pdf-button" />
      </div>

      {/* Main Content */}
      <div id="main-content">
        {metadata.title && <h1 className="document-title">{metadata.title}</h1>}
        <Markdown
          options={{
            overrides: {
              code: {
                component: CodeBlock,
              },
            },
          }}
        >
          {markdown}
        </Markdown>
      </div>
    </div>
  );
}

export default App;
