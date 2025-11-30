/**
 * Shared base URL utility
 * This script should be included before other scripts to ensure base URL is set correctly
 */

// Set dynamic base URL for GitHub Pages
(function () {
    const { hostname, pathname } = window.location;
    let baseUrl = '/';

    // Check if running on GitHub Pages (username.github.io)
    if (hostname.endsWith('github.io')) {
        // Handle both username.github.io/ and username.github.io/repo-name/ formats
        const pathSegments = pathname.split('/').filter(segment => segment !== '');

        // If this is username.github.io/repo-name format
        if (pathSegments.length > 0) {
            baseUrl = `/${pathSegments[0]}/`;
            console.log(`GitHub Pages detected (repo-based). Base URL set to: ${baseUrl}`);
        } else {
            console.log('GitHub Pages detected (organization/username-based). Base URL: /');
        }
    } else if (pathname !== '/' && pathname.indexOf('.html') === -1) {
        // For any other scenarios, get the path up to the last directory
        baseUrl = pathname.substring(0, pathname.lastIndexOf('/') + 1);
        console.log(`Custom hosting detected. Base URL set to: ${baseUrl}`);
    } else {
        console.log('Local development detected. Base URL: /');
    }

    // Create and append base element
    const base = document.createElement('base');
    base.href = baseUrl;
    document.head.appendChild(base);

    // Make baseUrl available globally
    window.siteBaseUrl = baseUrl;

    console.log(`Base URL configured: ${baseUrl}`);
})();
