/**
 * Base class for all music analyzer modes
 */
class MusicAnalyzerMode {
    constructor(analyzer) {
        this.analyzer = analyzer;
    }

    initialize() {
        // Override in derived classes
    }

    processData(data) {
        // Override in derived classes
    }

    // Shared utility methods for all modes
    noteToPitchValue(note) {
        // Convert note object to MIDI note number
        if (!note || !note.name) return 60; // Default to C4

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = note.octave !== undefined ? note.octave : 4;
        const noteIndex = noteNames.indexOf(note.name);

        if (noteIndex === -1) return 60; // Default to C4 if not found

        return 12 + (octave * 12) + noteIndex;
    }

    noteNameToPitchValue(noteName) {
        // Convert note name (e.g., "C4") to MIDI note number
        if (!noteName) return 60; // Default to C4

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const note = noteName.substring(0, noteName.length - 1);
        const octave = parseInt(noteName.charAt(noteName.length - 1), 10);
        const noteIndex = noteNames.indexOf(note);

        if (noteIndex === -1 || isNaN(octave)) return 60; // Default to C4 if not found

        return 12 + (octave * 12) + noteIndex;
    }

    pitchValueToNoteName(pitchValue) {
        // Convert MIDI note number to note name
        if (!pitchValue) return 'C4';

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor((pitchValue - 12) / 12);
        const noteIndex = (pitchValue - 12) % 12;

        return `${noteNames[noteIndex]}${octave}`;
    }
}

// Make base class available globally
window.MusicAnalyzerMode = MusicAnalyzerMode;
