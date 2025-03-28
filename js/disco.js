/**
 * Disco mode functionality
 */

// Function to create and append the disco toggle button
function initDiscoMode() {
    // Create the toggle button
    const discoButton = document.createElement('button');
    discoButton.className = 'disco-toggle';
    discoButton.innerHTML = '🪩';
    discoButton.title = 'Toggle Club Mode';
    document.body.appendChild(discoButton);

    // Check if disco mode was previously enabled
    const discoEnabled = localStorage.getItem('discoMode') === 'true';

    // Beat visualization elements for the disco button
    const visualizerContainer = document.createElement('div');
    visualizerContainer.className = 'beat-visualizer';
    visualizerContainer.style.cssText = `
        position: absolute; 
        top: 50%; 
        left: 50%; 
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    for (let i = 0; i < 3; i++) {
        const bar = document.createElement('div');
        bar.style.cssText = `
            width: 3px;
            height: 15px;
            margin: 0 2px;
            background: white;
            animation: beat-pulse ${2 + i * 0.3}s ease-in-out infinite alternate; /* Slower animation - increased from 1+i*0.15 to 2+i*0.3 */
        `;
        visualizerContainer.appendChild(bar);
    }

    discoButton.appendChild(visualizerContainer);

    // Create and add the beat animation
    const styleSheet = document.createElement('style');
    styleSheet.innerHTML = `
        @keyframes beat-pulse {
            0% { height: 5px; opacity: 0.7; }
            100% { height: 15px; opacity: 1; }
        }
    `;
    document.head.appendChild(styleSheet);

    // Apply disco mode if it was enabled
    if (discoEnabled) {
        document.body.classList.add('disco-mode');
        discoButton.classList.add('active');
        visualizerContainer.style.opacity = '1';
    }

    // Track user interaction to enable audio
    document.addEventListener('click', function userInteraction() {
        document.documentElement.setAttribute('data-user-interacted', 'true');
        document.removeEventListener('click', userInteraction);
    }, { once: true });

    // Add toggle functionality
    discoButton.addEventListener('click', () => {
        // Toggle the disco mode class on body
        document.body.classList.toggle('disco-mode');
        discoButton.classList.toggle('active');

        // Toggle visualizer
        visualizerContainer.style.opacity = discoButton.classList.contains('active') ? '1' : '0';


        // Save preference in localStorage
        const isDiscoMode = document.body.classList.contains('disco-mode');
        localStorage.setItem('discoMode', isDiscoMode);
    });
}

// Initialize disco mode when the page is loaded
document.addEventListener('DOMContentLoaded', initDiscoMode);

// Re-apply disco mode when navigating between pages
document.addEventListener('hashchange', () => {
    const discoEnabled = localStorage.getItem('discoMode') === 'true';

    if (discoEnabled) {
        document.body.classList.add('disco-mode');
        const discoToggle = document.querySelector('.disco-toggle');
        if (discoToggle) {
            discoToggle.classList.add('active');
            discoToggle.querySelector('.beat-visualizer').style.opacity = '1';
        }


    } else {
        document.body.classList.remove('disco-mode');
        const discoToggle = document.querySelector('.disco-toggle');
        if (discoToggle) {
            discoToggle.classList.remove('active');
            discoToggle.querySelector('.beat-visualizer').style.opacity = '0';
        }


    }
});
