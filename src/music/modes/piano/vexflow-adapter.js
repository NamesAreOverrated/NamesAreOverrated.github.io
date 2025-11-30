/**
 * VexFlow Adapter
 * Handles low-level VexFlow rendering operations
 */
class VexFlowAdapter {
    constructor(container) {
        this.container = container;
        this.svgContainer = null;
        this.measurePositions = new Map();
    }

    /**
     * Load VexFlow library if not already loaded
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
     * Initialize the SVG container
     */
    initContainer() {
        if (!this.svgContainer) {
            this.svgContainer = document.createElement('div');
            this.svgContainer.className = 'notation-svg-container';
            this.svgContainer.style.width = '100%';
            this.svgContainer.style.height = '100%';
            this.container.appendChild(this.svgContainer);
        } else {
            // Clear existing content
            while (this.svgContainer.firstChild) {
                this.svgContainer.firstChild.remove();
            }
        }
        return this.svgContainer;
    }

    /**
     * Render the notation
     * @param {Object} scoreModel The score model
     * @param {Array} visibleMeasureIndices Indices of measures to render
     * @returns {Map} Map of measure positions
     */
    render(scoreModel, visibleMeasureIndices) {
        this.measurePositions.clear();

        if (!visibleMeasureIndices.length) return this.measurePositions;

        const VF = Vex.Flow;
        const containerWidth = this.container.clientWidth;

        // Initialize renderer
        const renderer = new VF.Renderer(this.svgContainer, VF.Renderer.Backends.SVG);
        renderer.resize(containerWidth, containerWidth / 6.5); // Aspect ratio estimate
        const context = renderer.getContext();
        context.setFont("Arial", 10);

        // Set SVG properties
        const svgElement = this.svgContainer.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
            svgElement.style.display = 'block';
        }

        // Calculate layout
        const measuresPerLine = Math.max(2, Math.floor(containerWidth / 180));
        const lines = this.determineMeasureLines(visibleMeasureIndices, measuresPerLine);
        const visibleNotes = this.getNotesForMeasures(scoreModel, visibleMeasureIndices);

        // Render lines
        let yOffset = 50;
        for (const measureIndicesInLine of lines) {
            this.createStaveSystem(
                context,
                scoreModel,
                measureIndicesInLine,
                10,
                yOffset,
                containerWidth - 20,
                visibleNotes
            );
            yOffset += 200;
        }

        return this.measurePositions;
    }

    /**
     * Determine how measures should be organized into lines
     */
    determineMeasureLines(measureIndices, measuresPerLine) {
        const lines = [];
        let currentLine = [];

        for (let i = 0; i < measureIndices.length; i++) {
            currentLine.push(measureIndices[i]);
            if (currentLine.length >= measuresPerLine || i === measureIndices.length - 1) {
                lines.push(currentLine);
                currentLine = [];
            }
        }
        return lines;
    }

    /**
     * Get notes for specific measures
     */
    getNotesForMeasures(scoreModel, measureIndices) {
        if (!measureIndices.length) return [];

        let startTime = Infinity;
        let endTime = -Infinity;

        for (const index of measureIndices) {
            const measure = scoreModel.measures[index];
            const measureStart = measure.startPosition;
            const measureEnd = index < scoreModel.measures.length - 1
                ? scoreModel.measures[index + 1].startPosition
                : measureStart + measure.durationSeconds;

            startTime = Math.min(startTime, measureStart);
            endTime = Math.max(endTime, measureEnd);
        }

        return scoreModel.notes.filter(note => {
            if (note.isTiedFromPrevious) return false;
            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = note.start + noteDuration;
            return (note.start >= startTime && note.start < endTime) ||
                (note.start < startTime && noteEnd > startTime);
        });
    }

    /**
     * Create a system of staves
     */
    createStaveSystem(context, scoreModel, measureIndices, x, y, availableWidth, allNotes) {
        if (!measureIndices.length) return;

        const VF = Vex.Flow;
        const staffDistance = 120;

        // Calculate bounds and density
        const measureTimeBounds = measureIndices.map(index => {
            const measure = scoreModel.measures[index];
            const start = measure.startPosition;
            const end = index < scoreModel.measures.length - 1
                ? scoreModel.measures[index + 1].startPosition
                : start + measure.durationSeconds;
            return { start, end, index };
        });

        const notesByMeasure = measureIndices.map(index => {
            const bounds = measureTimeBounds.find(b => b.index === index);
            const notesInMeasure = allNotes.filter(note => {
                const noteEnd = note.start + (note.visualDuration || note.duration);
                return (note.start >= bounds.start && note.start < bounds.end) ||
                    (note.start < bounds.start && noteEnd > bounds.start);
            });
            return { index, noteCount: notesInMeasure.length, notes: notesInMeasure };
        });

        // Width distribution
        const totalNotes = notesByMeasure.reduce((sum, m) => sum + m.noteCount, 0);
        const averageNotesPerMeasure = Math.max(1, totalNotes / measureIndices.length);

        let totalAdjustedWidth = 0;
        const initialWidths = notesByMeasure.map(measure => {
            const density = measure.noteCount / averageNotesPerMeasure;
            const widthFactor = 0.9 + (density * 0.2);
            const width = (availableWidth / measureIndices.length) * widthFactor;
            totalAdjustedWidth += width;
            return width;
        });

        const scaleFactor = availableWidth / totalAdjustedWidth;
        const finalWidths = initialWidths.map(w => w * scaleFactor);

        // Draw staves
        let currentX = x;
        for (let i = 0; i < measureIndices.length; i++) {
            const measureIndex = measureIndices[i];
            const measureNotes = notesByMeasure.find(m => m.index === measureIndex);
            const measureWidth = Math.max(70, finalWidths[i]);

            // Store position
            const timeBounds = measureTimeBounds.find(b => b.index === measureIndex);
            if (timeBounds) {
                this.measurePositions.set(measureIndex, {
                    startTime: timeBounds.start,
                    endTime: timeBounds.end,
                    x: currentX,
                    width: measureWidth
                });
            }

            const trebleStave = new VF.Stave(currentX, y, measureWidth);
            const bassStave = new VF.Stave(currentX, y + staffDistance, measureWidth);

            // Clefs and Time Signatures
            if (i === 0) {
                trebleStave.addClef("treble");
                bassStave.addClef("bass");

                if (measureIndex === 0 || scoreModel.measures[measureIndex].hasTimeChange) {
                    const ts = this.getTimeSignature(scoreModel, measureIndex);
                    const tsString = `${ts.numerator}/${ts.denominator}`;
                    trebleStave.addTimeSignature(tsString);
                    bassStave.addTimeSignature(tsString);
                }

                new VF.StaveConnector(trebleStave, bassStave).setType(1).setContext(context).draw();
                new VF.StaveConnector(trebleStave, bassStave).setType(3).setContext(context).draw();
            } else if (scoreModel.measures[measureIndex].hasTimeChange) {
                const ts = this.getTimeSignature(scoreModel, measureIndex);
                const tsString = `${ts.numerator}/${ts.denominator}`;
                trebleStave.addTimeSignature(tsString);
                bassStave.addTimeSignature(tsString);
            }

            trebleStave.setContext(context).draw();
            bassStave.setContext(context).draw();

            if (i === measureIndices.length - 1) {
                new VF.StaveConnector(trebleStave, bassStave).setType(1).setContext(context).draw();
            }

            if (measureNotes?.notes.length > 0) {
                this.drawNotesForMeasure(
                    context,
                    scoreModel,
                    measureIndex,
                    measureNotes.notes,
                    trebleStave,
                    bassStave,
                    timeBounds
                );
            }

            currentX += measureWidth;
        }
    }

    /**
     * Get time signature for a measure
     */
    getTimeSignature(scoreModel, measureIndex) {
        let numerator = 4, denominator = 4;
        if (scoreModel.timeSignatures?.length) {
            const measurePosition = scoreModel.measures[measureIndex].startPosition;
            for (const timeSig of scoreModel.timeSignatures) {
                if (timeSig.position <= measurePosition) {
                    numerator = timeSig.numerator;
                    denominator = timeSig.denominator;
                } else {
                    break;
                }
            }
        }
        return { numerator, denominator };
    }

    /**
     * Draw notes for a measure
     */
    drawNotesForMeasure(context, scoreModel, measureIndex, notes, trebleStave, bassStave, timeBounds) {
        const VF = Vex.Flow;

        const trebleNotes = notes.filter(n => n.staff === 1 || (n.staff === undefined && n.noteNumber >= 60));
        const bassNotes = notes.filter(n => n.staff === 2 || (n.staff === undefined && n.noteNumber < 60));

        const trebleGroups = this.groupNotesByTime(trebleNotes);
        const bassGroups = this.groupNotesByTime(bassNotes);

        const ts = this.getTimeSignature(scoreModel, measureIndex);

        const trebleStaveNotes = this.createVexFlowNotes(scoreModel, trebleGroups, "treble", timeBounds, ts);
        const bassStaveNotes = this.createVexFlowNotes(scoreModel, bassGroups, "bass", timeBounds, ts);

        if (trebleStaveNotes.length > 0) {
            try {
                const voice = new VF.Voice({
                    num_beats: ts.numerator,
                    beat_value: ts.denominator,
                    resolution: VF.RESOLUTION
                }).setMode(VF.Voice.Mode.SOFT);

                voice.addTickables(trebleStaveNotes);
                new VF.Formatter().joinVoices([voice]).format([voice], trebleStave.getWidth() - 30);
                voice.draw(context, trebleStave);
            } catch (e) { console.error("Treble render error:", e); }
        }

        if (bassStaveNotes.length > 0) {
            try {
                const voice = new VF.Voice({
                    num_beats: ts.numerator,
                    beat_value: ts.denominator,
                    resolution: VF.RESOLUTION
                }).setMode(VF.Voice.Mode.SOFT);

                voice.addTickables(bassStaveNotes);
                new VF.Formatter().joinVoices([voice]).format([voice], bassStave.getWidth() - 30);
                voice.draw(context, bassStave);
            } catch (e) { console.error("Bass render error:", e); }
        }
    }

    /**
     * Group notes by time
     */
    groupNotesByTime(notes) {
        if (!notes?.length) return [];
        const notesByTime = new Map();
        const EPSILON = 0.02;

        for (const note of notes) {
            const timeKey = note.start.toFixed(3);
            if (!notesByTime.has(timeKey)) notesByTime.set(timeKey, []);
            notesByTime.get(timeKey).push(note);
        }

        const mergedGroups = new Map();
        const processedKeys = new Set();

        for (const timeKey of notesByTime.keys()) {
            if (processedKeys.has(timeKey)) continue;
            const time = parseFloat(timeKey);
            let mergedNotes = [...notesByTime.get(timeKey)];

            for (const otherKey of notesByTime.keys()) {
                if (otherKey === timeKey || processedKeys.has(otherKey)) continue;
                if (Math.abs(time - parseFloat(otherKey)) < EPSILON) {
                    mergedNotes = [...mergedNotes, ...notesByTime.get(otherKey)];
                    processedKeys.add(otherKey);
                }
            }
            processedKeys.add(timeKey);
            mergedGroups.set(timeKey, mergedNotes);
        }

        return Array.from(mergedGroups.entries())
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
            .map(entry => entry[1]);
    }

    /**
     * Create VexFlow notes
     */
    createVexFlowNotes(scoreModel, groupedNotes, clef, timeBounds, timeSignature) {
        if (!groupedNotes?.length) return [];
        const VF = Vex.Flow;
        const measureDuration = timeBounds.end - timeBounds.start;
        if (measureDuration <= 0) return [];

        const beatsPerMeasure = timeSignature.numerator || 4;
        const timeToBeats = (t) => {
            const pos = Math.max(0, Math.min(1, (t - timeBounds.start) / measureDuration));
            return beatsPerMeasure * pos;
        };

        const vfNotes = [];
        for (const group of groupedNotes) {
            if (!group?.length) continue;
            const first = group[0];

            if (first.start >= timeBounds.end) continue;
            const noteEnd = first.start + (first.visualDuration || first.duration);
            if (noteEnd <= timeBounds.start) continue;

            const effectiveStart = Math.max(first.start, timeBounds.start);
            const visibleDur = Math.min(noteEnd, timeBounds.end) - effectiveStart;
            const beatPos = timeToBeats(effectiveStart);
            const beatDur = timeToBeats(effectiveStart + visibleDur) - beatPos;

            if (beatDur < 0.01) continue;

            const keys = group.map(n => {
                let name = n.step.toLowerCase();
                if (n.alter === 1) name += "#";
                else if (n.alter === -1) name += "b";
                return `${name}/${n.octave}`;
            });

            let duration = "q";
            if (beatDur >= 4) duration = "w";
            else if (beatDur >= 3) duration = "hd";
            else if (beatDur >= 2) duration = "h";
            else if (beatDur >= 1.5) duration = "qd";
            else if (beatDur >= 1) duration = "q";
            else if (beatDur >= 0.75) duration = "8d";
            else if (beatDur >= 0.5) duration = "8";
            else if (beatDur >= 0.25) duration = "16";
            else duration = "32";

            try {
                const vfNote = new VF.StaveNote({ clef, keys, duration });

                group.forEach((n, i) => {
                    if (n.alter === 1) vfNote.addModifier(new VF.Accidental("#"), i);
                    else if (n.alter === -1) vfNote.addModifier(new VF.Accidental("b"), i);
                });

                if (first.staccato) vfNote.addArticulation(0, new VF.Articulation('a.').setPosition(3));
                if (first.accent) vfNote.addArticulation(0, new VF.Articulation('a>').setPosition(3));
                if (first.tenuto) vfNote.addArticulation(0, new VF.Articulation('a-').setPosition(3));

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
            } catch (e) { console.warn("Note creation error:", e); }
        }
        return vfNotes;
    }

    cleanup() {
        if (this.svgContainer) {
            while (this.svgContainer.firstChild) this.svgContainer.firstChild.remove();
            this.svgContainer.remove();
            this.svgContainer = null;
        }
        this.measurePositions.clear();
    }
}

window.VexFlowAdapter = VexFlowAdapter;
