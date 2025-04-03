/**
 * Notation Renderer
 * Handles rendering of musical notation using VexFlow with a scrolling view
 */
class NotationRenderer {
    constructor(scoreModel, container) {
        // Store references to models and DOM elements
        this.scoreModel = scoreModel;
        this.container = container;

        // Scrolling view state
        this.visibleTimeWindow = 8; // 8 seconds of music visible at once
        this.lookAhead = 6; // How many seconds ahead of current position to show
        this.lookBehind = 2; // How many seconds behind current position to show

        // SVG container and elements
        this.svgContainer = null;
        // Remove position indicator reference
        this.infoPanel = null;

        // Rendering state
        this._lastFullRender = 0;
        this._maxStaveWidth = 250; // Maximum width for a measure
        this._minStaveWidth = 120; // Minimum width for a measure

        // Bind methods that need 'this'
        this.renderNotation = this.renderNotation.bind(this);
        // Remove updatePositionIndicator binding
    }

    /**
     * Load VexFlow library if not already loaded
     * @returns {Promise} Promise that resolves when VexFlow is loaded
     */
    loadVexFlow() {
        return new Promise((resolve, reject) => {
            if (typeof Vex !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Update the visible time window based on current position
     */
    updateVisibleTimeWindow() {
        const currentTime = this.scoreModel.currentPosition;
        this.startTime = Math.max(0, currentTime - this.lookBehind);
        this.endTime = currentTime + this.lookAhead;

        // Sanity check for valid time window
        if (this.endTime <= this.startTime) {
            this.endTime = this.startTime + this.visibleTimeWindow;
        }
    }

    /**
     * Get the indices of measures visible in the current time window
     * @returns {Array} Array of measure indices
     */
    getVisibleMeasureIndices() {
        if (!this.scoreModel.measures || this.scoreModel.measures.length === 0) {
            return [];
        }

        this.updateVisibleTimeWindow();

        const visibleMeasures = [];

        for (let i = 0; i < this.scoreModel.measures.length; i++) {
            const measureStart = this.scoreModel.measures[i].startPosition;
            const measureEnd = i < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[i + 1].startPosition
                : measureStart + this.scoreModel.measures[i].durationSeconds;

            // Include the measure if any part of it is visible
            if ((measureStart >= this.startTime && measureStart < this.endTime) ||
                (measureEnd > this.startTime && measureEnd <= this.endTime) ||
                (measureStart <= this.startTime && measureEnd >= this.endTime)) {
                visibleMeasures.push(i);
            }

            // We've gone past the end of our window, no need to check further measures
            if (measureStart > this.endTime) {
                break;
            }
        }

        return visibleMeasures;
    }

    /**
     * Get time signature for a specific measure
     * @param {number} measureIndex Index of the measure
     * @returns {Object} Object with numerator and denominator
     */
    getTimeSignatureForMeasure(measureIndex) {
        // Default time signature
        let numerator = 4;
        let denominator = 4;

        // Find the appropriate time signature for this measure
        if (this.scoreModel.timeSignatures && this.scoreModel.timeSignatures.length > 0) {
            const measurePosition = this.scoreModel.measures[measureIndex].startPosition;

            // Find the last time signature change before or at this position
            for (const timeSig of this.scoreModel.timeSignatures) {
                if (timeSig.position <= measurePosition) {
                    numerator = timeSig.numerator;
                    denominator = timeSig.denominator;
                } else {
                    break; // Stop once we pass the current measure position
                }
            }
        }

        return { numerator, denominator };
    }

    /**
     * Render notation using VexFlow
     * @param {boolean} forceRender Whether to force a full re-render
     * @returns {Promise} Promise that resolves when rendering is complete
     */
    async renderNotation(forceRender = false) {
        if (!this.scoreModel.notes.length || !this.container) {
            return;
        }

        try {
            // Ensure VexFlow is loaded
            await this.loadVexFlow();

            const now = performance.now();
            if (!forceRender && this._lastFullRender && now - this._lastFullRender < 500) {
                // Skip full re-render for performance
                // Remove position indicator update call
                return;
            }
            this._lastFullRender = now;

            // Update the visible time window based on current position
            this.updateVisibleTimeWindow();
            const visibleMeasureIndices = this.getVisibleMeasureIndices();

            if (visibleMeasureIndices.length === 0) {
                console.warn("No visible measures found in current time window");
                return;
            }

            // Clear container
            this.container.innerHTML = '';

            // Create SVG container
            this.svgContainer = document.createElement('div');
            this.svgContainer.className = 'notation-svg-container';
            this.svgContainer.style.width = '100%';
            this.svgContainer.style.height = '100%';
            this.container.appendChild(this.svgContainer);

            // Initialize VexFlow
            const VF = Vex.Flow;

            // Calculate dimensions based on container size
            const containerWidth = this.container.clientWidth;
            const containerHeight = this.container.clientHeight;

            // Adjust visible time window based on container width and number of measures
            const measuresPerLine = Math.max(4, Math.floor(containerWidth / 200));

            // Create renderer with explicit dimensions
            const renderer = new VF.Renderer(this.svgContainer, VF.Renderer.Backends.SVG);
            const svgWidth = Math.max(containerWidth, visibleMeasureIndices.length * 200);
            renderer.resize(svgWidth, containerWidth / 6.5);
            const context = renderer.getContext();
            context.setFont("Arial", 10);

            // Get SVG element and set properties for proper display
            const svgElement = this.svgContainer.querySelector('svg');
            if (svgElement) {
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', '100%');
                svgElement.style.display = 'block';
            }

            // Determine line breaks for measures
            const lines = this.determineMeasureLines(visibleMeasureIndices, measuresPerLine);

            // Render each line of measures
            let yOffset = 50; // Start position for first line

            // Collect all notes for the visible measures
            const visibleNotes = this.getNotesForMeasures(visibleMeasureIndices);

            // Create staff systems for each line
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const measureIndicesInLine = lines[lineIndex];
                const staves = this.createStaveSystem(
                    context,
                    measureIndicesInLine,
                    20, // x-offset
                    yOffset,
                    containerWidth - 40, // width
                    visibleNotes
                );

                yOffset += 200; // Space between systems
            }

            // Add info panel only (removed position indicator)
            this.addNotationOverlays();

            // Adjust scroll position to follow current playback
            this.scrollToCurrentPosition();

            // Add scrolling behavior
            this.handleScroll();

        } catch (error) {
            console.error('Error rendering notation:', error);
            // Fallback to simpler notation
            this.renderSimpleNotation();
        }
    }

    /**
     * Determine how measures should be organized into lines
     * @param {Array} measureIndices Array of measure indices
     * @param {number} measuresPerLine Maximum measures per line
     * @returns {Array} Array of arrays, each containing measure indices for a line
     */
    determineMeasureLines(measureIndices, measuresPerLine) {
        const lines = [];
        let currentLine = [];

        for (let i = 0; i < measureIndices.length; i++) {
            currentLine.push(measureIndices[i]);

            // Start new line if we've reached max measures per line
            if (currentLine.length >= measuresPerLine || i === measureIndices.length - 1) {
                lines.push(currentLine);
                currentLine = [];
            }
        }

        return lines;
    }

    /**
     * Get notes that belong to the specified measures
     * @param {Array} measureIndices Array of measure indices
     * @returns {Array} Array of notes in those measures
     */
    getNotesForMeasures(measureIndices) {
        if (!measureIndices.length) return [];

        // Get time bounds for all specified measures
        let startTime = Infinity;
        let endTime = -Infinity;

        measureIndices.forEach(index => {
            const measure = this.scoreModel.measures[index];
            const measureStart = measure.startPosition;
            const measureEnd = index < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[index + 1].startPosition
                : measureStart + measure.durationSeconds;

            startTime = Math.min(startTime, measureStart);
            endTime = Math.max(endTime, measureEnd);
        });

        // Get all notes in the time range
        return this.scoreModel.notes.filter(note => {
            // Filter out tied continuation notes
            if (note.isTiedFromPrevious) return false;

            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = note.start + noteDuration;

            // Include note if any part of it falls within our time window
            return (note.start >= startTime && note.start < endTime) ||  // Note starts in window
                (note.start < startTime && noteEnd > startTime);      // Note overlaps start of window
        });
    }

    /**
     * Create a system of treble and bass staves for a line of measures
     * @param {Object} context The VexFlow rendering context
     * @param {Array} measureIndices Array of measure indices for this line
     * @param {number} x X position to start drawing
     * @param {number} y Y position to start drawing
     * @param {number} availableWidth Width available for drawing
     * @param {Array} allNotes Array of notes to render
     * @returns {Object} Object containing stave references
     */
    createStaveSystem(context, measureIndices, x, y, availableWidth, allNotes) {
        if (!measureIndices.length) return null;

        const VF = Vex.Flow;
        const staffHeight = 80;
        const staffDistance = 120;

        // Calculate width per measure (will adjust based on note density later)
        let baseWidth = availableWidth / measureIndices.length;
        const staves = { treble: [], bass: [], measureIndices: [] };

        // We'll need to know where each measure starts and ends in time
        const measureTimeBounds = measureIndices.map(index => {
            const measure = this.scoreModel.measures[index];
            const start = measure.startPosition;
            const end = index < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[index + 1].startPosition
                : start + measure.durationSeconds;
            return { start, end, index };
        });

        // Calculate note density for each measure to adjust widths
        const notesByMeasure = measureIndices.map(index => {
            const bounds = measureTimeBounds.find(b => b.index === index);
            const notesInMeasure = allNotes.filter(note =>
                (note.start >= bounds.start && note.start < bounds.end) ||
                (note.start < bounds.start && note.start + (note.visualDuration || note.duration) > bounds.start)
            );
            return {
                index,
                noteCount: notesInMeasure.length,
                notes: notesInMeasure
            };
        });

        // Adjust widths based on note density
        const totalNotes = notesByMeasure.reduce((sum, m) => sum + m.noteCount, 0);
        const averageNotesPerMeasure = totalNotes / measureIndices.length;

        let currentX = x;

        // Create staves for each measure
        for (let i = 0; i < measureIndices.length; i++) {
            const measureIndex = measureIndices[i];
            const measureNotes = notesByMeasure.find(m => m.index === measureIndex);

            // Adjust width based on note density compared to average
            let measureWidth = baseWidth;
            if (totalNotes > 0 && measureNotes) {
                const density = measureNotes.noteCount / averageNotesPerMeasure;
                measureWidth = Math.max(
                    this._minStaveWidth,
                    Math.min(this._maxStaveWidth, baseWidth * (0.8 + (density * 0.4)))
                );
            }

            // Create treble and bass staves
            const trebleStave = new VF.Stave(currentX, y, measureWidth);
            const bassStave = new VF.Stave(currentX, y + staffDistance, measureWidth);

            // Add clefs and time signature to first measure in line
            if (i === 0) {
                trebleStave.addClef("treble");
                bassStave.addClef("bass");

                // Add time signature if it's the first measure or there was a change
                if (measureIndex === 0 || this.scoreModel.measures[measureIndex].hasTimeChange) {
                    const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);
                    const timeSignature = `${numerator}/${denominator}`;
                    trebleStave.addTimeSignature(timeSignature);
                    bassStave.addTimeSignature(timeSignature);
                }

                // Connect staves with a brace and line
                const lineLeft = new VF.StaveConnector(trebleStave, bassStave).setType(1);
                const braceLeft = new VF.StaveConnector(trebleStave, bassStave).setType(3);
                lineLeft.setContext(context).draw();
                braceLeft.setContext(context).draw();
            } else if (this.scoreModel.measures[measureIndex].hasTimeChange) {
                // Add time signature for internal measures if there's a change
                const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);
                const timeSignature = `${numerator}/${denominator}`;
                trebleStave.addTimeSignature(timeSignature);
                bassStave.addTimeSignature(timeSignature);
            }

            // Draw the staves
            trebleStave.setContext(context).draw();
            bassStave.setContext(context).draw();

            // Store stave references
            staves.treble.push(trebleStave);
            staves.bass.push(bassStave);
            staves.measureIndices.push(measureIndex);

            // If this is the last measure, add a final bar line
            if (i === measureIndices.length - 1) {
                const lineRight = new VF.StaveConnector(trebleStave, bassStave).setType(1);
                lineRight.setContext(context).draw();
            }

            // Draw notes for this measure if we have them
            if (measureNotes && measureNotes.notes.length > 0) {
                this.drawNotesForMeasure(
                    context,
                    measureIndex,
                    measureNotes.notes,
                    trebleStave,
                    bassStave,
                    measureTimeBounds.find(b => b.index === measureIndex)
                );
            }

            // Move to next measure position
            currentX += measureWidth;
        }

        return staves;
    }

    /**
     * Draw notes for a specific measure
     * @param {Object} context The VexFlow rendering context
     * @param {number} measureIndex The index of the measure
     * @param {Array} notes Array of notes to render
     * @param {Object} trebleStave The treble stave for this measure
     * @param {Object} bassStave The bass stave for this measure
     * @param {Object} timeBounds Start and end time for the measure
     */
    drawNotesForMeasure(context, measureIndex, notes, trebleStave, bassStave, timeBounds) {
        const VF = Vex.Flow;

        // Separate notes into treble and bass
        const trebleNotes = notes.filter(note =>
            note.staff === 1 || (note.staff === undefined && note.noteNumber >= 60)
        );

        const bassNotes = notes.filter(note =>
            note.staff === 2 || (note.staff === undefined && note.noteNumber < 60)
        );

        // Group notes by time for chord formation
        const trebleNotesByTime = this.groupNotesByTime(trebleNotes);
        const bassNotesByTime = this.groupNotesByTime(bassNotes);

        // Get measure time bounds
        const { start: measureStartTime, end: measureEndTime } = timeBounds;

        // Get time signature for this measure
        const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);

        // Create VexFlow notes for each stave
        const trebleStaveNotes = this.createVexFlowNotes(
            trebleNotesByTime,
            "treble",
            measureStartTime,
            measureEndTime,
            this.scoreModel.currentPosition
        );

        const bassStaveNotes = this.createVexFlowNotes(
            bassNotesByTime,
            "bass",
            measureStartTime,
            measureEndTime,
            this.scoreModel.currentPosition
        );

        // Format and draw for treble stave if we have notes
        if (trebleStaveNotes.length > 0) {
            try {
                const trebleVoice = new VF.Voice({
                    num_beats: numerator,
                    beat_value: denominator,
                    resolution: VF.RESOLUTION
                }).setMode(VF.Voice.Mode.SOFT);

                trebleVoice.addTickables(trebleStaveNotes);

                new VF.Formatter()
                    .joinVoices([trebleVoice])
                    .format([trebleVoice], trebleStave.getWidth() - 30);

                trebleVoice.draw(context, trebleStave);
            } catch (e) {
                console.error("Error rendering treble notes:", e);
            }
        }

        // Format and draw for bass stave if we have notes
        if (bassStaveNotes.length > 0) {
            try {
                const bassVoice = new VF.Voice({
                    num_beats: numerator,
                    beat_value: denominator,
                    resolution: VF.RESOLUTION
                }).setMode(VF.Voice.Mode.SOFT);

                bassVoice.addTickables(bassStaveNotes);

                new VF.Formatter()
                    .joinVoices([bassVoice])
                    .format([bassVoice], bassStave.getWidth() - 30);

                bassVoice.draw(context, bassStave);
            } catch (e) {
                console.error("Error rendering bass notes:", e);
            }
        }
    }

    /**
     * Create VexFlow notes from grouped notes
     * @param {Array} groupedNotes Notes grouped by time
     * @param {string} clef The clef (treble/bass)
     * @param {number} measureStartTime Measure start time
     * @param {number} measureEndTime Measure end time
     * @param {number} currentPosition Current playback position
     * @returns {Array} Array of VexFlow StaveNote objects
     */
    createVexFlowNotes(groupedNotes, clef, measureStartTime, measureEndTime, currentPosition) {
        if (!groupedNotes || groupedNotes.length === 0) return [];

        const vfNotes = [];
        const VF = Vex.Flow;

        // Calculate measure duration in seconds
        const measureDuration = measureEndTime - measureStartTime;
        if (measureDuration <= 0) {
            console.warn("Invalid measure duration", { measureStartTime, measureEndTime });
            return [];
        }

        // Find the measure index for this time
        let measureIndex = 0;
        for (let i = 0; i < this.scoreModel.measures.length; i++) {
            if (this.scoreModel.measures[i].startPosition <= measureStartTime) {
                measureIndex = i;
            } else {
                break;
            }
        }

        // Get time signature for this measure
        const { numerator } = this.getTimeSignatureForMeasure(measureIndex);

        // Calculate beats per measure from time signature
        const beatsPerMeasure = numerator || 4;

        // Helper to convert time position to beats with bounds checking
        const timeToBeats = (timePosition) => {
            // Position within measure (0-1)
            const posInMeasure = Math.max(0, Math.min(1, (timePosition - measureStartTime) / measureDuration));
            // Convert to beat position
            return beatsPerMeasure * posInMeasure;
        };

        // Process each note group
        for (let groupIndex = 0; groupIndex < groupedNotes.length; groupIndex++) {
            const noteGroup = groupedNotes[groupIndex];
            if (!noteGroup || noteGroup.length === 0) continue;

            try {
                // Use the first note's properties for the group
                const firstNote = noteGroup[0];
                if (!firstNote) continue;

                // Skip notes completely outside our measure
                if (firstNote.start >= measureEndTime) continue;

                const noteDuration = firstNote.visualDuration || firstNote.duration;
                const noteEnd = firstNote.start + noteDuration;
                if (noteEnd <= measureStartTime) continue;

                // Adjust start time if note started before measure
                let effectiveStartTime = Math.max(firstNote.start, measureStartTime);

                // Get note positions in beats within the measure
                const beatPosition = timeToBeats(effectiveStartTime);

                // Calculate how much of the note is visible in this measure
                let visibleDuration = Math.min(
                    noteEnd,
                    measureEndTime
                ) - effectiveStartTime;

                // Convert note duration from seconds to beats
                const beatDuration = timeToBeats(effectiveStartTime + visibleDuration) - beatPosition;

                // Skip notes that would render too small
                if (beatDuration < 0.01) continue;

                // Get all note names for this chord
                const noteKeys = noteGroup.map(note => {
                    // Format note name with accidentals
                    let noteName = note.step.toLowerCase();
                    if (note.alter === 1) noteName += "#";
                    else if (note.alter === -1) noteName += "b";
                    return `${noteName}/${note.octave}`;
                });

                // Determine best duration (quarter, eighth, etc.)
                let vfDuration;
                if (beatDuration >= 4) vfDuration = "w"; // whole note
                else if (beatDuration >= 3) vfDuration = "hd"; // dotted half
                else if (beatDuration >= 2) vfDuration = "h"; // half note
                else if (beatDuration >= 1.5) vfDuration = "qd"; // dotted quarter
                else if (beatDuration >= 1) vfDuration = "q"; // quarter
                else if (beatDuration >= 0.75) vfDuration = "8d"; // dotted eighth
                else if (beatDuration >= 0.5) vfDuration = "8"; // eighth
                else if (beatDuration >= 0.25) vfDuration = "16"; // sixteenth
                else vfDuration = "32"; // thirty-second

                try {
                    // Create the note
                    const vfNote = new VF.StaveNote({
                        clef: clef,
                        keys: noteKeys,
                        duration: vfDuration
                    });

                    // Add accidentals
                    noteGroup.forEach((note, i) => {
                        if (note.alter === 1) {
                            vfNote.addModifier(new VF.Accidental("#"), i);
                        } else if (note.alter === -1) {
                            vfNote.addModifier(new VF.Accidental("b"), i);
                        }
                    });

                    // Add articulations to the first note in the group
                    if (firstNote.staccato) vfNote.addArticulation(0, new VF.Articulation('a.').setPosition(3));
                    if (firstNote.accent) vfNote.addArticulation(0, new VF.Articulation('a>').setPosition(3));
                    if (firstNote.tenuto) vfNote.addArticulation(0, new VF.Articulation('a-').setPosition(3));

                    // Enhance ledger lines
                    vfNote.setLedgerLineStyle({
                        strokeStyle: 'rgba(255, 255, 255, 0.95)',
                        lineWidth: 2.5,
                        lineCap: 'round',
                        shadowColor: 'rgba(255, 255, 255, 0.7)',
                        shadowBlur: 4
                    });

                    // Apply consistent styling to all notes (no highlighting based on playing state)
                    vfNote.setStyle({
                        fillStyle: 'rgba(255, 255, 255, 0.9)',
                        strokeStyle: 'rgba(255, 255, 255, 0.9)',
                    });

                    vfNotes.push(vfNote);
                } catch (e) {
                    console.warn('Error creating note:', e, {
                        keys: noteKeys,
                        duration: vfDuration,
                        beatDuration
                    });
                }
            } catch (err) {
                console.error("Error processing note group:", err);
            }
        }

        return vfNotes;
    }

    /**
     * Group notes by start time for chord creation
     * @param {Array} notes Array of notes
     * @returns {Array} Array of note groups by time
     */
    groupNotesByTime(notes) {
        if (!notes || notes.length === 0) return [];

        const notesByTime = new Map();
        const EPSILON = 0.02; // 20ms tolerance for chord grouping

        // First pass: Group notes by exact times
        notes.forEach(note => {
            if (!note) return;

            // Round to 3 decimal places for better grouping of simultaneous notes
            const timeKey = note.start.toFixed(3);
            if (!notesByTime.has(timeKey)) {
                notesByTime.set(timeKey, []);
            }
            notesByTime.get(timeKey).push(note);
        });

        // Second pass: Merge groups that are very close in time
        const mergedGroups = new Map();
        const processedKeys = new Set();

        Array.from(notesByTime.keys()).forEach(timeKey => {
            if (processedKeys.has(timeKey)) return;

            const time = parseFloat(timeKey);
            const notesAtTime = notesByTime.get(timeKey);
            let mergedNotes = [...notesAtTime];

            // Look for nearby groups to merge
            Array.from(notesByTime.keys()).forEach(otherKey => {
                if (otherKey === timeKey || processedKeys.has(otherKey)) return;

                const otherTime = parseFloat(otherKey);
                if (Math.abs(time - otherTime) < EPSILON) {
                    mergedNotes = [...mergedNotes, ...notesByTime.get(otherKey)];
                    processedKeys.add(otherKey);
                }
            });

            processedKeys.add(timeKey);
            mergedGroups.set(timeKey, mergedNotes);
        });

        // Convert map to sorted array of note groups
        return Array.from(mergedGroups.entries())
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
            .map(entry => entry[1]);
    }

    /**
     * Add info panel to the notation container (removed position indicator)
     */
    addNotationOverlays() {
        // Remove position indicator creation code

        // Determine current measure and beat
        let currentMeasure = 1;
        let currentBeat = 1;
        const safePosition = Math.max(0, this.scoreModel.currentPosition);

        for (const measure of this.scoreModel.measures) {
            if (safePosition >= measure.startPosition) {
                currentMeasure = measure.number;

                if (measure.startPosition <= safePosition) {
                    const nextMeasureStart = measure.index < this.scoreModel.measures.length - 1
                        ? this.scoreModel.measures[measure.index + 1].startPosition
                        : measure.startPosition + measure.durationSeconds;

                    const posInMeasure = (safePosition - measure.startPosition) /
                        (nextMeasureStart - measure.startPosition);

                    const { numerator } = this.getTimeSignatureForMeasure(measure.index);
                    currentBeat = Math.floor(posInMeasure * numerator) + 1;

                    if (currentBeat > numerator || !isFinite(currentBeat)) {
                        currentBeat = numerator;
                    }
                }
            } else {
                break;
            }
        }

        // Add info panel
        this.infoPanel = document.createElement('div');
        this.infoPanel.className = 'notation-info-panel';
        this.infoPanel.innerHTML = `
            <div class="position-info">Position: ${safePosition.toFixed(1)}s</div>
            <div class="measure-info">Measure: ${currentMeasure}, Beat: ${currentBeat}</div>
            <div class="speed-info">Tempo: ${this.scoreModel.bpm} BPM</div>
            <div class="playback-status">${this.scoreModel.isPlaying ? 'Playing' : 'Paused'}</div>
        `;

        this.svgContainer.appendChild(this.infoPanel);
    }

    /**
     * Render a simple notation view (fallback if VexFlow fails)
     */
    renderSimpleNotation() {
        if (!this.container || !this.scoreModel.notes.length) return;

        // Clean container
        this.container.innerHTML = '';

        // Create simple notation display
        const simpleNotation = document.createElement('div');
        simpleNotation.className = 'simple-notation';

        this.updateVisibleTimeWindow();

        // Add header with position info
        simpleNotation.innerHTML = `
            <h3>Notes from ${this.startTime.toFixed(2)}s to ${this.endTime.toFixed(2)}s</h3>
            <div class="position-info">Position: ${this.scoreModel.currentPosition.toFixed(2)}s</div>
            <div class="playback-status">${this.scoreModel.isPlaying ? 'Playing' : 'Paused'}</div>
        `;

        // Filter notes for this time window
        const visibleNotes = this.scoreModel.notes.filter(note => {
            const noteDuration = note.visualDuration || note.duration;
            return (note.start >= this.startTime && note.start < this.endTime) ||
                (note.start < this.startTime && note.start + noteDuration > this.startTime);
        }).sort((a, b) => a.start - b.start);

        // Create list of notes
        const notesList = document.createElement('ul');

        visibleNotes.forEach(note => {
            const noteName = `${note.step}${note.alter === 1 ? '#' : note.alter === -1 ? 'b' : ''}${note.octave}`;
            const isPlaying = note.start <= this.scoreModel.currentPosition &&
                (note.start + (note.visualDuration || note.duration) > this.scoreModel.currentPosition);

            const item = document.createElement('li');
            item.className = isPlaying ? 'playing-note' : '';
            item.innerHTML = `
                <span>${noteName} (${note.staff === 1 ? 'Treble' : 'Bass'})</span>
                <span class="note-timing">${note.start.toFixed(2)}s - ${(note.start + (note.visualDuration || note.duration)).toFixed(2)}s</span>
            `;

            notesList.appendChild(item);
        });

        simpleNotation.appendChild(notesList);
        this.container.appendChild(simpleNotation);
    }

    /**
     * Scroll to follow current playback position
     */
    scrollToCurrentPosition() {
        if (!this.svgContainer || !this.scoreModel.isPlaying) return;

        // Get current position relative to the visible time window
        this.updateVisibleTimeWindow();
        const timeRange = this.endTime - this.startTime;

        if (timeRange > 0) {
            const positionRatio = (this.scoreModel.currentPosition - this.startTime) / timeRange;
            const containerWidth = this.container.clientWidth;
            const targetScrollLeft = positionRatio * this.svgContainer.scrollWidth - containerWidth / 2;

            // Scroll container to keep current position centered
            this.container.scrollTo({
                left: Math.max(0, targetScrollLeft),
                behavior: 'smooth'
            });
        }
    }

    /**
     * Handle scroll events to control playback
     */
    handleScroll() {
        // Set up scroll interaction
        let scrollTimeout;

        this.container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);

            // When scrolling stops, update the visible window
            scrollTimeout = setTimeout(() => {
                if (!this.scoreModel.isPlaying) {
                    // Only update window if not playing
                    const visibleTimeWindow = this.calculateVisibleTimeFromScroll();
                    if (visibleTimeWindow) {
                        this.startTime = visibleTimeWindow.startTime;
                        this.endTime = visibleTimeWindow.endTime;
                    }
                }
            }, 100);
        });
    }

    /**
     * Calculate visible time window based on current scroll position
     * @returns {Object|null} Object with startTime and endTime
     */
    calculateVisibleTimeFromScroll() {
        if (!this.svgContainer) return null;

        const containerRect = this.container.getBoundingClientRect();
        const svgRect = this.svgContainer.querySelector('svg')?.getBoundingClientRect();

        if (!svgRect) return null;

        const scrollRatio = this.container.scrollLeft / (svgRect.width - containerRect.width);

        // Calculate the visible time window based on scroll position
        const totalMeasureTime = this.scoreModel.measures[this.scoreModel.measures.length - 1].startPosition +
            this.scoreModel.measures[this.scoreModel.measures.length - 1].durationSeconds;

        const visibleTimeWindow = this.visibleTimeWindow;
        const scrollStartTime = Math.max(0, scrollRatio * totalMeasureTime - (visibleTimeWindow / 2));
        const scrollEndTime = scrollStartTime + visibleTimeWindow;

        return {
            startTime: scrollStartTime,
            endTime: scrollEndTime
        };
    }
}

// Make the class available globally
window.NotationRenderer = NotationRenderer;