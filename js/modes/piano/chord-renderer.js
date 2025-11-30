/**
 * Chord Renderer
 * Handles detection and visualization of falling chords
 */
class ChordRenderer {
    constructor(container) {
        this.container = container;
        this.fallingChords = [];
        this.lookAheadTime = 4; // Seconds
    }

    /**
     * Update chord visualizations
     * @param {Object} scoreModel 
     */
    update(scoreModel) {
        if (!this.container) return;

        const currentTime = scoreModel.currentPosition;
        const startTime = currentTime - 0.5;
        const endTime = currentTime + this.lookAheadTime;

        // Reset if needed
        if (currentTime < 0.1 && this.fallingChords.length > 0) {
            this.clear();
        }

        // Get visible notes
        const visibleNotes = scoreModel.getVisibleNotes(startTime, endTime);

        // Create new chords
        this.createChords(visibleNotes);

        // Update positions
        this.updatePositions(currentTime);

        // Cleanup
        this.cleanup(startTime);
    }

    /**
     * Create falling chord visualizations
     */
    createChords(visibleNotes) {
        if (!visibleNotes || visibleNotes.length < 2) return;

        const leftHandNotes = this.groupNotesByTimeAndHand(visibleNotes, false);
        const rightHandNotes = this.groupNotesByTimeAndHand(visibleNotes, true);

        this.processHandChords(leftHandNotes, 'left');
        this.processHandChords(rightHandNotes, 'right');
    }

    /**
     * Group notes by time and hand
     */
    groupNotesByTimeAndHand(notes, isRightHand) {
        const notesByTime = {};
        notes.forEach(note => {
            if (note.isTiedFromPrevious) return;
            const noteHand = (note.staff === 1 || (note.staff === undefined && note.noteNumber >= 60));

            if (noteHand === isRightHand) {
                const timeKey = Math.round(note.start * 20) / 20;
                if (!notesByTime[timeKey]) notesByTime[timeKey] = [];
                notesByTime[timeKey].push(note);
            }
        });
        return notesByTime;
    }

    /**
     * Process chords for a hand
     */
    processHandChords(notesByTime, hand) {
        Object.keys(notesByTime).forEach(timeKey => {
            const notes = notesByTime[timeKey];
            const startTime = parseFloat(timeKey);

            if (notes.length >= 2) {
                // Check if exists
                const exists = this.fallingChords.some(c =>
                    Math.abs(c.startTime - startTime) < 0.05 && c.hand === hand
                );
                if (exists) return;

                // Detect chord
                if (typeof MusicTheory !== 'undefined') {
                    const detectedChord = MusicTheory.detectChord(notes);
                    if (detectedChord && detectedChord.name) {
                        this.createChordElement(detectedChord, startTime, hand, notes);
                    }
                }
            }
        });
    }

    /**
     * Create chord element
     */
    createChordElement(chord, startTime, hand, notes) {
        const chordElement = document.createElement('div');
        chordElement.className = `falling-chord ${hand}-hand`;
        chordElement.style.opacity = '0';

        if (hand === 'left') {
            chordElement.style.left = '15px';
            chordElement.style.right = 'auto';
        } else {
            chordElement.style.right = '15px';
            chordElement.style.left = 'auto';
        }

        const maxDuration = Math.max(...notes.map(n => n.visualDuration || n.duration));

        // Initial position
        const containerHeight = this.container.clientHeight;
        const timeToPixelRatio = containerHeight / this.lookAheadTime;
        const height = Math.max(30, maxDuration * timeToPixelRatio);

        // We'll let updatePositions handle the exact Y position, just set height
        chordElement.style.height = `${height}px`;

        // Content
        const chordNameEl = document.createElement('div');
        chordNameEl.className = 'chord-name';
        chordNameEl.textContent = chord.name || "Chord";
        chordNameEl.setAttribute('data-chord-type', this.getChordType(chord));
        chordElement.appendChild(chordNameEl);

        const chordNotesEl = document.createElement('div');
        chordNotesEl.className = 'chord-notes';
        chordNotesEl.textContent = chord.notes?.join(' ') || "";
        chordElement.appendChild(chordNotesEl);

        this.container.appendChild(chordElement);

        this.fallingChords.push({
            element: chordElement,
            startTime,
            duration: maxDuration,
            hand,
            chord,
            notes
        });

        requestAnimationFrame(() => {
            chordElement.style.opacity = '0.95';
        });
    }

    /**
     * Get chord type for styling
     */
    getChordType(chord) {
        if (!chord || !chord.name) return 'other';
        const name = chord.name.toLowerCase().replace(/\s+/g, '');
        const rootPattern = /^[a-g][#b]?/;
        const rootMatch = name.match(rootPattern);
        const quality = rootMatch ? name.substring(rootMatch[0].length) : name;
        const slashIndex = quality.indexOf('/');
        const mainQuality = slashIndex > -1 ? quality.substring(0, slashIndex) : quality;

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

        for (const { pattern, type } of chordPatterns) {
            if (pattern.test(mainQuality)) return type;
        }
        if (mainQuality === '') return 'major';
        return 'other';
    }

    /**
     * Update positions
     */
    updatePositions(currentTime) {
        if (!this.fallingChords.length) return;

        const containerHeight = this.container.clientHeight;
        const timeToPixelRatio = containerHeight / this.lookAheadTime;
        const updates = [];

        this.fallingChords.forEach(chord => {
            const { element, startTime, duration } = chord;
            if (!element || !element.parentNode) return;

            const chordEnd = startTime + duration;
            const isPlaying = startTime <= currentTime && chordEnd > currentTime;
            const isUpcoming = startTime > currentTime && startTime <= currentTime + this.lookAheadTime;
            const isPartiallyVisible = startTime < currentTime && chordEnd > currentTime;
            const isPassed = chordEnd <= currentTime && chordEnd > currentTime - 0.5;
            const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

            if (!isVisible) {
                updates.push({ element, display: 'none' });
                return;
            }

            let topPosition = 0;
            let height = Math.max(30, duration * timeToPixelRatio);
            let opacity = 0.95;

            if (isPlaying || isPartiallyVisible) {
                const elapsedTime = currentTime - startTime;
                const remainingDuration = Math.max(0, duration - elapsedTime);
                topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
            } else if (isUpcoming) {
                const timeToStart = startTime - currentTime;
                topPosition = containerHeight - (timeToStart * timeToPixelRatio) - height;
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

        if (updates.length > 0) {
            requestAnimationFrame(() => {
                for (const update of updates) {
                    update.element.style.display = update.display;
                    if (update.display === 'block') {
                        update.element.style.transform = update.transform;
                        update.element.style.height = update.height;
                        update.element.style.opacity = update.opacity;
                        update.element.classList.toggle('playing', update.isPlaying);

                        const nameEl = update.element.querySelector('.chord-name');
                        if (nameEl) nameEl.classList.toggle('playing', update.isPlaying);
                    }
                }
            });
        }
    }

    /**
     * Cleanup
     */
    cleanup(threshold) {
        const removeList = [];
        for (let i = 0; i < this.fallingChords.length; i++) {
            const chord = this.fallingChords[i];
            if (chord.startTime + chord.duration < threshold) {
                removeList.push(i);
                if (chord.element?.parentNode) {
                    chord.element.parentNode.removeChild(chord.element);
                }
            }
        }
        for (let i = removeList.length - 1; i >= 0; i--) {
            this.fallingChords.splice(removeList[i], 1);
        }
    }

    /**
     * Clear all
     */
    clear() {
        this.fallingChords.forEach(c => {
            if (c.element?.parentNode) c.element.parentNode.removeChild(c.element);
        });
        this.fallingChords = [];
    }
}

window.ChordRenderer = ChordRenderer;
