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
        this.container = null;
        this.createUI();
        this.bindEvents();
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
                    <button class="close-analyzer">×</button>
                </div>
                <div class="music-analyzer-body">
                    <div class="music-status">
                        <p>Click "Start Analysis" and play or sing into your microphone.</p>
                    </div>
                    <div class="music-mode-selector">
                        <label class="mode-label">
                            <input type="radio" name="music-mode" value="singing" checked>
                            <span>Singing</span>
                        </label>
                        <label class="mode-label">
                            <input type="radio" name="music-mode" value="guitar">
                            <span>Guitar</span>
                        </label>
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
                    <div class="music-controls">
                        <button class="start-analysis">Start Analysis</button>
                        <button class="stop-analysis" disabled>Stop Analysis</button>
                    </div>
                    <div class="music-info">
                        <p>This tool analyzes your music to detect pitch, key, and tuning information.</p>
                        <p>Play or sing into your microphone for best results.</p>
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
        this.startBtn = this.container.querySelector('.start-analysis');
        this.stopBtn = this.container.querySelector('.stop-analysis');
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
        this.modeSelector = this.container.querySelectorAll('input[name="music-mode"]');

        // Initially hide the panel
        this.panel.style.display = 'none';
    }

    bindEvents() {
        // Toggle panel visibility
        this.toggleBtn.addEventListener('click', () => {
            if (this.panel.style.display === 'none') {
                this.panel.style.display = 'block';
            } else {
                this.panel.style.display = 'none';
            }
        });

        // Close panel
        this.closeBtn.addEventListener('click', () => {
            this.panel.style.display = 'none';

            // If analyzing, stop
            if (this.analyzing) {
                this.stopAnalysis();
            }
        });

        // Start analysis
        this.startBtn.addEventListener('click', () => {
            this.startAnalysis();
        });

        // Stop analysis
        this.stopBtn.addEventListener('click', () => {
            this.stopAnalysis();
        });

        // Mode selector
        this.modeSelector.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateMode(radio.value);
            });
        });
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
        console.log("[MUSIC UI] Starting music analysis");
        const analysisStarted = window.AudioAnalyzer.startAnalysis(data => this.updateMusicData(data));

        if (analysisStarted) {
            this.analyzing = true;
            console.log("[MUSIC UI] Music analysis started successfully");
            this.showStatus('Listening... Play or sing into your microphone. You should see results after a few seconds.', 'active');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;

            // Display an immediate analyzing state to provide feedback
            this.resultElement.style.display = 'block';

            // No longer forcing redraw of visualizer
        } else {
            console.log("[MUSIC UI] Failed to start music analysis");
            this.showStatus('Failed to start music analysis.', 'error');
        }
    }

    stopAnalysis() {
        if (window.AudioAnalyzer) {
            window.AudioAnalyzer.stopAnalysis();

            // Don't update visualizer since we're not using it for music analysis
        }

        this.analyzing = false;
        this.showStatus('Analysis stopped. Click "Start Analysis" to try again.', 'info');
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }

    updateMusicData(data) {
        console.log("[MUSIC UI] Received music data update:", data);

        if (!data) {
            // Analysis was stopped
            console.log("[MUSIC UI] Analysis stopped (null data)");
            this.resultElement.style.display = 'none';
            return;
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
        if (mode === 'singing') {
            this.container.querySelector('.singing-analysis').style.display = 'block';
            this.container.querySelector('.guitar-analysis').style.display = 'none';
        } else if (mode === 'guitar') {
            this.container.querySelector('.singing-analysis').style.display = 'none';
            this.container.querySelector('.guitar-analysis').style.display = 'block';
        }
    }

    showStatus(message, type = 'info') {
        this.statusElement.innerHTML = `<p class="${type}">${message}</p>`;
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