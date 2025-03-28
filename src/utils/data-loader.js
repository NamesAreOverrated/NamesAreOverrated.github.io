/**
 * Data loading utility functions
 */

/**
 * Load data from JSON files
 * @param {string} dataType - Type of data to load (projects, tools, etc.)
 * @returns {Promise<Array>} - Array of data items
 */
async function loadData(dataType) {
    try {
        // Get base URL for GitHub Pages compatibility
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}data/${dataType}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load ${dataType} data`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${dataType} data:`, error);
        return [];
    }
}

/**
 * Special function to load blogs from individual files
 * @returns {Promise<Array>} - Array of blog posts
 */
async function loadBlogs() {
    try {
        // Get base URL for GitHub Pages compatibility
        const baseUrl = getBaseUrl();

        // Load from manifest and individual files
        const manifestResponse = await fetch(`${baseUrl}data/blogs/manifest.json`);
        if (!manifestResponse.ok) {
            throw new Error('Failed to load blogs manifest');
        }

        const manifest = await manifestResponse.json();
        const blogPromises = manifest.blogs.map(async (blogFile) => {
            const blogResponse = await fetch(`${baseUrl}data/blogs/${blogFile}`);
            if (!blogResponse.ok) {
                console.error(`Failed to load blog: ${blogFile}`);
                return null;
            }

            // Handle Markdown files
            if (blogFile.endsWith('.md')) {
                const markdownContent = await blogResponse.text();
                return parseBlogMarkdown(markdownContent, blogFile);
            }
            // Handle JSON files
            else {
                return await blogResponse.json();
            }
        });

        // Wait for all blog files to be loaded
        const blogs = await Promise.all(blogPromises);
        // Filter out any nulls (failed loads)
        return blogs.filter(blog => blog !== null);
    } catch (error) {
        console.error('Error loading blogs:', error);
        return [];
    }
}

/**
 * Helper function to get the base URL considering GitHub Pages deployment
 * @returns {string} - Base URL
 */
function getBaseUrl() {
    const pathname = window.location.pathname;
    // Check if deployed on GitHub Pages (will have format /{repo-name}/)
    if (pathname.match(/^\/[^/]+\/$/)) {
        // Already has trailing slash
        return pathname;
    }
    // Path contains repo name but no trailing slash
    else if (pathname !== '/' && !pathname.endsWith('/')) {
        const pathWithoutFile = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        // Handle case when viewing from a subdirectory
        if (pathWithoutFile !== '/') {
            return pathWithoutFile;
        }
    }
    // Local development or root deployment
    return '/';
}

/**
 * Parse Markdown blog post with YAML frontmatter
 * @param {string} markdown - Markdown content
 * @param {string} filename - Filename for generating ID if needed
 * @returns {Object} - Parsed blog post object
 */
function parseBlogMarkdown(markdown, filename) {
    try {
        // Extract YAML frontmatter between --- markers
        const frontMatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);

        if (!frontMatterMatch) {
            console.error(`No valid frontmatter found in ${filename}`);
            return null;
        }

        const frontMatter = frontMatterMatch[1];
        const content = markdown.slice(frontMatterMatch[0].length);

        // Parse frontmatter (improved version)
        const metadata = {};
        const lines = frontMatter.split('\n');

        let currentKey = null;
        let isMultiline = false;
        let multilineValue = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip empty lines
            if (!line) continue;

            // Handle multiline values
            if (isMultiline) {
                // Check if multiline value ends
                if (line === '"""' || line === "'''") {
                    metadata[currentKey] = multilineValue;
                    isMultiline = false;
                    multilineValue = '';
                    continue;
                }
                multilineValue += (multilineValue ? '\n' : '') + line;
                continue;
            }

            // Handle arrays like categories
            if (line.startsWith('- ') && currentKey && Array.isArray(metadata[currentKey])) {
                metadata[currentKey].push(line.substring(2).trim());
                continue;
            }

            // Regular key-value pairs
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                currentKey = line.slice(0, colonIndex).trim();
                let value = line.slice(colonIndex + 1).trim();

                // Check for multiline values
                if (value === '"""' || value === "'''") {
                    isMultiline = true;
                    multilineValue = '';
                    continue;
                }

                // Handle special case for arrays declaration
                if (value === '') {
                    metadata[currentKey] = [];
                }
                // Handle booleans
                else if (value === 'true' || value === 'false') {
                    metadata[currentKey] = value === 'true';
                }
                // Handle numbers
                else if (!isNaN(value) && value !== '') {
                    metadata[currentKey] = Number(value);
                }
                // Regular strings (remove quotes if present)
                else {
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        metadata[currentKey] = value.slice(1, -1);
                    } else {
                        metadata[currentKey] = value;
                    }
                }
            }
        }

        // Generate a unique ID if not provided
        if (!metadata.id) {
            metadata.id = filename.replace(/\.md$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        }

        // Fix image paths in the markdown content for GitHub Pages
        const baseUrl = getBaseUrl();
        if (baseUrl !== '/' && content.includes('](')) {
            // Fix image and link paths in markdown that aren't absolute URLs
            content = content.replace(/\]\((?!http|https|ftp)([^)]+)\)/g,
                (match, path) => `](${baseUrl}${path.startsWith('/') ? path.substring(1) : path})`);
        }

        // Add Markdown content and convert to HTML for display
        metadata.content = content;
        metadata.htmlContent = markdownToHtml(content);

        // Create link if not provided
        if (!metadata.link) {
            metadata.link = `#/blog/${metadata.id}`;
        }

        return metadata;
    } catch (error) {
        console.error(`Error parsing Markdown for ${filename}:`, error);
        return null;
    }
}

/**
 * Simple Markdown to HTML converter
 * @param {string} markdown - Markdown content
 * @returns {string} - HTML content
 */
function markdownToHtml(markdown) {
    let html = markdown
        // Convert headers
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        // Convert bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Convert links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Convert code blocks
        .replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>')
        // Convert inline code
        .replace(/`([^`]*?)`/g, '<code>$1</code>')
        // Convert lists
        .replace(/^\s*\* (.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>')
        // Convert paragraphs
        .replace(/^(?!<[uo]l>|<li>|<h[1-6]>|<pre>)(.*$)/gm, '<p>$1</p>');

    return html;
}

/**
 * Helper function to normalize filenames and titles for URL compatibility
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
function normalizeFilename(str) {
    return str.toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .replace(/--+/g, '-')     // Replace multiple hyphens with a single one
        .trim();
}

// Calculate estimated read time
function calculateReadTime(content) {
    // Average reading speed: 200 words per minute
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    return readingTime < 1 ? 1 : readingTime;
}

export {
    loadData,
    loadBlogs,
    getBaseUrl,
    normalizeFilename,
    calculateReadTime
};
