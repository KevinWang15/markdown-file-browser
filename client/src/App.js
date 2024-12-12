import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import './styles.css';

import * as AllLanguages from 'react-syntax-highlighter/dist/esm/languages/hljs';
import treeview from "./highlighters/treeview";
import pathex from "./highlighters/pathex";
import apiEndpoints from "./highlighters/api-endpoints";

Object.entries(AllLanguages).forEach(([name, language]) => {
    SyntaxHighlighter.registerLanguage(name, language);
});

SyntaxHighlighter.registerLanguage('treeview', treeview);
SyntaxHighlighter.registerLanguage('path-ex', pathex);
SyntaxHighlighter.registerLanguage('api-endpoints', apiEndpoints);

function App() {
    const [markdown, setMarkdown] = useState('');
    const [files, setFiles] = useState([]);
    const [loadingPDF, setLoadingPDF] = useState(false);
    const pathname = window.location.pathname;

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
        const fileName = pathname.slice(1); // e.g. 'README.md'
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
            <div style={{ marginBottom: '20px' }}>
                <button className="save-pdf-button" onClick={handleExportPDF} disabled={loadingPDF}>
                    {loadingPDF ? 'Generating PDF...' : 'Save to PDF'}
                </button>
            </div>
            <ReactMarkdown
                children={markdown}
                components={{
                    code({node, inline, className, children, ...props}) {
                        const match = /language-([\w-]+)/.exec(className || '');
                        return !inline && match ? (
                            <SyntaxHighlighter language={match[1]} style={github} {...props}>
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
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
