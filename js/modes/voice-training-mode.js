/**
 * Voice training mode - helps with vocal exercises
 */
class VoiceTrainingMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);

        // UI elements
        this.voiceRangeElement = analyzer.container.querySelector('.voice-range');
        this.exerciseButtons = analyzer.container.querySelectorAll('.exercise-btn');
        this.exerciseInstructions = analyzer.container.querySelector('.exercise-instructions');
        this.targetNoteElement = analyzer.container.querySelector('.target-note');
        this.currentPitchElement = analyzer.container.querySelector('.current-pitch');
        this.pitchMatchIndicator = analyzer.container.querySelector('.pitch-match-indicator');
        this.accuracyValueElement = analyzer.container.querySelector('.accuracy-value');
        this.notesValueElement = analyzer.container.querySelector('.notes-value');
        this.matchesValueElement = analyzer.container.querySelector('.matches-value');

        // Voice training properties
        this.voiceLowestNote = null;
        this.voiceHighestNote = null;
        this.currentExercise = 'scale';
        this.exerciseNotes = [];
        this.currentExerciseStep = 0;
        this.pitchAccuracy = [];
        this.isMatchingPitch = false;

        // Bind event handlers
        this.exerciseButtons.forEach(button => {
            button.addEventListener('click', () => {
                const exercise = button.dataset.exercise;
                this.setVoiceExercise(exercise);

                // Update active state
                this.exerciseButtons.forEach(btn => {
                    btn.classList.toggle('active', btn === button);
                });
            });
        });
    }

    initialize() {
        console.log("[VOICE MODE] Initializing voice training mode");

        // Reset voice range tracking
        this.voiceLowestNote = null;
        this.voiceHighestNote = null;

        // Reset exercise state
        this.currentExerciseStep = 0;
        this.pitchAccuracy = [];

        // Set default exercise
        this.setVoiceExercise('scale');

        // Update UI
        this.voiceRangeElement.textContent = "Sing to detect range";
        this.accuracyValueElement.textContent = "--";
        this.notesValueElement.textContent = "0";
        this.matchesValueElement.textContent = "0";

        // Show instructions
        this.updateExerciseInstructions();
    }

    processData(data) {
        if (!data.notes || data.notes.length === 0) {
            // No notes detected, but keep the UI visible
            // Update pitch position to indicate no sound
            this.updatePitchPosition(null);
            this.updatePitchMatchIndicator(false);
            return;
        }

        // Get the strongest note for voice training
        const strongestNote = [...data.notes].sort((a, b) => b.magnitude - a.magnitude)[0];

        // Analyze the vocal range
        this.analyzeVocalRange(strongestNote);

        // Update the pitch position in the display
        this.updatePitchPosition(strongestNote);

        // Check if the current note matches the target note
        this.checkPitchMatch(strongestNote);
    }

    analyzeVocalRange(note) {
        if (!note) return;

        // Convert note to MIDI number for easy comparison
        const noteValue = this.noteToPitchValue(note);

        // Update lowest and highest notes if needed
        if (!this.voiceLowestNote || noteValue < this.voiceLowestNote) {
            this.voiceLowestNote = noteValue;
        }

        if (!this.voiceHighestNote || noteValue > this.voiceHighestNote) {
            this.voiceHighestNote = noteValue;
        }

        // Update the vocal range display
        if (this.voiceLowestNote && this.voiceHighestNote) {
            // Get note names for display
            const lowestNoteName = this.pitchValueToNoteName(this.voiceLowestNote);
            const highestNoteName = this.pitchValueToNoteName(this.voiceHighestNote);

            // Update the display
            this.voiceRangeElement.textContent = `${lowestNoteName} to ${highestNoteName}`;
        }
    }

    updatePitchPosition(note) {
        if (!note) {
            // No note detected - move indicator to bottom
            this.currentPitchElement.style.top = '90%';
            this.currentPitchElement.style.left = '50%';
            return;
        }

        // Convert note to a position in the pitch display
        // The pitch display goes from low (bottom) to high (top)
        const noteValue = this.noteToPitchValue(note);

        // Get position: from 10% (low) to 90% (high) of the container height
        // Typical vocal range is about 2 octaves or 24 semitones
        // Use C3 (MIDI 48) to C5 (MIDI 72) as a common vocal range
        const minValue = 48; // C3
        const maxValue = 72; // C5
        const range = maxValue - minValue;

        // Invert the percentage (higher notes = higher position = smaller top percentage)
        const percentage = 90 - Math.min(80, Math.max(0, ((noteValue - minValue) / range) * 80));

        // Update pitch indicator position
        this.currentPitchElement.style.top = `${percentage}%`;

        // Horizontal position slightly varied based on detected cents deviation
        const cents = note.centsDeviation || 0;
        const xPosition = 50 + (cents / 50); // Shift left/right based on cents
        this.currentPitchElement.style.left = `${xPosition}%`;
    }

    updateTargetNote() {
        if (!this.exerciseNotes || this.exerciseNotes.length === 0) return;

        const targetNote = this.exerciseNotes[this.currentExerciseStep % this.exerciseNotes.length];
        this.targetNoteElement.setAttribute('data-note', targetNote);

        // Convert note name to pitch value (MIDI number)
        const noteValue = this.noteNameToPitchValue(targetNote);

        // Calculate vertical position (inverted, higher notes = smaller top percentage)
        const minValue = 48; // C3
        const maxValue = 72; // C5
        const range = maxValue - minValue;
        const percentage = 90 - Math.min(80, Math.max(0, ((noteValue - minValue) / range) * 80));

        // Update target line position
        this.targetNoteElement.style.top = `${percentage}%`;
    }

    checkPitchMatch(note) {
        if (!note || !this.exerciseNotes || this.exerciseNotes.length === 0) {
            this.updatePitchMatchIndicator(false);
            return;
        }

        // Get current target note
        const targetNote = this.exerciseNotes[this.currentExerciseStep % this.exerciseNotes.length];
        const targetValue = this.noteNameToPitchValue(targetNote);
        const detectedValue = this.noteToPitchValue(note);

        // Calculate how close we are to the target (in semitones)
        const semitoneDistance = Math.abs(targetValue - detectedValue);
        const centsDeviation = Math.abs(note.centsDeviation || 0);

        let matchStatus = false;
        let isClose = false;

        // Check match conditions
        if (semitoneDistance === 0 && centsDeviation <= 15) {
            // Perfect match: same note, less than 15 cents deviation
            matchStatus = true;

            // Track this match
            if (!this.isMatchingPitch) {
                this.isMatchingPitch = true;
                this.pitchAccuracy.push(Math.max(0, 100 - centsDeviation * 3));

                // Update stats
                this.notesValueElement.textContent = this.pitchAccuracy.length;

                // Calculate success rate
                const matches = this.pitchAccuracy.filter(acc => acc >= 80).length;
                this.matchesValueElement.textContent = matches;

                // Calculate overall accuracy
                const avgAccuracy = this.pitchAccuracy.reduce((sum, val) => sum + val, 0) / this.pitchAccuracy.length;
                this.accuracyValueElement.textContent = `${Math.round(avgAccuracy)}%`;

                // If sostenuto mode, wait more time for a match
                if (this.currentExercise !== 'sostenuto' || this.pitchAccuracy.length % 3 === 0) {
                    // Move to next note in the exercise after a short delay
                    setTimeout(() => {
                        this.currentExerciseStep++;
                        this.updateTargetNote();
                        this.isMatchingPitch = false;
                    }, 1000);
                }
            }
        } else if (semitoneDistance === 0 && centsDeviation <= 30) {
            // Close match: same note, less than 30 cents deviation
            isClose = true;
        } else {
            // No match
            this.isMatchingPitch = false;
        }

        // Update UI to show match status
        this.updatePitchMatchIndicator(matchStatus, isClose);
    }

    updatePitchMatchIndicator(isMatch, isClose = false) {
        // Remove all classes first
        this.pitchMatchIndicator.classList.remove('match', 'close');

        // Add appropriate class based on match status
        if (isMatch) {
            this.pitchMatchIndicator.classList.add('match');
        } else if (isClose) {
            this.pitchMatchIndicator.classList.add('close');
        }
    }

    updateExerciseInstructions() {
        switch (this.currentExercise) {
            case 'scale':
                this.exerciseInstructions.textContent = "Sing each note of the scale in sequence.";
                break;
            case 'intervals':
                this.exerciseInstructions.textContent = "Sing from the base note (C) to each interval and back.";
                break;
            case 'sostenuto':
                this.exerciseInstructions.textContent = "Hold each note steady for at least 3 seconds.";
                break;
            case 'custom':
                this.exerciseInstructions.textContent = "Practice notes in your comfortable range.";
                break;
        }
    }

    setVoiceExercise(exercise) {
        this.currentExercise = exercise;
        this.currentExerciseStep = 0;

        // Generate notes for the exercise
        switch (exercise) {
            case 'scale':
                this.exerciseNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
                this.exerciseInstructions.textContent = "Sing the scale notes in sequence.";
                break;
            case 'intervals':
                this.exerciseNotes = ['C4', 'E4', 'C4', 'F4', 'C4', 'G4', 'C4', 'A4'];
                this.exerciseInstructions.textContent = "Practice intervals from the root note (C).";
                break;
            case 'sostenuto':
                this.exerciseNotes = ['C4', 'E4', 'G4'];
                this.exerciseInstructions.textContent = "Hold each note steady for at least 3 seconds.";
                break;
            case 'custom':
                // Adapt to the user's detected range if available
                if (this.voiceLowestNote && this.voiceHighestNote) {
                    const noteRange = this.getCustomNoteRange();
                    this.exerciseNotes = noteRange;
                    this.exerciseInstructions.textContent = "Custom exercise based on your vocal range.";
                } else {
                    this.exerciseNotes = ['A3', 'C4', 'E4', 'G4', 'A4'];
                    this.exerciseInstructions.textContent = "Sing more to customize this exercise to your range.";
                }
                break;
        }

        // Set the initial target note
        this.updateTargetNote();
    }

    getCustomNoteRange() {
        // Create a custom exercise based on detected vocal range
        const result = [];

        if (!this.voiceLowestNote || !this.voiceHighestNote) {
            return ['C4', 'D4', 'E4', 'F4', 'G4']; // Default if no range detected
        }

        // Get a comfortable range within their detected limits
        const lowValue = this.voiceLowestNote + 2; // Start slightly above their lowest note
        const highValue = this.voiceHighestNote - 2; // End slightly below their highest note

        // Generate 5-8 notes within this range
        const range = highValue - lowValue;
        const steps = Math.min(8, Math.max(5, Math.floor(range / 2)));

        for (let i = 0; i < steps; i++) {
            const noteValue = lowValue + Math.floor((i / (steps - 1)) * range);
            result.push(this.pitchValueToNoteName(noteValue));
        }

        return result;
    }
}

// Make the mode class available globally
window.VoiceTrainingMode = VoiceTrainingMode;
