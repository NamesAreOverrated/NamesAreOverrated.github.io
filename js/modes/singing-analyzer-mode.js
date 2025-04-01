/**
 * Singing analysis mode - detects notes and musical key
 */
class SingingAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);
        this.detectedKeyElement = analyzer.container.querySelector('.detected-key');
        this.commonNoteElement = analyzer.container.querySelector('.common-note');
        this.notesDisplayElement = analyzer.container.querySelector('.notes-display');
    }

    initialize() {
        console.log("[SINGING MODE] Initialized");
    }

    processData(data) {
        // Show "analyzing" state when no valid frequencies detected
        if (!data.notes || data.notes.length === 0) {
            this.detectedKeyElement.textContent = 'Analyzing...';
            this.commonNoteElement.textContent = 'Waiting for input...';
            this.notesDisplayElement.innerHTML = '<span class="no-notes">No notes detected</span>';
            return;
        }

        // Display meaningful results
        console.log("[SINGING MODE] Displaying detected key:", data.key ? data.key.name : 'Unknown');
        console.log("[SINGING MODE] Detected notes:", data.notes);

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
}

// Make the mode class available globally
window.SingingAnalyzerMode = SingingAnalyzerMode;
