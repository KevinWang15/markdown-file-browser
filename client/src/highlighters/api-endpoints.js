function apiEndpoints(hljs) {
    return {
        name: 'API Endpoints',
        aliases: [ 'api-endpoints' ],
        keywords: {
            keyword: 'GET POST PUT DELETE PATCH HEAD OPTIONS'
        },
        contains: [
            {
                // Comments: lines starting with '#'
                className: 'comment',
                begin: /^\s*#/,
                end: /$/,
                relevance: 0
            },
            {
                // Slashes in paths
                className: 'punctuation',
                match: /\//
            },
            {
                // JSON block:
                // Detect a line that starts with optional spaces followed by a single '{'
                // and ends with a line that starts with optional spaces followed by '}'
                // Everything in between is considered JSON and will be highlighted as such.
                begin: /^[ ]*\{[ ]*$/,
                end: /^[ ]*\}[ ]*$/,
                // Use JSON as a sub-language. The content will be highlighted according to JSON rules.
                subLanguage: 'json',
                // Make sure not to clash with other rules inside this block
                excludeBegin: true,
                excludeEnd: true
            },
            {
                // Placeholders: {domain}, {app-name}
                className: 'title',
                begin: /\{/,
                end: /\}/
            },
        ]
    };
}

module.exports = apiEndpoints;
