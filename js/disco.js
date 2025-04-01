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

    // Track visualizer state across disco mode toggles
    let wasVisualizerActive = false;

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

    // Create mic access button
    const micButton = document.createElement('button');
    micButton.className = 'mic-toggle';
    micButton.innerHTML = '🎙️';
    micButton.title = 'Enable Visualizer (Requires Microphone)';
    micButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 80px;
        background-color: #222;
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        opacity: 0;
        pointer-events: none;
    `;
    document.body.appendChild(micButton);

    // Create visualization type switcher
    const visualizerTypeButton = document.createElement('button');
    visualizerTypeButton.className = 'viz-toggle';
    visualizerTypeButton.innerHTML = '📊';
    visualizerTypeButton.title = 'Change Visualization Type';
    visualizerTypeButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 140px;
        background-color: #222;
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        opacity: 0;
        pointer-events: none;
    `;
    document.body.appendChild(visualizerTypeButton);

    // Create visualization name tooltip
    const vizTooltip = document.createElement('div');
    vizTooltip.className = 'viz-tooltip';
    vizTooltip.textContent = 'Bars';
    vizTooltip.style.cssText = `
        position: fixed;
        bottom: 75px;
        right: 140px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 1000;
    `;
    document.body.appendChild(vizTooltip);

    // Apply disco mode if it was enabled
    if (discoEnabled) {
        document.body.classList.add('disco-mode');
        discoButton.classList.add('active');
        visualizerContainer.style.opacity = '1';
        micButton.style.opacity = '1';
        micButton.style.pointerEvents = 'auto';

        // Only show visualizer type button if visualizer is actually active
        const isVisualizerActive = window.AudioVisualizer && window.AudioVisualizer.active;
        visualizerTypeButton.style.opacity = isVisualizerActive ? '1' : '0';
        visualizerTypeButton.style.pointerEvents = isVisualizerActive ? 'auto' : 'none';
    }

    // Track user interaction to enable audio
    document.addEventListener('click', function userInteraction() {
        document.documentElement.setAttribute('data-user-interacted', 'true');
        document.removeEventListener('click', userInteraction);
    }, { once: true });

    // Add toggle functionality for disco mode
    discoButton.addEventListener('click', () => {
        // Check if visualizer is active before toggling
        if (window.AudioVisualizer && window.AudioVisualizer.active) {
            wasVisualizerActive = true;
        } else {
            wasVisualizerActive = false;
        }

        // Toggle the disco mode class on body
        document.body.classList.toggle('disco-mode');
        discoButton.classList.toggle('active');

        // Toggle visualizer
        visualizerContainer.style.opacity = discoButton.classList.contains('active') ? '1' : '0';

        // Toggle mic button visibility
        const isDiscoMode = document.body.classList.contains('disco-mode');
        micButton.style.opacity = isDiscoMode ? '1' : '0';
        micButton.style.pointerEvents = isDiscoMode ? 'auto' : 'none';

        // Toggle voice analyzer button visibility
        const voiceToggle = document.querySelector('.voice-toggle');
        if (voiceToggle) {
            // If turning off disco mode, hide voice analyzer panel too
            if (!isDiscoMode) {
                const voicePanel = document.querySelector('.voice-analyzer-panel');
                if (voicePanel) {
                    voicePanel.style.display = 'none';
                }

                // Stop voice analysis if it's running
                if (window.voiceAnalyzer && window.voiceAnalyzer.analyzing) {
                    window.voiceAnalyzer.stopAnalysis();
                }
            }
        }

        // Only show visualizer type button if disco mode is on AND visualizer is active
        const isVisualizerActive = window.AudioVisualizer && window.AudioVisualizer.active;
        visualizerTypeButton.style.opacity = isDiscoMode && isVisualizerActive ? '1' : '0';
        visualizerTypeButton.style.pointerEvents = isDiscoMode && isVisualizerActive ? 'auto' : 'none';

        // Stop audio visualizer if disco mode is turned off
        if (!isDiscoMode && window.AudioVisualizer) {
            if (window.AudioVisualizer.active) {
                window.AudioVisualizer.stop();
                // Remember that we were active, but update button state to match current state
                micButton.classList.remove('active');
                micButton.innerHTML = '🎙️';
                micButton.title = 'Enable Audio Visualization';
            }
        } else if (isDiscoMode && wasVisualizerActive && window.AudioVisualizer && window.AudioVisualizer.microphone) {
            // Restart visualizer if it was active before and we have microphone permissions
            window.AudioVisualizer.start();
            micButton.classList.add('active');
            micButton.innerHTML = '🔊';
            micButton.title = 'Disable Audio Visualization';
        }

        // Save preference in localStorage
        localStorage.setItem('discoMode', isDiscoMode);
    });

    // Add event listener for microphone button
    micButton.addEventListener('click', async () => {
        // Initialize audio visualizer if needed
        if (window.AudioVisualizer) {
            if (!window.AudioVisualizer.initialized) {
                const initialized = await window.AudioVisualizer.init();
                if (!initialized) {
                    alert('Could not initialize audio visualizer. Please check console for errors.');
                    return;
                }
            }

            // Request microphone access if not already granted
            if (!window.AudioVisualizer.microphone) {
                alert('Note: Browsers cannot directly access your system audio. The visualizer will use your microphone to capture ambient sound.');
                const micAccessGranted = await window.AudioVisualizer.requestMicrophoneAccess();
                if (!micAccessGranted) {
                    alert('Microphone access is required for audio visualization.');
                    return;
                }
                micButton.classList.add('active');
                micButton.innerHTML = '🔊';
                micButton.title = 'Disable Audio Visualization';

                // Start visualization
                window.AudioVisualizer.start();
            } else {
                // Toggle visualization state
                if (window.AudioVisualizer.active) {
                    window.AudioVisualizer.stop();
                    micButton.classList.remove('active');
                    micButton.innerHTML = '🎙️';
                    micButton.title = 'Enable Audio Visualization';
                } else {
                    window.AudioVisualizer.start();
                    micButton.classList.add('active');
                    micButton.innerHTML = '🔊';
                    micButton.title = 'Disable Audio Visualization';
                }
            }

            // Show visualizer type button when visualizer is active
            visualizerTypeButton.style.opacity = window.AudioVisualizer.active ? '1' : '0';
            visualizerTypeButton.style.pointerEvents = window.AudioVisualizer.active ? 'auto' : 'none';
        } else {
            console.error('AudioVisualizer not found. Make sure audio-visualizer.js is loaded.');
            alert('Audio visualization is not available. Please check console for errors.');
        }
    });

    // Add event listener for visualizer type button
    visualizerTypeButton.addEventListener('click', () => {
        if (window.AudioVisualizer && window.AudioVisualizer.active) {
            // Switch to next visualization type
            const newType = window.AudioVisualizer.nextVisualization();

            // Update button icon based on type
            const icons = {
                'bars': '📊',
                'wave': '〰️',
                'circular': '🔄',
                'spectrum': '🌈'
                // Removed 'particles': '✨'
            };

            visualizerTypeButton.innerHTML = icons[newType] || '📊';

            // Show tooltip with visualization name
            vizTooltip.textContent = newType.charAt(0).toUpperCase() + newType.slice(1);
            vizTooltip.style.opacity = '1';

            // Hide tooltip after 2 seconds
            setTimeout(() => {
                vizTooltip.style.opacity = '0';
            }, 2000);
        }
    });

    // Hover effect for visualizer type button
    visualizerTypeButton.addEventListener('mouseenter', () => {
        if (window.AudioVisualizer && window.AudioVisualizer.active) {
            vizTooltip.textContent = window.AudioVisualizer.getCurrentVisualizationName().charAt(0).toUpperCase() +
                window.AudioVisualizer.getCurrentVisualizationName().slice(1);
            vizTooltip.style.opacity = '1';
        }
    });

    visualizerTypeButton.addEventListener('mouseleave', () => {
        vizTooltip.style.opacity = '0';
    });

    // Add window resize handler for visualizer
    window.addEventListener('resize', () => {
        if (window.AudioVisualizer) {
            window.AudioVisualizer.handleResize();
        }
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

        const micToggle = document.querySelector('.mic-toggle');
        if (micToggle) {
            micToggle.style.opacity = '1';
            micToggle.style.pointerEvents = 'auto';

            // Ensure mic button state reflects visualizer state
            if (window.AudioVisualizer && window.AudioVisualizer.active) {
                micToggle.classList.add('active');
                micToggle.innerHTML = '🔊';
                micToggle.title = 'Disable Audio Visualization';
            } else {
                micToggle.classList.remove('active');
                micToggle.innerHTML = '🎙️';
                micToggle.title = 'Enable Audio Visualization';
            }
        }

        // Only show visualizer type button if visualizer is actually active
        const visualizerTypeButton = document.querySelector('.viz-toggle');
        if (visualizerTypeButton) {
            const isVisualizerActive = window.AudioVisualizer && window.AudioVisualizer.active;
            visualizerTypeButton.style.opacity = isVisualizerActive ? '1' : '0';
            visualizerTypeButton.style.pointerEvents = isVisualizerActive ? 'auto' : 'none';

            // Update icon if visualizer is active
            if (isVisualizerActive && window.AudioVisualizer.getCurrentVisualizationName) {
                const icons = {
                    'bars': '📊',
                    'wave': '〰️',
                    'circular': '🔄',
                    'spectrum': '🌈'
                    // Removed 'particles': '✨'
                };

                visualizerTypeButton.innerHTML = icons[window.AudioVisualizer.getCurrentVisualizationName()] || '📊';
            }
        }
    } else {
        document.body.classList.remove('disco-mode');
        const discoToggle = document.querySelector('.disco-toggle');
        if (discoToggle) {
            discoToggle.classList.remove('active');
            discoToggle.querySelector('.beat-visualizer').style.opacity = '0';
        }

        const micToggle = document.querySelector('.mic-toggle');
        if (micToggle) {
            micToggle.style.opacity = '0';
            micToggle.style.pointerEvents = 'none';
        }

        const visualizerTypeButton = document.querySelector('.viz-toggle');
        if (visualizerTypeButton) {
            visualizerTypeButton.style.opacity = '0';
            visualizerTypeButton.style.pointerEvents = 'none';
        }

        const vizTooltip = document.querySelector('.viz-tooltip');
        if (vizTooltip) {
            vizTooltip.style.opacity = '0';
        }

        // Stop audio visualizer
        if (window.AudioVisualizer && window.AudioVisualizer.active) {
            window.AudioVisualizer.stop();
        }
    }
});