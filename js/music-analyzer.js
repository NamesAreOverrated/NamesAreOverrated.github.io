/**
 * Music Analyzer
 * Provides real-time analysis of musical input including:
 * - Singing analysis
 * - Guitar tuning
 * - General pitch detection
 */

class MusicAnalyzer {
    constructor() {
        this.analyzing = false;
        this.paused = false;
        this.container = null;
        this.createUI();
        this.bindEvents();
        // Initialize the mode property to 'singing' to match the default UI state
        this.mode = 'singing';

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
                        <div class="mode-option" data-mode="singing">
                            <label class="mode-label">
                                <input type="radio" name="music-mode" value="singing" checked>
                                <span class="mode-icon">🎤</span>
                                <span class="mode-name">Singing</span>
                            </label>
                        </div>
                        <div class="mode-option" data-mode="guitar">
                            <label class="mode-label">
                                <input type="radio" name="music-mode" value="guitar">
                                <span class="mode-icon">🎸</span>
                                <span class="mode-name">Guitar</span>
                            </label>
                        </div>
                    </div>
                    <div class="music-result" style="display: none;">
                        <div class="singing-analysis">
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
        this.detectedKeyElement = this.container.querySelector('.detected-key');
        this.commonNoteElement = this.container.querySelector('.common-note');
        this.notesDisplayElement = this.container.querySelector('.notes-display');
        this.stringNameElement = this.container.querySelector('.string-name');
        this.frequencyValueElement = this.container.querySelector('.frequency-value');
        this.targetFrequencyElement = this.container.querySelector('.target-frequency');
        this.tunerNeedle = this.container.querySelector('.tuner-needle');
        this.tuningDirectionElement = this.container.querySelector('.tuning-direction');
        this.guitarStrings = this.container.querySelectorAll('.guitar-strings .string');
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
                // Fallback to singing mode if no radio is checked
                this.updateMode('singing');
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

        console.log("[MUSIC UI] Received music data update:", data);

        if (!data) {
            // Analysis was stopped
            console.log("[MUSIC UI] Analysis stopped (null data)");
            this.resultElement.style.display = 'none';
            return;
        }

        // Update based on mode
        if (!this.mode) {
            // If mode is not set for some reason, default to singing
            this.mode = 'singing';
        }

        // Update based on mode
        if (this.mode === 'singing') {
            this.updateSingingAnalysis(data);
        } else if (this.mode === 'guitar') {
            this.updateGuitarAnalysis(data);
        }
    }

    updateSingingAnalysis(data) {
        // Show "analyzing" state when no valid frequencies detected
        if (!data.notes || data.notes.length === 0) {
            this.detectedKeyElement.textContent = 'Analyzing...';
            this.commonNoteElement.textContent = 'Waiting for input...';
            this.notesDisplayElement.innerHTML = '<span class="no-notes">No notes detected</span>';
            return;
        }

        // Display meaningful results
        console.log("[MUSIC UI] Displaying detected key:", data.key ? data.key.name : 'Unknown');
        console.log("[MUSIC UI] Detected notes:", data.notes);

        this.detectedKeyElement.textContent = data.key ? data.key.name : 'Unknown';
        this.commonNoteElement.textContent = data.notes[0] ? data.notes[0].name : '--';

        // Update detected notes display
        this.notesDisplayElement.innerHTML = '';
        data.notes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-badge';
            noteElement.textContent = `${note.name}${note.octave}`;
            this.notesDisplayElement.appendChild(noteElement);
        });
    }

    updateGuitarAnalysis(data) {
        if (!data.notes || data.notes.length === 0) {
            this.stringNameElement.textContent = '--';
            this.tunerNeedle.style.transform = 'rotate(0deg)';
            this.tuningDirectionElement.textContent = '--';
            this.frequencyValueElement.textContent = '0.0 Hz';
            return;
        }

        // Get strongest note
        const strongestNote = [...data.notes].sort((a, b) => b.magnitude - a.magnitude)[0];
        const frequency = strongestNote.frequency;

        // Update frequency display
        this.frequencyValueElement.textContent = `${frequency.toFixed(2)} Hz`;

        // Use MusicTheory to analyze guitar string
        const stringInfo = MusicTheory.analyzeGuitarString(frequency);

        if (stringInfo) {
            // Update string name and tuning info
            this.stringNameElement.textContent = stringInfo.stringName;
            this.targetFrequencyElement.textContent = `Target: ${stringInfo.targetFrequency.toFixed(2)} Hz`;

            // Update tuning needle (transform rotation based on cents deviation)
            const rotationDegrees = Math.min(45, Math.max(-45, stringInfo.centsDeviation / 2));
            this.tunerNeedle.style.transform = `rotate(${rotationDegrees}deg)`;

            // Show tuning direction
            if (stringInfo.inTune) {
                this.tuningDirectionElement.textContent = 'In Tune!';
                this.tuningDirectionElement.className = 'in-tune';
            } else {
                this.tuningDirectionElement.textContent =
                    `${Math.abs(stringInfo.centsDeviation)}¢ ${stringInfo.tuningDirection}`;
                this.tuningDirectionElement.className = '';
            }

            // Highlight the matching string in the UI
            this.guitarStrings.forEach(stringElement => {
                stringElement.classList.remove('active', 'in-tune');
                if (stringElement.dataset.string === stringInfo.stringName) {
                    stringElement.classList.add('active');
                    if (stringInfo.inTune) {
                        stringElement.classList.add('in-tune');
                    }
                }
            });
        } else {
            // No recognizable string detected
            this.stringNameElement.textContent = 'No string detected';
            this.tuningDirectionElement.textContent = 'Try playing a single string';
            this.tunerNeedle.style.transform = 'rotate(0deg)';

            // Reset string highlights
            this.guitarStrings.forEach(string => {
                string.classList.remove('active', 'in-tune');
            });
        }
    }

    updateMode(mode) {
        this.mode = mode;
        console.log("[MUSIC UI] Mode updated to:", mode);

        // Show the right analysis panel based on mode
        if (mode === 'singing') {
            this.container.querySelector('.singing-analysis').style.display = 'block';
            this.container.querySelector('.guitar-analysis').style.display = 'none';
        } else if (mode === 'guitar') {
            this.container.querySelector('.singing-analysis').style.display = 'none';
            this.container.querySelector('.guitar-analysis').style.display = 'block';
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