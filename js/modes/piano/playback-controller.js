/**
 * PlaybackController
 * Handles playback controls, UI interactions and animation loop for music playback
 */
class PlaybackController {
    constructor(scoreModel) {
        // Store reference to the score model
        this.scoreModel = scoreModel;

        // UI elements
        this.container = null;
        this.playPauseButton = null;
        this.speedControl = null;
        this.speedDisplay = null;

        // Animation state
        this.animationFrameId = null;
        this._lastNotationUpdate = 0;
        this._toggleInProgress = false;

        // Callbacks for visualization updates
        this.onVisualizationUpdate = null;
        this.onNotationUpdate = null;

        // Bind methods that need 'this'
        this.togglePlayback = this.togglePlayback.bind(this);
        this.startAnimationLoop = this.startAnimationLoop.bind(this);
        this.updatePlayPauseButton = this.updatePlayPauseButton.bind(this);
        this.handleTempoChange = this.handleTempoChange.bind(this);
    }

    /**
     * Initialize the controller with UI container and callbacks
     * @param {HTMLElement} container Container for UI controls
     * @param {Object} callbacks Callback functions
     */
    initialize(container, callbacks = {}) {
        this.container = container;

        // Set callbacks
        this.onVisualizationUpdate = callbacks.onVisualizationUpdate || null;
        this.onNotationUpdate = callbacks.onNotationUpdate || null;

        // Initialize UI controls
        this.initializeControls();

        // Set up event listeners for the score model
        this.setupScoreModelListeners();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    /**
     * Initialize playback control UI elements
     */
    initializeControls() {
        if (!this.container) return;

        // Play/pause button
        this.playPauseButton = this.container.querySelector('.piano-play-pause');
        if (this.playPauseButton) {
            // Replace with a fresh clone to remove any old event listeners
            const newButton = this.playPauseButton.cloneNode(true);
            this.playPauseButton.parentNode.replaceChild(newButton, this.playPauseButton);
            this.playPauseButton = newButton;

            // Add event listener
            this.playPauseButton.addEventListener('click', this.togglePlayback);

            // Set initial state
            this.updatePlayPauseButton();
        }

        // Speed control
        this.speedControl = this.container.querySelector('.piano-speed');
        this.speedDisplay = this.container.querySelector('.speed-value');

        if (this.speedControl && this.speedDisplay) {
            // Replace with a fresh clone to remove any old event listeners
            const newControl = this.speedControl.cloneNode(true);
            this.speedControl.parentNode.replaceChild(newControl, this.speedControl);
            this.speedControl = newControl;

            // Configure range input
            this.speedControl.min = "40";   // Minimum BPM
            this.speedControl.max = "240";  // Maximum BPM
            this.speedControl.step = "1";   // BPM increments by 1
            this.speedControl.value = this.scoreModel.bpm;

            // Add event listener
            this.speedControl.addEventListener('input', this.handleTempoChange);

            // Set initial display
            this.updateTempoDisplay();
        }
    }

    /**
     * Set up event listeners for the score model
     */
    setupScoreModelListeners() {
        // Listen for play events
        this.scoreModel.addEventListener('play', () => {
            this.updatePlayPauseButton();
        });

        // Listen for pause events
        this.scoreModel.addEventListener('pause', () => {
            this.updatePlayPauseButton();
        });

        // Listen for stop events
        this.scoreModel.addEventListener('stop', () => {
            this.updatePlayPauseButton();
        });

        // Listen for tempo change events
        this.scoreModel.addEventListener('tempochange', (data) => {
            this.updateTempoDisplay();
        });
    }

    /**
     * Set up keyboard shortcuts for playback control
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Only if no text input is focused
            if (document.activeElement &&
                (document.activeElement.tagName === 'INPUT' ||
                    document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            switch (event.key) {
                case ' ': // Space bar
                    event.preventDefault();
                    this.togglePlayback();
                    break;
                case 'ArrowLeft': // Left arrow - rewind 5 seconds
                    event.preventDefault();
                    this.seek(-5);
                    break;
                case 'ArrowRight': // Right arrow - forward 5 seconds
                    event.preventDefault();
                    this.seek(5);
                    break;
                case 'Home': // Home - go to start
                    event.preventDefault();
                    this.scoreModel.seekTo(0);
                    break;
            }
        });
    }

    /**
     * Update the play/pause button state based on playback state
     */
    updatePlayPauseButton() {
        if (!this.playPauseButton) return;

        // Update button text
        this.playPauseButton.textContent = this.scoreModel.isPlaying ? 'Pause' : 'Play';

        // Update button appearance
        this.playPauseButton.classList.toggle('playing', this.scoreModel.isPlaying);
    }

    /**
     * Handle tempo change from UI
     * @param {Event} event Input event from tempo slider
     */
    handleTempoChange(event) {
        const newTempo = parseFloat(event.target.value);
        this.scoreModel.setTempo(newTempo);
        this.updateTempoDisplay();
    }

    /**
     * Update tempo display to match current tempo
     */
    updateTempoDisplay() {
        if (!this.speedDisplay) return;

        // Update tempo display
        this.speedDisplay.textContent = `${this.scoreModel.bpm} BPM`;

        // Ensure slider matches current tempo
        if (this.speedControl) {
            this.speedControl.value = this.scoreModel.bpm;
        }
    }

    /**
     * Toggle between play and pause
     */
    togglePlayback() {
        if (this._toggleInProgress) return;
        this._toggleInProgress = true;

        try {
            if (this.scoreModel.isPlaying) {
                this.scoreModel.pause();
                this.stopAnimationLoop();
            } else {
                this.scoreModel.play();
                this.startAnimationLoop();
            }
        } catch (err) {
            console.error("Error toggling playback:", err);
        } finally {
            // Prevent rapid toggle clicks
            setTimeout(() => {
                this._toggleInProgress = false;
            }, 300);
        }
    }

    /**
     * Start the animation loop for visualization updates
     */
    startAnimationLoop() {
        // Cancel any existing animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const animate = (timestamp) => {
            if (!this.scoreModel.isPlaying) return;

            // Update visualizations
            if (typeof this.onVisualizationUpdate === 'function') {
                this.onVisualizationUpdate(timestamp);
            }

            // Update notation less frequently (every 500ms)
            if (!this._lastNotationUpdate ||
                timestamp - this._lastNotationUpdate > 500) {
                if (typeof this.onNotationUpdate === 'function') {
                    this.onNotationUpdate(timestamp);
                }
                this._lastNotationUpdate = timestamp;
            }

            // Continue loop
            this.animationFrameId = requestAnimationFrame(animate);
        };

        // Start the animation loop
        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Stop the animation loop
     */
    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Seek forward or backward relative to current position
     * @param {number} seconds Seconds to seek (positive for forward, negative for backward)
     */
    seek(seconds) {
        const newPosition = Math.max(0, this.scoreModel.currentPosition + seconds);
        this.scoreModel.seekTo(newPosition);
    }

    /**
     * Show playback controls in UI
     */
    showPlaybackControls() {
        if (!this.container) return;

        const playbackControls = this.container.querySelector('.piano-playback-controls');
        if (playbackControls) {
            playbackControls.style.display = 'flex';
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Stop animation loop
        this.stopAnimationLoop();

        // Stop any playback
        if (this.scoreModel && this.scoreModel.isPlaying) {
            this.scoreModel.pause();
        }
    }
}

// Make the class available globally
window.PlaybackController = PlaybackController;
