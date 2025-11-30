/**
 * Piano Keyboard Component
 * Handles generation and interaction with the piano keyboard UI
 */
class PianoKeyboard {
    constructor(container) {
        this.container = container;
        this.keyPositions = new Map();
        this.generateKeyboard();
    }

    /**
     * Generate the piano keyboard with all keys
     */
    generateKeyboard() {
        if (!this.container) return;

        this.container.innerHTML = '';
        const fragment = document.createDocumentFragment();

        for (let i = 21; i <= 108; i++) {
            const isBlackKey = [1, 3, 6, 8, 10].includes(i % 12);
            const keyElement = document.createElement('div');
            keyElement.className = `piano-key ${isBlackKey ? 'black-key' : 'white-key'}`;
            keyElement.dataset.note = i;

            // Add octave labels on C keys
            if (!isBlackKey && i % 12 === 0) {
                const octave = Math.floor(i / 12) - 1;
                const label = document.createElement('div');
                label.className = 'key-label';
                label.textContent = `C${octave}`;
                keyElement.appendChild(label);
            }

            fragment.appendChild(keyElement);
        }

        this.container.appendChild(fragment);
    }

    /**
     * Highlight piano keys for currently playing notes
     * @param {Array} notes Array of notes to highlight
     */
    highlightKeys(notes) {
        if (!this.container) return;

        // Remove all active highlights first
        const keys = this.container.querySelectorAll('.piano-key.active');
        keys.forEach(key => key.classList.remove('active'));

        // Exit if no notes to highlight
        if (!notes?.length) return;

        // Add active class to keys for currently playing notes
        for (const note of notes) {
            if (!note?.noteNumber) continue;

            const key = this.container.querySelector(
                `.piano-key[data-note="${note.noteNumber}"]`
            );
            key?.classList.add('active');
        }
    }

    /**
     * Get the position and width of a key
     * @param {number} noteNumber MIDI note number
     * @param {HTMLElement} relativeContainer Container to calculate relative position to
     * @returns {Object|null} {left, width} or null if not found
     */
    getKeyPosition(noteNumber, relativeContainer) {
        // Check cache first? 
        // Actually, caching might be tricky if window resizes. 
        // Let's rely on the caller to handle caching or just calculate it.
        // But for performance, we might want to cache it per resize.

        const keyElement = this.container.querySelector(`.piano-key[data-note="${noteNumber}"]`);
        if (!keyElement) return null;

        const keyRect = keyElement.getBoundingClientRect();
        const containerRect = relativeContainer.getBoundingClientRect();

        return {
            left: keyRect.left - containerRect.left + (keyRect.width / 2),
            width: keyRect.width,
            element: keyElement
        };
    }

    /**
     * Clear the keyboard
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.keyPositions.clear();
    }
}

window.PianoKeyboard = PianoKeyboard;
