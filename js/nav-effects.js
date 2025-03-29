/**
 * Navigation effects for terminal-style navigation
 */

document.addEventListener('DOMContentLoaded', function () {
    // Get base URL for GitHub Pages compatibility
    const baseUrl = window.siteBaseUrl || '/';

    // Store original link texts to avoid issues with typing effect
    const originalLinkTexts = {};
    document.querySelectorAll('nav a').forEach(link => {
        originalLinkTexts[link.getAttribute('href')] = link.textContent;
    });

    // Update navigation links based on current hash
    function updateNavLinks() {
        const currentHash = window.location.hash;
        console.log('Current hash:', currentHash);

        const navLinks = document.querySelectorAll('nav a');

        navLinks.forEach(link => {
            // First, restore original text to avoid partial text issues
            const linkPath = link.getAttribute('href');
            link.textContent = originalLinkTexts[linkPath];

            console.log('Checking link:', linkPath);

            // Handle hash-based routes
            const isActive =
                // Home path match
                (linkPath === '#/' && (currentHash === '' || currentHash === '#/' || currentHash === '#')) ||
                // Exact hash match for other pages
                (linkPath === currentHash) ||
                // Partial match for sub-routes (like #/blog/something)
                (linkPath !== '#/' && currentHash.startsWith(linkPath));

            if (isActive) {
                console.log('Setting active class for:', linkPath);
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    // Call on page load
    updateNavLinks();

    // Also call when hash changes
    window.addEventListener('hashchange', updateNavLinks);
});
