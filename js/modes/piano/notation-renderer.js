/**
 * Notation Renderer
 * Handles rendering of musical notation using VexFlow
 */
class NotationRenderer {
    constructor(scoreModel, container) {
        // Store references to models and DOM elements
        this.scoreModel = scoreModel;
        this.container = container;

        // Page navigation state
        this.currentPage = 0;
        this.measuresPerPage = 2;
        this.totalPages = 1;

        // Page time bounds
        this.currentPageStartPosition = 0;
        this.currentPageEndPosition = 0;

        // Rendering state
        this._lastFullRender = 0;


        // Bind methods that need 'this'
        this.renderNotation = this.renderNotation.bind(this);
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
                return;
            }
            this._lastFullRender = now;

            // Clear container
            this.container.innerHTML = '';

            // Create SVG container with improved dimensions
            const svgContainer = document.createElement('div');
            svgContainer.className = 'notation-svg-container';
            svgContainer.style.width = '100%';
            svgContainer.style.height = '100%';
            this.container.appendChild(svgContainer);

            // Initialize VexFlow
            const VF = Vex.Flow;

            // Calculate dimensions based on container size with better margins
            const containerWidth = this.container.clientWidth;
            const containerHeight = this.container.clientHeight;

            // Use full container width with small margins
            const width = containerWidth - 40;
            const height = containerWidth / 6.5;

            // Create renderer with explicit dimensions
            const renderer = new VF.Renderer(svgContainer, VF.Renderer.Backends.SVG);
            renderer.resize(width, height);
            const context = renderer.getContext();
            context.setFont("Arial", 10);

            // Get SVG element and set fixed properties
            const svgElement = svgContainer.querySelector('svg');
            if (svgElement) {
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', '100%');
                svgElement.style.display = 'block';
            }

            // Calculate current playback measure
            let currentMeasureIndex = this.findCurrentMeasureIndex();

            // Calculate optimal measures per page based on tempo and note density
            this.calculateOptimalMeasuresPerPage(currentMeasureIndex);

            // Calculate total pages
            this.totalPages = Math.ceil(this.scoreModel.measures.length / this.measuresPerPage);

            // Determine the correct page based on current position
            const targetPage = Math.floor(currentMeasureIndex / this.measuresPerPage);
            if (this.currentPage !== targetPage) {
                this.currentPage = targetPage;
            }

            // Calculate start and end measure indices for current page
            const startMeasureIndex = this.currentPage * this.measuresPerPage;
            const endMeasureIndex = Math.min(
                this.scoreModel.measures.length - 1,
                startMeasureIndex + this.measuresPerPage - 1
            );

            // Get time bounds from measure data
            const startPosition = this.scoreModel.measures[startMeasureIndex].startPosition;
            const endPosition = endMeasureIndex < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[endMeasureIndex + 1].startPosition
                : startPosition + this.scoreModel.measures[endMeasureIndex].durationSeconds;

            // Store page time bounds for position indicator calculations
            this.currentPageStartPosition = startPosition;
            this.currentPageEndPosition = endPosition;

            // Layout settings for a single staff system
            const staffHeight = 80;
            const staffDistance = 120; // Distance between treble and bass staves
            const measureWidth = (width - 60) / this.measuresPerPage;

            // Y position for the single system
            const systemY = 20;
            const staves = { treble: [], bass: [], measureIndices: [] };

            // Create a single system with treble and bass staves for each measure
            for (let measurePos = 0; measurePos < this.measuresPerPage; measurePos++) {
                const measureIndex = startMeasureIndex + measurePos;
                if (measureIndex > endMeasureIndex) break;

                const xPosition = 20 + measurePos * measureWidth;

                // Create treble and bass staves for this measure
                const trebleStave = new VF.Stave(xPosition, systemY, measureWidth);
                const bassStave = new VF.Stave(xPosition, systemY + staffDistance, measureWidth);

                // Add clefs and time signature only to first measure on the page
                if (measurePos === 0) {
                    trebleStave.addClef("treble");
                    bassStave.addClef("bass");

                    // Add time signature if it changed at this measure or it's the first measure
                    if (measureIndex === 0 || this.scoreModel.measures[measureIndex].hasTimeChange) {
                        // Get time signature from the time signatures array
                        const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);

                        // Only add time signature if we have valid values
                        if (numerator && denominator) {
                            const timeSignature = `${numerator}/${denominator}`;
                            trebleStave.addTimeSignature(timeSignature);
                            bassStave.addTimeSignature(timeSignature);
                        }
                    }
                } else {
                    // For internal measures, check if time signature changed
                    if (this.scoreModel.measures[measureIndex].hasTimeChange) {
                        // Get time signature from the time signatures array
                        const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);

                        // Only add time signature if we have valid values
                        if (numerator && denominator) {
                            const timeSignature = `${numerator}/${denominator}`;
                            trebleStave.addTimeSignature(timeSignature);
                            bassStave.addTimeSignature(timeSignature);
                        }
                    }
                }

                // Connect staves with a brace and line at the beginning of the system
                if (measurePos === 0) {
                    const lineLeft = new VF.StaveConnector(trebleStave, bassStave).setType(1);
                    const braceLeft = new VF.StaveConnector(trebleStave, bassStave).setType(3);
                    lineLeft.setContext(context).draw();
                    braceLeft.setContext(context).draw();
                }

                // Draw the staves
                trebleStave.setContext(context).draw();
                bassStave.setContext(context).draw();

                // Store stave references
                staves.treble.push(trebleStave);
                staves.bass.push(bassStave);
                staves.measureIndices.push(measureIndex);
            }

            // Filter notes for the current page's view window
            const visibleNotes = this.scoreModel.notes.filter(note => {
                // Get note duration (consider visual duration for tied notes)
                const noteDuration = note.visualDuration || note.duration;
                const noteEnd = note.start + noteDuration;

                // Include a note if:
                return (
                    // 1. The note starts within our page's time window
                    (note.start >= startPosition && note.start < endPosition) ||

                    // 2. The note started before but extends into our window
                    (note.start < startPosition && noteEnd > startPosition) ||

                    // 3. The note spans across our window
                    (note.start < endPosition && noteEnd > startPosition)
                );
            });

            console.log(`Found ${visibleNotes.length} notes for the current page (from ${startPosition.toFixed(2)}s to ${endPosition.toFixed(2)}s)`);

            // Group notes by measure for more accurate positioning
            const measureVisibleNotes = [];
            for (let i = 0; i <= endMeasureIndex - startMeasureIndex; i++) {
                measureVisibleNotes[i] = [];
            }

            // Sort notes into measures with better boundary handling
            visibleNotes.forEach(note => {
                let assignedToMeasure = false;

                // First, try to find the exact measure this note belongs to
                for (let i = 0; i <= endMeasureIndex - startMeasureIndex; i++) {
                    const measureIndex = startMeasureIndex + i;
                    const measureStartTime = this.scoreModel.measures[measureIndex].startPosition;
                    const measureEndTime = measureIndex < this.scoreModel.measures.length - 1
                        ? this.scoreModel.measures[measureIndex + 1].startPosition
                        : measureStartTime + this.scoreModel.measures[measureIndex].durationSeconds;

                    // Note starts in this measure
                    if (note.start >= measureStartTime && note.start < measureEndTime) {
                        measureVisibleNotes[i].push(note);
                        assignedToMeasure = true;
                        break;
                    }

                    // Note started before but extends into this measure
                    const noteDuration = note.visualDuration || note.duration;
                    const noteEnd = note.start + noteDuration;

                    if (note.start < measureStartTime && noteEnd > measureStartTime) {
                        measureVisibleNotes[i].push(note);
                        assignedToMeasure = true;
                        break;
                    }
                }

                // Fallback: if note wasn't assigned to any measure but is within our time range,
                // put it in the first measure (this prevents notes from disappearing)
                if (!assignedToMeasure && note.start >= startPosition && note.start < endPosition) {
                    measureVisibleNotes[0].push(note);
                }
            });

            // Process each measure and draw the notes
            staves.measureIndices.forEach((measureIndex, measurePosition) => {
                // Get notes for this measure
                const measureNotesIndex = measureIndex - startMeasureIndex;
                if (measureNotesIndex < 0 || measureNotesIndex >= measureVisibleNotes.length) return;

                const measureNotes = measureVisibleNotes[measureNotesIndex];
                console.log(`Measure ${measureIndex}: ${measureNotes.length} notes`);

                // Skip if no notes in this measure
                if (!measureNotes || !measureNotes.length) return;

                // Separate notes into treble and bass
                const trebleNotes = measureNotes.filter(note => note.noteNumber >= 60 || note.staff === 1);
                const bassNotes = measureNotes.filter(note => note.noteNumber < 60 || note.staff === 2);

                // Get measure start and end time
                const measureStartTime = this.scoreModel.measures[measureIndex].startPosition;
                const measureEndTime = measureIndex < this.scoreModel.measures.length - 1
                    ? this.scoreModel.measures[measureIndex + 1].startPosition
                    : measureStartTime + this.scoreModel.measures[measureIndex].durationSeconds;

                // Get the staves for this measure position
                const trebleStave = staves.treble[measurePosition];
                const bassStave = staves.bass[measurePosition];

                if (!trebleStave || !bassStave) {
                    console.warn(`Missing stave for measure ${measureIndex} at position ${measurePosition}`);
                    return;
                }

                // Group notes by time for chord formation
                const trebleNotesByTime = this.groupNotesByTime(trebleNotes);
                const bassNotesByTime = this.groupNotesByTime(bassNotes);

                console.log(`Treble chord groups: ${trebleNotesByTime.length}, Bass chord groups: ${bassNotesByTime.length}`);

                // Create VexFlow notes
                const trebleStaveNotes = this.createVexFlowNotes(
                    trebleNotesByTime, "treble", measureStartTime, measureEndTime
                );

                const bassStaveNotes = this.createVexFlowNotes(
                    bassNotesByTime, "bass", measureStartTime, measureEndTime
                );

                // Get time signature for this measure
                const { numerator, denominator } = this.getTimeSignatureForMeasure(measureIndex);

                // Format and draw voices for treble stave if we have notes
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
                            .format([trebleVoice], measureWidth - 30);

                        trebleVoice.draw(context, trebleStave);
                    } catch (e) {
                        console.error("Error rendering treble notes:", e);
                    }
                }

                // Format and draw voices for bass stave if we have notes
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
                            .format([bassVoice], measureWidth - 30);

                        bassVoice.draw(context, bassStave);
                    } catch (e) {
                        console.error("Error rendering bass notes:", e);
                    }
                }
            });

            // Add position and info overlay
            this.addNotationOverlays(svgContainer, startPosition, endPosition);

            return { startPosition, endPosition };
        } catch (error) {
            console.error('Error rendering notation:', error);
            // Fallback to simpler notation
            this.renderSimpleNotation();
            return null;
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

                    // Apply style to make notes stand out
                    vfNote.setStyle({
                        fillStyle: 'rgba(255, 100, 255, 0.9)',      // Brighter pink/purple fill
                        strokeStyle: 'rgba(80, 200, 255, 0.95)',    // Brighter blue stroke
                        shadowColor: 'rgba(255, 100, 255, 0.8)',    // Matching shadow
                        shadowBlur: 15,                             // Blur amount for glow effect
                        strokeWidth: 2                              // Thicker stroke for better visibility
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

        // Group notes by similar start times
        notes.forEach(note => {
            if (!note) return;

            // Round to 3 decimal places for better grouping of simultaneous notes
            const timeKey = note.start.toFixed(3);
            if (!notesByTime.has(timeKey)) {
                notesByTime.set(timeKey, []);
            }
            notesByTime.get(timeKey).push(note);
        });

        // Convert map to sorted array of note groups
        return Array.from(notesByTime.entries())
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
            .map(entry => entry[1]);
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

        // Calculate current page bounds
        const startMeasureIndex = this.currentPage * this.measuresPerPage;
        const endMeasureIndex = Math.min(
            this.scoreModel.measures.length - 1,
            startMeasureIndex + this.measuresPerPage - 1
        );

        const startPosition = this.scoreModel.measures[startMeasureIndex].startPosition;
        const endPosition = endMeasureIndex < this.scoreModel.measures.length - 1
            ? this.scoreModel.measures[endMeasureIndex + 1].startPosition
            : startPosition + this.scoreModel.measures[endMeasureIndex].durationSeconds;

        this.currentPageStartPosition = startPosition;
        this.currentPageEndPosition = endPosition;

        // Add page info
        const pageInfo = document.createElement('div');
        pageInfo.className = 'simple-page-info';
        pageInfo.innerHTML = `<span>Page ${this.currentPage + 1} of ${this.totalPages}</span>`;

        // Add header with position info
        simpleNotation.innerHTML = `
            <h3>Notes for Measures ${startMeasureIndex + 1}-${endMeasureIndex + 1}</h3>
            <div class="position-info">Position: ${this.scoreModel.currentPosition.toFixed(2)}s</div>
            <div class="playback-status">${this.scoreModel.isPlaying ? 'Playing' : 'Paused'}</div>
        `;

        // Add the page info
        simpleNotation.appendChild(pageInfo);

        // Filter notes for this page
        const visibleNotes = this.scoreModel.notes.filter(note => {
            const noteDuration = note.visualDuration || note.duration;
            return (note.start >= startPosition && note.start < endPosition) ||
                (note.start < startPosition && note.start + noteDuration > startPosition);
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

        return { startPosition, endPosition };
    }

    /**
     * Find the current measure index based on playback position
     * @returns {number} Current measure index
     */
    findCurrentMeasureIndex() {
        let currentMeasureIndex = 0;
        const currentPosition = this.scoreModel.currentPosition;

        for (let i = 0; i < this.scoreModel.measures.length; i++) {
            if (currentPosition >= this.scoreModel.measures[i].startPosition) {
                currentMeasureIndex = i;
            } else {
                break;
            }
        }

        return currentMeasureIndex;
    }

    /**
     * Calculate optimal number of measures to show per page
     * @param {number} currentMeasureIndex Index of the current measure
     * @returns {number} Optimal measures per page
     */
    calculateOptimalMeasuresPerPage(currentMeasureIndex) {
        let optimalMeasures = 2;

        const containerWidth = this.container?.clientWidth || 800;

        const basePerPage = Math.max(1, Math.floor(containerWidth / 300));

        try {
            const startMeasure = currentMeasureIndex;
            const endMeasure = Math.min(this.scoreModel.measures.length - 1, startMeasure + 4);

            let totalNotes = 0;
            let totalMeasures = 0;

            for (let i = startMeasure; i <= endMeasure; i++) {
                const measureStart = this.scoreModel.measures[i].startPosition;
                const measureEnd = i < this.scoreModel.measures.length - 1
                    ? this.scoreModel.measures[i + 1].startPosition
                    : measureStart + this.scoreModel.measures[i].durationSeconds;

                const notesInMeasure = this.scoreModel.notes.filter(note =>
                    (note.start >= measureStart && note.start < measureEnd) ||
                    (note.start < measureStart && note.start + (note.visualDuration || note.duration) > measureStart)
                ).length;

                totalNotes += notesInMeasure;
                totalMeasures++;
            }

            const averageNotesPerMeasure = totalMeasures > 0 ? totalNotes / totalMeasures : 0;

            if (averageNotesPerMeasure > 16) {
                optimalMeasures = Math.max(1, basePerPage - 1);
            } else if (averageNotesPerMeasure > 8) {
                optimalMeasures = basePerPage;
            } else {
                optimalMeasures = basePerPage + 1;
            }

            const currentTempo = this.scoreModel.bpm;
            if (currentTempo > 160) {
                optimalMeasures = Math.max(1, optimalMeasures - 1);
            } else if (currentTempo < 80) {
                optimalMeasures = optimalMeasures + 1;
            }

            optimalMeasures = Math.min(6, Math.max(1, optimalMeasures));

        } catch (error) {
            console.warn('Error calculating optimal measures per page', error);
        }

        this.measuresPerPage = optimalMeasures;
        return optimalMeasures;
    }

    /**
     * Navigate to the next page of notation
     */
    goToNextPage() {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            this.renderNotation(true);

            const measureIndex = this.currentPage * this.measuresPerPage;
            if (measureIndex < this.scoreModel.measures.length) {
                return this.scoreModel.measures[measureIndex].startPosition;
            }
        }
        return null;
    }

    /**
     * Navigate to the previous page of notation
     */
    goToPreviousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderNotation(true);

            const measureIndex = this.currentPage * this.measuresPerPage;
            if (measureIndex < this.scoreModel.measures.length) {
                return this.scoreModel.measures[measureIndex].startPosition;
            }
        }
        return null;
    }

    /**
     * Add overlays with information about current playback
     * @param {HTMLElement} svgContainer The SVG container element
     * @param {number} startPosition Start position of visible window
     * @param {number} endPosition End position of visible window
     */
    addNotationOverlays(svgContainer, startPosition, endPosition) {
        let currentMeasure = 1;
        let currentBeat = 1;

        // Add safety check for the current position
        const safePosition = isNaN(this.scoreModel.currentPosition) || !isFinite(this.scoreModel.currentPosition) ?
            0 : Math.max(0, this.scoreModel.currentPosition);

        for (const measure of this.scoreModel.measures) {
            if (safePosition >= measure.startPosition) {
                currentMeasure = measure.number;

                if (measure.startPosition <= safePosition) {
                    const nextMeasureStart = measure.index < this.scoreModel.measures.length - 1
                        ? this.scoreModel.measures[measure.index + 1].startPosition
                        : measure.startPosition + measure.durationSeconds;

                    const posInMeasure = (safePosition - measure.startPosition) /
                        (nextMeasureStart - measure.startPosition);

                    // Get time signature numerator for this measure
                    const { numerator } = this.getTimeSignatureForMeasure(measure.index);

                    currentBeat = Math.floor(posInMeasure * numerator) + 1;

                    // Ensure beat number is valid
                    if (currentBeat > numerator || !isFinite(currentBeat)) {
                        currentBeat = numerator;
                    }
                }
            } else {
                break;
            }
        }

        const infoPanel = document.createElement('div');
        infoPanel.className = 'notation-info-panel';
        infoPanel.innerHTML = `
            <div class="position-info">Position: ${safePosition.toFixed(1)}s</div>
            <div class="measure-info">Measure: ${currentMeasure}, Beat: ${currentBeat}</div>
            <div class="speed-info">Tempo: ${this.scoreModel.bpm} BPM</div>
            <div class="playback-status">${this.scoreModel.isPlaying ? 'Playing' : 'Paused'}</div>
            <div class="view-info">Page: ${this.currentPage + 1}/${this.totalPages}</div>
        `;

        svgContainer.appendChild(infoPanel);
    }

    /**
     * Get the page time bounds for position indicator
     * @returns {Object} Object with startPosition and endPosition
     */
    getPageTimeBounds() {
        return {
            startPosition: this.currentPageStartPosition,
            endPosition: this.currentPageEndPosition
        };
    }
}

// Make the class available globally
window.NotationRenderer = NotationRenderer;