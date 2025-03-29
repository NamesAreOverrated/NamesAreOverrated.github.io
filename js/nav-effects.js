/**
 * Navigation effects for terminal-style navigation
 */

document.addEventListener('DOMContentLoaded', function () {
    // Get base URL for GitHub Pages compatibility
    const baseUrl = window.siteBaseUrl || '/';

    // Ensure current navigation item is highlighted
    const currentLocation = window.location.pathname;
    console.log('Current location:', currentLocation, 'Base URL:', baseUrl);

    const navLinks = document.querySelectorAll('nav a');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        console.log('Checking link:', linkPath);

        // Enhanced path matching for GitHub Pages - account for repo name in path
        const isActive =
            // Direct path match
            currentLocation.endsWith(linkPath) ||
            // Index page variations
            (linkPath === 'index.html' && (currentLocation === '/' || currentLocation.endsWith('/') || currentLocation.endsWith('/index.html'))) ||
            // Special case for habit tracker
            (linkPath.includes('habit-tracker') && currentLocation.includes('habit-tracker')) ||
            // Hash-based routing match for the home page
            (linkPath === '#/' && (currentLocation === '/' || currentLocation.endsWith('/') || currentLocation.endsWith('/index.html')));

        if (isActive) {
            console.log('Setting active class for:', linkPath);
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Add typing effect to the active link text
    const activeLink = document.querySelector('nav a.active');
    if (activeLink) {
        const originalText = activeLink.textContent;
        activeLink.textContent = '';

        let i = 0;
        const typeInterval = setInterval(() => {
            if (i < originalText.length) {
                activeLink.textContent += originalText.charAt(i);
                i++;
            } else {
                clearInterval(typeInterval);
            }
        }, 50);
    }
});
