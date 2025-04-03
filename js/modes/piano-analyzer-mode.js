/**
 * Piano Analyzer Mode
 * Visualizes musical notation from MusicXML files
 */

class PianoAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);

        // Create the music score model instance
        this.scoreModel = new MusicScoreModel();

        // Create the MusicXML parser
        this.musicXMLParser = new MusicXMLParser();

        // Create the piano visualization
        this.pianoVisualization = null;

        // Create the playback controller
        this.playbackController = new PlaybackController(this.scoreModel);

        // The notation renderer will be created when visualization is shown
        this.notationRenderer = null;

        // State variables
        this.currentPosition = 0;
    }

    initialize() {
        const openButton = this.analyzer.container.querySelector('.open-musicxml');
        const fileInput = this.analyzer.container.querySelector('#musicxml-input');

        if (openButton && fileInput) {
            // Clear existing listeners to prevent duplicates
            const newOpenButton = openButton.cloneNode(true);
            const newFileInput = fileInput.cloneNode(true);

            // Update the accept attribute to include .mxl files
            newFileInput.accept = '.xml,.musicxml,.mxl';

            openButton.parentNode.replaceChild(newOpenButton, openButton);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);

            // Add event listeners
            newOpenButton.addEventListener('click', () => {
                newFileInput.click();
            });

            newFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.loadMusicXMLFile(e.target.files[0]);
                }
            });
        }

        // Also update the result display to show Piano mode is ready
        const resultElement = this.analyzer.container.querySelector('.music-result');
        if (resultElement && resultElement.style.display === 'none') {
            resultElement.style.display = 'block';
        }



        // Initialize playback controller with callbacks
        this.playbackController.initialize(this.analyzer.container, {
            onVisualizationUpdate: this.updateVisualization.bind(this),
            onNotationUpdate: this.updateNotation.bind(this)
        });



        // Set up event listeners for the score model
        this.setupScoreModelListeners();
    }

    /**
     * Set up event listeners for the score model
     */
    setupScoreModelListeners() {
        // Listen for position changes to update visualizations
        this.scoreModel.addEventListener('positionchange', (data) => {
            // Store current position
            this.currentPosition = data.position;

            // Skip visualization updates if containers aren't created yet
            if (!this.pianoVisualization) return;

            // For large position jumps, update immediately (seeking behavior)
            if (Math.abs(data.position - (data.previousPosition || 0)) > 0.3) {
                // Handle page changes immediately
                if (this.notationRenderer) {
                    this.notationRenderer.renderNotation(true);
                }
                return;
            }

            // Updates will happen in the animation loop managed by PlaybackController
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
        // Update note bars
        this.pianoVisualization.updateNoteBars();

        // Highlight piano keys
        const playingNotes = this.scoreModel.getCurrentlyPlayingNotes();
        this.pianoVisualization.highlightPianoKeys(playingNotes);

        // Remove position indicator update since it's been removed
        // this.notationRenderer.updatePositionIndicator(this.scoreModel.currentPosition);
    }

    /**
     * Update notation (called less frequently from animation loop)
     */
    updateNotation(timestamp) {
        if (this.notationRenderer) {

            this.notationRenderer.renderNotation()

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
            // Use the parser to load and process the file
            const scoreData = await this.musicXMLParser.loadMusicXMLFile(file);

            // Set the data in our score model
            this.scoreModel.setScoreData(scoreData);

            // Update UI
            statusElement.textContent = `Loaded: ${scoreData.title}`;
            this.updateScoreUI();

        } catch (error) {
            console.error('Error loading MusicXML file:', error);
            statusElement.textContent = 'Error loading file: ' + error.message;
        }
    }

    updateScoreTitle(title) {
        const songNameElement = document.querySelector('.piano-song-name');
        if (songNameElement) {
            songNameElement.textContent = title;
        }
    }

    createVisualization() {

        const existingContainer = document.getElementById('piano-visualization-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        this.pianoVisualizationContainer = document.createElement('div');
        this.pianoVisualizationContainer.id = 'piano-visualization-container';
        this.pianoVisualizationContainer.className = 'piano-visualization-container';

        this.pianoVisualizationContainer.innerHTML = `
            <div class="notation-container">
            </div>
            <div class="note-bar-container">
            </div>
            <div class="piano-keyboard-container">
                <div class="piano-keyboard">
                </div>
            </div>
           
        `;

        document.body.appendChild(this.pianoVisualizationContainer);

        this.notationContainer = this.pianoVisualizationContainer.querySelector('.notation-container');



        this.analyzer.panel.style.display = 'none';


        // Create the notation renderer
        this.notationRenderer = new NotationRenderer(this.scoreModel, this.notationContainer);

        // Initial render of notation
        this.notationRenderer.renderNotation(true);

        this.pianoVisualization = new PianoVisualization(this.scoreModel, this.pianoVisualizationContainer);


        // Show the visualization
        this.pianoVisualization.show();
    }

    cleanup() {
        // Use playback controller's cleanup
        this.playbackController.cleanup();

        // Release references
        this.notationRenderer = null;

        // Use piano visualization's cleanup
        this.pianoVisualization.cleanup();
    }

    closePianoVisualization() {
        this.cleanup();
        this.analyzer.panel.style.display = 'block';
    }

    updateScoreUI() {


        this.updateScoreTitle(this.scoreModel.title);
        this.playbackController.showPlaybackControls();
        this.createVisualization();
    }
}

