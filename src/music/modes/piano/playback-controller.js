/**
 * PlaybackController
 * Handles playback controls, UI interactions and animation loop for music playback
 */
class PlaybackController {
    constructor(scoreModel) {
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

        // Callbacks
        this.onVisualizationUpdate = null;
        this.onNotationUpdate = null;

        // Bind methods
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
        this.onVisualizationUpdate = callbacks.onVisualizationUpdate || null;
        this.onNotationUpdate = callbacks.onNotationUpdate || null;

        this.initializeControls();
        this.setupScoreModelListeners();
        this.setupKeyboardShortcuts();
    }

    /**
     * Initialize playback control UI elements
     */
    initializeControls() {
        if (!this.container) return;

        // Setup play/pause button
        this.playPauseButton = this.container.querySelector('.piano-play-pause');
        if (this.playPauseButton) {
            // Replace with fresh clone to remove old event listeners
            const newButton = this.playPauseButton.cloneNode(true);
            this.playPauseButton.parentNode.replaceChild(newButton, this.playPauseButton);
            this.playPauseButton = newButton;

            this.playPauseButton.addEventListener('click', this.togglePlayback);
            this.updatePlayPauseButton();
        }

        // Setup speed control
        this.speedControl = this.container.querySelector('.piano-speed');
        this.speedDisplay = this.container.querySelector('.speed-value');

        if (this.speedControl) {
            this.speedControl.style.display = 'none';
        }

        if (this.speedDisplay) {
            this.updateTempoDisplay();
        }
    }

    /**
     * Set up event listeners for the score model
     */
    setupScoreModelListeners() {
        this.scoreModel.addEventListener('play', () => this.updatePlayPauseButton());
        this.scoreModel.addEventListener('pause', () => this.updatePlayPauseButton());
        this.scoreModel.addEventListener('stop', () => this.updatePlayPauseButton());
        this.scoreModel.addEventListener('tempochange', () => this.updateTempoDisplay());
    }

    /**
     * Set up keyboard shortcuts for playback control
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Skip if text input is focused
            if (document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA') {
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
                case '+': // Plus - increase tempo
                case '=': // Equal (often same key as plus)
                    this.adjustTempo(5);
                    break;
                case '-': // Minus - decrease tempo
                case '_': // Underscore (often same key as minus)
                    this.adjustTempo(-5);
                    break;
            }
        });
    }

    /**
     * Adjust tempo by a relative amount
     * @param {number} delta Amount to change tempo by
     */
    adjustTempo(delta) {
        const currentTempo = this.scoreModel.bpm;
        const newTempo = Math.max(40, Math.min(240, currentTempo + delta));
        this.scoreModel.setTempo(newTempo);
        this.updateTempoDisplay();
    }

    /**
     * Update the play/pause button state based on playback state
     */
    updatePlayPauseButton() {
        if (!this.playPauseButton) return;
        this.playPauseButton.textContent = this.scoreModel.isPlaying ? 'Pause' : 'Play';
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
        // Round to integer for cleaner display
        this.speedDisplay.textContent = `${Math.round(this.scoreModel.bpm)} BPM`;
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
        this.stopAnimationLoop();

        const animate = (timestamp) => {
            if (!this.scoreModel.isPlaying) return;

            // Update visualizations
            if (typeof this.onVisualizationUpdate === 'function') {
                this.onVisualizationUpdate(timestamp);
            }

            // Update position indicator on every frame for smooth movement
            if (this.onPositionIndicatorUpdate) {
                this.onPositionIndicatorUpdate(timestamp);
            }

            // Update notation less frequently
            if (!this._lastNotationUpdate || timestamp - this._lastNotationUpdate > 500) {
                if (typeof this.onNotationUpdate === 'function') {
                    this.onNotationUpdate(timestamp);
                }
                this._lastNotationUpdate = timestamp;
            }

            // Continue loop
            this.animationFrameId = requestAnimationFrame(animate);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Register a callback for position indicator updates
     * @param {Function} callback Function to call for position indicator updates
     */
    setPositionIndicatorUpdateCallback(callback) {
        this.onPositionIndicatorUpdate = callback;
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
     * @param {number} seconds Seconds to seek
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
        this.stopAnimationLoop();
        if (this.scoreModel?.isPlaying) {
            this.scoreModel.pause();
        }
    }
}

// Make the class available globally
window.PlaybackController = PlaybackController;
