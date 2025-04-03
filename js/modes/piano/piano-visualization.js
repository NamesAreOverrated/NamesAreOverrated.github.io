/**
 * Piano Visualization
 * Handles piano keyboard, note bars, and chord visualization
 */
class PianoVisualization {
    constructor(scoreModel, container) {
        // Store reference to the score model
        this.scoreModel = scoreModel;

        // UI containers
        this.pianoVisualizationContainer = container;
        this.keyboardContainer = container.querySelector('.piano-keyboard');
        this.noteBarContainer = container.querySelector('.note-bar-container');

        // Visualization settings
        this.noteBars = [];
        this.fallingChords = [];
        this.noteBarLookAhead = 4; // Seconds of notes to show ahead

        // Generate keyboard and set up resize handler
        this.generatePianoKeyboard();
        this.setupResizeHandler();
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        // Store reference to bound handler for later removal
        this._resizeHandler = () => {
            if (this.pianoVisualizationContainer &&
                this.pianoVisualizationContainer.style.display !== 'none') {
                this.updateNoteBarsPosition();
                if (typeof this.onResizeCallback === 'function') {
                    this.onResizeCallback();
                }
            }
        };

        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Generate the piano keyboard with all keys
     */
    generatePianoKeyboard() {
        const keyboard = this.keyboardContainer;
        if (!keyboard) return;

        keyboard.innerHTML = '';

        // Create a document fragment for better performance
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

        keyboard.appendChild(fragment);
    }

    /**
     * Show the visualization
     */
    show() {
        this.pianoVisualizationContainer.style.display = 'block';
        // Small delay to ensure DOM is ready before positioning
        setTimeout(() => this.updateNoteBarsPosition(), 50);
    }

    /**
     * Close the visualization
     */
    close() {
        // Stop animations
        if (this.noteBarContainer) {
            this.noteBars.forEach(bar => {
                if (bar.element) {
                    bar.element.style.animation = 'none';
                }
            });
        }
        this.pianoVisualizationContainer.style.display = 'none';
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Cancel any animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Remove the resize event listener
        window.removeEventListener('resize', this._resizeHandler);

        // Clear all visual elements
        if (this.noteBarContainer) {
            this.noteBarContainer.innerHTML = '';

            // Clear references to DOM elements in note bars
            if (this.noteBars) {
                this.noteBars.forEach(bar => {
                    if (bar.element && bar.element.parentNode) {
                        bar.element.parentNode.removeChild(bar.element);
                    }
                    bar.element = null;
                    bar.keyElement = null;
                });
            }
            this.noteBars = [];

            // Clear falling chords references
            if (this.fallingChords) {
                this.fallingChords.forEach(chord => {
                    if (chord.element && chord.element.parentNode) {
                        chord.element.parentNode.removeChild(chord.element);
                    }
                    chord.element = null;
                });
            }
            this.fallingChords = [];
        }

        // Clear keyboard container
        if (this.keyboardContainer) {
            this.keyboardContainer.innerHTML = '';
        }

        // Remove container from DOM if it exists
        if (this.pianoVisualizationContainer?.parentNode) {
            this.pianoVisualizationContainer.parentNode.removeChild(this.pianoVisualizationContainer);
            this.pianoVisualizationContainer = null;
        }

        // Clear callback references
        this.onResizeCallback = null;

        // Clear piano containers
        this.keyboardContainer = null;
        this.noteBarContainer = null;
    }

    /**
     * Highlight piano keys for currently playing notes
     * @param {Array} notes Array of notes to highlight
     */
    highlightPianoKeys(notes) {
        if (!this.pianoVisualizationContainer) return;

        // Remove all active highlights first
        const keys = this.pianoVisualizationContainer.querySelectorAll('.piano-key.active');
        keys.forEach(key => key.classList.remove('active'));

        // Exit if no notes to highlight
        if (!notes?.length) return;

        // Add active class to keys for currently playing notes
        for (const note of notes) {
            if (!note?.noteNumber) continue;

            const key = this.pianoVisualizationContainer.querySelector(
                `.piano-key[data-note="${note.noteNumber}"]`
            );
            key?.classList.add('active');
        }
    }

    /**
     * Update note bars visualization
     */
    updateNoteBars() {
        if (!this.noteBarContainer || !this.scoreModel.notes.length) return;

        // Reset on new playback
        if (this.scoreModel.currentPosition < 0.1 && this.noteBars.length > 0) {
            this.noteBarContainer.innerHTML = '';
            this.noteBars = [];
            this.fallingChords = [];
        }

        // Define visible time window
        const startTime = this.scoreModel.currentPosition - 0.5;
        const endTime = this.scoreModel.currentPosition + this.noteBarLookAhead;

        // Get notes in the visible range
        const visibleNotes = this.scoreModel.getVisibleNotes(startTime, endTime);

        // Create any missing note bars and chord visualizations
        this.createMissingNoteBars(visibleNotes);
        this.createFallingChordVisualizations(visibleNotes);

        // Position all visual elements
        this.updateNoteBarsPosition();

        // Clean up notes that are no longer visible
        this.cleanupInvisibleNoteBars(startTime);
    }

    /**
     * Create note bars for visible notes that don't have bars yet
     * @param {Array} visibleNotes Array of visible notes
     */
    createMissingNoteBars(visibleNotes) {
        if (!visibleNotes?.length) return;

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        let newBars = 0;

        for (const note of visibleNotes) {
            const noteId = `${note.id}-${note.start.toFixed(6)}`;

            // Skip if this note already has a bar
            if (this.noteBars.some(bar => bar.noteId === noteId)) continue;

            // Create a new note bar
            const barElement = this.createNoteBarElement(note, noteId);
            if (barElement) {
                fragment.appendChild(barElement.element);
                this.noteBars.push(barElement);
                newBars++;
            }
        }

        // Only update DOM if we have new bars
        if (newBars > 0) {
            this.noteBarContainer.appendChild(fragment);

            // Now fade in the new bars after they're in the DOM
            requestAnimationFrame(() => {
                for (let i = this.noteBars.length - newBars; i < this.noteBars.length; i++) {
                    const bar = this.noteBars[i];
                    if (bar.element) {
                        bar.element.style.transition = 'opacity 0.2s ease-out';
                        bar.element.style.opacity = '0.7';  // Default opacity for note bars
                    }
                }
            });
        }
    }

    /**
     * Create a visual note bar element
     * @param {Object} note The note to visualize
     * @param {string} noteId Unique ID for the note bar
     * @return {Object|null} Object containing the element and note data or null
     */
    createNoteBarElement(note, noteId) {
        const keyElement = this.pianoVisualizationContainer.querySelector(
            `.piano-key[data-note="${note.noteNumber}"]`
        );
        if (!keyElement) return null;

        // Create note bar element
        const noteBar = document.createElement('div');
        noteBar.className = 'note-bar';

        // Set initial styles to prevent flickering
        noteBar.style.opacity = '0';
        noteBar.style.transition = 'none';

        // Add styles based on note properties
        const isBlackKey = [1, 3, 6, 8, 10].includes(note.noteNumber % 12);
        if (isBlackKey) noteBar.classList.add('black-note');

        // Determine hand and add appropriate class
        const isRightHand = note.staff === 1 || (note.staff === undefined && note.noteNumber >= 60);
        noteBar.classList.add(isRightHand ? 'right-hand' : 'left-hand');

        // Pre-calculate initial position to prevent flickering
        const containerHeight = this.noteBarContainer.clientHeight;
        const currentTime = this.scoreModel.currentPosition;
        const timeToPixelRatio = containerHeight / this.noteBarLookAhead;
        const keyRect = keyElement.getBoundingClientRect();
        const noteBarContainerRect = this.noteBarContainer.getBoundingClientRect();
        const keyPosition = {
            left: keyRect.left - noteBarContainerRect.left + (keyRect.width / 2),
            width: keyRect.width
        };

        // Calculate initial position based on timing
        const noteStart = note.start;
        const noteDuration = note.visualDuration || note.duration;
        const noteHeight = Math.max(8, noteDuration * timeToPixelRatio);
        let topPosition = 0;

        if (noteStart > currentTime) {
            // Upcoming note
            const timeToStart = noteStart - currentTime;
            topPosition = containerHeight - (timeToStart * timeToPixelRatio) - noteHeight;
        } else {
            // Currently playing note
            const elapsedTime = currentTime - noteStart;
            const remainingDuration = Math.max(0, noteDuration - elapsedTime);
            topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
        }

        // Apply initial positioning directly
        noteBar.style.transform = `translate3d(${keyPosition.left - (keyPosition.width / 2)}px, ${topPosition}px, 0)`;
        noteBar.style.width = `${keyPosition.width}px`;
        noteBar.style.height = `${note.staccato ? noteHeight * 0.7 : noteHeight}px`;

        // Add articulation classes with a more concise approach
        const articulations = {
            staccato: note.staccato,
            accent: note.accent,
            tenuto: note.tenuto,
            fermata: note.fermata,
            tied: note.hasTie,
            'tied-continuation': note.isTiedFromPrevious
        };

        Object.entries(articulations).forEach(([className, condition]) => {
            if (condition) noteBar.classList.add(className);
        });

        // Add data attributes
        noteBar.dataset.noteId = noteId;
        noteBar.dataset.duration = note.visualDuration || note.duration;
        noteBar.dataset.start = note.start;
        noteBar.dataset.part = note.partId;
        noteBar.dataset.voice = note.voice;
        noteBar.dataset.staff = note.staff || "unspecified";

        // Add note name
        const noteNameElement = document.createElement('div');
        noteNameElement.className = 'note-name';
        noteNameElement.textContent = note.step +
            (note.alter === 1 ? '#' : note.alter === -1 ? 'b' : '');
        noteBar.appendChild(noteNameElement);

        return { noteId, element: noteBar, note, keyElement };
    }

    /**
     * Calculate position for a note bar
     * @param {Object} bar Note bar data
     * @param {Object} params Calculation parameters
     * @returns {Object} Position and display data
     */
    calculateNoteBarPosition(bar, params) {
        const { currentTime, containerHeight, timeToPixelRatio, minHeight, keyPositions } = params;
        const { note, keyElement } = bar;

        // Get or calculate key position
        let keyPosition;
        if (keyPositions.has(note.noteNumber)) {
            keyPosition = keyPositions.get(note.noteNumber);
        } else {
            const keyRect = keyElement.getBoundingClientRect();
            const noteBarContainerRect = this.noteBarContainer.getBoundingClientRect();
            keyPosition = {
                left: keyRect.left - noteBarContainerRect.left + (keyRect.width / 2),
                width: keyRect.width
            };
            keyPositions.set(note.noteNumber, keyPosition);
        }

        const noteStart = note.start;
        const noteDuration = note.visualDuration || note.duration;
        const noteEnd = noteStart + noteDuration;

        // Check visibility state
        const isPlaying = noteStart <= currentTime && noteEnd > currentTime;
        const isUpcoming = noteStart > currentTime && noteStart <= currentTime + this.noteBarLookAhead;
        const isPartiallyVisible = noteStart < currentTime && noteEnd > currentTime;
        const isPassed = noteEnd <= currentTime && noteEnd > currentTime - 0.5;
        const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

        if (!isVisible) {
            return { display: 'none' };
        }

        // Calculate position and dimensions
        const noteHeight = Math.max(minHeight, noteDuration * timeToPixelRatio);
        let topPosition = 0;
        let opacity = 1;

        if (isPlaying) {
            const elapsedTime = currentTime - noteStart;
            const remainingDuration = Math.max(0, noteDuration - elapsedTime);
            topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
        } else if (isUpcoming) {
            const timeToStart = noteStart - currentTime;
            topPosition = containerHeight - (timeToStart * timeToPixelRatio) - noteHeight;
        } else if (isPartiallyVisible) {
            const elapsedTime = currentTime - noteStart;
            const remainingDuration = Math.max(0, noteDuration - elapsedTime);
            topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
        } else if (isPassed) {
            opacity = Math.max(0, 0.5 - (currentTime - noteEnd));
            topPosition = containerHeight;
        }

        // Apply staccato visual effect
        let finalHeight = note.staccato ? noteHeight * 0.7 : noteHeight;

        return {
            display: 'block',
            x: keyPosition.left - (keyPosition.width / 2),
            y: topPosition,
            width: keyPosition.width,
            height: finalHeight,
            opacity: note.accent ? 0.95 : opacity,
            isPlaying
        };
    }

    /**
     * Update positions of all note bars
     */
    updateNoteBarsPosition() {
        if (!this.noteBarContainer || !this.noteBars.length) return;

        const containerHeight = this.noteBarContainer.clientHeight;
        const currentTime = this.scoreModel.currentPosition;
        const timeToPixelRatio = containerHeight / this.noteBarLookAhead;
        const MIN_NOTE_HEIGHT = 8;

        // Cache container rect and key positions
        const keyPositions = new Map();

        // Calculate all updates before applying to DOM
        const updates = [];
        const params = {
            currentTime,
            containerHeight,
            timeToPixelRatio,
            minHeight: MIN_NOTE_HEIGHT,
            keyPositions
        };

        // Process note bars
        for (const bar of this.noteBars) {
            if (!bar.element || !bar.keyElement) continue;
            const noteData = this.calculateNoteBarPosition(bar, params);
            if (noteData) {
                updates.push({ element: bar.element, data: noteData });
            }
        }

        // Apply all DOM updates in one batch
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                for (const { element, data } of updates) {
                    element.style.display = data.display;
                    if (data.display === 'block') {
                        element.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
                        element.style.width = `${data.width}px`;
                        element.style.height = `${data.height}px`;
                        element.style.opacity = data.opacity;
                        element.classList.toggle('playing', data.isPlaying);
                    }
                }
            });
        }

        // Update falling chord positions
        this.updateFallingChordPositions(containerHeight, currentTime);
    }

    /**
     * Clean up invisible note bars
     * @param {number} startTime Current view start time
     */
    cleanupInvisibleNoteBars(startTime) {
        const cleanupThreshold = startTime - 1.0;

        // Use a single pass approach to clean up both note bars and chords
        this.cleanupElements(this.noteBars, cleanupThreshold);
        this.cleanupElements(this.fallingChords, cleanupThreshold);
    }

    /**
     * Helper method to clean up any visualization elements
     * @param {Array} elements Array of elements to clean
     * @param {number} threshold Time threshold for cleanup
     */
    cleanupElements(elements, threshold) {
        if (!elements || elements.length === 0) return;

        // Identify elements to remove
        const removeList = [];

        for (let i = 0; i < elements.length; i++) {
            const item = elements[i];
            const itemStart = item.startTime || (item.note && item.note.start) || 0;
            const itemDuration = item.duration ||
                (item.note && (item.note.visualDuration || item.note.duration)) || 0;

            if (itemStart + itemDuration < threshold) {
                removeList.push(i);
                if (item.element?.parentNode) {
                    item.element.parentNode.removeChild(item.element);
                }
            }
        }

        // Remove from array in reverse to maintain indices
        for (let i = removeList.length - 1; i >= 0; i--) {
            elements.splice(removeList[i], 1);
        }
    }

    /**
     * Create falling chord visualizations for upcoming chord groups
     * @param {Array} visibleNotes Visible notes within the current window
     */
    createFallingChordVisualizations(visibleNotes) {
        if (!visibleNotes || visibleNotes.length < 2) return;

        // First, group notes by start time and hand
        const leftHandNotesByTime = this.groupNotesByTimeAndHand(visibleNotes, false);
        const rightHandNotesByTime = this.groupNotesByTimeAndHand(visibleNotes, true);

        // Process each group for left hand
        this.processHandChords(leftHandNotesByTime, 'left');

        // Process each group for right hand
        this.processHandChords(rightHandNotesByTime, 'right');
    }

    /**
     * Group notes by start time and hand (left or right)
     * @param {Array} notes Array of notes
     * @param {boolean} isRightHand True for right hand, false for left hand
     * @returns {Object} Notes grouped by time
     */
    groupNotesByTimeAndHand(notes, isRightHand) {
        const notesByTime = {};

        notes.forEach(note => {
            // Skip tied continuation notes
            if (note.isTiedFromPrevious) return;

            // Determine hand based on staff or note number
            const noteHand = (note.staff === 1 || (note.staff === undefined && note.noteNumber >= 60));

            // Only include notes for the specified hand
            if (noteHand === isRightHand) {
                // Round to 50ms for chord grouping
                const timeKey = Math.round(note.start * 20) / 20;

                if (!notesByTime[timeKey]) {
                    notesByTime[timeKey] = [];
                }
                notesByTime[timeKey].push(note);
            }
        });

        return notesByTime;
    }

    /**
     * Process and create chord visualizations for one hand
     * @param {Object} notesByTime Notes grouped by time
     * @param {string} hand 'left' or 'right'
     */
    processHandChords(notesByTime, hand) {
        // Process each time group that has multiple notes (potential chord)
        Object.keys(notesByTime).forEach(timeKey => {
            const notes = notesByTime[timeKey];
            const startTime = parseFloat(timeKey);

            // Only consider as chord if we have at least 2 notes
            if (notes.length >= 2) {
                // Find if we already have a chord visualization for this time and hand
                const existingChordIndex = this.fallingChords.findIndex(
                    c => Math.abs(c.startTime - startTime) < 0.05 && c.hand === hand
                );

                // Skip if we already have this chord
                if (existingChordIndex >= 0) return;

                // Detect chord using MusicTheory
                const detectedChord = MusicTheory.detectChord(notes);

                // Only proceed if we have a valid chord detection
                if (detectedChord && detectedChord.name) {
                    this.createFallingChordElement(detectedChord, startTime, hand, notes);
                }
            }
        });
    }

    /**
     * Create a visual element for a falling chord
     * @param {Object} chord The detected chord
     * @param {number} startTime When the chord begins
     * @param {string} hand 'left' or 'right'
     * @param {Array} notes Array of notes in the chord
     */
    createFallingChordElement(chord, startTime, hand, notes) {
        if (!this.noteBarContainer) return;

        // Create the DOM element
        const chordElement = document.createElement('div');
        chordElement.className = `falling-chord ${hand}-hand`;

        // Set initial styles to prevent flickering at top-left corner
        chordElement.style.opacity = '0';

        // Pre-position based on hand
        if (hand === 'left') {
            chordElement.style.left = '15px';
            chordElement.style.right = 'auto';
        } else {
            chordElement.style.right = '15px';
            chordElement.style.left = 'auto';
        }

        // Calculate initial position
        const containerHeight = this.noteBarContainer.clientHeight;
        const currentTime = this.scoreModel.currentPosition;
        const timeToPixelRatio = containerHeight / this.noteBarLookAhead;

        // Calculate duration based on the longest note in the chord
        const maxDuration = Math.max(...notes.map(note => note.visualDuration || note.duration));

        // Calculate height & position
        const height = Math.max(30, maxDuration * timeToPixelRatio);
        let topPosition;

        if (startTime > currentTime) {
            const timeToStart = startTime - currentTime;
            topPosition = containerHeight - (timeToStart * timeToPixelRatio) - height;
        } else {
            const elapsedTime = currentTime - startTime;
            const remainingDuration = Math.max(0, maxDuration - elapsedTime);
            topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
        }

        // Apply initial positioning
        chordElement.style.transform = `translate3d(0, ${topPosition}px, 0)`;
        chordElement.style.height = `${height}px`;

        // Add chord information
        const chordNameEl = document.createElement('div');
        chordNameEl.className = 'chord-name';
        chordNameEl.textContent = chord.name || "Chord";

        // Add chord type attribute for styling
        const chordType = this.getChordType(chord);
        chordNameEl.setAttribute('data-chord-type', chordType);

        chordElement.appendChild(chordNameEl);

        // Add a subtle indicator for the notes in the chord
        const chordNotesEl = document.createElement('div');
        chordNotesEl.className = 'chord-notes';
        chordNotesEl.textContent = chord.notes?.join(' ') || "";
        chordElement.appendChild(chordNotesEl);

        // Store chord data
        const chordData = {
            element: chordElement,
            startTime: startTime,
            duration: maxDuration,
            hand: hand,
            chord: chord,
            notes: notes
        };

        // Add to the container and track in our array
        this.noteBarContainer.appendChild(chordElement);
        this.fallingChords.push(chordData);

        // Fade in with a small delay to ensure positioning is applied first
        requestAnimationFrame(() => {
            chordElement.style.opacity = '0.95';
        });
    }

    /**
     * Extract chord type from chord name with improved pattern matching
     * @param {Object} chord The chord object
     * @returns {string} The chord type for styling
     */
    getChordType(chord) {
        if (!chord || !chord.name) return 'other';

        // Convert to lowercase and remove all spaces for consistent processing
        const name = chord.name.toLowerCase().replace(/\s+/g, '');

        // First extract the root note to avoid confusion
        const rootPattern = /^[a-g][#b]?/;
        const rootMatch = name.match(rootPattern);

        // Get just the chord quality part (without the root note)
        const quality = rootMatch ? name.substring(rootMatch[0].length) : name;

        // Handle slash chords - extract just the quality before the slash
        const slashIndex = quality.indexOf('/');
        const mainQuality = slashIndex > -1 ? quality.substring(0, slashIndex) : quality;

        // Map of regex patterns to chord types for more maintainable matching
        const chordPatterns = [
            { pattern: /maj13/, type: 'maj13' },
            { pattern: /13/, type: '13' },
            { pattern: /maj11/, type: 'maj11' },
            { pattern: /11/, type: '11' },
            { pattern: /maj9/, type: 'maj9' },
            { pattern: /9/, type: '9' },
            { pattern: /maj7b5/, type: 'maj7b5' },
            { pattern: /7#5|7\+5|7aug/, type: '7aug' },
            { pattern: /7b5/, type: '7b5' },
            { pattern: /maj7#5|maj7\+5/, type: 'maj7aug' },
            { pattern: /maj7/, type: 'maj7' },
            { pattern: /m7b5|min7b5|ø/, type: 'min7b5' },
            { pattern: /m7|min7|-7/, type: 'min7' },
            { pattern: /7sus4|7sus/, type: '7sus4' },
            { pattern: /7/, type: '7' },
            { pattern: /dim7|°7/, type: 'dim7' },
            { pattern: /dim|°/, type: 'dim' },
            { pattern: /aug\+|aug|augmented|\+/, type: 'aug' },
            { pattern: /sus2/, type: 'sus2' },
            { pattern: /sus4|sus/, type: 'sus4' },
            { pattern: /min|m|-/, type: 'minor' },
            { pattern: /maj|major|\^|△/, type: 'major' },
            { pattern: /add9/, type: 'add9' },
            { pattern: /add11/, type: 'add11' },
            { pattern: /add13/, type: 'add13' },
            { pattern: /add/, type: 'add' },
            { pattern: /m6|min6|-6/, type: 'min6' },
            { pattern: /6/, type: '6' }
        ];

        // Find the first matching pattern
        for (const { pattern, type } of chordPatterns) {
            if (pattern.test(mainQuality)) {
                return type;
            }
        }

        // If there's no explicit quality and it's just a root note
        if (mainQuality === '') return 'major';

        // Fallback
        return 'other';
    }

    /**
     * Update positions of falling chord elements
     * @param {number} containerHeight Height of the container
     * @param {number} currentTime Current playback position
     */
    updateFallingChordPositions(containerHeight, currentTime) {
        if (!this.fallingChords?.length) return;

        // Calculate positions for chords
        const timeToPixelRatio = containerHeight / this.noteBarLookAhead;
        const updates = [];

        this.fallingChords.forEach(chordData => {
            const element = chordData.element;
            if (!element || !element.parentNode) return;

            const chordStart = chordData.startTime;
            const chordDuration = chordData.duration;
            const chordEnd = chordStart + chordDuration;

            // Visibility checks - same logic as note bars
            const isPlaying = chordStart <= currentTime && chordEnd > currentTime;
            const isUpcoming = chordStart > currentTime && chordStart <= currentTime + this.noteBarLookAhead;
            const isPartiallyVisible = chordStart < currentTime && chordEnd > currentTime;
            const isPassed = chordEnd <= currentTime && chordEnd > currentTime - 0.5;
            const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

            if (!isVisible) {
                updates.push({ element, display: 'none' });
                return;
            }

            // Position logic similar to note bars
            let topPosition = 0;
            let height = Math.max(30, chordDuration * timeToPixelRatio);
            let opacity = 0.95;

            if (isPlaying) {
                const elapsedTime = currentTime - chordStart;
                const remainingDuration = Math.max(0, chordDuration - elapsedTime);
                topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
            } else if (isUpcoming) {
                const timeToStart = chordStart - currentTime;
                topPosition = containerHeight - (timeToStart * timeToPixelRatio) - height;
            } else if (isPartiallyVisible) {
                const elapsedTime = currentTime - chordStart;
                const remainingDuration = Math.max(0, chordDuration - elapsedTime);
                topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
            } else if (isPassed) {
                opacity = Math.max(0, 0.5 - (currentTime - chordEnd));
                topPosition = containerHeight;
            }

            updates.push({
                element,
                display: 'block',
                transform: `translate3d(0, ${topPosition}px, 0)`,
                height: `${height}px`,
                opacity,
                isPlaying
            });
        });

        // Batch DOM updates for better performance
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                for (const update of updates) {
                    update.element.style.display = update.display;

                    if (update.display === 'block') {
                        update.element.style.transform = update.transform;
                        update.element.style.height = update.height;
                        update.element.style.opacity = update.opacity;
                        update.element.classList.toggle('playing', update.isPlaying);

                        // Update chord name element
                        const chordNameEl = update.element.querySelector('.chord-name');
                        if (chordNameEl) {
                            chordNameEl.classList.toggle('playing', update.isPlaying);
                        }
                    }
                }
            });
        }
    }

    /**
     * Register a callback for resize events
     * @param {Function} callback Function to call on resize
     */
    onResize(callback) {
        this.onResizeCallback = callback;
    }

    /**
     * Get the notation container element
     * @returns {HTMLElement} The notation container
     */
    getNotationContainer() {
        return this.notationContainer;
    }
}

// Make the class available globally
window.PianoVisualization = PianoVisualization;
