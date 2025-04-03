/**
 * Piano Analyzer Mode
 * Visualizes musical notation from MusicXML files
 */
class PianoAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);

        // Create core components
        this.scoreModel = new MusicScoreModel();
        this.musicXMLParser = new MusicXMLParser();
        this.playbackController = new PlaybackController(this.scoreModel);

        // These will be initialized later
        this.pianoVisualization = null;
        this.notationRenderer = null;
        this.currentPosition = 0;
    }

    /**
     * Initialize the mode
     */
    initialize() {
        this.setupFileInput();
        this.setupPlaybackController();
        this.setupScoreModelListeners();
        this.updateResultDisplay();

        // No longer adding the keyboard event listener here
        // We'll add it when visualization is created instead
    }

    /**
     * Set up file input handling
     */
    setupFileInput() {
        const openButton = this.analyzer.container.querySelector('.open-musicxml');
        const fileInput = this.analyzer.container.querySelector('#musicxml-input');

        if (openButton && fileInput) {
            // Replace with fresh clones to prevent duplicate listeners
            const newOpenButton = openButton.cloneNode(true);
            const newFileInput = fileInput.cloneNode(true);

            newFileInput.accept = '.xml,.musicxml,.mxl';

            openButton.parentNode.replaceChild(newOpenButton, openButton);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);

            // Add event listeners
            newOpenButton.addEventListener('click', () => newFileInput.click());
            newFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.loadMusicXMLFile(e.target.files[0]);
                }
            });
        }
    }

    /**
     * Update the result display area
     */
    updateResultDisplay() {
        const resultElement = this.analyzer.container.querySelector('.music-result');
        if (resultElement && resultElement.style.display === 'none') {
            resultElement.style.display = 'block';
        }
    }

    /**
     * Set up playback controller
     */
    setupPlaybackController() {
        this.playbackController.initialize(this.analyzer.container, {
            onVisualizationUpdate: this.updateVisualization.bind(this),
            onNotationUpdate: this.updateNotation.bind(this)
        });
    }

    /**
     * Set up event listeners for the score model
     */
    setupScoreModelListeners() {
        // Listen for position changes
        this.scoreModel.addEventListener('positionchange', (data) => {
            this.currentPosition = data.position;

            // Skip updates if visualization isn't created yet
            if (!this.pianoVisualization) return;

            // For large position jumps, update immediately
            if (Math.abs(data.position - (data.previousPosition || 0)) > 0.3) {
                if (this.notationRenderer) {
                    this.notationRenderer.renderNotation(true);
                }
            }
        });

        // Score loaded event
        this.scoreModel.addEventListener('loaded', () => {
            console.log("Score model loaded data successfully");
        });
    }

    /**
     * Update visualization components (called from animation loop)
     */
    updateVisualization(timestamp) {
        if (!this.pianoVisualization) return;

        // Update visual elements
        this.pianoVisualization.updateNoteBars();

        // Highlight currently playing notes
        const playingNotes = this.scoreModel.getCurrentlyPlayingNotes();
        this.pianoVisualization.highlightPianoKeys(playingNotes);
    }

    /**
     * Update notation (called less frequently)
     */
    updateNotation(timestamp) {
        if (this.notationRenderer) {
            this.notationRenderer.renderNotation();
        }
    }

    /**
     * Load and process a MusicXML file
     * @param {File} file The file to load
     */
    async loadMusicXMLFile(file) {
        const statusElement = this.analyzer.container.querySelector('.piano-status');
        if (!statusElement) return;

        statusElement.textContent = 'Loading MusicXML file...';

        try {
            // Parse the file
            const scoreData = await this.musicXMLParser.loadMusicXMLFile(file);

            // Set data in our model
            this.scoreModel.setScoreData(scoreData);

            // Update UI
            statusElement.textContent = `Loaded: ${scoreData.title}`;
            this.updateScoreUI();

        } catch (error) {
            console.error('Error loading MusicXML file:', error);
            statusElement.textContent = 'Error loading file: ' + error.message;
        }
    }

    /**
     * Update the displayed score title
     */
    updateScoreTitle(title) {
        const songNameElement = document.querySelector('.piano-song-name');
        if (songNameElement) {
            songNameElement.textContent = title;
        }
    }

    /**
     * Create the visualization components
     */
    createVisualization() {
        // First do proper cleanup in case we have any existing visualization elements
        this.cleanup();

        // Remove any existing visualization container
        const existingContainer = document.getElementById('piano-visualization-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Create container
        this.pianoVisualizationContainer = document.createElement('div');
        this.pianoVisualizationContainer.id = 'piano-visualization-container';
        this.pianoVisualizationContainer.className = 'piano-visualization-container';

        // Set up container structure
        this.pianoVisualizationContainer.innerHTML = `
            <div class="notation-container"></div>
            <div class="note-bar-container"></div>
            <div class="piano-keyboard-container">
                <div class="piano-keyboard"></div>
            </div>
        `;

        // Add to document
        document.body.appendChild(this.pianoVisualizationContainer);

        // Get notation container reference
        this.notationContainer = this.pianoVisualizationContainer.querySelector('.notation-container');

        // Hide analyzer panel while visualization is shown
        this.analyzer.panel.style.display = 'none';

        // Create components
        this.notationRenderer = new NotationRenderer(this.scoreModel, this.notationContainer);
        this.pianoVisualization = new PianoVisualization(this.scoreModel, this.pianoVisualizationContainer);

        // Initial render
        this.notationRenderer.renderNotation(true);
        this.pianoVisualization.show();

        // Show an escape hint in the piano status
        const statusElement = this.analyzer.container.querySelector('.piano-status');
        if (statusElement) {
            statusElement.textContent = 'Press ESC to return to the analyzer menu.';
        }

        // Add keyboard event listener specifically for this visualization
        // First remove any existing listener to prevent duplicates
        if (this.keyboardEventHandler) {
            document.removeEventListener('keydown', this.keyboardEventHandler);
        }

        // Create and attach new listener
        this.keyboardEventHandler = this.handleKeyboardEvent.bind(this);
        document.addEventListener('keydown', this.keyboardEventHandler);
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event Keyboard event
     */
    handleKeyboardEvent(event) {
        // Only handle events if we have an active visualization
        if (this.pianoVisualization) {
            if (event.key === 'Escape') {
                // Close visualization when Escape key is pressed
                this.closePianoVisualization();
                event.preventDefault();
            }
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Stop playback to prevent any ongoing animations or timers
        if (this.scoreModel?.isPlaying) {
            this.scoreModel.stop();
        }

        // Clean up playback controller
        if (this.playbackController) {
            this.playbackController.cleanup();
        }

        // Clean up visualization - with enhanced memory leak prevention
        if (this.pianoVisualization) {
            this.pianoVisualization.cleanup();
            this.pianoVisualization = null;
        }

        // Clean up renderer with special handling for SVG elements
        if (this.notationRenderer) {
            // Call cleanup method if it exists
            if (typeof this.notationRenderer.cleanup === 'function') {
                this.notationRenderer.cleanup();
            } else {
                // Manual cleanup if method doesn't exist
                if (this.notationRenderer.svgContainer) {
                    while (this.notationRenderer.svgContainer.firstChild) {
                        this.notationRenderer.svgContainer.firstChild.remove();
                    }
                }

                // Clear any potential animation frames
                if (this.notationRenderer.animationFrameId) {
                    cancelAnimationFrame(this.notationRenderer.animationFrameId);
                }
            }
            this.notationRenderer = null;
        }

        // Remove visualization container from DOM if it exists
        if (this.pianoVisualizationContainer) {
            if (this.pianoVisualizationContainer.parentNode) {
                // First remove all child elements to prevent memory leaks
                while (this.pianoVisualizationContainer.firstChild) {
                    this.pianoVisualizationContainer.firstChild.remove();
                }
                this.pianoVisualizationContainer.parentNode.removeChild(this.pianoVisualizationContainer);
            }
            this.pianoVisualizationContainer = null;
        }

        // Remove keyboard event listener
        if (this.keyboardEventHandler) {
            document.removeEventListener('keydown', this.keyboardEventHandler);
            this.keyboardEventHandler = null;
        }

        // Clean up score model event listeners
        if (this.scoreModel) {
            // Keep the instance but clear its event listeners
            const events = ['positionchange', 'play', 'pause', 'stop', 'tempochange', 'loaded'];
            events.forEach(event => {
                if (this.scoreModel.eventListeners && this.scoreModel.eventListeners[event]) {
                    this.scoreModel.eventListeners[event] = [];
                }
            });
        }

        // Reset current position
        this.currentPosition = 0;

        // Clear any references to DOM elements to prevent memory leaks
        this.notationContainer = null;

        // Force garbage collection hint (though JS engines decide when to actually run it)
        if (window.gc) {
            try {
                window.gc();
            } catch (e) {
                console.log("Manual garbage collection not available");
            }
        }
    }

    /**
     * Close the piano visualization
     */
    closePianoVisualization() {
        // Clean up resources first
        this.cleanup();

        // Show analyzer panel
        if (this.analyzer && this.analyzer.panel) {
            this.analyzer.panel.style.display = 'block';
        }
    }

    /**
     * Update UI after score is loaded
     */
    updateScoreUI() {
        this.updateScoreTitle(this.scoreModel.title);
        this.playbackController.showPlaybackControls();
        this.createVisualization();
    }

    /**
     * Called when the mode is deactivated
     */
    deactivate() {
        // Ensure we clean up thoroughly when switching to another analyzer mode
        this.cleanup();

        // Also ensure we null out any remaining references
        this.pianoVisualizationContainer = null;
        this.notationContainer = null;
    }
}

