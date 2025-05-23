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

// Update navigation active states based on current hash
function updateNavActiveStates() {
    const currentHash = window.location.hash || '#/';
    const navLinks = document.querySelectorAll('nav a');

    // Remove active class from all links
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to current link
    const activeLink = document.querySelector(`nav a[href="${currentHash}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    } else if (currentHash === '#/') {
        // Default to home if no match
        const homeLink = document.querySelector('nav a[href="#/"]');
        if (homeLink) homeLink.classList.add('active');
    }
}

// Update on page load and when hash changes
document.addEventListener('DOMContentLoaded', updateNavActiveStates);
window.addEventListener('hashchange', updateNavActiveStates);
