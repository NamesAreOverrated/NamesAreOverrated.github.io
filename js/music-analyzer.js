/**
 * Music Analyzer
 * Provides real-time analysis of musical input including:
 * - Key analysis
 * - Guitar tuning
 * - General pitch detection
 * - Voice training
 */

class MusicAnalyzer {
    constructor() {
        this.analyzing = false;
        this.paused = false;
        this.container = null;
        this.createUI();
        this.bindEvents();

        // Initialize the mode property to 'key' to match the default UI state
        this.mode = 'key';

        // After UI is created and before setting up mode instances
        this.setupModes();

        // Hide the music analyzer button initially
        this.hideToggleButton();

        // Listen for visualizer state changes
        document.addEventListener('visualizer-state-changed', (event) => {
            if (event.detail && event.detail.active) {
                this.showToggleButton();
            } else {
                this.hideToggleButton();
                // Also hide panel if visualizer is turned off
                if (this.panel.style.display !== 'none') {
                    this.panel.style.display = 'none';
                }
                // Stop analysis if it's running when visualizer is disabled
                if (this.analyzing) {
                    this.stopAnalysis();
                }
            }
        });
    }

    setupModes() {
        // Available analyzer modes - check if mode classes are available
        if (typeof KeyAnalyzerMode === 'undefined' ||
            typeof GuitarAnalyzerMode === 'undefined' ||
            typeof VoiceTrainingMode === 'undefined') {
            console.error('Analyzer mode classes not found. Make sure music-analyzer-modes.js is loaded before music-analyzer.js');
            return;
        }

        this.modes = {
            key: new KeyAnalyzerMode(this),
            guitar: new GuitarAnalyzerMode(this),
            voice: new VoiceTrainingMode(this),
            piano: new PianoAnalyzerMode(this)
        };

        // Set initial mode
        this.currentModeInstance = this.modes.key;
    }

    createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.className = 'music-analyzer';

        // Add HTML structure
        this.container.innerHTML = `
            <div class="music-analyzer-toggle">
                <button class="music-toggle">🎵 Analyze Music</button>
            </div>
            <div class="music-analyzer-panel">
                <div class="music-analyzer-header">
                    <h3>Music Analysis</h3>
                    <div class="analyzer-controls">
                        <button class="pause-analysis" title="Pause/Resume Analysis">
                            <span class="pause-icon">⏸️</span>
                        </button>
                        <button class="close-analyzer">×</button>
                    </div>
                </div>
                <div class="music-analyzer-body">
                    <div class="music-status">
                        <p>Analysis will start automatically. Play or sing into your microphone.</p>
                    </div>
                    <div class="music-mode-selector">
                        <div class="mode-option" data-mode="key">
                            <label class="mode-label">
                                <input type="radio" name="music-mode" value="key" checked>
                                <span class="mode-icon">🎹</span>
                                <span class="mode-name">Key</span>
                            </label>
                        </div>
                        <div class="mode-option" data-mode="guitar">
                            <label class="mode-label">
                                <input type="radio" name="music-mode" value="guitar">
                                <span class="mode-icon">🎸</span>
                                <span class="mode-name">Guitar</span>
                            </label>
                        </div>
                        <div class="mode-option" data-mode="voice">
                            <label class="mode-label">
                                <input type="radio" name="music-mode" value="voice">
                                <span class="mode-icon">🗣️</span>
                                <span class="mode-name">Voice Training</span>
                            </label>
                        </div>
                        <div class="mode-option" data-mode="piano">
                            <label class="mode-label">
                                <input type="radio" name="music-mode" value="piano">
                                <span class="mode-icon">🎼</span>
                                <span class="mode-name">Piano</span>
                            </label>
                        </div>
                    </div>
                    <div class="music-result" style="display: none;">
                        <div class="key-analysis">
                            <p class="music-info"><span>Detected Key:</span> <strong class="detected-key">--</strong></p>
                            <p class="music-info"><span>Common Note:</span> <strong class="common-note">--</strong></p>
                            <div class="current-notes">
                                <p><span>Detected Notes:</span></p>
                                <div class="notes-display"></div>
                            </div>
                        </div>
                        <div class="guitar-analysis" style="display: none;">
                            <p class="music-info"><span>String:</span> <strong class="string-name">--</strong></p>
                            <p class="music-info"><span>Frequency:</span> <strong class="frequency-value">0.0 Hz</strong></p>
                            <p class="music-info"><span>Target:</span> <strong class="target-frequency">--</strong></p>
                            <div class="tuner">
                                <div class="tuner-needle"></div>
                                <div class="tuning-direction">--</div>
                            </div>
                            <div class="guitar-strings">
                                <div class="string" data-string="E2">E2</div>
                                <div class="string" data-string="A2">A2</div>
                                <div class="string" data-string="D3">D3</div>
                                <div class="string" data-string="G3">G3</div>
                                <div class="string" data-string="B3">B3</div>
                                <div class="string" data-string="E4">E4</div>
                            </div>
                        </div>
                        <div class="voice-training" style="display: none;">
                            <div class="voice-range-display">
                                <p class="music-info"><span>Vocal Range:</span> <strong class="voice-range">--</strong></p>
                            </div>
                            
                            <div class="voice-exercises">
                                <h4>Practice Exercises</h4>
                                <div class="exercise-selector">
                                    <button class="exercise-btn active" data-exercise="scale">Scale</button>
                                    <button class="exercise-btn" data-exercise="intervals">Intervals</button>
                                    <button class="exercise-btn" data-exercise="sostenuto">Sostenuto</button>
                                    <button class="exercise-btn" data-exercise="custom">Custom</button>
                                </div>
                                
                                <div class="exercise-instructions">
                                    Sing each note displayed. Hold until you match the pitch.
                                </div>
                                
                                <div class="pitch-display">
                                    <div class="target-note" data-note="C4" style="top: 50%;"></div>
                                    <div class="current-pitch" style="top: 50%; left: 50%;"></div>
                                </div>
                                
                                <div class="pitch-guide">
                                    <div class="pitch-match-indicator"></div>
                                </div>
                            </div>
                            
                            <div class="voice-stats">
                                <div class="stats-card">
                                    <h4>Accuracy</h4>
                                    <div class="value accuracy-value">--</div>
                                </div>
                                <div class="stats-card">
                                    <h4>Notes</h4>
                                    <div class="value notes-value">0</div>
                                </div>
                                <div class="stats-card">
                                    <h4>Matches</h4>
                                    <div class="value matches-value">0</div>
                                </div>
                            </div>
                        </div>
                        <div class="piano-analysis" style="display: none;">
                            <div class="piano-controls">
                                <input type="file" id="musicxml-input" accept=".xml,.musicxml" style="display:none;">
                                <button class="open-musicxml">Open MusicXML</button>
                                <div class="piano-playback-controls" style="display:none;">
                                    <button class="piano-play-pause">Play</button>
                                    <input type="range" class="piano-speed" min="0.5" max="2" step="0.1" value="1">
                                    <span class="speed-value">1.0x</span>
                                </div>
                            </div>
                            <div class="piano-status">Select a MusicXML file to visualize</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to document
        document.body.appendChild(this.container);

        // Store references to elements
        this.toggleBtn = this.container.querySelector('.music-toggle');
        this.panel = this.container.querySelector('.music-analyzer-panel');
        this.closeBtn = this.container.querySelector('.close-analyzer');
        this.pauseBtn = this.container.querySelector('.pause-analysis');
        this.statusElement = this.container.querySelector('.music-status');
        this.resultElement = this.container.querySelector('.music-result');

        // Mode selection elements
        this.modeSelectors = this.container.querySelectorAll('input[name="music-mode"]');
        this.modeOptions = this.container.querySelectorAll('.mode-option');

        // Initially hide the panel
        this.panel.style.display = 'none';
    }

    bindEvents() {
        // Toggle panel visibility
        this.toggleBtn.addEventListener('click', () => {
            if (this.panel.style.display === 'none') {
                this.panel.style.display = 'block';

                // Hide the button immediately when panel is shown
                this.toggleBtn.style.transition = 'none'; // Disable transition
                this.toggleBtn.style.opacity = '0';
                this.toggleBtn.style.pointerEvents = 'none';

                // Re-enable transition after a brief timeout
                setTimeout(() => {
                    this.toggleBtn.style.transition = 'all 0.3s ease';
                }, 50);

                // Auto-start analysis when opening the panel
                if (!this.analyzing && !this.paused) {
                    this.startAnalysis();
                } else if (this.paused) {
                    // If we were paused, just show the correct button state
                    this.updatePauseButtonState();
                }
            } else {
                this.panel.style.display = 'none';
                // Show the button when panel is closed
                this.toggleBtn.style.opacity = '1';
                this.toggleBtn.style.pointerEvents = 'auto';

                // If analyzing, stop
                if (this.analyzing) {
                    this.stopAnalysis();
                }
            }
        });

        // Close panel
        this.closeBtn.addEventListener('click', () => {
            this.panel.style.display = 'none';

            // Show the button again when panel is closed
            this.toggleBtn.style.opacity = '1';
            this.toggleBtn.style.pointerEvents = 'auto';

            // If analyzing, stop
            if (this.analyzing) {
                this.stopAnalysis();
            }

            // Reset paused state
            this.paused = false;
            this.updatePauseButtonState();
        });

        // Pause/resume analysis
        this.pauseBtn.addEventListener('click', () => {
            if (!this.analyzing) return;

            if (this.paused) {
                // Resume analysis
                this.paused = false;
                this.updatePauseButtonState();
                this.resumeAnalysis();
            } else {
                // Pause analysis
                this.paused = true;
                this.updatePauseButtonState();
                this.pauseAnalysis();
            }
        });

        // Mode selector - updated to work with new structure
        this.modeSelectors.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateMode(radio.value);

                // Update active state on mode options
                this.modeOptions.forEach(option => {
                    option.classList.toggle('active', option.dataset.mode === radio.value);
                });
            });
        });

        // Also allow clicking the entire mode option to select
        this.modeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const radio = option.querySelector('input[type="radio"]');
                if (radio && !radio.checked) {
                    radio.checked = true;
                    this.updateMode(radio.value);

                    // Update active states
                    this.modeOptions.forEach(opt => {
                        opt.classList.toggle('active', opt === option);
                    });
                }
            });

            // Set initial active class
            if (option.querySelector('input[type="radio"]:checked')) {
                option.classList.add('active');
            }
        });
    }

    updatePauseButtonState() {
        if (!this.pauseBtn) return;

        const pauseIcon = this.pauseBtn.querySelector('.pause-icon');
        if (this.paused) {
            pauseIcon.textContent = '▶️'; // Play icon
            this.pauseBtn.title = 'Resume Analysis';
            this.pauseBtn.classList.add('paused');
        } else {
            pauseIcon.textContent = '⏸️'; // Pause icon
            this.pauseBtn.title = 'Pause Analysis';
            this.pauseBtn.classList.remove('paused');
        }

        // Only enable the pause button if we're analyzing
        this.pauseBtn.disabled = !this.analyzing;
    }

    startAnalysis() {
        // Check if AudioAnalyzer is available
        if (typeof window.AudioAnalyzer === 'undefined') {
            this.showStatus('Error: Audio Analyzer not available. Please check console for errors.', 'error');
            console.error("AudioAnalyzer object not found. Make sure audio-analyzer.js is loaded before music-analyzer.js");
            return;
        }

        // Initialize AudioAnalyzer if needed
        if (!window.AudioAnalyzer.initialized) {
            window.AudioAnalyzer.init().then(initialized => {
                if (initialized) {
                    this.requestMicAccess();
                } else {
                    this.showStatus('Failed to initialize audio analyzer.', 'error');
                }
            });
        } else {
            this.requestMicAccess();
        }
    }

    async requestMicAccess() {
        this.showStatus('Requesting microphone access...', 'info');
        console.log("[MUSIC UI] Requesting microphone access");

        // Request microphone access if not already granted
        if (!window.AudioAnalyzer.microphone) {
            const micAccessGranted = await window.AudioAnalyzer.requestMicrophoneAccess();
            if (!micAccessGranted) {
                console.log("[MUSIC UI] Microphone access denied");
                this.showStatus('Microphone access is required for music analysis.', 'error');
                return;
            }
            console.log("[MUSIC UI] Microphone access granted");
        } else {
            console.log("[MUSIC UI] Microphone already connected");
        }

        // Start the analyzer if not already running, but don't activate visualization
        if (!window.AudioAnalyzer.active && !window.AudioAnalyzer.isAnalyzing) {
            // Don't call window.AudioAnalyzer.start() to avoid showing visualization
            console.log("[MUSIC UI] Audio analyzer initialized but visualization not started");
        } else {
            console.log("[MUSIC UI] Audio analyzer already running");
        }

        // Start music analysis
        this.startActualAnalysis();
    }

    startActualAnalysis() {
        console.log("[MUSIC UI] Starting music analysis");
        const analysisStarted = window.AudioAnalyzer.startAnalysis(data => this.updateMusicData(data));

        if (analysisStarted) {
            this.analyzing = true;
            this.paused = false;
            console.log("[MUSIC UI] Music analysis started successfully");
            this.showStatus('Listening... Play or sing into your microphone. You should see results after a few seconds.', 'active');

            // Display an immediate analyzing state to provide feedback
            this.resultElement.style.display = 'block';

            // Make sure UI is in the right mode based on the selected radio button
            const activeRadio = this.container.querySelector('input[name="music-mode"]:checked');
            if (activeRadio) {
                this.updateMode(activeRadio.value);
            } else {
                // Fallback to key mode if no radio is checked
                this.updateMode('key');
            }

            // Add active class to the toggle button to match visualization buttons
            this.toggleBtn.classList.add('active');

            // Update the pause button state
            this.updatePauseButtonState();
        } else {
            console.log("[MUSIC UI] Failed to start music analysis");
            this.showStatus('Failed to start music analysis.', 'error');
        }
    }

    pauseAnalysis() {
        console.log("[MUSIC UI] Pausing music analysis");
        // We're not stopping analysis completely, just ignoring updates temporarily

        this.showStatus('Analysis paused. Click the play button to resume.', 'info');

        // Update UI
        this.updatePauseButtonState();
    }

    resumeAnalysis() {
        console.log("[MUSIC UI] Resuming music analysis");

        this.showStatus('Listening... Play or sing into your microphone.', 'active');

        // Update UI
        this.updatePauseButtonState();
    }

    stopAnalysis() {
        if (window.AudioAnalyzer) {
            window.AudioAnalyzer.stopAnalysis();
        }

        this.analyzing = false;
        this.paused = false;
        this.showStatus('Analysis stopped. Open the panel again to restart.', 'info');

        // Remove active class from toggle button
        this.toggleBtn.classList.remove('active');

        // Update pause button
        this.updatePauseButtonState();
    }

    updateMusicData(data) {
        // Don't update UI if paused
        if (this.paused) return;

        if (!data) {
            // Analysis was stopped
            console.log("[MUSIC UI] Analysis stopped (null data)");
            this.resultElement.style.display = 'none';
            return;
        }

        // Use the current mode instance to handle the data
        if (this.currentModeInstance && typeof this.currentModeInstance.processData === 'function') {
            this.currentModeInstance.processData(data);
        } else {
            console.warn("[MUSIC UI] No valid mode instance available for processing data");
        }
    }

    updateMode(mode) {
        if (this.mode === mode && this.currentModeInstance) return;

        this.mode = mode;
        console.log("[MUSIC UI] Mode updated to:", mode);

        // Check if modes are initialized
        if (!this.modes) {
            console.error("[MUSIC UI] Modes not initialized");
            return;
        }

        // Get the mode instance
        this.currentModeInstance = this.modes[mode];

        if (!this.currentModeInstance) {
            console.error(`Mode ${mode} not found`);
            return;
        }

        // Show the right analysis panel based on mode
        this.container.querySelector('.key-analysis').style.display = mode === 'key' ? 'block' : 'none';
        this.container.querySelector('.guitar-analysis').style.display = mode === 'guitar' ? 'block' : 'none';
        this.container.querySelector('.voice-training').style.display = mode === 'voice' ? 'block' : 'none';
        this.container.querySelector('.piano-analysis').style.display = mode === 'piano' ? 'block' : 'none';

        // Initialize the mode
        if (typeof this.currentModeInstance.initialize === 'function') {
            this.currentModeInstance.initialize();
        }

        // If we have data and are analyzing, update the UI immediately with the new mode
        if (this.analyzing && !this.paused && window.AudioAnalyzer && window.AudioAnalyzer.currentNotes) {
            const data = {
                notes: window.AudioAnalyzer.currentNotes,
                key: window.AudioAnalyzer.lastDetectedKey
            };
            this.updateMusicData(data);
        }
    }

    showStatus(message, type = 'info') {
        this.statusElement.innerHTML = `<p class="${type}">${message}</p>`;
    }

    showToggleButton() {
        if (this.toggleBtn) {
            // Only show the button if the panel is not currently displayed
            if (this.panel.style.display === 'none') {
                // Restore normal transition for showing
                this.toggleBtn.style.transition = 'all 0.3s ease';
                this.toggleBtn.style.opacity = '1';
                this.toggleBtn.style.pointerEvents = 'auto';
            }
        }
    }

    hideToggleButton() {
        if (this.toggleBtn) {
            // Hide immediately without animation
            this.toggleBtn.style.transition = 'none';
            this.toggleBtn.style.opacity = '0';
            this.toggleBtn.style.pointerEvents = 'none';

            // Re-enable transition after a brief timeout
            setTimeout(() => {
                this.toggleBtn.style.transition = 'all 0.3s ease';
            }, 50);

            // Also remove active class when hiding
            this.toggleBtn.classList.remove('active');
        }
    }
}

// Initialize music analyzer when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make sure MusicTheory is available before initializing
    if (typeof window.MusicTheory === 'undefined') {
        console.error("MusicTheory not found. Make sure music-theory.js is loaded before music-analyzer.js");
        return;
    }

    window.musicAnalyzer = new MusicAnalyzer();
});