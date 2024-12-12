function treeview(hljs) {
    // Common line characters used by `tree`
    const BRANCH_CHARS = {
        className: 'punctuation',
        variants: [
            { begin: /[├└]──/ },  // Matches "├──" or "└──"
            { begin: /│/ },       // Vertical line
            { begin: /┌|┐|└|┘|─/ } // Any other line-drawing chars you might use
        ]
    };

    // Match directory names (heuristic: lines often end with a slash)
    const DIRECTORY = {
        className: 'title',
        begin: /[^\s]+\/$/,
        end: /$/,
        excludeEnd: true
    };

    // Match file names (simple heuristic: match word chars and dots, highlight file names)
    // You can refine this to highlight certain extensions differently.
    const FILE = {
        className: 'string',
        begin: /[^\s]+(\.[A-Za-z0-9]+)?$/,
        end: /$/,
        excludeEnd: true,
        relevance: 0
    };

    // Leading spaces for indentation
    const INDENTATION = {
        className: 'comment',
        begin: /^[ ]+/,
        relevance: 0
    };

    return {
        name: 'Treeview',
        aliases: [ 'treeview' ],
        contains: [
            // We match indentation first, then branch chars, then directories/files.
            INDENTATION,
            BRANCH_CHARS,
            DIRECTORY,
            FILE
        ]
    };
}

module.exports = treeview;
