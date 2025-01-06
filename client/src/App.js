import React, {useEffect, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import {Light as SyntaxHighlighter} from 'react-syntax-highlighter';
import {github} from 'react-syntax-highlighter/dist/esm/styles/hljs';
import mermaid from 'mermaid';
import remarkGfm from 'remark-gfm';
import './styles.css';

import * as AllLanguages from 'react-syntax-highlighter/dist/esm/languages/hljs';
import treeview from "./highlighters/treeview";
import pathex from "./highlighters/pathex";
import apiEndpoints from "./highlighters/api-endpoints";

// Initialize mermaid
mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    themeCSS: `
    .node rect { fill: #fff; }
    `,
});

Object.entries(AllLanguages).forEach(([name, language]) => {
    SyntaxHighlighter.registerLanguage(name, language);
});

SyntaxHighlighter.registerLanguage('treeview', treeview);
SyntaxHighlighter.registerLanguage('path-ex', pathex);
SyntaxHighlighter.registerLanguage('api-endpoints', apiEndpoints);

// Mermaid render cache
const mermaidRenderCache = new Map();

// Mermaid rendering component
const MermaidDiagram = ({chart}) => {
    const [svg, setSvg] = useState('');
    const [id] = useState(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        (async () => {
            try {
                // Check cache first
                if (mermaidRenderCache.has(chart)) {
                    console.log('[Mermaid] Using cached render');
                    setSvg(mermaidRenderCache.get(chart));
                    return;
                }

                console.log('[Mermaid] Cache miss, rendering:', id);
                const {svg: renderedSvg} = await mermaid.render(id, chart);

                // Cache the result
                mermaidRenderCache.set(chart, renderedSvg);

                setSvg(renderedSvg);
            } catch (error) {
                console.error('[Mermaid] Render error:', error);
                setSvg(`<pre>Error rendering diagram: ${error.message}</pre>`);
            }
        })();
    }, [chart, id]);

    return <div dangerouslySetInnerHTML={{__html: svg}}/>;
};

function App() {
    const [markdown, setMarkdown] = useState('');
    const [files, setFiles] = useState([]);
    const [loadingPDF, setLoadingPDF] = useState(false);
    const pathname = window.location.pathname;

    // Get XPath of closest heading
    const getClosestHeadingXPath = () => {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let closestHeading = null;
        let minDistance = Infinity;
        let relativePosition = 0;

        headings.forEach(heading => {
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
        console.log('[Scroll] Found closest heading:', {
            xpath,
            relativePosition,
            text: closestHeading.textContent
        });

        return {xpath, relativePosition};
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
        return '/' + parts.join('/');
    };

    // Restore scroll position using XPath
    const restoreScrollPosition = (scrollInfo) => {
        if (!scrollInfo) return;

        console.log('[Scroll] Attempting to restore using:', scrollInfo);

        try {
            const element = document.evaluate(
                scrollInfo.xpath,
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            if (element) {
                const newScrollPosition = element.offsetTop + scrollInfo.relativePosition;
                console.log('[Scroll] Restoring to position:', newScrollPosition);
                window.scrollTo(0, newScrollPosition);
            } else {
                console.log('[Scroll] Target element not found');
            }
        } catch (error) {
            console.log('[Scroll] Error restoring position:', error);
        }
    };

    useEffect(() => {
        if (pathname !== '/') {
            const sse = new EventSource('/sse');

            sse.addEventListener('file-changed', (event) => {
                const changedFileName = event.data;
                const currentFile = pathname.slice(1);

                if (changedFileName === currentFile) {
                    const scrollInfo = getClosestHeadingXPath();
                    console.log('[Refresh] Stored scroll info:', scrollInfo);

                    fetch(`/api/markdown/${currentFile}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.content) {
                                setMarkdown(data.content);

                                // Wait for markdown to be fully rendered
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        console.log('[Render] Content rendered, restoring scroll');
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
        if (pathname === '/') {
            // Fetch the list of files
            fetch('/api/markdown')
                .then(res => res.json())
                .then(data => {
                    setFiles(data.files);
                });
        } else {
            // Fetch the specific file
            const fileName = pathname.slice(1); // remove leading '/'
            fetch(`/api/markdown/${fileName}`)
                .then(res => res.json())
                .then(data => {
                    if (data.content) {
                        setMarkdown(data.content);
                        const titleMatch = data.content.match(/^(.*?)\n---/s);
                        if (titleMatch) {
                            document.title = titleMatch[1].trim();
                        } else {
                            document.title = fileName;
                        }
                    } else {
                        setMarkdown(`# Error\nCould not load ${fileName}`);
                    }
                })
                .catch(() => {
                    setMarkdown(`# Error\nCould not load ${fileName}`);
                });
        }
    }, [pathname]);

    const handleExportPDF = async () => {
        setLoadingPDF(true);
        const fileName = pathname.slice(1);
        try {
            const response = await fetch(`/api/export/pdf?file=${encodeURIComponent(fileName)}`);
            if (!response.ok) {
                alert('Failed to generate PDF');
                setLoadingPDF(false);
                return;
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName.replace('.md', '.pdf');
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('An error occurred while generating PDF');
        }
        setLoadingPDF(false);
    };

    if (pathname === '/') {
        return (
            <div className="container">
                <h1>Available Markdown Files</h1>
                <ul>
                    {files.map(file => (
                        <li key={file}>
                            <a href={`/${file}`}>{file}</a>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{marginBottom: '20px'}}>
                <button className="save-pdf-button" onClick={handleExportPDF} disabled={loadingPDF}>
                    {loadingPDF ? 'Generating PDF...' : 'Save to PDF'}
                </button>
            </div>
            <ReactMarkdown
                children={markdown}
                remarkPlugins={[remarkGfm]}
                components={{
                    code({node, inline, className, children, ...props}) {
                        const match = /language-([\w-]+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        if (!inline) {
                            if (language === 'mermaid') {
                                return <MermaidDiagram chart={String(children).replace(/\n$/, '')}/>;
                            }

                            return (
                                <SyntaxHighlighter language={language} style={github} {...props}>
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            );
                        }

                        return (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            />
        </div>
    );
}

export default App;