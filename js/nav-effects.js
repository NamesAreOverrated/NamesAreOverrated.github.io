/**
 * Navigation effects for terminal-style navigation
 */

document.addEventListener('DOMContentLoaded', function () {
    // Ensure current navigation item is highlighted
    const currentLocation = window.location.pathname;
    const navLinks = document.querySelectorAll('nav a');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        // Check if current path ends with the link's href
        if (currentLocation.endsWith(linkPath) ||
            (linkPath === 'index.html' && (currentLocation === '/' || currentLocation.endsWith('/')))) {
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
