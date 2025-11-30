/**
 * Voice Training Mode
 * Provides voice register detection and exploration
 */
class VoiceTrainingMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);

        // Voice range tracking
        this.lowestNote = null;
        this.highestNote = null;

        // Voice type detection - basic ranges based on classical voice categorization
        this.voiceRanges = {
            // Male voice types (MIDI note numbers)
            male: {
                chest: { min: 36, max: 60 },    // C2-C4
                mixed: { min: 55, max: 67 },    // G3-G4
                head: { min: 62, max: 74 },    // D4-D5
                falsetto: { min: 67, max: 84 }  // G4-C6
            },
            // Female voice types
            female: {
                chest: { min: 48, max: 67 },    // C3-G4
                mixed: { min: 62, max: 74 },    // D4-D5
                head: { min: 69, max: 84 },    // A4-C6
                falsetto: { min: 79, max: 96 }  // G5-C7
            }
        };

        // Educational descriptions for each voice register
        this.registerDescriptions = {
            chest: {
                feeling: "Vibration feels strongest in chest/throat",
                sound: "Fuller, deeper, richer sound",
                uses: "Speaking voice, belting in singing"
            },
            mixed: {
                feeling: "Balanced sensation between chest and head",
                sound: "Balanced tone, neither too heavy nor too light",
                uses: "Middle range singing, connecting registers"
            },
            head: {
                feeling: "Vibration feels in face/mask/head",
                sound: "Lighter, brighter sound with less weight",
                uses: "Higher notes without strain"
            },
            falsetto: {
                feeling: "Very light, airy feeling above normal range",
                sound: "Breathy, flutier quality with less core",
                uses: "Special effects, very high notes"
            }
        };

        // Default to unknown voice gender
        this.voiceGender = null;

        // Voice register history for smoothing
        this.voiceRegisterHistory = [];
        this.historyMaxLength = 5;

        // Track register transitions for educational feedback
        this.lastRegister = null;
        this.transitionPoint = null;

        // Register exploration exercises instead of generic pitch matching
        this.registerExercises = {
            'chest-to-mixed': {
                title: "Chest to Mixed Voice",
                description: "Practice transitioning smoothly from chest to mixed voice",
                targetNotes: this.voiceGender === 'female' ?
                    ['E4', 'F4', 'G4', 'A4'] :
                    ['A3', 'B3', 'C4', 'D4']
            },
            'mixed-to-head': {
                title: "Mixed to Head Voice",
                description: "Practice transitioning smoothly from mixed to head voice",
                targetNotes: this.voiceGender === 'female' ?
                    ['B4', 'C5', 'D5', 'E5'] :
                    ['E4', 'F4', 'G4', 'A4']
            },
            'head-to-falsetto': {
                title: "Head to Falsetto",
                description: "Practice transitioning between head voice and falsetto",
                targetNotes: this.voiceGender === 'female' ?
                    ['E5', 'F5', 'G5', 'A5'] :
                    ['A4', 'B4', 'C5', 'D5']
            },
            'full-range': {
                title: "Full Range Exploration",
                description: "Explore your full vocal range across all registers",
                targetNotes: this.voiceGender === 'female' ?
                    ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'] :
                    ['C3', 'E3', 'G3', 'C4', 'E4', 'G4']
            }
        };

        // Current exercise state
        this.exerciseState = {
            currentExercise: 'full-range',
            currentNoteIndex: 0,
            targetRegister: null,
            stats: {
                totalTransitions: 0,
                smoothTransitions: 0
            }
        };
    }

    initialize() {
        const container = this.analyzer.container;

        // Reset stats when mode is initialized
        this.exerciseState.stats = {
            totalTransitions: 0,
            smoothTransitions: 0
        };

        // Add voice type display if not present
        if (!container.querySelector('.voice-register-section')) {
            this.addVoiceRegisterElements(container);
        } else {
            // Update tooltips and descriptions if the section exists
            this.updateRegisterTooltips(container);
        }

        // Replace the pitch practice UI with register exploration UI
        this.replaceExerciseUI(container);

        // Update UI for the current exercise
        this.updateExerciseUI();
    }

    addVoiceRegisterElements(container) {
        const voiceTraining = container.querySelector('.voice-training');

        // Create voice register section with more compact layout
        const registerSection = document.createElement('div');
        registerSection.className = 'voice-register-section';
        registerSection.innerHTML = `
            <h4>Voice Register</h4>
            <div class="voice-register-display">
                <div class="register-indicator">
                    <span class="register-label">Unknown</span>
                    <div class="register-description">Sing into your microphone to detect your voice register</div>
                </div>
                <div class="register-meter">
                    <div class="register-value chest" style="height: 0%" title="${this.getTooltip('chest')}">Chest</div>
                    <div class="register-value mixed" style="height: 0%" title="${this.getTooltip('mixed')}">Mixed</div>
                    <div class="register-value head" style="height: 0%" title="${this.getTooltip('head')}">Head</div>
                    <div class="register-value falsetto" style="height: 0%" title="${this.getTooltip('falsetto')}">Falsetto</div>
                </div>
            </div>
            <div class="register-feedback"></div>
            
            <div class="voice-gender-selector">
                <label><input type="radio" name="voice-gender" value="male"> Male</label>
                <label><input type="radio" name="voice-gender" value="female"> Female</label>
                <button class="toggle-register-info">?</button>
            </div>
            
            <div class="register-info-panel" style="display:none;">
                <p>Voice registers have unique characteristics:</p>
                <ul>
                    <li><strong>Chest:</strong> Lower range, speaking voice</li>
                    <li><strong>Mixed:</strong> Blend of chest and head</li>
                    <li><strong>Head:</strong> Higher, lighter quality</li>
                    <li><strong>Falsetto:</strong> Very high, breathy sound</li>
                </ul>
            </div>
        `;

        // Insert after voice range display
        const rangeDisplay = voiceTraining.querySelector('.voice-range-display');
        voiceTraining.insertBefore(registerSection, rangeDisplay.nextSibling);

        // Set up gender selector listeners
        const genderInputs = registerSection.querySelectorAll('input[name="voice-gender"]');
        genderInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.voiceGender = input.value;
                console.log(`Voice gender set to: ${this.voiceGender}`);

                // Reset history when gender changes to prevent confusion
                this.voiceRegisterHistory = [];
                this.lastRegister = null;
            });
        });

        // Set up toggle for info panel
        const infoToggle = registerSection.querySelector('.toggle-register-info');
        const infoPanel = registerSection.querySelector('.register-info-panel');

        infoToggle.addEventListener('click', () => {
            if (infoPanel.style.display === 'none') {
                infoPanel.style.display = 'block';
                infoToggle.textContent = 'Hide register information';
            } else {
                infoPanel.style.display = 'none';
                infoToggle.textContent = '?';
            }
        });
    }

    replaceExerciseUI(container) {
        const voiceTraining = container.querySelector('.voice-training');

        // Find and remove old exercise UI
        const oldExercises = voiceTraining.querySelector('.voice-exercises');
        if (oldExercises) {
            oldExercises.remove();
        }

        // Create new register-focused exercise UI with correctly ordered vocal bands
        const exerciseSection = document.createElement('div');
        exerciseSection.className = 'register-exercises';
        exerciseSection.innerHTML = `
            <h4>Register Exploration</h4>
            <div class="exercise-selector">
                <button class="exercise-btn active" data-exercise="full-range">Full Range</button>
                <button class="exercise-btn" data-exercise="chest-to-mixed">Chest → Mixed</button>
                <button class="exercise-btn" data-exercise="mixed-to-head">Mixed → Head</button>
                <button class="exercise-btn" data-exercise="head-to-falsetto">Head → Falsetto</button>
            </div>
            
            <div class="exercise-instructions">
                Explore your voice registers by singing the note and register shown below
            </div>
            
            <div class="register-visualization">
                <div class="register-target-indicator">
                    <div class="register-target-note">C4</div>
                    <div class="register-target-name">Chest Voice</div>
                </div>
                <div class="register-vocal-map">
                    <div class="register-band falsetto" data-register="falsetto"></div>
                    <div class="register-band head" data-register="head"></div>
                    <div class="register-band mixed" data-register="mixed"></div>
                    <div class="register-band chest" data-register="chest"></div>
                    <div class="current-pitch-marker"></div>
                </div>
            </div>
            
            <div class="register-feedback-display">
                <div class="register-match-indicator"></div>
                <div class="register-match-text">Sing the note shown above</div>
            </div>
        `;

        // Insert after the voice range display
        const rangeDisplay = voiceTraining.querySelector('.voice-range-display');
        if (rangeDisplay) {
            voiceTraining.insertBefore(exerciseSection, rangeDisplay.nextSibling);
        } else {
            voiceTraining.appendChild(exerciseSection);
        }

        // Replace or update stats display
        const oldStats = voiceTraining.querySelector('.voice-stats');
        if (oldStats) {
            oldStats.innerHTML = `
                <div class="stats-card">
                    <h4>Transitions</h4>
                    <div class="value transitions-value">0</div>
                </div>
                <div class="stats-card">
                    <h4>Smooth</h4>
                    <div class="value smooth-value">0</div>
                </div>
                <div class="stats-card">
                    <h4>Current Register</h4>
                    <div class="value current-register-value">-</div>
                </div>
            `;
        }

        // Set up exercise handlers
        this.setupRegisterExerciseHandlers(container);
    }

    setupRegisterExerciseHandlers(container) {
        // Find exercise buttons
        const exerciseBtns = container.querySelectorAll('.exercise-btn');

        // Add click handlers
        exerciseBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active exercise
                exerciseBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Set current exercise
                this.exerciseState.currentExercise = btn.dataset.exercise;

                // Reset current note index
                this.exerciseState.currentNoteIndex = 0;

                // Update UI
                this.updateExerciseUI();
            });
        });
    }

    updateExerciseUI() {
        const container = this.analyzer.container;
        const exercise = this.registerExercises[this.exerciseState.currentExercise];

        if (!exercise) return;

        // Update exercise instructions
        const instructions = container.querySelector('.exercise-instructions');
        if (instructions) {
            instructions.textContent = exercise.description;
        }

        // Get current target note
        const noteIndex = this.exerciseState.currentNoteIndex % exercise.targetNotes.length;
        const currentNote = exercise.targetNotes[noteIndex];

        // Determine target register based on the note
        const midiValue = this.noteNameToPitchValue(currentNote);
        this.exerciseState.targetRegister = this.getExpectedRegisterForNote(midiValue);

        // Update target note display
        const targetNote = container.querySelector('.register-target-note');
        const targetRegister = container.querySelector('.register-target-name');

        if (targetNote) targetNote.textContent = currentNote;
        if (targetRegister) {
            const registerName = this.exerciseState.targetRegister.charAt(0).toUpperCase() +
                this.exerciseState.targetRegister.slice(1);
            targetRegister.textContent = registerName + " Voice";
            targetRegister.className = 'register-target-name ' + this.exerciseState.targetRegister;
        }

        // Update the visual marker position
        const vocalMap = container.querySelector('.register-vocal-map');
        const marker = container.querySelector('.current-pitch-marker');

        if (vocalMap && marker) {
            // Position marker based on target note pitch
            const position = this.calculateNotePositionInRegisterMap(midiValue);
            marker.style.top = `${position}%`;
        }
    }

    getExpectedRegisterForNote(midiValue) {
        // Determine which register we expect based on the note value and voice gender
        const ranges = this.voiceGender === 'female' ? this.voiceRanges.female : this.voiceRanges.male;

        // Check each register range
        if (midiValue <= ranges.chest.max) return 'chest';
        if (midiValue <= ranges.mixed.max) return 'mixed';
        if (midiValue <= ranges.head.max) return 'head';
        return 'falsetto';
    }

    calculateNotePositionInRegisterMap(midiValue) {
        // Map note to position in the vocal range visualization (0% = highest, 100% = lowest)
        const ranges = this.voiceGender === 'female' ? this.voiceRanges.female : this.voiceRanges.male;

        // Get overall range
        const minNote = ranges.chest.min;
        const maxNote = ranges.falsetto.max;
        const totalRange = maxNote - minNote;

        // Calculate position (inverted so higher notes are at the top)
        const normalizedPosition = (midiValue - minNote) / totalRange;
        return 100 - (normalizedPosition * 100);
    }

    processData(data) {
        if (!data || !data.notes || data.notes.length === 0) return;

        // Update voice range
        this.updateVoiceRange(data.notes);

        // Get the strongest note for register detection
        const primaryNote = this.getPrimaryNote(data.notes);
        if (!primaryNote) return;

        // Update current pitch in register exploration exercise
        this.updateRegisterExploration(primaryNote);

        // Detect voice register (chest, mixed, head, falsetto)
        const voiceRegister = this.detectVoiceRegister(primaryNote);
        if (voiceRegister) {
            this.updateVoiceRegisterDisplay(voiceRegister);

            // Track register transitions for educational feedback
            if (this.lastRegister && this.lastRegister !== voiceRegister.register) {
                this.handleRegisterTransition(this.lastRegister, voiceRegister);
            }

            this.lastRegister = voiceRegister.register;

            // Update current register display in stats
            const currentRegisterValue = this.analyzer.container.querySelector('.current-register-value');
            if (currentRegisterValue) {
                currentRegisterValue.textContent = voiceRegister.register.charAt(0).toUpperCase() +
                    voiceRegister.register.slice(1);

                // Clear other register classes and add current one
                const registerClasses = ['chest', 'mixed', 'head', 'falsetto'];
                registerClasses.forEach(rc => currentRegisterValue.classList.remove(rc));
                currentRegisterValue.classList.add(voiceRegister.register);
            }
        }
    }

    updateRegisterExploration(note) {
        const container = this.analyzer.container;
        if (!note || !container) return;

        const midiValue = this.noteToPitchValue(note);
        const vocalMap = container.querySelector('.register-vocal-map');
        const userMarker = container.querySelector('.current-pitch-marker');

        if (vocalMap && userMarker) {
            // Position user marker based on the current note
            const position = this.calculateNotePositionInRegisterMap(midiValue);
            userMarker.style.top = `${position}%`;
            userMarker.dataset.note = `${note.name}${note.octave}`;

            // Check if the note is close to target note
            const targetNote = container.querySelector('.register-target-note');
            if (targetNote) {
                const targetNoteValue = this.noteNameToPitchValue(targetNote.textContent);
                const distance = Math.abs(midiValue - targetNoteValue);

                const matchIndicator = container.querySelector('.register-match-indicator');
                const matchText = container.querySelector('.register-match-text');

                if (matchIndicator && matchText) {
                    if (distance <= 1) { // Within a semitone
                        matchIndicator.className = 'register-match-indicator match';

                        // Check if register matches target
                        const registerResult = this.detectVoiceRegister(note);
                        if (registerResult && registerResult.register === this.exerciseState.targetRegister) {
                            matchText.textContent = "Perfect! You're in the correct register";

                            // Move to next note after a brief delay
                            if (!this._advanceTimeout) {
                                this._advanceTimeout = setTimeout(() => {
                                    this.exerciseState.currentNoteIndex++;
                                    this.updateExerciseUI();
                                    this._advanceTimeout = null;

                                    // Update stats
                                    this.exerciseState.stats.smoothTransitions++;
                                    this.exerciseState.stats.totalTransitions++;
                                    this.updateTransitionStats();
                                }, 1500);
                            }
                        } else {
                            matchText.textContent = "Right note, but try using your " +
                                this.exerciseState.targetRegister + " voice";
                            matchIndicator.className = 'register-match-indicator close';
                        }
                    } else if (distance <= 3) { // Within 3 semitones
                        matchIndicator.className = 'register-match-indicator close';
                        matchText.textContent = "Getting closer to the note";

                        // Clear any pending advance timeout
                        if (this._advanceTimeout) {
                            clearTimeout(this._advanceTimeout);
                            this._advanceTimeout = null;
                        }
                    } else {
                        matchIndicator.className = 'register-match-indicator';
                        matchText.textContent = "Sing the note shown above";

                        // Clear any pending advance timeout
                        if (this._advanceTimeout) {
                            clearTimeout(this._advanceTimeout);
                            this._advanceTimeout = null;
                        }
                    }
                }
            }
        }
    }

    updateTransitionStats() {
        const container = this.analyzer.container;
        const transitionsValue = container.querySelector('.transitions-value');
        const smoothValue = container.querySelector('.smooth-value');

        if (transitionsValue) {
            transitionsValue.textContent = this.exerciseState.stats.totalTransitions;
        }

        if (smoothValue) {
            smoothValue.textContent = this.exerciseState.stats.smoothTransitions;
        }
    }

    getTooltip(register) {
        const desc = this.registerDescriptions[register];
        return `${register.charAt(0).toUpperCase() + register.slice(1)} Voice\n• Feel: ${desc.feeling}\n• Sound: ${desc.sound}\n• Used for: ${desc.uses}`;
    }

    updateRegisterTooltips(container) {
        // Update tooltips in case they need refreshing
        const registerMeter = container.querySelector('.register-meter');
        if (registerMeter) {
            const types = ['chest', 'mixed', 'head', 'falsetto'];
            types.forEach(type => {
                const bar = registerMeter.querySelector(`.register-value.${type}`);
                if (bar) {
                    bar.title = this.getTooltip(type);
                }
            });
        }
    }

    getPrimaryNote(notes) {
        // Find the note with highest magnitude
        return notes.reduce((strongest, current) => {
            return (!strongest || (current.magnitude > strongest.magnitude)) ? current : strongest;
        }, null);
    }

    updateVoiceRange(notes) {
        notes.forEach(note => {
            const midiValue = this.noteToPitchValue(note);

            // Update lowest note
            if (!this.lowestNote || midiValue < this.lowestNote.value) {
                this.lowestNote = {
                    value: midiValue,
                    name: `${note.name}${note.octave}`
                };
            }

            // Update highest note
            if (!this.highestNote || midiValue > this.highestNote.value) {
                this.highestNote = {
                    value: midiValue,
                    name: `${note.name}${note.octave}`
                };
            }
        });

        // Update voice range display
        if (this.lowestNote && this.highestNote) {
            const rangeDisplay = this.analyzer.container.querySelector('.voice-range');
            if (rangeDisplay) {
                rangeDisplay.textContent = `${this.lowestNote.name} - ${this.highestNote.name}`;
            }
        }
    }

    /**
     * Basic voice register detection based primarily on pitch range
     */
    detectVoiceRegister(note) {
        if (!note) return null;

        // If gender not set, try to infer from vocal range
        if (!this.voiceGender && this.lowestNote && this.highestNote) {
            // If lowest note is below F3 (53), likely male voice
            if (this.lowestNote.value < 53) {
                this.voiceGender = 'male';
            }
            // If highest comfortable note is above C6 (84), likely female voice
            else if (this.highestNote.value > 84) {
                this.voiceGender = 'female';
            }
        }

        // Default to male if still undetermined
        const ranges = this.voiceGender === 'female' ? this.voiceRanges.female : this.voiceRanges.male;

        // Convert note to MIDI value
        const midiValue = this.noteToPitchValue(note);

        // Calculate proximity scores to each range
        const scores = {
            chest: this.calculateRangeScore(midiValue, ranges.chest),
            mixed: this.calculateRangeScore(midiValue, ranges.mixed),
            head: this.calculateRangeScore(midiValue, ranges.head),
            falsetto: this.calculateRangeScore(midiValue, ranges.falsetto)
        };

        // Find the highest scoring register
        let bestRegister = null;
        let highestScore = 0;

        for (const [register, score] of Object.entries(scores)) {
            if (score > highestScore) {
                highestScore = score;
                bestRegister = register;
            }
        }

        // Add spectral characteristics to improve detection
        // Note: This is very simplified compared to a full spectral analysis
        if (note.frequency && bestRegister) {
            const spectralScore = this.estimateSpectralCharacteristics(note);

            // Adjust scores based on spectral characteristics
            if (spectralScore < 0.3) { // More harmonic richness suggests chest voice
                scores.chest += 0.2;
                scores.mixed += 0.1;
                scores.head -= 0.1;
                scores.falsetto -= 0.2;
            } else if (spectralScore > 0.7) { // Less harmonic richness suggests falsetto/head
                scores.chest -= 0.2;
                scores.mixed -= 0.1;
                scores.head += 0.1;
                scores.falsetto += 0.2;
            }

            // Recalculate best register
            highestScore = 0;
            for (const [register, score] of Object.entries(scores)) {
                if (score > highestScore) {
                    highestScore = score;
                    bestRegister = register;
                }
            }
        }

        // Store result including all scores and confidence
        const result = {
            register: bestRegister,
            confidence: highestScore,
            scores: scores,
            note: `${note.name}${note.octave}`,
            midiValue: midiValue
        };

        // Add to history for smoothing
        this.addToRegisterHistory(result);

        // Return smoothed result
        return this.getSmoothRegisterResult();
    }

    /**
     * Calculate how well a note fits into a particular range
     */
    calculateRangeScore(midiValue, range) {
        // If outside the range, give it a low score
        if (midiValue < range.min || midiValue > range.max) {
            return 0.1;
        }

        // Calculate position within range (0 to 1)
        const rangeSize = range.max - range.min;
        const position = (midiValue - range.min) / rangeSize;

        // Score is highest (1.0) in the middle of the range, lower at edges
        const score = 1.0 - Math.abs(position - 0.5) * 1.5;
        return Math.max(0.1, score);
    }

    /**
     * Very simplified spectral characteristic estimation
     */
    estimateSpectralCharacteristics(note) {
        // In a full implementation, we would analyze the actual spectrum
        // Here we use a simplified approach based on frequency and magnitude

        // Lower notes tend to have richer harmonics (chest voice)
        // Higher notes tend to have fewer harmonics (head voice/falsetto)
        const midiValue = this.noteToPitchValue(note);

        // Normalize to 0-1 range (C3 to C6)
        const normalizedValue = Math.max(0, Math.min(1, (midiValue - 48) / 36));

        // Return a score where 0 = likely chest, 1 = likely falsetto
        return normalizedValue;
    }

    /**
     * Add result to history for smoothing
     */
    addToRegisterHistory(result) {
        this.voiceRegisterHistory.push(result);

        // Keep history at maximum length
        if (this.voiceRegisterHistory.length > this.historyMaxLength) {
            this.voiceRegisterHistory.shift();
        }
    }

    /**
     * Get smoothed result from history
     */
    getSmoothRegisterResult() {
        if (this.voiceRegisterHistory.length === 0) return null;

        // Count occurrences of each register
        const registers = {
            chest: 0,
            mixed: 0,
            head: 0,
            falsetto: 0
        };

        // Sum confidence scores for each register
        this.voiceRegisterHistory.forEach(result => {
            registers[result.register] += result.confidence;
        });

        // Find register with highest total confidence
        let bestRegister = 'chest';
        let highestScore = 0;

        for (const [register, score] of Object.entries(registers)) {
            if (score > highestScore) {
                highestScore = score;
                bestRegister = register;
            }
        }

        // Calculate aggregate confidence
        const confidence = highestScore / this.voiceRegisterHistory.length;

        // Get the most recent result for additional details
        const lastResult = this.voiceRegisterHistory[this.voiceRegisterHistory.length - 1];

        return {
            register: bestRegister,
            confidence: confidence,
            scores: lastResult.scores,
            note: lastResult.note,
            midiValue: lastResult.midiValue
        };
    }

    /**
     * Handle register transitions for educational feedback
     */
    handleRegisterTransition(fromRegister, toRegisterResult) {
        const container = this.analyzer.container;
        const feedbackElement = container.querySelector('.register-feedback');
        if (!feedbackElement) return;

        // Only provide feedback for significant transitions
        if (toRegisterResult.confidence < 0.6) return;

        const toRegister = toRegisterResult.register;
        const note = toRegisterResult.note;

        // Clear previous feedback
        feedbackElement.innerHTML = '';

        // Create transition message based on direction
        let message = '';

        // Define register order from low to high
        const registerOrder = ['chest', 'mixed', 'head', 'falsetto'];
        const fromIndex = registerOrder.indexOf(fromRegister);
        const toIndex = registerOrder.indexOf(toRegister);

        if (fromIndex < toIndex) {
            // Moving up in registers
            message = `<span class="transition-arrow">↑</span> Transition to ${toRegister} voice around note ${note}`;
            this.transitionPoint = {
                direction: 'up',
                fromRegister: fromRegister,
                toRegister: toRegister,
                note: note,
                midiValue: toRegisterResult.midiValue
            };
        } else {
            // Moving down in registers
            message = `<span class="transition-arrow">↓</span> Transition to ${toRegister} voice around note ${note}`;
            this.transitionPoint = {
                direction: 'down',
                fromRegister: fromRegister,
                toRegister: toRegister,
                note: note,
                midiValue: toRegisterResult.midiValue
            };
        }

        // Add feedback message with animation
        feedbackElement.innerHTML = `<div class="transition-message">${message}</div>`;
        feedbackElement.querySelector('.transition-message').classList.add('highlight-transition');

        // Remove highlight after animation completes
        setTimeout(() => {
            const msgElement = feedbackElement.querySelector('.transition-message');
            if (msgElement) {
                msgElement.classList.remove('highlight-transition');
            }
        }, 3000);
    }

    /**
     * Update the UI with detected voice register
     */
    updateVoiceRegisterDisplay(result) {
        const container = this.analyzer.container;
        const registerLabel = container.querySelector('.register-label');
        const registerDescription = container.querySelector('.register-description');
        const registerMeter = container.querySelector('.register-meter');

        if (!registerLabel || !registerMeter) return;

        // Update label with register and confidence
        const confidencePercent = Math.round(result.confidence * 100);
        registerLabel.textContent = `${result.register.charAt(0).toUpperCase() + result.register.slice(1)} Voice (${confidencePercent}%)`;

        // Add descriptive text based on the register
        if (registerDescription && this.registerDescriptions[result.register]) {
            const desc = this.registerDescriptions[result.register];
            registerDescription.textContent = desc.sound;
            registerDescription.title = `${desc.feeling}\n${desc.uses}`;
        }

        // Update meter visualization for each register type
        const types = ['chest', 'mixed', 'head', 'falsetto'];
        types.forEach(type => {
            const bar = registerMeter.querySelector(`.register-value.${type}`);
            if (bar) {
                // Convert score to percentage
                const score = result.scores[type] || 0;
                const percent = Math.round(score * 100);
                bar.style.height = `${percent}%`;

                // Highlight active register
                bar.classList.toggle('active', type === result.register);
            }
        });
    }
}

// Make VoiceTrainingMode available globally
window.VoiceTrainingMode = VoiceTrainingMode;
