/**
 * Notation Renderer
 * Handles rendering of musical notation using VexFlow with page-like behavior
 */
class NotationRenderer {
    constructor(scoreModel, container) {
        // Store references to models and DOM elements
        this.scoreModel = scoreModel;
        this.container = container;

        // Page view configuration
        this.visibleTimeWindow = 8; // Seconds of music visible at once
        this.pageFlipThreshold = 0.75; // Flip page when reaching 75% of current page

        // Page state tracking
        this.currentPageStartTime = 0;
        this.currentPageEndTime = 0;
        this.pageRefreshNeeded = true;
        this.startTime = 0;
        this.endTime = 0;

        // SVG container and elements
        this.svgContainer = null;
        this.infoPanel = null;

        // Position indicator
        this.positionIndicator = null;
        this.measurePositions = new Map(); // Store measure positions for indicator updates

        // Rendering state
        this._lastFullRender = 0;
        this._maxStaveWidth = 250;
        this._minStaveWidth = 120;

        // Bind methods
        this.renderNotation = this.renderNotation.bind(this);
        this.updatePositionIndicator = this.updatePositionIndicator.bind(this);
    }

    /**
     * Load VexFlow library if not already loaded
     * @returns {Promise} Promise that resolves when VexFlow is loaded
     */
    loadVexFlow() {
        return new Promise((resolve, reject) => {
            if (typeof Vex !== 'undefined') {
                return resolve();
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Update the visible time window based on current position with page behavior
     */
    updateVisibleTimeWindow() {
        const currentTime = this.scoreModel.currentPosition;

        // Check if we need to flip to the next page
        if (this.currentPageEndTime > 0) {
            const pageTimeSpan = this.currentPageEndTime - this.currentPageStartTime;
            const thresholdPosition = this.currentPageStartTime + (pageTimeSpan * this.pageFlipThreshold);

            if (currentTime > thresholdPosition) {
                // We've reached the threshold to flip to next page
                this.pageRefreshNeeded = true;
                this.currentPageStartTime = currentTime;
            }
        }

        // Initialize or refresh page
        if (this.currentPageEndTime === 0 || this.pageRefreshNeeded) {
            this.startTime = Math.max(0, currentTime);
            this.endTime = this.startTime + this.visibleTimeWindow;
            this.currentPageStartTime = this.startTime;
            this.currentPageEndTime = this.endTime;
            this.pageRefreshNeeded = false;
        } else {
            // Keep using the current page boundaries
            this.startTime = this.currentPageStartTime;
            this.endTime = this.currentPageEndTime;
        }
    }

    /**
     * Get the indices of measures visible in the current time window
     * @returns {Array} Array of measure indices
     */
    getVisibleMeasureIndices() {
        if (!this.scoreModel.measures?.length) return [];

        this.updateVisibleTimeWindow();
        const visibleMeasures = [];

        for (let i = 0; i < this.scoreModel.measures.length; i++) {
            const measure = this.scoreModel.measures[i];
            const measureStart = measure.startPosition;
            const measureEnd = i < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[i + 1].startPosition
                : measureStart + measure.durationSeconds;

            // Include the measure if any part of it is visible
            if ((measureStart >= this.startTime && measureStart < this.endTime) ||
                (measureEnd > this.startTime && measureEnd <= this.endTime) ||
                (measureStart <= this.startTime && measureEnd >= this.endTime)) {
                visibleMeasures.push(i);
            }

            // Break early if we've gone past the end of our window
            if (measureStart > this.endTime) break;
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
        let numerator = 4, denominator = 4;

        // Find the appropriate time signature for this measure
        if (this.scoreModel.timeSignatures?.length) {
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
     * Create and add position indicator to the notation
     */
    createPositionIndicator() {
        // Remove any existing indicator
        if (this.positionIndicator) {
            this.positionIndicator.remove();
        }

        // Create position indicator element
        this.positionIndicator = document.createElement('div');
        this.positionIndicator.className = 'notation-position-indicator';
        this.container.appendChild(this.positionIndicator);
    }

    /**
     * Update position indicator location based on current playback position
     * @param {boolean} forceUpdate Force update even if not playing
     */
    updatePositionIndicator(forceUpdate = false) {
        if (!this.positionIndicator || (!this.scoreModel.isPlaying && !forceUpdate)) {
            return;
        }

        const currentTime = this.scoreModel.currentPosition;
        let indicatorPosition = null;

        // Find the appropriate measure based on current time
        for (const [measureIndex, measureData] of this.measurePositions.entries()) {
            const { startTime, endTime, x, width } = measureData;

            if (currentTime >= startTime && currentTime <= endTime) {
                // Calculate position within the measure
                const measureProgress = (currentTime - startTime) / (endTime - startTime);
                indicatorPosition = x + (width * measureProgress);
                break;
            }
        }

        // If we found a valid position, update the indicator
        if (indicatorPosition !== null) {
            this.positionIndicator.style.left = `${indicatorPosition}px`;
            this.positionIndicator.style.display = 'block';
        } else {
            // Hide indicator if position is outside visible range
            this.positionIndicator.style.display = 'none';
        }
    }

    /**
     * Render notation using VexFlow
     * @param {boolean} forceRender Whether to force a full re-render
     * @returns {Promise} Promise that resolves when rendering is complete
     */
    async renderNotation(forceRender = false) {
        if (!this.scoreModel.notes.length || !this.container) return;

        try {
            // Ensure VexFlow is loaded
            await this.loadVexFlow();

            const now = performance.now();

            // Skip rendering if not needed
            if (!forceRender && this._lastFullRender &&
                now - this._lastFullRender < 500 &&
                !this.pageRefreshNeeded) {
                // Just update position indicator without re-rendering
                this.updatePositionIndicator();
                return;
            }

            this._lastFullRender = now;

            // Get visible measures based on current position
            const visibleMeasureIndices = this.getVisibleMeasureIndices();
            if (visibleMeasureIndices.length === 0) {
                console.warn("No visible measures found in current time window");
                return;
            }

            // Clear container and create SVG container
            this.container.innerHTML = '';
            this.svgContainer = document.createElement('div');
            this.svgContainer.className = 'notation-svg-container';
            this.svgContainer.style.width = '100%';
            this.svgContainer.style.height = '100%';
            this.container.appendChild(this.svgContainer);

            // Initialize VexFlow
            const VF = Vex.Flow;
            const containerWidth = this.container.clientWidth;

            // Calculate measures per line
            const measuresPerLine = Math.max(2, Math.floor(containerWidth / 180));

            // Create renderer
            const renderer = new VF.Renderer(this.svgContainer, VF.Renderer.Backends.SVG);
            renderer.resize(containerWidth, containerWidth / 6.5);
            const context = renderer.getContext();
            context.setFont("Arial", 10);

            // Set SVG properties
            const svgElement = this.svgContainer.querySelector('svg');
            if (svgElement) {
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', '100%');
                svgElement.style.display = 'block';
            }

            // Organize measures into lines
            const lines = this.determineMeasureLines(visibleMeasureIndices, measuresPerLine);

            // Get notes for visible measures
            const visibleNotes = this.getNotesForMeasures(visibleMeasureIndices);

            // Reset measure positions for position indicator
            this.measurePositions.clear();

            // Create staff systems for each line
            let yOffset = 50;
            for (const measureIndicesInLine of lines) {
                this.createStaveSystem(
                    context,
                    measureIndicesInLine,
                    10,
                    yOffset,
                    containerWidth - 20,
                    visibleNotes
                );

                yOffset += 200; // Space between systems
            }

            // Create position indicator
            this.createPositionIndicator();
            this.updatePositionIndicator(true);

            // Add info panel
            this.addNotationOverlays();

        } catch (error) {
            console.error('Error rendering notation:', error);
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

            // Start new line when we've reached max measures or at the end
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

        // Calculate time bounds
        let startTime = Infinity;
        let endTime = -Infinity;

        for (const index of measureIndices) {
            const measure = this.scoreModel.measures[index];
            const measureStart = measure.startPosition;
            const measureEnd = index < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[index + 1].startPosition
                : measureStart + measure.durationSeconds;

            startTime = Math.min(startTime, measureStart);
            endTime = Math.max(endTime, measureEnd);
        }

        // Get notes within time range
        return this.scoreModel.notes.filter(note => {
            // Skip tied continuation notes
            if (note.isTiedFromPrevious) return false;

            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = note.start + noteDuration;

            // Include note if any part of it falls within our time window
            return (note.start >= startTime && note.start < endTime) ||
                (note.start < startTime && noteEnd > startTime);
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
        const staffDistance = 120;
        const staves = { treble: [], bass: [], measureIndices: [] };

        // Calculate measure time bounds
        const measureTimeBounds = measureIndices.map(index => {
            const measure = this.scoreModel.measures[index];
            const start = measure.startPosition;
            const end = index < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[index + 1].startPosition
                : start + measure.durationSeconds;
            return { start, end, index };
        });

        // Calculate note density for width allocation
        const notesByMeasure = measureIndices.map(index => {
            const bounds = measureTimeBounds.find(b => b.index === index);
            const notesInMeasure = allNotes.filter(note =>
                (note.start >= bounds.start && note.start < bounds.end) ||
                (note.start < bounds.start && note.start + (note.visualDuration || note.duration) > bounds.start)
            );
            return { index, noteCount: notesInMeasure.length, notes: notesInMeasure };
        });

        // Calculate width distribution based on note density
        const totalNotes = notesByMeasure.reduce((sum, m) => sum + m.noteCount, 0);
        const averageNotesPerMeasure = Math.max(1, totalNotes / measureIndices.length);

        let totalAdjustedWidth = 0;
        const initialWidths = notesByMeasure.map(measure => {
            const density = measure.noteCount / averageNotesPerMeasure;
            // Less extreme density adjustment (0.9 to 1.1 range)
            const widthFactor = 0.9 + (density * 0.2);
            const width = (availableWidth / measureIndices.length) * widthFactor;
            totalAdjustedWidth += width;
            return width;
        });

        // Scale widths to fit available space
        const scaleFactor = availableWidth / totalAdjustedWidth;
        const finalWidths = initialWidths.map(w => w * scaleFactor);

        // Create and draw staves
        let currentX = x;
        for (let i = 0; i < measureIndices.length; i++) {
            const measureIndex = measureIndices[i];
            const measureNotes = notesByMeasure.find(m => m.index === measureIndex);
            const measureWidth = Math.max(70, finalWidths[i]);

            // Store measure position data for position indicator
            const timeBounds = measureTimeBounds.find(b => b.index === measureIndex);
            if (timeBounds) {
                this.measurePositions.set(measureIndex, {
                    startTime: timeBounds.start,
                    endTime: timeBounds.end,
                    x: currentX,
                    width: measureWidth
                });
            }

            // Create treble and bass staves
            const trebleStave = new VF.Stave(currentX, y, measureWidth);
            const bassStave = new VF.Stave(currentX, y + staffDistance, measureWidth);

            // Add clefs and time signature to first measure in line
            if (i === 0) {
                trebleStave.addClef("treble");
                bassStave.addClef("bass");

                // Add time signature if needed
                if (measureIndex === 0 || this.scoreModel.measures[measureIndex].hasTimeChange) {
                    const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);
                    const timeSignature = `${numerator}/${denominator}`;
                    trebleStave.addTimeSignature(timeSignature);
                    bassStave.addTimeSignature(timeSignature);
                }

                // Connect staves with a brace and line
                new VF.StaveConnector(trebleStave, bassStave).setType(1).setContext(context).draw();
                new VF.StaveConnector(trebleStave, bassStave).setType(3).setContext(context).draw();
            } else if (this.scoreModel.measures[measureIndex].hasTimeChange) {
                // Add time signature for internal measures if there's a change
                const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);
                trebleStave.addTimeSignature(`${numerator}/${denominator}`);
                bassStave.addTimeSignature(`${numerator}/${denominator}`);
            }

            // Draw the staves
            trebleStave.setContext(context).draw();
            bassStave.setContext(context).draw();

            // Store references
            staves.treble.push(trebleStave);
            staves.bass.push(bassStave);
            staves.measureIndices.push(measureIndex);

            // Add final bar line if this is the last measure
            if (i === measureIndices.length - 1) {
                new VF.StaveConnector(trebleStave, bassStave).setType(1).setContext(context).draw();
            }

            // Draw notes for this measure
            if (measureNotes?.notes.length > 0) {
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

        // Get time signature for this measure
        const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);

        // Create VexFlow notes for each stave
        const trebleStaveNotes = this.createVexFlowNotes(
            trebleNotesByTime, "treble", timeBounds.start, timeBounds.end
        );

        const bassStaveNotes = this.createVexFlowNotes(
            bassNotesByTime, "bass", timeBounds.start, timeBounds.end
        );

        // Draw treble staff notes
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

        // Draw bass staff notes
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
     * @returns {Array} Array of VexFlow StaveNote objects
     */
    createVexFlowNotes(groupedNotes, clef, measureStartTime, measureEndTime) {
        if (!groupedNotes || !groupedNotes.length) return [];

        const vfNotes = [];
        const VF = Vex.Flow;
        const measureDuration = measureEndTime - measureStartTime;

        if (measureDuration <= 0) return [];

        // Find measure index and time signature
        let measureIndex = 0;
        for (let i = 0; i < this.scoreModel.measures.length; i++) {
            if (this.scoreModel.measures[i].startPosition <= measureStartTime) {
                measureIndex = i;
            } else {
                break;
            }
        }

        const { numerator } = this.getTimeSignatureForMeasure(measureIndex);
        const beatsPerMeasure = numerator || 4;

        // Helper to convert time position to beats
        const timeToBeats = (timePosition) => {
            const posInMeasure = Math.max(0, Math.min(1,
                (timePosition - measureStartTime) / measureDuration));
            return beatsPerMeasure * posInMeasure;
        };

        // Process each note group
        for (const noteGroup of groupedNotes) {
            if (!noteGroup?.length) continue;

            const firstNote = noteGroup[0];
            if (!firstNote) continue;

            // Skip notes outside our measure
            if (firstNote.start >= measureEndTime) continue;

            const noteDuration = firstNote.visualDuration || firstNote.duration;
            const noteEnd = firstNote.start + noteDuration;
            if (noteEnd <= measureStartTime) continue;

            // Calculate effective start time and duration
            const effectiveStartTime = Math.max(firstNote.start, measureStartTime);
            const visibleDuration = Math.min(noteEnd, measureEndTime) - effectiveStartTime;
            const beatPosition = timeToBeats(effectiveStartTime);
            const beatDuration = timeToBeats(effectiveStartTime + visibleDuration) - beatPosition;

            // Skip notes that would render too small
            if (beatDuration < 0.01) continue;

            // Format note keys with proper accidentals
            const noteKeys = noteGroup.map(note => {
                let noteName = note.step.toLowerCase();
                if (note.alter === 1) noteName += "#";
                else if (note.alter === -1) noteName += "b";
                return `${noteName}/${note.octave}`;
            });

            // Determine appropriate duration
            let vfDuration = "q";  // Default to quarter note
            if (beatDuration >= 4) vfDuration = "w";
            else if (beatDuration >= 3) vfDuration = "hd";
            else if (beatDuration >= 2) vfDuration = "h";
            else if (beatDuration >= 1.5) vfDuration = "qd";
            else if (beatDuration >= 1) vfDuration = "q";
            else if (beatDuration >= 0.75) vfDuration = "8d";
            else if (beatDuration >= 0.5) vfDuration = "8";
            else if (beatDuration >= 0.25) vfDuration = "16";
            else vfDuration = "32";

            try {
                // Create note and add to collection
                const vfNote = new VF.StaveNote({
                    clef, keys: noteKeys, duration: vfDuration
                });

                // Add accidentals
                noteGroup.forEach((note, i) => {
                    if (note.alter === 1) {
                        vfNote.addModifier(new VF.Accidental("#"), i);
                    } else if (note.alter === -1) {
                        vfNote.addModifier(new VF.Accidental("b"), i);
                    }
                });

                // Add articulations
                if (firstNote.staccato)
                    vfNote.addArticulation(0, new VF.Articulation('a.').setPosition(3));
                if (firstNote.accent)
                    vfNote.addArticulation(0, new VF.Articulation('a>').setPosition(3));
                if (firstNote.tenuto)
                    vfNote.addArticulation(0, new VF.Articulation('a-').setPosition(3));

                // Styling
                vfNote.setLedgerLineStyle({
                    strokeStyle: 'rgba(255, 255, 255, 0.95)',
                    lineWidth: 2.5,
                    lineCap: 'round',
                    shadowColor: 'rgba(255, 255, 255, 0.7)',
                    shadowBlur: 4
                });

                vfNote.setStyle({
                    fillStyle: 'rgba(255, 255, 255, 0.9)',
                    strokeStyle: 'rgba(255, 255, 255, 0.9)',
                });

                vfNotes.push(vfNote);
            } catch (e) {
                console.warn('Error creating note:', e);
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
        if (!notes?.length) return [];

        const notesByTime = new Map();
        const EPSILON = 0.02; // 20ms tolerance for chord grouping

        // Group by exact times
        for (const note of notes) {
            if (!note) continue;
            const timeKey = note.start.toFixed(3);
            if (!notesByTime.has(timeKey)) {
                notesByTime.set(timeKey, []);
            }
            notesByTime.get(timeKey).push(note);
        }

        // Merge groups that are very close in time
        const mergedGroups = new Map();
        const processedKeys = new Set();

        for (const timeKey of notesByTime.keys()) {
            if (processedKeys.has(timeKey)) continue;

            const time = parseFloat(timeKey);
            const notesAtTime = notesByTime.get(timeKey);
            let mergedNotes = [...notesAtTime];

            // Find nearby groups to merge
            for (const otherKey of notesByTime.keys()) {
                if (otherKey === timeKey || processedKeys.has(otherKey)) continue;
                const otherTime = parseFloat(otherKey);
                if (Math.abs(time - otherTime) < EPSILON) {
                    mergedNotes = [...mergedNotes, ...notesByTime.get(otherKey)];
                    processedKeys.add(otherKey);
                }
            }

            processedKeys.add(timeKey);
            mergedGroups.set(timeKey, mergedNotes);
        }

        // Convert to sorted array
        return Array.from(mergedGroups.entries())
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
            .map(entry => entry[1]);
    }

    /**
     * Add info panel to the notation container
     */
    addNotationOverlays() {
        // Remove this method's content - don't add the info panel
        // We'll keep the empty method to avoid breaking any calls to it
    }

    /**
     * Render a simple notation view (fallback if VexFlow fails)
     */
    renderSimpleNotation() {
        if (!this.container || !this.scoreModel.notes.length) return;

        this.container.innerHTML = '';
        const simpleNotation = document.createElement('div');
        simpleNotation.className = 'simple-notation';

        this.updateVisibleTimeWindow();

        // Add header with position info
        simpleNotation.innerHTML = `
            <h3>Notes from ${this.startTime.toFixed(2)}s to ${this.endTime.toFixed(2)}s</h3>
            <div class="position-info">Position: ${this.scoreModel.currentPosition.toFixed(2)}s</div>
            <div class="playback-status">${this.scoreModel.isPlaying ? 'Playing' : 'Paused'}</div>
        `;

        // Filter and display visible notes
        const visibleNotes = this.scoreModel.notes.filter(note => {
            const noteDuration = note.visualDuration || note.duration;
            return (note.start >= this.startTime && note.start < this.endTime) ||
                (note.start < this.startTime && note.start + noteDuration > this.startTime);
        }).sort((a, b) => a.start - b.start);

        const notesList = document.createElement('ul');
        for (const note of visibleNotes) {
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
        }

        simpleNotation.appendChild(notesList);
        this.container.appendChild(simpleNotation);
    }

    /**
     * Clean up resources to prevent memory leaks
     */
    cleanup() {
        // Cancel any pending animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Clear SVG container
        if (this.svgContainer) {
            while (this.svgContainer.firstChild) {
                this.svgContainer.firstChild.remove();
            }
            this.svgContainer = null;
        }

        // Clear info panel (keeping this check for cleanup purposes)
        if (this.infoPanel) {
            if (this.infoPanel.parentNode) {
                this.infoPanel.parentNode.removeChild(this.infoPanel);
            }
            this.infoPanel = null;
        }

        // Clear position indicator
        if (this.positionIndicator) {
            if (this.positionIndicator.parentNode) {
                this.positionIndicator.parentNode.removeChild(this.positionIndicator);
            }
            this.positionIndicator = null;
        }

        // Clear measure positions
        this.measurePositions.clear();

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        // Reset state
        this.currentPageStartTime = 0;
        this.currentPageEndTime = 0;
        this.pageRefreshNeeded = true;
        this._lastFullRender = 0;
    }
}

// Make the class available globally
window.NotationRenderer = NotationRenderer;