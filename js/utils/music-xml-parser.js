/**
 * MusicXML Parser
 * Handles parsing and processing of MusicXML files
 */
class MusicXMLParser {
    constructor() {
        // Parser state
        this.divisions = 24;
        this.timeSignatureNumerator = 4;
        this.timeSignatureDenominator = 4;
        this.bpm = 120;

        // Parsed data storage
        this.tempoChanges = [];
        this.timeSignatureChanges = [];
        this.parsedNotes = [];
        this.measureData = [];
        this.composer = '';
        this.title = '';
    }

    /**
     * Load and parse a MusicXML file
     * @param {File} file The file to load
     * @returns {Promise} Promise that resolves with the parsed score data
     */
    async loadMusicXMLFile(file) {
        if (file.name.toLowerCase().endsWith('.mxl')) {
            const buffer = await file.arrayBuffer();
            const xmlString = await this.processMXLData(buffer);
            return this.processMusicXMLString(xmlString);
        } else {
            const xmlString = await file.text();
            return this.processMusicXMLString(xmlString);
        }
    }

    /**
     * Process compressed MusicXML (.mxl) data
     * @param {ArrayBuffer} arrayBuffer The compressed data
     * @returns {Promise<string>} Promise that resolves with the extracted XML string
     */
    async processMXLData(arrayBuffer) {
        if (typeof JSZip === 'undefined') {
            await this.loadJSZip();
        }

        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(arrayBuffer);

            let mainScoreFile = null;

            if (contents.files['META-INF/container.xml']) {
                const containerXml = await contents.files['META-INF/container.xml'].async('string');
                const parser = new DOMParser();
                const containerDoc = parser.parseFromString(containerXml, 'text/xml');
                const rootfiles = containerDoc.getElementsByTagName('rootfile');

                if (rootfiles.length > 0) {
                    mainScoreFile = rootfiles[0].getAttribute('full-path');
                }
            }

            if (!mainScoreFile || !contents.files[mainScoreFile]) {
                for (const filename in contents.files) {
                    if (filename.endsWith('.xml') && !filename.includes('META-INF')) {
                        mainScoreFile = filename;
                        break;
                    }
                }
            }

            if (mainScoreFile && contents.files[mainScoreFile]) {
                return await contents.files[mainScoreFile].async('string');
            } else {
                throw new Error('No MusicXML data found in the compressed file');
            }
        } catch (error) {
            console.error('Error extracting MXL file:', error);
            throw error;
        }
    }

    /**
     * Load JSZip library if not available
     * @returns {Promise} Promise that resolves when JSZip is loaded
     */
    loadJSZip() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Process a MusicXML string into structured score data
     * @param {string} xmlString The MusicXML content as a string
     * @returns {Object} Parsed score data
     */
    processMusicXMLString(xmlString) {
        try {
            const parser = new DOMParser();
            const musicXML = parser.parseFromString(xmlString, 'text/xml');

            const parsererror = musicXML.getElementsByTagName('parsererror');
            if (parsererror.length > 0) {
                throw new Error('XML parsing error: ' + parsererror[0].textContent);
            }

            this.resetMusicalState();

            this.title = this.extractScoreMetadata(musicXML);
            this.extractScoreTimingInformation(musicXML);
            this.parseScoreContent(musicXML);
            this.processNoteRelationships();

            return {
                title: this.title,
                composer: this.composer || '',
                notes: this.parsedNotes,
                measures: this.measureData,
                timeSignatures: this.timeSignatureChanges,
                tempoChanges: this.tempoChanges,
                divisions: this.divisions,
                timeSignatureNumerator: this.timeSignatureNumerator,
                timeSignatureDenominator: this.timeSignatureDenominator
            };
        } catch (error) {
            console.error('Error processing MusicXML:', error);
            throw error;
        }
    }

    /**
     * Extract title and composer from MusicXML
     * @param {Document} musicXML The parsed MusicXML document
     * @returns {string} The score title
     */
    extractScoreMetadata(musicXML) {
        const workTitle = musicXML.querySelector('work-title');
        const movementTitle = musicXML.querySelector('movement-title');
        const scorePartName = musicXML.querySelector('part-name');
        const creator = musicXML.querySelector('creator[type="composer"]');

        if (creator) {
            this.composer = creator.textContent;
        }

        return workTitle?.textContent ||
            movementTitle?.textContent ||
            scorePartName?.textContent ||
            'Untitled Score';
    }

    /**
     * Reset the musical state before parsing a new score
     */
    resetMusicalState() {
        this.divisions = 24;
        this.timeSignatureNumerator = 4;
        this.timeSignatureDenominator = 4;
        this.bpm = 120;

        this.tempoChanges = [{ position: 0, tempo: this.bpm }];
        this.timeSignatureChanges = [{
            position: 0,
            numerator: this.timeSignatureNumerator,
            denominator: this.timeSignatureDenominator
        }];

        this.parsedNotes = [];
        this.measureData = [];
    }

    /**
     * Extract timing information from the score
     * @param {Document} musicXML The parsed MusicXML document
     */
    extractScoreTimingInformation(musicXML) {
        const divisionsElements = musicXML.querySelectorAll('divisions');
        if (divisionsElements.length > 0) {
            const divisionsValue = parseInt(divisionsElements[0].textContent);
            if (!isNaN(divisionsValue) && divisionsValue > 0) {
                this.divisions = divisionsValue;
                console.log(`Initial divisions: ${this.divisions} ticks per quarter note`);
            }
        }

        const timeElements = musicXML.querySelectorAll('time');
        if (timeElements.length > 0) {
            const beats = parseInt(timeElements[0].querySelector('beats')?.textContent);
            const beatType = parseInt(timeElements[0].querySelector('beat-type')?.textContent);

            if (!isNaN(beats) && beats > 0 && !isNaN(beatType) && beatType > 0) {
                this.timeSignatureNumerator = beats;
                this.timeSignatureDenominator = beatType;
                console.log(`Initial time signature: ${beats}/${beatType}`);
            }
        }

        const tempoElements = musicXML.querySelectorAll('sound[tempo]');
        if (tempoElements.length > 0) {
            const tempo = parseFloat(tempoElements[0].getAttribute('tempo'));
            if (!isNaN(tempo) && tempo > 0) {
                this.bpm = tempo;
                console.log(`Initial tempo: ${tempo} BPM`);
            }
        }

        this.scanTimingChanges(musicXML);
    }

    /**
     * Scan the score for tempo and time signature changes
     * @param {Document} musicXML The parsed MusicXML document
     */
    scanTimingChanges(musicXML) {
        const parts = musicXML.getElementsByTagName('part');
        if (parts.length === 0) return;

        const firstPart = parts[0];
        const measures = firstPart.getElementsByTagName('measure');

        let currentMeasurePosition = 0;
        let currentTickPosition = 0;
        let currentDivisions = this.divisions;

        for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
            const measure = measures[measureIndex];
            const measureNumber = parseInt(measure.getAttribute('number')) || (measureIndex + 1);

            const measureInfo = {
                index: measureIndex,
                number: measureNumber,
                startPosition: currentMeasurePosition,
                startTick: currentTickPosition,
                divisions: currentDivisions,
                hasTimeChange: false,
                hasTempoChange: false
            };

            const divisionsElements = measure.getElementsByTagName('divisions');
            if (divisionsElements.length > 0) {
                const newDivisions = parseInt(divisionsElements[0].textContent);
                if (!isNaN(newDivisions) && newDivisions > 0) {
                    currentDivisions = newDivisions;
                    measureInfo.divisions = newDivisions;
                    console.log(`Measure ${measureNumber}: Divisions change to ${newDivisions}`);
                }
            }

            const timeElements = measure.getElementsByTagName('time');
            if (timeElements.length > 0) {
                const beats = parseInt(timeElements[0].querySelector('beats')?.textContent);
                const beatType = parseInt(timeElements[0].querySelector('beat-type')?.textContent);

                if (!isNaN(beats) && !isNaN(beatType) && beats > 0 && beatType > 0) {
                    this.timeSignatureNumerator = beats;
                    this.timeSignatureDenominator = beatType;

                    this.timeSignatureChanges.push({
                        position: currentMeasurePosition,
                        numerator: beats,
                        denominator: beatType,
                        measure: measureNumber
                    });

                    measureInfo.hasTimeChange = true;
                    measureInfo.timeSignature = `${beats}/${beatType}`;

                    console.log(`Measure ${measureNumber}: Time signature change to ${beats}/${beatType}`);
                }
            }

            const soundElements = measure.querySelectorAll('sound[tempo]');
            if (soundElements.length > 0) {
                let measureHasTempo = false;
                for (const sound of soundElements) {
                    const tempo = parseFloat(sound.getAttribute('tempo'));
                    if (!isNaN(tempo) && tempo > 0) {
                        this.tempoChanges.push({
                            position: currentMeasurePosition,
                            tempo: tempo,
                            measure: measureNumber
                        });

                        measureHasTempo = true;
                        measureInfo.tempo = tempo;

                        console.log(`Measure ${measureNumber}: Tempo change to ${tempo} BPM`);

                        this.bpm = tempo;
                    }
                }

                if (measureHasTempo) {
                    measureInfo.hasTempoChange = true;
                }
            }

            const measureDurationTicks = this.calculateMeasureDurationInTicks(
                this.timeSignatureNumerator,
                this.timeSignatureDenominator,
                currentDivisions
            );

            let currentTempo = this.bpm;
            for (const tempoChange of this.tempoChanges) {
                if (tempoChange.position <= currentMeasurePosition) {
                    currentTempo = tempoChange.tempo;
                } else {
                    break;
                }
            }

            const measureDurationSeconds = this.ticksToSeconds(
                measureDurationTicks,
                currentDivisions,
                currentTempo
            );

            measureInfo.durationTicks = measureDurationTicks;
            measureInfo.durationSeconds = measureDurationSeconds;
            measureInfo.divisions = currentDivisions;

            this.measureData.push(measureInfo);

            currentMeasurePosition += measureDurationSeconds;
            currentTickPosition += measureDurationTicks;
        }

        console.log(`Scanned ${measures.length} measures with ${this.timeSignatureChanges.length} time signature changes and ${this.tempoChanges.length} tempo changes`);

        if (this.measureData.length > 0) {
            const lastMeasure = this.measureData[this.measureData.length - 1];
            const totalDuration = lastMeasure.startPosition + lastMeasure.durationSeconds;
            console.log(`Total score duration: ${totalDuration.toFixed(2)} seconds`);
        }
    }

    /**
     * Calculate measure duration in ticks based on time signature and divisions
     * @param {number} numerator Time signature numerator
     * @param {number} denominator Time signature denominator
     * @param {number} divisions Divisions per quarter note
     * @returns {number} Duration in ticks
     */
    calculateMeasureDurationInTicks(numerator, denominator, divisions) {
        const ticksPerWholeNote = divisions * 4;
        const ticksPerBeat = ticksPerWholeNote / denominator;
        return ticksPerBeat * numerator;
    }

    /**
     * Parse the full score content
     * @param {Document} musicXML The parsed MusicXML document
     */
    parseScoreContent(musicXML) {
        console.log("Parsing score content with enhanced accuracy");

        const parts = musicXML.getElementsByTagName('part');

        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex];
            const partId = part.getAttribute('id') || `part-${partIndex + 1}`;

            console.log(`Parsing part ${partId} (${partIndex + 1}/${parts.length})`);

            const scorePart = musicXML.querySelector(`score-part[id="${partId}"]`);
            const partName = scorePart?.querySelector('part-name')?.textContent || `Part ${partIndex + 1}`;

            this.parsePart(part, partId, partName, partIndex);
        }

        this.parsedNotes.sort((a, b) => a.start - b.start);

        console.log(`Parsed ${this.parsedNotes.length} total notes`);

        if (this.parsedNotes.length > 0) {
            const lastNote = this.parsedNotes[this.parsedNotes.length - 1];
            const scoreDuration = lastNote.start + lastNote.duration;

            console.log(`Score duration: ${scoreDuration.toFixed(2)} seconds`);
        }
    }

    /**
     * Parse a part from the score
     * @param {Element} part The part element
     * @param {string} partId Part ID
     * @param {string} partName Part name
     * @param {number} partIndex Part index
     */
    parsePart(part, partId, partName, partIndex) {
        const measures = part.getElementsByTagName('measure');
        if (!measures.length) return;

        const tiedNotes = new Map();
        let currentTime = 0;

        for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
            const measure = measures[measureIndex];
            const measureNumber = parseInt(measure.getAttribute('number')) || (measureIndex + 1);

            const measureData = this.measureData[measureIndex];
            if (measureData) {
                currentTime = measureData.startPosition;
            }

            const currentDivisions = measureData?.divisions || this.divisions;

            currentTime = this.parseMeasure(
                measure,
                currentTime,
                currentDivisions,
                partId,
                partName,
                partIndex,
                measureNumber,
                tiedNotes
            );
        }
    }

    /**
     * Parse a measure from a part
     * @param {Element} measure The measure element
     * @param {number} startTime Start time in seconds
     * @param {number} divisions Divisions per quarter note
     * @param {string} partId Part ID
     * @param {string} partName Part name
     * @param {number} partIndex Part index
     * @param {number} measureNumber Measure number
     * @param {Map} tiedNotes Map of tied notes
     * @returns {number} End time of the measure in seconds
     */
    parseMeasure(measure, startTime, divisions, partId, partName, partIndex, measureNumber, tiedNotes) {
        let currentTime = startTime;
        const voicePositions = new Map();
        const elements = Array.from(measure.children);

        const attributes = measure.querySelector('attributes');
        if (attributes) {
            this.processAttributes(attributes, divisions);
        }

        let currentVoice = 1;
        let currentStaff = 1;
        let inChord = false;
        let chordStartTime = currentTime;
        let currentChordNotes = [];

        for (const element of elements) {
            switch (element.tagName) {
                case 'note':
                    const note = element;

                    const voiceElement = note.querySelector('voice');
                    if (voiceElement) {
                        const voice = parseInt(voiceElement.textContent);
                        if (!isNaN(voice)) {
                            if (voice !== currentVoice) {
                                voicePositions.set(currentVoice, currentTime);

                                if (voicePositions.has(voice)) {
                                    currentTime = voicePositions.get(voice);
                                }

                                currentVoice = voice;
                            }
                        }
                    }

                    const staffElement = note.querySelector('staff');
                    if (staffElement) {
                        const staff = parseInt(staffElement.textContent);
                        if (!isNaN(staff)) {
                            currentStaff = staff;
                        }
                    }

                    const isChordNote = !!note.querySelector('chord');

                    if (inChord && !isChordNote) {
                        this.processChordGroup(currentChordNotes, chordStartTime, partId, partName, partIndex, currentVoice, currentStaff);
                        currentChordNotes = [];
                        inChord = false;
                    }

                    const durationElement = note.querySelector('duration');
                    if (!durationElement) continue;

                    const durationTicks = parseInt(durationElement.textContent);
                    if (isNaN(durationTicks)) continue;

                    const durationSeconds = this.ticksToSeconds(durationTicks, divisions, this.bpm);

                    if (note.querySelector('rest')) {
                        if (!isChordNote) {
                            currentTime += durationSeconds;
                        }
                        continue;
                    }

                    const noteObj = this.parseNotePitch(note, currentTime, durationSeconds, durationTicks);
                    if (!noteObj) continue;

                    noteObj.partId = partId;
                    noteObj.partName = partName;
                    noteObj.partIndex = partIndex;
                    noteObj.voice = currentVoice;
                    noteObj.staff = currentStaff;
                    noteObj.measure = measureNumber;
                    noteObj.isChordNote = isChordNote;

                    this.processNoteProperties(noteObj, note);

                    if (isChordNote) {
                        noteObj.start = chordStartTime;
                        currentChordNotes.push(noteObj);
                        inChord = true;
                    } else {
                        this.parsedNotes.push(noteObj);
                        chordStartTime = currentTime;
                        currentTime += durationSeconds;
                    }

                    this.processNoteTies(noteObj, note, tiedNotes);
                    break;

                case 'backup':
                    const backupDuration = parseInt(element.querySelector('duration')?.textContent);
                    if (!isNaN(backupDuration)) {
                        currentTime -= this.ticksToSeconds(backupDuration, divisions, this.bpm);
                    }
                    break;

                case 'forward':
                    const forwardDuration = parseInt(element.querySelector('duration')?.textContent);
                    if (!isNaN(forwardDuration)) {
                        currentTime += this.ticksToSeconds(forwardDuration, divisions, this.bpm);
                    }
                    break;

                case 'direction':
                    const sound = element.querySelector('sound[tempo]');
                    if (sound) {
                        const newTempo = parseFloat(sound.getAttribute('tempo'));
                        if (!isNaN(newTempo) && newTempo > 0) {
                            this.bpm = newTempo;
                        }
                    }
                    break;
            }
        }

        if (currentChordNotes.length > 0) {
            this.processChordGroup(currentChordNotes, chordStartTime, partId, partName, partIndex, currentVoice, currentStaff);
        }

        return currentTime;
    }

    /**
     * Parse pitch information from a note element
     * @param {Element} noteElement The note element
     * @param {number} startTime Start time in seconds
     * @param {number} durationSeconds Duration in seconds
     * @param {number} durationTicks Duration in ticks
     * @returns {Object|null} Note object or null if invalid
     */
    parseNotePitch(noteElement, startTime, durationSeconds, durationTicks) {
        const pitch = noteElement.querySelector('pitch');
        if (!pitch) return null;

        const step = pitch.querySelector('step')?.textContent;
        const octave = parseInt(pitch.querySelector('octave')?.textContent);
        const alter = parseInt(pitch.querySelector('alter')?.textContent || '0');

        if (!step || isNaN(octave)) return null;

        const noteNumber = this.stepOctaveToMidiNote(step, octave, alter);

        const noteObj = {
            noteNumber,
            start: startTime,
            duration: durationSeconds,
            tickDuration: durationTicks,
            step,
            octave,
            alter,
            id: noteElement.getAttribute('id') || `note-${noteNumber}-${startTime.toFixed(6)}`,
        };

        return noteObj;
    }

    /**
     * Process note properties such as articulations, etc.
     * @param {Object} noteObj Note object to update
     * @param {Element} noteElement Note XML element
     */
    processNoteProperties(noteObj, noteElement) {
        const notations = noteElement.querySelector('notations');
        if (!notations) return;

        const articulations = notations.querySelector('articulations');
        if (articulations) {
            noteObj.staccato = !!articulations.querySelector('staccato');
            noteObj.accent = !!articulations.querySelector('accent');
            noteObj.tenuto = !!articulations.querySelector('tenuto');
            noteObj.marcato = !!articulations.querySelector('strong-accent');
        }

        const technical = notations.querySelector('technical');
        if (technical) {
            noteObj.fingering = technical.querySelector('fingering')?.textContent;
        }

        const ornaments = notations.querySelector('ornaments');
        if (ornaments) {
            noteObj.trill = !!ornaments.querySelector('trill-mark');
            noteObj.mordent = !!ornaments.querySelector('mordent');
            noteObj.turn = !!ornaments.querySelector('turn');
        }

        const slurStart = notations.querySelector('slur[type="start"]');
        const slurStop = notations.querySelector('slur[type="stop"]');
        if (slurStart) noteObj.slurStart = true;
        if (slurStop) noteObj.slurStop = true;

        noteObj.fermata = !!notations.querySelector('fermata');
    }

    /**
     * Process note ties
     * @param {Object} noteObj Note object to update
     * @param {Element} noteElement Note XML element
     * @param {Map} tiedNotes Map of tied notes
     */
    processNoteTies(noteObj, noteElement, tiedNotes) {
        const tieElements = noteElement.querySelectorAll('tie');
        let tieStart = Array.from(tieElements).some(t => t.getAttribute('type') === 'start');
        let tieStop = Array.from(tieElements).some(t => t.getAttribute('type') === 'stop');

        const notations = noteElement.querySelector('notations');
        if (notations) {
            const tiedElements = notations.querySelectorAll('tied');
            if (tiedElements.length > 0) {
                const hasTiedStart = Array.from(tiedElements).some(t => t.getAttribute('type') === 'start');
                const hasTiedStop = Array.from(tiedElements).some(t => t.getAttribute('type') === 'stop');

                if (hasTiedStart) tieStart = true;
                if (hasTiedStop) tieStop = true;
            }
        }

        noteObj.isTieStart = tieStart;
        noteObj.isTieEnd = tieStop;

        if (tieStart) {
            const tieKey = `${noteObj.partId}-${noteObj.voice}-${noteObj.noteNumber}`;
            tiedNotes.set(tieKey, noteObj);
        }

        if (tieStop) {
            const tieKey = `${noteObj.partId}-${noteObj.voice}-${noteObj.noteNumber}`;
            const startNote = tiedNotes.get(tieKey);

            if (startNote) {
                startNote.tiedToId = noteObj.id;
                noteObj.tiedFromId = startNote.id;

                tiedNotes.delete(tieKey);
            }
        }
    }

    /**
     * Process attributes element
     * @param {Element} attributesElement Attributes XML element
     * @param {number} divisions Current divisions value
     */
    processAttributes(attributesElement, divisions) {
        const divisionsElement = attributesElement.querySelector('divisions');
        if (divisionsElement) {
            const divisionsValue = parseInt(divisionsElement.textContent);
            if (!isNaN(divisionsValue) && divisionsValue > 0) {
                this.divisions = divisionsValue;
            }
        }

        const timeElement = attributesElement.querySelector('time');
        if (timeElement) {
            const beats = parseInt(timeElement.querySelector('beats')?.textContent);
            const beatType = parseInt(timeElement.querySelector('beat-type')?.textContent);

            if (!isNaN(beats) && !isNaN(beatType) && beats > 0 && beatType > 0) {
                this.timeSignatureNumerator = beats;
                this.timeSignatureDenominator = beatType;
            }
        }

        const keyElement = attributesElement.querySelector('key');
        if (keyElement) {
            const fifths = parseInt(keyElement.querySelector('fifths')?.textContent);
            if (!isNaN(fifths)) {
                this.keySignature = fifths;
            }
        }
    }

    /**
     * Process a group of notes forming a chord
     * @param {Array} chordNotes Array of note objects in the chord
     * @param {number} startTime Start time in seconds
     * @param {string} partId Part ID
     * @param {string} partName Part name
     * @param {number} partIndex Part index
     * @param {number} voice Voice number
     * @param {number} staff Staff number
     */
    processChordGroup(chordNotes, startTime, partId, partName, partIndex, voice, staff) {
        if (!chordNotes.length) return;

        chordNotes.forEach(note => {
            note.start = startTime;
            note.isChordNote = true;
            note.partId = partId;
            note.partName = partName;
            note.partIndex = partIndex;
            note.voice = voice;
            note.staff = staff;

            this.parsedNotes.push(note);
        });
    }

    /**
     * Process relationships between notes
     */
    processNoteRelationships() {
        this.processTiedNotes();
        this.applyArticulationEffects();
    }

    /**
     * Process tied notes to calculate visual durations
     */
    processTiedNotes() {
        const noteById = new Map();
        this.parsedNotes.forEach(note => noteById.set(note.id, note));

        const tieChains = new Map();

        for (const note of this.parsedNotes) {
            if (note.isTieStart && !note.isTiedFromPrevious) {
                tieChains.set(note.id, [note]);
            }
        }

        for (const [startId, chain] of tieChains.entries()) {
            let currentNote = chain[0];
            while (currentNote.tiedToId && noteById.has(currentNote.tiedToId)) {
                const nextNote = noteById.get(currentNote.tiedToId);
                chain.push(nextNote);
                currentNote = nextNote;

                if (!currentNote.isTieStart) break;
            }
        }

        for (const chain of tieChains.values()) {
            if (chain.length <= 1) continue;

            let totalDuration = 0;
            for (const note of chain) {
                totalDuration += note.duration;
            }

            const firstNote = chain[0];
            firstNote.visualDuration = totalDuration;
            firstNote.hasTie = true;

            for (let i = 1; i < chain.length; i++) {
                chain[i].isTiedFromPrevious = true;
            }
        }

        for (const note of this.parsedNotes) {
            if (!note.visualDuration) {
                note.visualDuration = note.duration;
            }
        }

        console.log("Processed tied notes with improved accuracy");
    }

    /**
     * Apply articulation effects to notes
     */
    applyArticulationEffects() {
        for (const note of this.parsedNotes) {
            if (note.staccato) {
                const originalDuration = note.duration;
                note.playbackDuration = originalDuration * 0.5;
                note.staccatoEffect = true;
            }

            if (note.accent) {
                note.accentEffect = true;
                note.velocity = 100;
            } else {
                note.velocity = 80;
            }
        }
    }

    /**
     * Convert ticks to seconds
     * @param {number} ticks Duration in ticks
     * @param {number} divisions Divisions per quarter note
     * @param {number} tempo Tempo in BPM
     * @returns {number} Duration in seconds
     */
    ticksToSeconds(ticks, divisions, tempo) {
        if (!ticks || ticks <= 0) return 0;

        const quarterNoteSeconds = 60 / tempo;
        const quarterNoteFraction = ticks / divisions;

        return quarterNoteFraction * quarterNoteSeconds;
    }

    /**
     * Convert step and octave to MIDI note number
     * @param {string} step Note step (C, D, E, etc.)
     * @param {number} octave Octave number
     * @param {number} alter Alteration (-1 for flat, 1 for sharp)
     * @returns {number} MIDI note number
     */
    stepOctaveToMidiNote(step, octave, alter = 0) {
        const stepValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

        if (typeof step !== 'string' || !stepValues.hasOwnProperty(step)) {
            console.warn(`Invalid note step: ${step}, defaulting to C`);
            step = 'C';
        }

        if (isNaN(octave)) {
            console.warn(`Invalid octave: ${octave} defaulting to 4}`);
            octave = 4;
        }

        return (octave + 1) * 12 + stepValues[step] + alter;
    }
}

// Make the class available globally
window.MusicXMLParser = MusicXMLParser;
