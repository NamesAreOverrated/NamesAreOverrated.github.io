/**
 * Chord Overlay Renderer
 * Handles detection and visualization of chord progressions
 */
class ChordOverlay {
    constructor(container) {
        this.container = container;
        this.element = document.createElement('div');
        this.element.className = 'chord-progression-container';
        this.container.appendChild(this.element);
        this.chordBlocks = new Map();
    }

    /**
     * Render chord progression bar
     */
    render(visibleNotes, startTime, endTime, measurePositions, svgContainer) {
        if (!visibleNotes?.length || !measurePositions.size) return;

        this.element.innerHTML = '';
        this.chordBlocks.clear();

        const chordSegments = this.detectChords(visibleNotes);
        if (!chordSegments.length) return;

        // Align with SVG
        if (svgContainer) {
            const svgRect = svgContainer.getBoundingClientRect();
            const containerRect = this.container.getBoundingClientRect();
            this.element.style.left = `${svgRect.left - containerRect.left}px`;
            this.element.style.width = `${svgRect.width}px`;
            this.element.style.position = 'absolute';
            // Increase height to accommodate both hands
            this.element.style.height = '50px';
            this.element.style.top = '5px';
        }

        const fragment = document.createDocumentFragment();

        for (const chord of chordSegments) {
            if (!chord) continue;

            const positionData = this.getChordPosition(chord, measurePositions);
            if (!positionData) continue;

            const { left, width } = positionData;
            const chordBlock = document.createElement('div');
            chordBlock.className = `chord-block ${chord.hand}-hand`;
            chordBlock.textContent = chord.name || '';
            chordBlock.dataset.chordType = this.getChordType(chord);
            chordBlock.dataset.startTime = chord.startTime.toFixed(3);
            chordBlock.dataset.endTime = chord.endTime.toFixed(3);

            const notesList = chord.notes.map(n =>
                `${n.step}${n.alter === 1 ? '#' : n.alter === -1 ? 'b' : ''}${n.octave}`
            ).join(', ');
            chordBlock.title = `${chord.name || 'Unknown'} (${chord.hand}): ${notesList}`;

            chordBlock.style.position = 'absolute';
            chordBlock.style.left = `${left}px`;
            chordBlock.style.width = `${width}px`;

            // Vertical positioning based on hand
            if (chord.hand === 'right') {
                chordBlock.style.top = '0';
                chordBlock.style.height = '24px';
            } else {
                chordBlock.style.bottom = '0';
                chordBlock.style.height = '24px';
            }

            this.chordBlocks.set(`${chord.startTime.toFixed(3)}-${chord.hand}`, chordBlock);
            fragment.appendChild(chordBlock);
        }

        this.element.appendChild(fragment);
    }

    /**
     * Calculate chord position
     */
    getChordPosition(chord, measurePositions) {
        if (!chord || !measurePositions.size) return null;

        let startLeft = null;
        for (const [idx, data] of measurePositions.entries()) {
            if (chord.startTime >= data.startTime && chord.startTime <= data.endTime) {
                const progress = (chord.startTime - data.startTime) / (data.endTime - data.startTime);
                startLeft = data.x + (data.width * progress);
                break;
            }
        }

        let endLeft = null;
        for (const [idx, data] of measurePositions.entries()) {
            if (chord.endTime >= data.startTime && chord.endTime <= data.endTime) {
                const progress = (chord.endTime - data.startTime) / (data.endTime - data.startTime);
                endLeft = data.x + (data.width * progress);
                break;
            }
        }

        // Handle spanning chords
        if (startLeft === null || endLeft === null) {
            const measures = Array.from(measurePositions.entries())
                .sort(([, a], [, b]) => a.startTime - b.startTime);

            if (startLeft === null && measures.length) {
                for (let i = measures.length - 1; i >= 0; i--) {
                    const [, data] = measures[i];
                    if (data.startTime <= chord.startTime) {
                        const clamped = Math.min(chord.startTime, data.endTime);
                        const progress = (clamped - data.startTime) / (data.endTime - data.startTime);
                        startLeft = data.x + (data.width * progress);
                        break;
                    }
                }
                if (startLeft === null) startLeft = measures[0][1].x;
            }

            if (endLeft === null && measures.length) {
                for (let i = 0; i < measures.length; i++) {
                    const [, data] = measures[i];
                    if (data.endTime >= chord.endTime) {
                        const clamped = Math.max(chord.endTime, data.startTime);
                        const progress = (clamped - data.startTime) / (data.endTime - data.startTime);
                        endLeft = data.x + (data.width * progress);
                        break;
                    }
                }
                if (endLeft === null) {
                    const last = measures[measures.length - 1][1];
                    endLeft = last.x + last.width;
                }
            }
        }

        if (startLeft === null || endLeft === null) return null;

        const width = Math.max(30, endLeft - startLeft);
        const rightmost = Array.from(measurePositions.values())
            .reduce((max, pos) => Math.max(max, pos.x + pos.width), 0);
        const left = Math.min(startLeft, rightmost - width);

        return { left, width };
    }

    /**
     * Detect chords using logic from ChordRenderer
     */
    detectChords(notes) {
        const chords = [];
        const leftHandNotes = this.groupNotesByTimeAndHand(notes, false);
        const rightHandNotes = this.groupNotesByTimeAndHand(notes, true);

        this.processHandChords(leftHandNotes, 'left', chords);
        this.processHandChords(rightHandNotes, 'right', chords);

        return chords.sort((a, b) => a.startTime - b.startTime);
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
    processHandChords(notesByTime, hand, chordsArray) {
        Object.keys(notesByTime).forEach(timeKey => {
            const notes = notesByTime[timeKey];
            const startTime = parseFloat(timeKey);
            const maxDuration = Math.max(...notes.map(n => n.visualDuration || n.duration));
            const endTime = startTime + maxDuration;

            if (notes.length >= 2) {
                if (typeof MusicTheory !== 'undefined') {
                    const detected = MusicTheory.detectChord(notes);
                    if (detected && detected.name) {
                        chordsArray.push({
                            ...detected,
                            startTime,
                            endTime,
                            duration: maxDuration,
                            notes,
                            hand
                        });
                    }
                }
            }
        });
    }

    /**
     * Update highlighting
     */
    updateHighlight(currentTime) {
        for (const block of this.chordBlocks.values()) block.classList.remove('current');
        for (const block of this.chordBlocks.values()) {
            const s = parseFloat(block.dataset.startTime);
            const e = parseFloat(block.dataset.endTime);
            if (currentTime >= s && currentTime < e) {
                block.classList.add('current');
            }
        }
    }

    /**
     * Get chord type for styling
     */
    getChordType(chord) {
        if (!chord || !chord.name) return 'other';
        const name = chord.name.toLowerCase().replace(/\s+/g, '');
        const rootMatch = name.match(/^[a-g][#b]?/);
        const quality = rootMatch ? name.substring(rootMatch[0].length) : name;
        const mainQuality = quality.split('/')[0];

        if (/7sus4|7sus/.test(mainQuality)) return "7sus4-composite";
        if (/maj7aug|maj7#5|maj7\+5/.test(mainQuality)) return "maj7aug-composite";
        if (/m7b5|min7b5|ø/.test(mainQuality)) return "min7b5-composite";
        if (/add9/.test(mainQuality) && /maj|major/.test(mainQuality)) return "maj-add9-composite";

        const patterns = [
            { p: /maj13/, t: 'maj13' }, { p: /13/, t: '13' },
            { p: /maj11/, t: 'maj11' }, { p: /11/, t: '11' },
            { p: /maj9/, t: 'maj9' }, { p: /9/, t: '9' },
            { p: /maj7b5/, t: 'maj7b5' }, { p: /7#5|7\+5|7aug/, t: '7aug' },
            { p: /7b5/, t: '7b5' }, { p: /maj7#5|maj7\+5/, t: 'maj7aug' },
            { p: /maj7/, t: 'maj7' }, { p: /m7b5|min7b5|ø/, t: 'min7b5' },
            { p: /m7|min7|-7/, t: 'min7' }, { p: /7sus4|7sus/, t: '7sus4' },
            { p: /7/, t: '7' }, { p: /dim7|°7/, t: 'dim7' },
            { p: /dim|°/, t: 'dim' }, { p: /aug\+|aug|augmented|\+/, t: 'aug' },
            { p: /sus2/, t: 'sus2' }, { p: /sus4|sus/, t: 'sus4' },
            { p: /min|m|-/, t: 'minor' }, { p: /maj|major|\^|△/, t: 'major' },
            { p: /add9/, t: 'add9' }, { p: /add11/, t: 'add11' },
            { p: /add13/, t: 'add13' }, { p: /add/, t: 'add' },
            { p: /m6|min6|-6/, t: 'min6' }, { p: /6/, t: '6' }
        ];

        for (const { p, t } of patterns) {
            if (p.test(mainQuality)) return t;
        }
        return mainQuality === '' ? 'major' : 'other';
    }

    cleanup() {
        this.element.innerHTML = '';
        this.element.remove();
        this.chordBlocks.clear();
    }
}

window.ChordOverlay = ChordOverlay;
