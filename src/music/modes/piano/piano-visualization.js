/**
 * Piano Visualization
 * Coordinator for piano keyboard, note bars, and chord visualization
 */
class PianoVisualization {
    constructor(scoreModel, container) {
        this.scoreModel = scoreModel;
        this.container = container;

        // Initialize components
        this.keyboardContainer = container.querySelector('.piano-keyboard');
        this.noteBarContainer = container.querySelector('.note-bar-container');

        this.keyboard = new PianoKeyboard(this.keyboardContainer);
        this.noteBarRenderer = new NoteBarRenderer(this.noteBarContainer, this.keyboard);
        this.chordRenderer = new ChordRenderer(this.noteBarContainer);

        this.setupResizeHandler();
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        this._resizeHandler = () => {
            if (this.container && this.container.style.display !== 'none') {
                // Force update positions
                const currentTime = this.scoreModel.currentPosition;
                this.noteBarRenderer.updatePositions(currentTime);
                this.chordRenderer.updatePositions(currentTime);

                if (typeof this.onResizeCallback === 'function') {
                    this.onResizeCallback();
                }
            }
        };
        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Show the visualization
     */
    show() {
        this.container.style.display = 'block';
        // Small delay to ensure DOM is ready before positioning
        setTimeout(() => {
            const currentTime = this.scoreModel.currentPosition;
            this.noteBarRenderer.updatePositions(currentTime);
            this.chordRenderer.updatePositions(currentTime);
        }, 50);
    }

    /**
     * Close the visualization
     */
    close() {
        this.container.style.display = 'none';
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        window.removeEventListener('resize', this._resizeHandler);

        this.noteBarRenderer.clear();
        this.chordRenderer.clear();
        this.keyboard.clear();

        if (this.container?.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.onResizeCallback = null;
    }

    /**
     * Highlight piano keys for currently playing notes
     * @param {Array} notes Array of notes to highlight
     */
    highlightPianoKeys(notes) {
        this.keyboard.highlightKeys(notes);
    }

    /**
     * Update note bars visualization
     */
    updateNoteBars() {
        this.noteBarRenderer.update(this.scoreModel);
        this.chordRenderer.update(this.scoreModel);
    }

    /**
     * Register a callback for resize events
     * @param {Function} callback Function to call on resize
     */
    onResize(callback) {
        this.onResizeCallback = callback;
    }
}

window.PianoVisualization = PianoVisualization;
