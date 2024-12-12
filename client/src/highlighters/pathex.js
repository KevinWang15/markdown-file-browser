function pathex(hljs) {
    const PLACEHOLDER = {
        className: 'title',
        begin: /\{/,
        end: /\}/
    };


    const SLASH = {
        className: 'comment',
        match: /\//
    };


    return {
        name: 'Path Expression',
        aliases: [ 'pathex' ],
        contains: [
            SLASH,
            PLACEHOLDER
        ]
    };
}

module.exports = pathex;
