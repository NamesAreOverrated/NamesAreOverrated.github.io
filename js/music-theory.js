/**
 * Music Theory Library
 * Provides utilities for musical analysis including:
 * - Pitch detection
 * - Note identification
 * - Musical key analysis
 * - Scale and chord detection
 */

class MusicTheory {
    // Note frequencies (A4 = 440Hz) for octaves 0-8
    static noteFrequencies = {
        'C': [16.35, 32.70, 65.41, 130.81, 261.63, 523.25, 1046.50, 2093.00, 4186.01],
        'C#': [17.32, 34.65, 69.30, 138.59, 277.18, 554.37, 1108.73, 2217.46, 4434.92],
        'D': [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32, 4698.64],
        'D#': [19.45, 38.89, 77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02, 4978.03],
        'E': [20.60, 41.20, 82.41, 164.81, 329.63, 659.26, 1318.51, 2637.02, 5274.04],
        'F': [21.83, 43.65, 87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83, 5587.65],
        'F#': [23.12, 46.25, 92.50, 185.00, 369.99, 739.99, 1479.98, 2959.96, 5919.91],
        'G': [24.50, 49.00, 98.00, 196.00, 392.00, 783.99, 1567.98, 3135.96, 6271.93],
        'G#': [25.96, 51.91, 103.83, 207.65, 415.30, 830.61, 1661.22, 3322.44, 6644.88],
        'A': [27.50, 55.00, 110.00, 220.00, 440.00, 880.00, 1760.00, 3520.00, 7040.00],
        'A#': [29.14, 58.27, 116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31, 7458.62],
        'B': [30.87, 61.74, 123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07, 7902.13]
    };

    // Standard guitar string frequencies (E2, A2, D3, G3, B3, E4)
    static guitarStrings = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

    // Key signatures and their scales
    static keySignatures = {
        'C Major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        'G Major': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
        'D Major': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
        'A Major': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
        'E Major': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
        'B Major': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
        'F# Major': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
        'F Major': ['F', 'G', 'A', 'A#', 'C', 'D', 'E'],
        'A Minor': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        'E Minor': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
        'B Minor': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
        'F# Minor': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
        'C# Minor': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
        'G# Minor': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
        'D Minor': ['D', 'E', 'F', 'G', 'A', 'A#', 'C'],
        'G Minor': ['G', 'A', 'A#', 'C', 'D', 'D#', 'F'],
        'C Minor': ['C', 'D', 'D#', 'F', 'G', 'G#', 'A#']
    };

    // Tonic positions in major and minor keys for key detection
    static keyTonicWeights = {
        major: [5, 1, 2, 1, 3, 1, 1], // I, ii, iii, IV, V, vi, vii°
        minor: [5, 1, 3, 1, 3, 1, 1]  // i, ii°, III, iv, v/V, VI, VII/vii°
    };

    // Common chord types and their interval patterns
    static chordTypes = {
        'maj': [0, 4, 7],           // Major
        'min': [0, 3, 7],           // Minor
        'dim': [0, 3, 6],           // Diminished
        'aug': [0, 4, 8],           // Augmented
        '7': [0, 4, 7, 10],         // Dominant 7th
        'maj7': [0, 4, 7, 11],      // Major 7th
        'min7': [0, 3, 7, 10],      // Minor 7th
        'dim7': [0, 3, 6, 9],       // Diminished 7th
        'hdim7': [0, 3, 6, 10],     // Half-diminished 7th
        'sus4': [0, 5, 7],          // Suspended 4th
        'sus2': [0, 2, 7],          // Suspended 2nd
        'add9': [0, 4, 7, 14],      // Add 9
        '6': [0, 4, 7, 9],          // Major 6th
        'min6': [0, 3, 7, 9],       // Minor 6th
        '9': [0, 4, 7, 10, 14],     // Dominant 9th
        'maj9': [0, 4, 7, 11, 14]   // Major 9th
    };

    /**
     * Detect musical notes from frequency data
     * @param {Array} frequencies Array of frequency objects 
     * @returns {Array} Detected musical notes with properties
     */
    static detectNotes(frequencies) {
        if (!frequencies || frequencies.length === 0) return [];

        const detectedNotes = [];

        for (const freq of frequencies) {
            // Skip frequencies that are too weak
            if (freq.magnitude < 20) continue;

            // Find the closest musical note
            const note = this.frequencyToNote(freq.frequency);

            if (note) {
                // Add additional properties from frequency analysis
                note.frequency = freq.frequency;
                note.magnitude = freq.magnitude;
                note.isFundamental = freq.isFundamental || false;
                note.isHarmonic = freq.isHarmonic || false;

                // Add to detected notes if not already present with higher magnitude
                const existingIndex = detectedNotes.findIndex(n => n.name === note.name && n.octave === note.octave);
                if (existingIndex !== -1) {
                    if (detectedNotes[existingIndex].magnitude < note.magnitude) {
                        detectedNotes[existingIndex] = note;
                    }
                } else {
                    detectedNotes.push(note);
                }
            }
        }

        return detectedNotes;
    }

    /**
     * Convert a frequency to a musical note with adaptive precision
     * @param {number} frequency The frequency in Hz
     * @returns {Object} Note information or null if not matching any note
     */
    static frequencyToNote(frequency) {
        if (frequency < 15 || frequency > 8000) return null;

        let closestNote = null;
        let closestOctave = 0;
        let closestDistance = Infinity;
        let closestFrequency = 0;

        // For each note and each octave, find the closest match
        for (const [noteName, octaveFreqs] of Object.entries(this.noteFrequencies)) {
            for (let octave = 0; octave < octaveFreqs.length; octave++) {
                const noteFreq = octaveFreqs[octave];
                const distance = Math.abs(noteFreq - frequency);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestNote = noteName;
                    closestOctave = octave;
                    closestFrequency = noteFreq;
                }
            }
        }

        // Adaptive tolerance based on frequency range
        let tolerance;
        if (closestFrequency < 100) {
            // Very low notes need wider tolerance (10-15%)
            tolerance = closestFrequency * 0.15;
        } else if (closestFrequency < 200) {
            // Low notes (8-10%)
            tolerance = closestFrequency * 0.1;
        } else if (closestFrequency < 500) {
            // Mid-low notes (5-8%)
            tolerance = closestFrequency * 0.08;
        } else if (closestFrequency < 1000) {
            // Mid-range notes (3-5%)
            tolerance = closestFrequency * 0.05;
        } else {
            // High notes (2-3%)
            tolerance = closestFrequency * 0.03;
        }

        // Calculate cents deviation from ideal frequency
        const centsDeviation = 1200 * Math.log2(frequency / closestFrequency);

        // If within tolerance, return the note
        if (Math.abs(centsDeviation) <= 50) { // 50 cents = half semitone
            return {
                name: closestNote,
                octave: closestOctave,
                exactFrequency: closestFrequency,
                centsDeviation: Math.round(centsDeviation),
                confidence: 1 - Math.abs(centsDeviation) / 50
            };
        }

        return null;
    }

    /**
     * Analyze notes to determine the most likely musical key
     * @param {Array} notes Array of detected notes with weights
     * @returns {Object} Detected key with confidence score
     */
    static analyzeMusicalKey(notes) {
        if (!notes || notes.length < 3) return null;

        // Build a histogram of note occurrences weighted by magnitude/duration
        const noteWeights = {};
        notes.forEach(note => {
            const noteName = note.name;
            noteWeights[noteName] = (noteWeights[noteName] || 0) + (note.weight || 1);
        });

        // Score each potential key
        const keyScores = {};
        let highestScore = 0;
        let bestKey = null;

        for (const [keyName, keyNotes] of Object.entries(this.keySignatures)) {
            // Determine if major or minor
            const isMajor = keyName.includes('Major');
            const tonicWeights = isMajor ? this.keyTonicWeights.major : this.keyTonicWeights.minor;

            // Score based on note presence and position in key
            let score = 0;
            for (const [noteIndex, noteName] of keyNotes.entries()) {
                if (noteWeights[noteName]) {
                    // Weight by position in scale (tonic, dominant, etc)
                    score += noteWeights[noteName] * (tonicWeights[noteIndex] || 1);
                }
            }

            // Penalize notes outside the key
            for (const [noteName, weight] of Object.entries(noteWeights)) {
                if (!keyNotes.includes(noteName)) {
                    score -= weight * 0.5;
                }
            }

            // Store score
            keyScores[keyName] = score;

            if (score > highestScore) {
                highestScore = score;
                bestKey = keyName;
            }
        }

        // No clear winner
        if (highestScore <= 0) return null;

        // Find second best score for confidence calculation
        let secondHighestScore = 0;
        for (const [keyName, score] of Object.entries(keyScores)) {
            if (score > secondHighestScore && score < highestScore) {
                secondHighestScore = score;
            }
        }

        // Calculate confidence based on difference between top scores
        let confidence = 0.5;
        if (secondHighestScore > 0) {
            // How much better is our top key vs next best?
            const scoreDiff = (highestScore - secondHighestScore) / highestScore;
            confidence = Math.min(0.95, 0.5 + scoreDiff * 0.5);
        }

        return {
            name: bestKey,
            confidence: confidence,
            notes: this.keySignatures[bestKey]
        };
    }

    /**
     * Guitar tuner function - detects if a frequency is close to a guitar string
     * @param {number} frequency Detected frequency
     * @returns {Object} Information about the closest guitar string and tuning
     */
    static analyzeGuitarString(frequency) {
        if (frequency < 75 || frequency > 350) return null;

        let closestString = null;
        let closestIndex = -1;
        let closestDistance = Infinity;

        // Find the closest guitar string
        for (let i = 0; i < this.guitarStrings.length; i++) {
            const stringFreq = this.guitarStrings[i];
            const distance = Math.abs(stringFreq - frequency);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestString = stringFreq;
                closestIndex = i;
            }
        }

        // Convert distance to cents
        const centsDeviation = 1200 * Math.log2(frequency / closestString);

        // String names from low to high
        const stringNames = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

        // If within 100 cents (1 semitone), consider it a match
        if (Math.abs(centsDeviation) <= 100) {
            return {
                stringName: stringNames[closestIndex],
                targetFrequency: closestString,
                actualFrequency: frequency,
                centsDeviation: Math.round(centsDeviation),
                // Tuning advice: negative means tune down, positive means tune up
                tuningDirection: centsDeviation < 0 ? 'tune down' : 'tune up',
                inTune: Math.abs(centsDeviation) <= 5, // Consider in tune if within 5 cents
                confidence: 1 - Math.abs(centsDeviation) / 100
            };
        }

        return null;
    }

    /**
     * Detect chord from a set of notes
     * @param {Array} notes Array of note objects with noteNumber or name+octave
     * @returns {Object} Detected chord information or null
     */
    static detectChord(notes) {
        if (!notes || notes.length < 2) return null;

        // Convert notes to MIDI numbers if they're not already
        const midiNotes = notes.map(note => {
            if (note.noteNumber !== undefined) {
                return note.noteNumber;
            } else if (note.name && note.octave !== undefined) {
                return this.noteNameToMidi(note.name, note.octave);
            }
            return null;
        }).filter(n => n !== null);

        if (midiNotes.length < 2) return null;

        // Sort notes and find lowest note (potential root)
        midiNotes.sort((a, b) => a - b);
        const lowestNote = midiNotes[0];

        // Transform to semitone intervals from the lowest note
        const intervals = midiNotes.map(note => (note - lowestNote) % 12);

        // Remove duplicates (we only care about pitch classes)
        const uniqueIntervals = [...new Set(intervals)].sort((a, b) => a - b);

        // Check against known chord patterns
        let bestMatchName = '';
        let bestMatchScore = 0;
        let bestMatchMissing = Infinity;

        for (const [chordName, chordPattern] of Object.entries(this.chordTypes)) {
            // Count matching notes and missing notes
            let matchCount = 0;
            let missingCount = 0;

            for (const interval of chordPattern) {
                if (uniqueIntervals.includes(interval)) {
                    matchCount++;
                } else {
                    missingCount++;
                }
            }

            // Count extra notes not in the pattern
            const extraCount = uniqueIntervals.length - matchCount;

            // Calculate score: prioritize matches, then fewer missing notes, then fewer extra notes
            const score = (matchCount * 10) - (missingCount * 5) - (extraCount * 2);

            // Update best match if this is better
            if (score > bestMatchScore ||
                (score === bestMatchScore && missingCount < bestMatchMissing)) {
                bestMatchScore = score;
                bestMatchName = chordName;
                bestMatchMissing = missingCount;
            }
        }

        // Require at least 2 matching notes and more than 60% of the chord
        if (bestMatchScore < 15) return null;

        // Get the root note name
        const rootNoteName = this.midiNoteToName(lowestNote);

        return {
            name: `${rootNoteName}${bestMatchName}`,
            root: rootNoteName,
            type: bestMatchName,
            notes: midiNotes.map(midi => this.midiNoteToName(midi)),
            inversion: 0, // Basic implementation, doesn't detect inversions yet
            confidence: bestMatchScore / (this.chordTypes[bestMatchName].length * 10)
        };
    }

    /**
     * Convert note name and octave to MIDI note number
     * @param {string} name Note name (e.g., 'C', 'C#')
     * @param {number} octave Octave number
     * @returns {number} MIDI note number
     */
    static noteNameToMidi(name, octave) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = noteNames.indexOf(name);

        if (noteIndex === -1) return null;

        return (octave + 1) * 12 + noteIndex;
    }

    /**
     * Convert MIDI note number to note name
     * @param {number} midiNumber MIDI note number
     * @returns {string} Note name with octave
     */
    static midiNoteToName(midiNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNumber / 12) - 1;
        const noteIndex = midiNumber % 12;

        return noteNames[noteIndex];
    }
}

// Make MusicTheory available globally
window.MusicTheory = MusicTheory;
