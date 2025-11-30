/**
 * Voice Training Mode
 * Provides voice register detection and exploration
 */
class VoiceTrainingMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);

        // Calibration state
        this.calibration = {
            isActive: false,
            step: 'idle', // 'idle', 'intro', 'low', 'high', 'complete'
            tempLow: Infinity,
            tempHigh: -Infinity,
            samples: [],
            stableCount: 0
        };

        // User's detected range
        this.userRange = {
            min: null, // MIDI note number
            max: null, // MIDI note number
            registers: null // Calculated register boundaries
        };

        // Current state
        this.currentNote = null;
        this.isListening = false;
    }

    initialize() {
        const container = this.analyzer.container;

        // Clear any existing content
        const voiceTraining = container.querySelector('.voice-training');
        voiceTraining.innerHTML = '';

        // Create main container
        const mainContainer = document.createElement('div');
        mainContainer.className = 'voice-training-main';
        voiceTraining.appendChild(mainContainer);

        // Start with calibration intro
        this.renderCalibrationIntro();
    }

    renderCalibrationIntro() {
        const container = this.analyzer.container.querySelector('.voice-training-main');
        container.innerHTML = `
            <div class="calibration-container">
                <div class="calibration-step active">
                    <h3>Voice Calibration</h3>
                    <p class="calibration-instruction">Let's find your unique voice range.</p>
                    <p class="calibration-subtext">We'll measure your lowest and highest comfortable notes to customize the analyzer for you.</p>
                    <div class="calibration-controls">
                        <button class="btn-primary" id="start-calibration">Start Calibration</button>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#start-calibration').addEventListener('click', () => {
            this.startLowNoteCalibration();
        });
    }

    startLowNoteCalibration() {
        this.calibration.step = 'low';
        this.calibration.tempLow = Infinity;
        this.calibration.samples = [];
        this.renderCalibrationStep('low');
    }

    startHighNoteCalibration() {
        this.calibration.step = 'high';
        this.calibration.tempHigh = -Infinity;
        this.calibration.samples = [];
        this.renderCalibrationStep('high');
    }

    renderCalibrationStep(type) {
        const container = this.analyzer.container.querySelector('.voice-training-main');
        const title = type === 'low' ? "Sing Your Lowest Note" : "Sing Your Highest Note";
        const instruction = type === 'low'
            ? "Relax and hum down to your lowest comfortable note."
            : "Sing up to your highest comfortable note (Falsetto is okay!).";

        container.innerHTML = `
            <div class="calibration-container">
                <div class="calibration-step active">
                    <h3>${title}</h3>
                    <p class="calibration-instruction">${instruction}</p>
                    
                    <div class="calibration-note-display">---</div>
                    
                    <div class="calibration-meter-container">
                        <div class="calibration-bar" style="height: 0%"></div>
                    </div>
                    
                    <p class="calibration-subtext">Sing steady to capture...</p>
                    
                    <div class="calibration-controls">
                        <button class="btn-secondary" id="cancel-cal">Cancel</button>
                        <button class="btn-primary" id="confirm-cal" disabled>Confirm Note</button>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#cancel-cal').addEventListener('click', () => this.initialize());
        container.querySelector('#confirm-cal').addEventListener('click', () => {
            if (type === 'low') {
                this.userRange.min = this.calibration.tempLow;
                this.startHighNoteCalibration();
            } else {
                this.userRange.max = this.calibration.tempHigh;
                this.finishCalibration();
            }
        });
    }

    finishCalibration() {
        this.calibration.step = 'complete';
        this.calculateRegisters();
        this.renderTrainingUI();
    }

    calculateRegisters() {
        const min = this.userRange.min;
        const max = this.userRange.max;
        const range = max - min;

        // Dynamic register calculation based on total range
        // These ratios are approximations based on vocal pedagogy
        this.userRange.registers = {
            chest: {
                min: min,
                max: min + (range * 0.35),
                name: "Chest Voice",
                desc: "Speaking range, deep & resonant"
            },
            mixed: {
                min: min + (range * 0.35),
                max: min + (range * 0.65),
                name: "Mixed Voice",
                desc: "Blend of chest and head resonance"
            },
            head: {
                min: min + (range * 0.65),
                max: max - (range * 0.1), // Overlap slightly with falsetto
                name: "Head Voice",
                desc: "Light, bright, ringing tone"
            },
            falsetto: {
                min: max - (range * 0.15),
                max: max + 12, // Allow going higher than calibrated
                name: "Falsetto",
                desc: "Airy, flute-like, very high"
            }
        };
    }

    renderTrainingUI() {
        const container = this.analyzer.container.querySelector('.voice-training-main');
        const registers = this.userRange.registers;

        const minNoteName = this.midiToNoteName(this.userRange.min);
        const maxNoteName = this.midiToNoteName(this.userRange.max);

        container.innerHTML = `
            <div class="calibration-container">
                <h3>Your Voice Profile</h3>
                <p class="calibration-subtext">Range: ${minNoteName} - ${maxNoteName}</p>
                
                <div class="range-visualizer">
                    <div class="current-note-indicator" style="display: none;"></div>
                    
                    <div class="range-segment falsetto" id="reg-falsetto">
                        <span>Falsetto</span>
                        <span class="note-range">${this.midiToNoteName(Math.floor(registers.falsetto.min))} - ...</span>
                    </div>
                    <div class="range-segment head" id="reg-head">
                        <span>Head Voice</span>
                        <span class="note-range">${this.midiToNoteName(Math.floor(registers.head.min))} - ${this.midiToNoteName(Math.floor(registers.head.max))}</span>
                    </div>
                    <div class="range-segment mixed" id="reg-mixed">
                        <span>Mixed Voice</span>
                        <span class="note-range">${this.midiToNoteName(Math.floor(registers.mixed.min))} - ${this.midiToNoteName(Math.floor(registers.mixed.max))}</span>
                    </div>
                    <div class="range-segment chest" id="reg-chest">
                        <span>Chest Voice</span>
                        <span class="note-range">${this.midiToNoteName(Math.floor(registers.chest.min))} - ${this.midiToNoteName(Math.floor(registers.chest.max))}</span>
                    </div>
                </div>

                <div class="calibration-controls">
                    <button class="btn-secondary" id="recalibrate">Recalibrate</button>
                </div>
            </div>
        `;

        container.querySelector('#recalibrate').addEventListener('click', () => this.renderCalibrationIntro());
    }

    processData(data) {
        if (!data || !data.notes || data.notes.length === 0) return;

        // Get the strongest note
        const primaryNote = data.notes.reduce((prev, current) =>
            (prev.magnitude > current.magnitude) ? prev : current
        );

        if (primaryNote.magnitude < 0.1) return; // Noise gate

        const midiValue = this.noteToPitchValue(primaryNote);
        const noteName = `${primaryNote.name}${primaryNote.octave}`;

        // Handle Calibration Logic
        if (this.calibration.step === 'low' || this.calibration.step === 'high') {
            this.processCalibrationNote(midiValue, noteName);
        }
        // Handle Training Logic
        else if (this.calibration.step === 'complete') {
            this.updateTrainingDisplay(midiValue);
        }
    }

    processCalibrationNote(midiValue, noteName) {
        const container = this.analyzer.container;
        const noteDisplay = container.querySelector('.calibration-note-display');
        const bar = container.querySelector('.calibration-bar');
        const confirmBtn = container.querySelector('#confirm-cal');
        const subtext = container.querySelector('.calibration-subtext');

        if (!noteDisplay) return;

        noteDisplay.textContent = noteName;

        // Visual feedback based on stability
        // In a real app we'd check variance over time
        bar.style.height = '50%';
        bar.style.backgroundColor = 'var(--accent-color)';

        if (this.calibration.step === 'low') {
            if (midiValue < this.calibration.tempLow) {
                this.calibration.tempLow = midiValue;
                subtext.textContent = "New lowest note detected...";
                // Reset stability if new low found
                this.calibration.stableCount = 0;
            } else if (midiValue === this.calibration.tempLow) {
                this.calibration.stableCount++;
            }
        } else {
            if (midiValue > this.calibration.tempHigh) {
                this.calibration.tempHigh = midiValue;
                subtext.textContent = "New highest note detected...";
                this.calibration.stableCount = 0;
            } else if (midiValue === this.calibration.tempHigh) {
                this.calibration.stableCount++;
            }
        }

        // Enable confirm button if we have a somewhat stable note
        if (this.calibration.stableCount > 10) {
            confirmBtn.disabled = false;
            confirmBtn.classList.add('pulse');
            subtext.textContent = "Hold steady and click Confirm!";
        }
    }

    updateTrainingDisplay(midiValue) {
        const container = this.analyzer.container;
        const indicator = container.querySelector('.current-note-indicator');
        const segments = container.querySelectorAll('.range-segment');

        if (!indicator) return;

        // Determine current register
        let currentReg = null;
        const regs = this.userRange.registers;

        if (midiValue >= regs.falsetto.min) currentReg = 'falsetto';
        else if (midiValue >= regs.head.min) currentReg = 'head';
        else if (midiValue >= regs.mixed.min) currentReg = 'mixed';
        else currentReg = 'chest';

        // Highlight active segment
        segments.forEach(seg => {
            if (seg.id === `reg-${currentReg}`) seg.classList.add('active');
            else seg.classList.remove('active');
        });

        // Position indicator
        // Map midiValue to vertical position (Chest bottom -> Falsetto top)
        const totalMin = regs.chest.min;
        const totalMax = regs.falsetto.max;
        const range = totalMax - totalMin;

        // Calculate percentage (0% at bottom, 100% at top)
        let percent = ((midiValue - totalMin) / range) * 100;
        percent = Math.max(5, Math.min(95, percent)); // Clamp

        indicator.style.display = 'block';
        indicator.style.bottom = `${percent}%`;
        indicator.style.top = 'auto'; // Override default
    }

    // Helper: Convert MIDI number back to Note Name (e.g. 60 -> C4)
    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return noteNames[noteIndex] + octave;
    }

    // Helper: Convert Note Object to MIDI (copied from base class or implemented here if missing)
    noteToPitchValue(note) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return (note.octave + 1) * 12 + noteNames.indexOf(note.name);
    }

    // Helper: Convert Note Name String to MIDI
    noteNameToPitchValue(noteName) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = noteName.match(/([A-G]#?)(\d+)/);
        if (!match) return 0;
        return (parseInt(match[2]) + 1) * 12 + noteNames.indexOf(match[1]);
    }
}

// Make VoiceTrainingMode available globally
window.VoiceTrainingMode = VoiceTrainingMode;
