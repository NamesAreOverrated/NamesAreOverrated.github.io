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
        this.scoreLoaded = false; // Track if a score is loaded

        // Listen for audio visualization stopped event
        this.handleVisualizationStopped = this.handleVisualizationStopped.bind(this);
        document.addEventListener('audio-visualization-stopped', this.handleVisualizationStopped);
    }

    /**
     * Handle audio visualization stopped event
     */
    handleVisualizationStopped() {
        if (this.pianoVisualization) {
            console.log("Piano Analyzer: Closing visualization due to audio visualization being stopped");
            this.closePianoVisualization();
        }
    }

    /**
     * Initialize the mode
     */
    initialize() {
        this.setupFileInput();
        this.setupReopenButton();
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
     * Set up the reopen button
     */
    setupReopenButton() {
        const reopenButton = this.analyzer.container.querySelector('.reopen-musicxml');
        if (reopenButton) {
            // Replace with fresh clone to prevent duplicate listeners
            const newReopenButton = reopenButton.cloneNode(true);
            reopenButton.parentNode.replaceChild(newReopenButton, reopenButton);

            // Add event listener
            newReopenButton.addEventListener('click', () => {
                if (this.scoreLoaded) {
                    this.createVisualization();
                    newReopenButton.style.display = 'none';
                }
            });

            // Show/hide based on current state
            newReopenButton.style.display = this.scoreLoaded ? 'inline-block' : 'none';
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

        // Add position indicator update callback
        this.playbackController.setPositionIndicatorUpdateCallback(() => {
            if (this.notationRenderer) {
                this.notationRenderer.updatePositionIndicator();
            }
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
            this.scoreLoaded = true;

            // Hide reopen button when we load a new score
            const reopenButton = this.analyzer.container.querySelector('.reopen-musicxml');
            if (reopenButton) {
                reopenButton.style.display = 'none';
            }
        });

        // Add listeners for play and pause to update heart animation
        this.scoreModel.addEventListener('play', () => {
            // Update heart animation when playback starts
            this.updateHeartPulseAnimation();
        });

        this.scoreModel.addEventListener('pause', () => {
            // Update heart animation when playback pauses
            this.updateHeartPulseAnimation();
        });

        this.scoreModel.addEventListener('stop', () => {
            // Update heart animation when playback stops
            this.updateHeartPulseAnimation();
        });

        // Also listen for beat-level events to synchronize heart animation
        this.scoreModel.addEventListener('positionchange', (data) => {
            // If we're playing, check if we've just crossed a beat boundary
            if (this.scoreModel.isPlaying && this.heartIcon) {
                const bpm = parseFloat(this.scoreModel.bpm) || 60;
                const beatDuration = 60 / bpm;

                const prevBeat = Math.floor(data.previousPosition / beatDuration);
                const currentBeat = Math.floor(data.position / beatDuration);

                // If we've crossed a beat boundary, pulse the heart
                if (prevBeat !== currentBeat) {
                    this._pulseHeartImmediately();
                }
            }
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

        // Update disco info panel with current playback information
        this.updateDiscoInfoPanel();
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

        // Create disco info panel
        this.createDiscoInfoPanel();

        // Initial render
        this.notationRenderer.renderNotation(true);
        this.pianoVisualization.show();

        // Initial update of info panel
        this.updateDiscoInfoPanel();

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

        // Hide reopen button while visualization is open
        const reopenButton = this.analyzer.container.querySelector('.reopen-musicxml');
        if (reopenButton) {
            reopenButton.style.display = 'none';
        }
    }

    /**
     * Create the disco-themed information panel
     */
    createDiscoInfoPanel() {
        // Remove any existing panel
        if (this.discoInfoPanel) {
            this.discoInfoPanel.remove();
        }

        // Create new panel
        this.discoInfoPanel = document.createElement('div');
        this.discoInfoPanel.className = 'notation-disco-info';

        // Create first row: KEY and TIME
        const row1 = document.createElement('div');
        row1.className = 'notation-info-row';

        // Create key info with icon
        const keyInfo = document.createElement('div');
        keyInfo.className = 'notation-info-item key-info';
        keyInfo.innerHTML = `
            <div class="notation-info-icon">🔑</div>
            <div class="notation-info-value key-value">--</div>
        `;

        // Create time signature info with icon
        const timeInfo = document.createElement('div');
        timeInfo.className = 'notation-info-item time-info';
        timeInfo.innerHTML = `
            <div class="notation-info-icon">🕒</div>
            <div class="notation-info-value time-value">4/4</div>
        `;

        // Add items to first row
        row1.appendChild(keyInfo);
        row1.appendChild(timeInfo);

        // Create second row: TEMPO with heart icon
        const row2 = document.createElement('div');
        row2.className = 'notation-info-row';

        // Create tempo info with pulsing heart icon
        const tempoInfo = document.createElement('div');
        tempoInfo.className = 'notation-info-item tempo-info';
        tempoInfo.innerHTML = `
            <div class="notation-info-icon heart-icon">❤️</div>
            <div class="notation-info-value tempo-value">${this.scoreModel.bpm || '--'} BPM</div>
        `;

        // Add tempo to second row
        row2.appendChild(tempoInfo);

        // Create measure info with icon
        const measureInfo = document.createElement('div');
        measureInfo.className = 'notation-info-item measure-info';
        measureInfo.innerHTML = `
            <div class="notation-info-icon">📏</div>
            <div class="notation-info-value measure-value">--/--</div>
        `;

        // Add measure to first row
        row2.appendChild(measureInfo);

        // Add all rows to panel
        this.discoInfoPanel.appendChild(row1);
        this.discoInfoPanel.appendChild(row2);

        // Add panel to the visualization container
        this.pianoVisualizationContainer.appendChild(this.discoInfoPanel);

        // Store references for updating
        this.keyValueElement = keyInfo.querySelector('.key-value');
        this.tempoValueElement = tempoInfo.querySelector('.tempo-value');
        this.measureValueElement = measureInfo.querySelector('.measure-value');
        this.timeValueElement = timeInfo.querySelector('.time-value');
        this.heartIcon = tempoInfo.querySelector('.heart-icon');

        // Initialize heart beat
        this.setupHeartBeat();
    }

    /**
     * Set up heart beat animation
     */
    setupHeartBeat() {
        if (!this.heartIcon) return;

        // Initial styling
        this.heartIcon.style.transition = 'transform 0.1s ease-out';
        this.heartIcon.style.transform = 'scale(1)';
        this.heartIcon.style.transformOrigin = 'center';
        this.heartIcon.style.display = 'inline-block';
        this.heartIcon.style.color = '#ff3a3a';

        // Track the last beat time
        this.lastBeatTime = 0;

        // Listen for beat events
        this.scoreModel.addEventListener('positionchange', this.checkForBeat.bind(this));
    }

    /**
     * Check if we've hit a beat and trigger heart animation
     * @param {Object} data Position change data
     */
    checkForBeat(data) {
        if (!this.scoreModel.isPlaying || !this.heartIcon) return;

        const bpm = parseFloat(this.scoreModel.bpm) || 60;
        const beatInterval = 60 / bpm; // seconds per beat

        // Calculate which beat we're on
        const currentBeat = Math.floor(this.scoreModel.currentPosition / beatInterval);
        const previousBeat = Math.floor((data.previousPosition || 0) / beatInterval);

        // If we've crossed a beat boundary
        if (currentBeat > previousBeat) {
            this.pulseBeat();
        }
    }

    /**
     * Create a single heartbeat pulse
     */
    pulseBeat() {
        if (!this.heartIcon || this.pulseInProgress) return;

        // Prevent multiple simultaneous beats
        this.pulseInProgress = true;

        // Visual styles during active beat
        this.heartIcon.style.color = '#ff0000';
        this.heartIcon.style.transform = 'scale(1.6)';

        // Reset after animation
        setTimeout(() => {
            if (this.heartIcon) {
                this.heartIcon.style.transform = 'scale(1)';
                this.heartIcon.style.color = this.scoreModel.isPlaying ? '#ff3a3a' : '#aa3a3a';
            }
            this.pulseInProgress = false;
        }, 150);
    }

    /**
     * Update the disco information panel with current data
     */
    updateDiscoInfoPanel() {
        if (!this.discoInfoPanel) return;

        // Update key information if available
        if (this.keyValueElement) {
            const currentKey = this.scoreModel.getCurrentKey();

            if (currentKey) {
                this.keyValueElement.textContent = currentKey;
            } else {
                // If no key information is available, try to detect from current notes
                const currentNotes = this.scoreModel.getCurrentlyPlayingNotes();
                if (currentNotes && currentNotes.length > 0 && window.MusicTheory) {
                    const detectedKey = MusicTheory.detectKey(currentNotes);
                    this.keyValueElement.textContent = detectedKey || 'C MAJOR';
                } else {
                    this.keyValueElement.textContent = 'C MAJOR';
                }
            }
        }

        // Update tempo information
        if (this.tempoValueElement) {
            const newBpm = this.scoreModel.bpm || '--';
            this.tempoValueElement.textContent = `${newBpm} BPM`;

            // Playing state changed or BPM changed
            const wasPlaying = this.heartIcon && this.heartIcon.style.animation &&
                this.heartIcon.style.animation !== 'none';

            if (wasPlaying !== this.scoreModel.isPlaying ||
                (this.scoreModel.isPlaying && this._lastBpm !== newBpm)) {
                // this.updateHeartPulseAnimation();
                this._lastBpm = newBpm;
            }
        }

        // Update measure information with current/total format
        if (this.measureValueElement) {
            const currentMeasure = this.scoreModel.getCurrentMeasure();
            const totalMeasures = this.scoreModel.measures.length;

            if (currentMeasure && totalMeasures) {
                const measureNumber = currentMeasure.number || '--';
                this.measureValueElement.textContent = `${measureNumber}/${totalMeasures}`;
            } else {
                this.measureValueElement.textContent = '--/--';
            }
        }

        // Update time signature information
        if (this.timeValueElement) {
            const currentMeasure = this.scoreModel.getCurrentMeasure();
            if (currentMeasure && currentMeasure.timeSignature) {
                this.timeValueElement.textContent = currentMeasure.timeSignature;
            } else {
                // Default time signature if none is specified
                this.timeValueElement.textContent = '4/4';
            }
        }

        // Update heart color based on playback state
        if (this.heartIcon && !this.pulseInProgress) {
            this.heartIcon.style.color = this.scoreModel.isPlaying ? '#ff3a3a' : '#aa3a3a';
        }
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

        // Clean up disco info panel
        if (this.discoInfoPanel) {
            if (this.discoInfoPanel.parentNode) {
                this.discoInfoPanel.parentNode.removeChild(this.discoInfoPanel);
            }
            this.discoInfoPanel = null;
            this.keyValueElement = null;
            this.tempoValueElement = null;
            this.measureValueElement = null;
            this.timeValueElement = null;
        }

        // Remove heart pulse animation style
        const styleSheet = document.getElementById('heart-pulse-style');
        if (styleSheet) {
            styleSheet.remove();
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

            // Show reopen button if we have a score loaded
            if (this.scoreLoaded) {
                const reopenButton = this.analyzer.container.querySelector('.reopen-musicxml');
                if (reopenButton) {
                    reopenButton.style.display = 'inline-block';
                }

                // Update status to indicate reopening is possible
                const statusElement = this.analyzer.container.querySelector('.piano-status');
                if (statusElement) {
                    statusElement.textContent = 'Press "Reopen Score" to view the visualization again.';
                }
            }
        }
    }

    /**
     * Update UI after score is loaded
     */
    updateScoreUI() {
        this.updateScoreTitle(this.scoreModel.title);
        this.createVisualization();
    }

    /**
     * Called when the mode is deactivated
     */
    deactivate() {
        // Ensure we clean up thoroughly when switching to another analyzer mode
        this.cleanup();

        // Remove the visualization stopped event listener
        document.removeEventListener('audio-visualization-stopped', this.handleVisualizationStopped);

        // Also ensure we null out any remaining references
        this.pianoVisualizationContainer = null;
        this.notationContainer = null;
    }
}

