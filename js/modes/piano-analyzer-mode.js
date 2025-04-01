/**
 * Piano Analyzer Mode
 * Visualizes musical notation from MusicXML files
 */

class PianoAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);
        this.musicXML = null;
        this.isPlaying = false;
        this.currentPosition = 0;

        // Simplify BPM handling - just use a single BPM value
        this.bpm = 120; // Current BPM, the only tempo value we need

        this.pianoRollContainer = null;
        this.notationContainer = null;
        this.lastRenderTime = 0;
        this.parsedNotes = [];
        this.visibleDuration = 10; // Seconds visible in view

        // Add variables for note bars
        this.noteBars = [];
        this.noteBarContainer = null;
        this.noteBarLookAhead = 4; // Seconds of notes to show ahead of playback
        this.fallDuration = 4; // Time in seconds for notes to fall from top to bottom

        // Playback animation frame ID for cancellation
        this.animationFrameId = null;

        // Add variables for drag interaction
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartPosition = 0;

        // Add time signature and division information
        this.divisions = 24; // Default divisions per quarter note (will be updated from file)
        this.timeSignatureNumerator = 4;   // Default 4/4 time
        this.timeSignatureDenominator = 4; // Default 4/4 time

        // Add a reference tempo to handle timing correctly
        this.referenceBPM = 60; // At 60 BPM, musical time = real time
    }

    initialize() {
        const openButton = this.analyzer.container.querySelector('.open-musicxml');
        const fileInput = this.analyzer.container.querySelector('#musicxml-input');

        if (openButton && fileInput) {
            // Clear existing listeners to prevent duplicates
            const newOpenButton = openButton.cloneNode(true);
            const newFileInput = fileInput.cloneNode(true);

            // Update the accept attribute to include .mxl files
            newFileInput.accept = '.xml,.musicxml,.mxl';

            openButton.parentNode.replaceChild(newOpenButton, openButton);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);

            // Add event listeners
            newOpenButton.addEventListener('click', () => {
                newFileInput.click();
            });

            newFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.loadMusicXMLFile(e.target.files[0]);
                }
            });

            // Play/pause button
            const playPauseButton = this.analyzer.container.querySelector('.piano-play-pause');
            if (playPauseButton) {
                const newPlayPauseButton = playPauseButton.cloneNode(true);
                playPauseButton.parentNode.replaceChild(newPlayPauseButton, playPauseButton);

                newPlayPauseButton.addEventListener('click', () => {
                    this.togglePlayback();
                });
            }

            // Speed control
            const speedControl = this.analyzer.container.querySelector('.piano-speed');
            const speedValue = this.analyzer.container.querySelector('.speed-value');

            if (speedControl && speedValue) {
                const newSpeedControl = speedControl.cloneNode(true);
                speedControl.parentNode.replaceChild(newSpeedControl, speedControl);

                // Update the range input attributes for BPM
                newSpeedControl.min = "40";  // Minimum BPM
                newSpeedControl.max = "240"; // Maximum BPM
                newSpeedControl.step = "1";  // BPM increments by 1
                newSpeedControl.value = this.bpm; // Set initial value

                newSpeedControl.addEventListener('input', (e) => {
                    this.bpm = parseFloat(e.target.value);
                    speedValue.textContent = `${this.bpm} BPM`;
                    console.log(`BPM changed to ${this.bpm}`);
                });

                // Initialize the speed display
                speedValue.textContent = `${this.bpm} BPM`;
            }
        }

        // Also update the result display to show Piano mode is ready
        const resultElement = this.analyzer.container.querySelector('.music-result');
        if (resultElement && resultElement.style.display === 'none') {
            resultElement.style.display = 'block';
        }
    }

    loadMusicXMLFile(file) {
        const statusElement = this.analyzer.container.querySelector('.piano-status');
        if (!statusElement) return;

        statusElement.textContent = 'Loading MusicXML file...';

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Check if this is a compressed MusicXML file (.mxl)
                if (file.name.toLowerCase().endsWith('.mxl')) {
                    // For compressed MXL files, we need to extract the XML content
                    this.processMXLData(e.target.result).then(xmlString => {
                        this.processMusicXMLString(xmlString, statusElement);
                    }).catch(error => {
                        console.error('Error extracting MXL file:', error);
                        statusElement.textContent = 'Error processing MXL file. Please try another file.';
                    });
                } else {
                    // Regular uncompressed XML
                    this.processMusicXMLString(e.target.result, statusElement);
                }
            } catch (error) {
                console.error('Error parsing MusicXML file:', error);
                statusElement.textContent = 'Error loading MusicXML file. Please try another file.';
            }
        };

        reader.onerror = () => {
            statusElement.textContent = 'Error reading file. Please try again.';
        };

        if (file.name.toLowerCase().endsWith('.mxl')) {
            reader.readAsArrayBuffer(file); // Read as binary for ZIP files
        } else {
            reader.readAsText(file); // Read as text for XML files
        }
    }

    // Process compressed MusicXML (.mxl) files
    async processMXLData(arrayBuffer) {
        // Load JSZip library if not available
        if (typeof JSZip === 'undefined') {
            await this.loadJSZip();
        }

        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(arrayBuffer);

            // Find the main MusicXML file (typically named 'score.xml' or similar)
            // First check container.xml to find the main score file
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

            // If we couldn't find it in container.xml, look for .xml files
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

    // Load JSZip library for MXL files
    loadJSZip() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Process MusicXML data with enhanced parsing for complex structures
    processMusicXMLString(xmlString, statusElement) {
        try {
            // Parse the MusicXML string into a DOM
            const parser = new DOMParser();
            this.musicXML = parser.parseFromString(xmlString, 'text/xml');

            // Check if the parsing was successful
            const parsererror = this.musicXML.getElementsByTagName('parsererror');
            if (parsererror.length > 0) {
                throw new Error('XML parsing error: ' + parsererror[0].textContent);
            }

            // Extract the song metadata
            const title = this.extractScoreMetadata(this.musicXML);

            console.log(`Processing score: ${title}`);

            // Reset all musical state and timing information
            this.resetMusicalState();

            // Extract global divisions, time signatures and tempo markings
            this.extractScoreTimingInformation(this.musicXML);

            // Parse parts and measures with enhanced accuracy
            this.parseScoreContent();

            // Final post-processing of parsed notes
            this.processNoteRelationships();

            // Show success message and prepare UI
            statusElement.textContent = `Loaded: ${title}`;
            this.updateScoreTitle(title);
            this.showPlaybackControls();
            this.createVisualization();

        } catch (error) {
            console.error('Error processing MusicXML:', error);
            statusElement.textContent = 'Error processing file: ' + error.message;
        }
    }

    // Extract score title and additional metadata
    extractScoreMetadata(musicXML) {
        const workTitle = musicXML.querySelector('work-title');
        const movementTitle = musicXML.querySelector('movement-title');
        const scorePartName = musicXML.querySelector('part-name');
        const creator = musicXML.querySelector('creator[type="composer"]');

        // Store composer info if available
        if (creator) {
            this.composer = creator.textContent;
        }

        // Return the most specific title available
        return workTitle?.textContent ||
            movementTitle?.textContent ||
            scorePartName?.textContent ||
            'Untitled Score';
    }

    // Reset all musical state information before parsing
    resetMusicalState() {
        // Reset timing properties
        this.divisions = 24; // Default divisions per quarter note
        this.timeSignatureNumerator = 4;
        this.timeSignatureDenominator = 4;
        this.bpm = 120;
        this.currentPosition = 0;

        // Store tempo and time signature changes throughout the piece
        this.tempoChanges = [{ position: 0, tempo: this.bpm }];
        this.timeSignatureChanges = [{
            position: 0,
            numerator: this.timeSignatureNumerator,
            denominator: this.timeSignatureDenominator
        }];

        // Reset note data
        this.parsedNotes = [];
        this.measureData = [];
        this.noteBars = [];
    }

    // Extract comprehensive timing information from the score
    extractScoreTimingInformation(musicXML) {
        // Extract global divisions value (ticks per quarter note)
        const divisionsElements = musicXML.querySelectorAll('divisions');
        if (divisionsElements.length > 0) {
            const divisionsValue = parseInt(divisionsElements[0].textContent);
            if (!isNaN(divisionsValue) && divisionsValue > 0) {
                this.divisions = divisionsValue;
                console.log(`Initial divisions: ${this.divisions} ticks per quarter note`);
            }
        }

        // Extract initial time signature
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

        // Extract initial tempo
        const tempoElements = musicXML.querySelectorAll('sound[tempo]');
        if (tempoElements.length > 0) {
            const tempo = parseFloat(tempoElements[0].getAttribute('tempo'));
            if (!isNaN(tempo) && tempo > 0) {
                this.bpm = tempo;
                console.log(`Initial tempo: ${tempo} BPM`);
            }
        }

        // Scan through all parts and measures for timing changes
        this.scanTimingChanges(musicXML);

        // Update UI controls to match extracted tempo
        this.updateTempoControls();
    }

    // Scan through all measures for timing changes (tempo, time signature)
    scanTimingChanges(musicXML) {
        const parts = musicXML.getElementsByTagName('part');
        if (parts.length === 0) return;

        // Use first part to extract timing changes
        const firstPart = parts[0];
        const measures = firstPart.getElementsByTagName('measure');

        let currentMeasurePosition = 0; // Position in seconds
        let currentTickPosition = 0;    // Position in ticks

        // Scan through all measures
        for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
            const measure = measures[measureIndex];
            const measureNumber = parseInt(measure.getAttribute('number')) || (measureIndex + 1);

            // Store information about this measure
            const measureInfo = {
                index: measureIndex,
                number: measureNumber,
                startPosition: currentMeasurePosition,
                startTick: currentTickPosition,
                hasTimeChange: false,
                hasTempoChange: false
            };

            // Check for divisions change
            const divisionsElements = measure.getElementsByTagName('divisions');
            if (divisionsElements.length > 0) {
                const newDivisions = parseInt(divisionsElements[0].textContent);
                if (!isNaN(newDivisions) && newDivisions > 0) {
                    this.divisions = newDivisions;
                    measureInfo.divisions = newDivisions;
                    console.log(`Measure ${measureNumber}: Divisions change to ${newDivisions}`);
                }
            }

            // Check for time signature change
            const timeElements = measure.getElementsByTagName('time');
            if (timeElements.length > 0) {
                const beats = parseInt(timeElements[0].querySelector('beats')?.textContent);
                const beatType = parseInt(timeElements[0].querySelector('beat-type')?.textContent);

                if (!isNaN(beats) && !isNaN(beatType) && beats > 0 && beatType > 0) {
                    this.timeSignatureNumerator = beats;
                    this.timeSignatureDenominator = beatType;

                    // Record the time signature change
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

            // Check for tempo changes
            const soundElements = measure.querySelectorAll('sound[tempo]');
            if (soundElements.length > 0) {
                for (const sound of soundElements) {
                    const tempo = parseFloat(sound.getAttribute('tempo'));
                    if (!isNaN(tempo) && tempo > 0) {
                        // Store the tempo change
                        this.tempoChanges.push({
                            position: currentMeasurePosition,
                            tempo: tempo,
                            measure: measureNumber
                        });

                        measureInfo.hasTempoChange = true;
                        measureInfo.tempo = tempo;

                        console.log(`Measure ${measureNumber}: Tempo change to ${tempo} BPM`);

                        // Update current tempo for duration calculations
                        this.bpm = tempo;
                    }
                }
            }

            // Calculate measure duration in ticks using current time signature
            const measureDurationTicks = this.calculateMeasureDurationInTicks(
                this.timeSignatureNumerator,
                this.timeSignatureDenominator,
                this.divisions
            );

            // Calculate duration in seconds based on tempo
            const measureDurationSeconds = this.ticksToSeconds(measureDurationTicks, this.divisions, this.bpm);

            // Store measure duration
            measureInfo.durationTicks = measureDurationTicks;
            measureInfo.durationSeconds = measureDurationSeconds;

            // Update positions for next measure
            currentMeasurePosition += measureDurationSeconds;
            currentTickPosition += measureDurationTicks;

            // Store measure info in our measure data array
            this.measureData.push(measureInfo);
        }

        console.log(`Scanned ${measures.length} measures with ${this.timeSignatureChanges.length} time signature changes and ${this.tempoChanges.length} tempo changes`);
    }

    // Calculate measure duration in ticks based on time signature
    calculateMeasureDurationInTicks(numerator, denominator, divisions) {
        // Calculate ticks per whole note
        const ticksPerWholeNote = divisions * 4;

        // Calculate ticks per beat
        const ticksPerBeat = ticksPerWholeNote / denominator;

        // Total ticks for the measure
        return ticksPerBeat * numerator;
    }

    // Parse the complete score with enhanced handling of parts, voices, and articulations
    parseScoreContent() {
        if (!this.musicXML) return;

        console.log("Parsing score content with enhanced accuracy");

        const parts = this.musicXML.getElementsByTagName('part');

        // Process each part
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex];
            const partId = part.getAttribute('id') || `part-${partIndex + 1}`;

            console.log(`Parsing part ${partId} (${partIndex + 1}/${parts.length})`);

            // Get part name if available
            const scorePart = this.musicXML.querySelector(`score-part[id="${partId}"]`);
            const partName = scorePart?.querySelector('part-name')?.textContent || `Part ${partIndex + 1}`;

            // Parse this part
            this.parsePart(part, partId, partName, partIndex);
        }

        // Sort all notes by start time for consistent playback
        this.parsedNotes.sort((a, b) => a.start - b.start);

        // Log parsing results
        console.log(`Parsed ${this.parsedNotes.length} total notes`);

        if (this.parsedNotes.length > 0) {
            // Calculate score duration and other statistics
            const lastNote = this.parsedNotes[this.parsedNotes.length - 1];
            const scoreDuration = lastNote.start + lastNote.duration;

            console.log(`Score duration: ${scoreDuration.toFixed(2)} seconds`);
            console.log('Sample of parsed notes:', {
                first: this.parsedNotes.slice(0, 3),
                last: this.parsedNotes.slice(-3)
            });
        }
    }

    // Parse an individual part
    parsePart(part, partId, partName, partIndex) {
        const measures = part.getElementsByTagName('measure');
        if (!measures.length) return;

        // State for tracking notes that need to be connected
        const tiedNotes = new Map();

        // Current position in seconds from start of piece
        let currentTime = 0;

        // Process each measure in this part
        for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
            const measure = measures[measureIndex];
            const measureNumber = parseInt(measure.getAttribute('number')) || (measureIndex + 1);

            // Use measure data we've already calculated
            const measureData = this.measureData[measureIndex];
            if (measureData) {
                currentTime = measureData.startPosition;
            }

            // Get the current divisions value - might have changed
            const currentDivisions = measureData?.divisions || this.divisions;

            // Parse contents of this measure
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

    // Parse a single measure with enhanced handling of complex musical elements
    parseMeasure(measure, startTime, divisions, partId, partName, partIndex, measureNumber, tiedNotes) {
        // Current position within the measure, in seconds
        let currentTime = startTime;

        // Multiple voice handling
        const voicePositions = new Map(); // Track position for each voice

        // Get all elements in measure that affect timing
        const elements = Array.from(measure.children);

        // Process attributes like time, key, etc.
        const attributes = measure.querySelector('attributes');
        if (attributes) {
            // Handle attributes that affect timing
            this.processAttributes(attributes, divisions);
        }

        // First scan for backup/forward elements to understand voice structure
        elements.forEach(element => {
            if (element.tagName === 'backup' || element.tagName === 'forward') {
                // Handle these later
            }
        });

        // Now process notes, rests, etc. - handle chord structure properly
        let currentVoice = 1;
        let currentStaff = 1;
        let inChord = false;
        let chordStartTime = currentTime;
        let currentChordNotes = [];

        // Process each note and other elements in sequence
        for (const element of elements) {
            // Handle different element types
            switch (element.tagName) {
                case 'note':
                    const note = element;

                    // Check for voice changes
                    const voiceElement = note.querySelector('voice');
                    if (voiceElement) {
                        const voice = parseInt(voiceElement.textContent);
                        if (!isNaN(voice)) {
                            // If changing voices, store current voice position
                            if (voice !== currentVoice) {
                                voicePositions.set(currentVoice, currentTime);

                                // If we've seen this voice before, restore its position
                                if (voicePositions.has(voice)) {
                                    currentTime = voicePositions.get(voice);
                                }

                                currentVoice = voice;
                            }
                        }
                    }

                    // Check for staff changes
                    const staffElement = note.querySelector('staff');
                    if (staffElement) {
                        const staff = parseInt(staffElement.textContent);
                        if (!isNaN(staff)) {
                            currentStaff = staff;
                        }
                    }

                    // Check if this is part of a chord
                    const isChordNote = !!note.querySelector('chord');

                    // If we were in a chord and this isn't a chord note, process the chord
                    if (inChord && !isChordNote) {
                        this.processChordGroup(currentChordNotes, chordStartTime, partId, partName, partIndex, currentVoice, currentStaff);
                        currentChordNotes = [];
                        inChord = false;
                    }

                    // Get note duration
                    const durationElement = note.querySelector('duration');
                    if (!durationElement) continue; // Skip notes without duration

                    const durationTicks = parseInt(durationElement.textContent);
                    if (isNaN(durationTicks)) continue;

                    // Convert to seconds
                    const durationSeconds = this.ticksToSeconds(durationTicks, divisions, this.bpm);

                    // If it's a rest, just advance the time
                    if (note.querySelector('rest')) {
                        if (!isChordNote) { // only advance time for non-chord rests
                            currentTime += durationSeconds;
                        }
                        continue;
                    }

                    // Parse pitch information with enhanced accuracy
                    const noteObj = this.parseNotePitch(note, currentTime, durationSeconds, durationTicks);
                    if (!noteObj) continue;

                    // Add additional properties
                    noteObj.partId = partId;
                    noteObj.partName = partName;
                    noteObj.partIndex = partIndex;
                    noteObj.voice = currentVoice;
                    noteObj.staff = currentStaff;
                    noteObj.measure = measureNumber;
                    noteObj.isChordNote = isChordNote;

                    // Process note articulations, dynamics, etc.
                    this.processNoteProperties(noteObj, note);

                    // Handle chord structure
                    if (isChordNote) {
                        noteObj.start = chordStartTime; // All chord notes start together
                        currentChordNotes.push(noteObj);
                        inChord = true;
                    } else {
                        // Regular note - add to parsed notes
                        this.parsedNotes.push(noteObj);

                        // If this starts a chord, remember the start time
                        chordStartTime = currentTime;

                        // Advance time for non-chord notes
                        currentTime += durationSeconds;
                    }

                    // Process ties
                    this.processNoteTies(noteObj, note, tiedNotes);
                    break;

                case 'backup':
                    // Move backward in time (for multiple voices)
                    const backupDuration = parseInt(element.querySelector('duration')?.textContent);
                    if (!isNaN(backupDuration)) {
                        currentTime -= this.ticksToSeconds(backupDuration, divisions, this.bpm);
                    }
                    break;

                case 'forward':
                    // Move forward in time (for skipping)
                    const forwardDuration = parseInt(element.querySelector('duration')?.textContent);
                    if (!isNaN(forwardDuration)) {
                        currentTime += this.ticksToSeconds(forwardDuration, divisions, this.bpm);
                    }
                    break;

                case 'direction':
                    // Handle tempo changes and other directions
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

        // Process any remaining chord notes
        if (currentChordNotes.length > 0) {
            this.processChordGroup(currentChordNotes, chordStartTime, partId, partName, partIndex, currentVoice, currentStaff);
        }

        return currentTime;
    }

    // Parse pitch information from a note element
    parseNotePitch(noteElement, startTime, durationSeconds, durationTicks) {
        const pitch = noteElement.querySelector('pitch');
        if (!pitch) return null;

        const step = pitch.querySelector('step')?.textContent;
        const octave = parseInt(pitch.querySelector('octave')?.textContent);
        const alter = parseInt(pitch.querySelector('alter')?.textContent || '0');

        if (!step || isNaN(octave)) return null;

        // Convert to MIDI note number
        const noteNumber = this.stepOctaveToMidiNote(step, octave, alter);

        // Create note object with enhanced properties
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

    // Process additional note properties like articulations
    processNoteProperties(noteObj, noteElement) {
        // Get notations element
        const notations = noteElement.querySelector('notations');
        if (!notations) return;

        // Articulations
        const articulations = notations.querySelector('articulations');
        if (articulations) {
            // Check for specific articulations
            noteObj.staccato = !!articulations.querySelector('staccato');
            noteObj.accent = !!articulations.querySelector('accent');
            noteObj.tenuto = !!articulations.querySelector('tenuto');
            noteObj.marcato = !!articulations.querySelector('strong-accent');
        }

        // Technical markings
        const technical = notations.querySelector('technical');
        if (technical) {
            noteObj.fingering = technical.querySelector('fingering')?.textContent;
        }

        // Ornaments
        const ornaments = notations.querySelector('ornaments');
        if (ornaments) {
            noteObj.trill = !!ornaments.querySelector('trill-mark');
            noteObj.mordent = !!ornaments.querySelector('mordent');
            noteObj.turn = !!ornaments.querySelector('turn');
        }

        // Slurs
        const slurStart = notations.querySelector('slur[type="start"]');
        const slurStop = notations.querySelector('slur[type="stop"]');
        if (slurStart) noteObj.slurStart = true;
        if (slurStop) noteObj.slurStop = true;

        // Fermata
        noteObj.fermata = !!notations.querySelector('fermata');
    }

    // Process tied notes
    processNoteTies(noteObj, noteElement, tiedNotes) {
        // Check for tie elements
        const tieElements = noteElement.querySelectorAll('tie');
        let tieStart = Array.from(tieElements).some(t => t.getAttribute('type') === 'start');
        let tieStop = Array.from(tieElements).some(t => t.getAttribute('type') === 'stop');

        // Also check notation/tied elements (MusicXML sometimes uses this instead)
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

        // Store tie status on note
        noteObj.isTieStart = tieStart;
        noteObj.isTieEnd = tieStop;

        // Handle tie connections (will connect in postprocessing)
        if (tieStart) {
            // This note starts a tie, store it for later connection
            const tieKey = `${noteObj.partId}-${noteObj.voice}-${noteObj.noteNumber}`;
            tiedNotes.set(tieKey, noteObj);
        }

        if (tieStop) {
            // This note ends a tie, look for starting note
            const tieKey = `${noteObj.partId}-${noteObj.voice}-${noteObj.noteNumber}`;
            const startNote = tiedNotes.get(tieKey);

            if (startNote) {
                // Mark both notes as connected
                startNote.tiedToId = noteObj.id;
                noteObj.tiedFromId = startNote.id;

                // Clear the tie start reference (one start can only tie to one end)
                tiedNotes.delete(tieKey);
            }
        }
    }

    // Process attributes like time signature, key, etc.
    processAttributes(attributesElement, divisions) {
        // Handle divisions (ppq)
        const divisionsElement = attributesElement.querySelector('divisions');
        if (divisionsElement) {
            const divisionsValue = parseInt(divisionsElement.textContent);
            if (!isNaN(divisionsValue) && divisionsValue > 0) {
                this.divisions = divisionsValue;
            }
        }

        // Handle time signature
        const timeElement = attributesElement.querySelector('time');
        if (timeElement) {
            const beats = parseInt(timeElement.querySelector('beats')?.textContent);
            const beatType = parseInt(timeElement.querySelector('beat-type')?.textContent);

            if (!isNaN(beats) && !isNaN(beatType) && beats > 0 && beatType > 0) {
                this.timeSignatureNumerator = beats;
                this.timeSignatureDenominator = beatType;
            }
        }

        // Handle key signature
        const keyElement = attributesElement.querySelector('key');
        if (keyElement) {
            const fifths = parseInt(keyElement.querySelector('fifths')?.textContent);
            if (!isNaN(fifths)) {
                // Store key signature info (useful for notation)
                this.keySignature = fifths;
            }
        }
    }

    // Process a group of chord notes together
    processChordGroup(chordNotes, startTime, partId, partName, partIndex, voice, staff) {
        if (!chordNotes.length) return;

        // Ensure all chord notes have the same start time
        chordNotes.forEach(note => {
            // Set common properties
            note.start = startTime;
            note.isChordNote = true;
            note.partId = partId;
            note.partName = partName;
            note.partIndex = partIndex;
            note.voice = voice;
            note.staff = staff;

            // Add to parsed notes collection
            this.parsedNotes.push(note);
        });
    }

    // Final post-processing of notes to handle ties, etc.
    processNoteRelationships() {
        // Step 1: Process tied notes - extend durations
        this.processTiedNotes();

        // Step 2: Apply articulation effects
        this.applyArticulationEffects();
    }

    // Process tied notes into single sustained notes
    processTiedNotes() {
        // Map all notes by ID for quick lookups
        const noteById = new Map();
        this.parsedNotes.forEach(note => noteById.set(note.id, note));

        // Process tie connections
        for (const note of this.parsedNotes) {
            if (note.tiedToId && noteById.has(note.tiedToId)) {
                const nextNote = noteById.get(note.tiedToId);

                // Extend the first note's duration to include the tied note
                note.extendedDuration = note.duration + nextNote.duration;
                note.visualDuration = note.extendedDuration; // For rendering

                // Mark tied notes
                note.hasTie = true;
                nextNote.isTiedFromPrevious = true;
            } else if (!note.hasTie && !note.isTiedFromPrevious) {
                // Regular untied notes keep their original duration for visuals
                note.visualDuration = note.duration;
            }
        }

        console.log("Processed tied notes");
    }

    // Apply effects of articulations to note durations and rendering
    applyArticulationEffects() {
        for (const note of this.parsedNotes) {
            // Staccato shortens notes but keeps their visual length
            if (note.staccato) {
                const originalDuration = note.duration;
                note.playbackDuration = originalDuration * 0.5; // Half the duration for playback
                note.staccatoEffect = true;
            }

            // Other articulations might affect velocity or other properties
            if (note.accent) {
                note.accentEffect = true;
                note.velocity = 100; // Higher velocity for accented notes
            } else {
                note.velocity = 80; // Default velocity
            }
        }
    }

    // Convert ticks to seconds with BPM consideration
    ticksToSeconds(ticks, divisions, tempo) {
        if (!ticks || ticks <= 0) return 0;

        // Quarter note duration in seconds at the given tempo
        const quarterNoteSeconds = 60 / tempo;

        // Convert ticks to quarter note fraction
        const quarterNoteFraction = ticks / divisions;

        // Apply time signature adjustment if necessary
        // For compound meters (6/8, 9/8, 12/8), we need to adjust the duration
        const beatUnitFactor = this.timeSignatureDenominator === 8 &&
            [6, 9, 12].includes(this.timeSignatureNumerator)
            ? 3 / this.timeSignatureDenominator
            : 4 / this.timeSignatureDenominator;

        // Final duration calculation with all factors considered
        return quarterNoteFraction * quarterNoteSeconds * beatUnitFactor;
    }

    // Update the note bar visualization with greatly improved timing accuracy
    updateNoteBars() {
        if (!this.noteBarContainer || !this.parsedNotes.length) return;

        // Clear existing note bars if playback has restarted
        if (this.currentPosition < 0.1 && this.noteBars.length > 0) {
            this.noteBarContainer.innerHTML = '';
            this.noteBars = [];
        }

        // Calculate visible time window with ahead and behind margins
        const startTime = this.currentPosition - 0.5; // Allow some margin for notes that just passed
        const endTime = this.currentPosition + this.noteBarLookAhead;

        // Find which notes should be visible with enhanced filtering
        const visibleNotes = this.getVisibleNotes(startTime, endTime);

        // Create missing note bars
        this.createMissingNoteBars(visibleNotes);

        // Update positions of all note bars with improved accuracy
        this.updateNoteBarsPosition();

        // Clean up notes that are no longer visible
        this.cleanupInvisibleNoteBars(startTime);
    }

    // Get notes visible in the current time window
    getVisibleNotes(startTime, endTime) {
        return this.parsedNotes.filter(note => {
            // Use visual duration for tied notes
            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = note.start + noteDuration;

            // Include notes:
            return (
                // Notes starting within window
                (note.start >= startTime && note.start <= endTime) ||

                // Notes currently playing (started before window but still active)
                (note.start < startTime && noteEnd > startTime) ||

                // Notes that begin before window but end within window
                (note.start < startTime && noteEnd > startTime && noteEnd <= endTime)
            );
        });
    }

    // Create note bars for notes that don't have them yet
    createMissingNoteBars(visibleNotes) {
        visibleNotes.forEach(note => {
            // Generate a precise unique ID for each note
            const noteId = `${note.id}-${note.start.toFixed(6)}`;

            // Check if this note already has a bar
            if (!this.noteBars.some(bar => bar.noteId === noteId)) {
                this.createEnhancedNoteBar(note, noteId);
            }
        });
    }

    // Create a note bar with enhanced properties
    createEnhancedNoteBar(note, noteId) {
        // Find the corresponding piano key
        const keyElement = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
        if (!keyElement) return;

        // Create the note bar element with improved styling
        const noteBar = document.createElement('div');
        noteBar.className = 'note-bar';

        // Prevent transitions for precise control
        noteBar.style.transition = 'none';

        // Add classes based on note properties
        const isBlackKey = [1, 3, 6, 8, 10].includes(note.noteNumber % 12);
        if (isBlackKey) noteBar.classList.add('black-note');

        // Add hand indication based on staff or note number
        const isRightHand = note.staff === 1 || note.noteNumber >= 60;
        noteBar.classList.add(isRightHand ? 'right-hand' : 'left-hand');

        // Add articulation classes
        if (note.staccato) noteBar.classList.add('staccato');
        if (note.accent) noteBar.classList.add('accent');
        if (note.tenuto) noteBar.classList.add('tenuto');
        if (note.fermata) noteBar.classList.add('fermata');

        // Add tie visualization
        if (note.hasTie) noteBar.classList.add('tied');
        if (note.isTiedFromPrevious) noteBar.classList.add('tied-continuation');

        // Set note data attributes
        noteBar.dataset.noteId = noteId;
        noteBar.dataset.duration = note.visualDuration || note.duration;
        noteBar.dataset.start = note.start;
        noteBar.dataset.part = note.partId;
        noteBar.dataset.voice = note.voice;

        // Add to container
        this.noteBarContainer.appendChild(noteBar);

        // Store reference to bar
        this.noteBars.push({
            noteId,
            element: noteBar,
            note,
            keyElement
        });
    }

    // Update positions of all note bars with improved timing accuracy
    updateNoteBarsPosition() {
        if (!this.noteBarContainer || !this.noteBars.length) return;

        const containerHeight = this.noteBarContainer.clientHeight;
        const lookAheadTime = this.noteBarLookAhead;

        // Performance optimization: Cache DOM measurements
        const containerRect = this.keyboardContainer.getBoundingClientRect();
        const keyPositions = new Map();

        // Time-to-pixel ratio for consistent visual scaling
        const timeToPixelRatio = containerHeight / lookAheadTime;

        // Minimum size for very short notes
        const MIN_NOTE_HEIGHT = 8;

        // Process each note bar
        this.noteBars.forEach(bar => {
            const note = bar.note;
            const element = bar.element;

            if (!element) return;

            // Get piano key position, using cached measurements when possible
            const keyElement = bar.keyElement;
            if (!keyElement) return;

            // Get or calculate key position
            let keyPosition;
            if (keyPositions.has(note.noteNumber)) {
                keyPosition = keyPositions.get(note.noteNumber);
            } else {
                const keyRect = keyElement.getBoundingClientRect();
                keyPosition = {
                    left: keyRect.left - containerRect.left + (keyRect.width / 2),
                    width: keyElement.classList.contains('black-key') ? 14 : 22
                };
                keyPositions.set(note.noteNumber, keyPosition);
            }

            // Calculate timing and position
            const noteStart = note.start;
            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = noteStart + noteDuration;

            // Status checks with precise timing
            const currentTime = this.currentPosition;
            const isPlaying = noteStart <= currentTime && noteEnd > currentTime;
            const isUpcoming = noteStart > currentTime && noteStart <= currentTime + lookAheadTime;
            const isPartiallyVisible = noteStart < currentTime && noteEnd > currentTime && noteEnd <= currentTime + lookAheadTime;
            const isPassed = noteEnd <= currentTime && noteEnd > currentTime - 0.5; // Recently passed notes

            // Determine visibility
            const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

            if (isVisible) {
                element.style.display = 'block';

                // Calculate height based on visual duration
                const noteHeight = Math.max(MIN_NOTE_HEIGHT, noteDuration * timeToPixelRatio);

                // Calculate vertical position based on timing
                let topPosition;

                if (isPlaying) {
                    // Currently playing notes - show the remaining portion
                    const elapsedTime = currentTime - noteStart;
                    const remainingDuration = Math.max(0, noteDuration - elapsedTime);
                    const remainingHeight = remainingDuration * timeToPixelRatio;

                    // Position bottom of note at container bottom, with remaining height
                    topPosition = containerHeight - remainingHeight;
                }
                else if (isUpcoming) {
                    // Upcoming notes - calculate based on time until they play
                    const timeToStart = noteStart - currentTime;
                    const startPosition = containerHeight - (timeToStart * timeToPixelRatio);

                    // Position so the bottom of the note is at the calculated start position
                    topPosition = startPosition - noteHeight;
                }
                else if (isPartiallyVisible) {
                    // Notes that started before but aren't finished
                    const elapsedTime = currentTime - noteStart;
                    const remainingDuration = Math.max(0, noteDuration - elapsedTime);
                    const remainingHeight = remainingDuration * timeToPixelRatio;

                    // Position at bottom with remaining height
                    topPosition = containerHeight - remainingHeight;
                }
                else if (isPassed) {
                    // Recently finished notes - fade them out
                    const timeSinceEnd = currentTime - noteEnd;
                    const opacity = Math.max(0, 0.5 - timeSinceEnd);
                    element.style.opacity = opacity.toString();

                    // Position fully beneath container
                    topPosition = containerHeight;
                }

                // Apply positions and dimensions with hardware acceleration
                element.style.transform = `translate3d(${keyPosition.left - (keyPosition.width / 2)}px, ${topPosition}px, 0)`;
                element.style.width = `${keyPosition.width}px`;
                element.style.height = `${noteHeight}px`;

                // Mark currently playing notes
                element.classList.toggle('playing', isPlaying);

                // Apply articulation styling
                if (note.staccato) {
                    // Make staccato notes visually shorter but keep timing accurate
                    element.style.height = `${noteHeight * 0.7}px`;
                }

                if (note.accent) {
                    // Make accented notes more prominent
                    element.style.opacity = '0.95';
                }

                // Apply dynamic styling if available
                if (note.dynamic) {
                    element.classList.add(`dynamic-${note.dynamic}`);
                }
            } else {
                element.style.display = 'none';
            }
        });
    }

    // Remove note bars that are no longer needed
    cleanupInvisibleNoteBars(startTime) {
        // Use a threshold to keep recently played notes
        const cleanupThreshold = startTime - 1.0; // Keep notes for 1 second after they finish

        this.noteBars = this.noteBars.filter(bar => {
            const note = bar.note;
            const noteDuration = note.visualDuration || note.duration;
            const isFinished = note.start + noteDuration < cleanupThreshold;

            if (isFinished) {
                if (bar.element && bar.element.parentNode) {
                    bar.element.parentNode.removeChild(bar.element);
                }
                return false;
            }

            return true;
        });
    }

    // Update UI controls to match tempo
    updateTempoControls() {
        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        const speedValue = this.analyzer.container.querySelector('.speed-value');

        if (speedControl && speedValue) {
            speedControl.value = this.bpm;
            speedValue.textContent = `${this.bpm} BPM`;
        }
    }

    // Update song title in UI
    updateScoreTitle(title) {
        const songNameElement = document.querySelector('.piano-song-name');
        if (songNameElement) {
            songNameElement.textContent = title;
        }
    }

    // Show playback controls
    showPlaybackControls() {
        const playbackControls = this.analyzer.container.querySelector('.piano-playback-controls');
        if (playbackControls) {
            playbackControls.style.display = 'flex';
        }
    }

    createPianoVisualizationContainer() {
        // Remove existing container if it exists
        const existingContainer = document.getElementById('piano-visualization-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Create a new container that covers the entire screen
        this.pianoVisualizationContainer = document.createElement('div');
        this.pianoVisualizationContainer.id = 'piano-visualization-container';
        this.pianoVisualizationContainer.className = 'piano-visualization-container';

        // Create layout with piano keyboard at bottom, notation at top, and falling notes in between
        this.pianoVisualizationContainer.innerHTML = `
            <div class="notation-container">
                <!-- Musical notation will be rendered here -->
            </div>
            <div class="note-bar-container">
                <!-- Falling note bars will be rendered here -->
            </div>
            <div class="piano-keyboard-container">
                <div class="piano-keyboard">
                    <!-- Piano keys will be generated here -->
                </div>
            </div>
            <button class="piano-close-btn" title="Close Visualization">×</button>
        `;

        document.body.appendChild(this.pianoVisualizationContainer);

        // Store references to containers
        this.notationContainer = this.pianoVisualizationContainer.querySelector('.notation-container');
        this.keyboardContainer = this.pianoVisualizationContainer.querySelector('.piano-keyboard-container');
        this.noteBarContainer = this.pianoVisualizationContainer.querySelector('.note-bar-container');
        this.closeButton = this.pianoVisualizationContainer.querySelector('.piano-close-btn');

        // Generate piano keyboard
        this.generatePianoKeyboard();

        // Add close button listener
        this.closeButton.addEventListener('click', () => {
            this.closePianoVisualization();
        });

        // Click to toggle playback on notation
        this.notationContainer.addEventListener('click', (e) => {
            // We'll handle the click in the mouseup handler instead
            // to better distinguish between clicks and drags
        });

        // Add drag events to scrub through music with improved click detection
        this.notationContainer.addEventListener('mousedown', (e) => {
            this.startDragging(e);
        });

        document.addEventListener('mousemove', (e) => {
            this.handleDragging(e);
        });

        document.addEventListener('mouseup', () => {
            this.stopDragging();
        });

        // Add keyboard shortcut to close visualization
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.pianoVisualizationContainer.style.display !== 'none') {
                this.closePianoVisualization();
            }
        });

        // Handle resize events to ensure proper notation rendering
        window.addEventListener('resize', () => {
            if (this.pianoVisualizationContainer.style.display !== 'none') {
                this.renderNotation();
                this.updateNoteBarsPosition(); // Re-position note bars on resize
            }
        });
    }

    createVisualization() {
        // Close the music analyzer panel
        this.analyzer.panel.style.display = 'none';

        // Create or get the piano visualization container
        this.createPianoVisualizationContainer();

        // Initial render of notation
        this.renderNotation();

        // Show the visualization container
        this.pianoVisualizationContainer.style.display = 'block';
    }

    generatePianoKeyboard() {
        const keyboard = this.pianoVisualizationContainer.querySelector('.piano-keyboard');
        keyboard.innerHTML = '';

        // Generate 88 keys (standard piano) - now horizontal layout
        for (let i = 21; i <= 108; i++) {
            const isBlackKey = [1, 3, 6, 8, 10].includes(i % 12);
            const keyElement = document.createElement('div');
            keyElement.className = `piano-key ${isBlackKey ? 'black-key' : 'white-key'}`;
            keyElement.dataset.note = i;

            // Add note name (C4, etc.)
            if (!isBlackKey && i % 12 === 0) { // C notes
                const octave = Math.floor(i / 12) - 1;
                const label = document.createElement('div');
                label.className = 'key-label';
                label.textContent = `C${octave}`;
                keyElement.appendChild(label);
            }

            keyboard.appendChild(keyElement);
        }
    }

    updatePlayback(timestamp) {
        if (!this.isPlaying) return;

        // Calculate elapsed time in seconds (real clock time)
        const deltaTime = (timestamp - this.lastRenderTime) / 1000;
        this.lastRenderTime = timestamp;

        // Just advance by real time - the note durations are already scaled by BPM
        this.currentPosition += deltaTime;

        // Check for tempo changes at the current position
        this.updateTempoAtPosition();

        // Re-render notation periodically (not every frame)
        if (Math.floor(this.currentPosition * 2) > Math.floor((this.currentPosition - deltaTime) * 2)) {
            this.renderNotation();
        }

        // Update note bars
        this.updateNoteBars();

        // Find notes that should be triggered at current position - FIX: use visualDuration for tied notes
        const notesToPlay = this.parsedNotes.filter(
            note => note.start <= this.currentPosition &&
                note.start + (note.visualDuration || note.duration) > this.currentPosition &&
                !note.isTiedFromPrevious // Don't highlight tied continuation notes
        );

        // Highlight keys for notes currently playing
        this.highlightPianoKeys(notesToPlay);

        // Check if we've reached the end of the song
        const lastNote = this.parsedNotes[this.parsedNotes.length - 1];
        if (lastNote && this.currentPosition > lastNote.start + (lastNote.visualDuration || lastNote.duration) + 2) {
            // End of song, reset to beginning
            this.currentPosition = 0;
        }

        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
    }

    // Add method to track and update tempo at the current playback position
    updateTempoAtPosition() {
        if (!this.tempoChanges || this.tempoChanges.length <= 1) return;

        // Find the latest tempo change that's before or at the current position
        let currentTempo = this.tempoChanges[0].tempo; // Start with initial tempo

        for (let i = 1; i < this.tempoChanges.length; i++) {
            const tempoChange = this.tempoChanges[i];
            if (tempoChange.position <= this.currentPosition) {
                currentTempo = tempoChange.tempo;
            } else {
                // We've gone past the current position
                break;
            }
        }

        // If tempo has changed, update UI
        if (Math.abs(this.bpm - currentTempo) > 0.01) {
            this.bpm = currentTempo;
            this.updateTempoControls();
        }
    }

    renderNotation() {
        if (!this.parsedNotes.length || !this.notationContainer) return;

        // Check if we have Vexflow available for notation
        if (typeof Vex === 'undefined') {
            // Load Vexflow if not available
            this.loadVexFlow().then(() => {
                this.renderNotationWithVexFlow();
            }).catch(error => {
                console.error('Failed to load VexFlow:', error);
                this.notationContainer.innerHTML = '<p>Unable to load notation library. Please try again later.</p>';
            });
        } else {
            this.renderNotationWithVexFlow();
        }
    }

    loadVexFlow() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Use CDN VexFlow library instead of local
            script.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    renderNotationWithVexFlow() {
        if (!this.parsedNotes.length || !this.notationContainer) return;

        // Clear notation container
        this.notationContainer.innerHTML = '';

        try {
            // Show simple notation view while VexFlow loads/renders
            const loadingView = document.createElement('div');
            loadingView.className = 'simple-notation';
            loadingView.innerHTML = '<p>Loading notation...</p>';
            this.notationContainer.appendChild(loadingView);

            // Check if VexFlow is properly loaded
            if (typeof Vex === 'undefined' || typeof Vex.Flow === 'undefined') {
                this.renderSimpleNotation();
                return;
            }

            // Create SVG container with fixed dimensions
            const svgContainer = document.createElement('div');
            svgContainer.className = 'notation-svg-container';
            svgContainer.style.width = '100%';
            svgContainer.style.height = '100%';

            // Initialize VexFlow
            const VF = Vex.Flow;

            // Use fixed width and height that work reliably
            const width = Math.min(this.notationContainer.clientWidth - 10, 1200);
            const height = 180;

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
                // svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
                svgElement.style.display = 'block';
            }

            // Create staves with fixed positions
            const staveWidth = width - 50;
            const stave = new VF.Stave(10, 25, staveWidth);
            stave.addClef("treble");
            stave.setContext(context).draw();

            const bassStave = new VF.Stave(10, 100, staveWidth);
            bassStave.addClef("bass");
            bassStave.setContext(context).draw();

            /* ...existing code for drawing notes... */

            // Replace the loading view with the SVG container
            this.notationContainer.removeChild(loadingView);
            this.notationContainer.appendChild(svgContainer);

            // Add playhead and info panel
            this.addNotationOverlays(svgContainer);

        } catch (error) {
            console.error('Error rendering notation:', error);
            this.renderSimpleNotation();
        }
    }

    renderSimpleNotation() {
        // Clear everything - removed instructions
        this.notationContainer.innerHTML = '';

        // Create simple notation view
        const simpleNotation = document.createElement('div');
        simpleNotation.className = 'simple-notation';

        // Get current visible notes
        const startTime = this.currentPosition;
        const endTime = startTime + this.visibleDuration;
        const visibleNotes = this.parsedNotes
            .filter(note => note.start >= startTime && note.start < endTime)
            .sort((a, b) => a.start - b.start)
            .slice(0, 12); // Show more notes in simple view

        if (visibleNotes.length === 0) {
            simpleNotation.innerHTML = `
                <p>No notes in current view. Try scrolling or loading a different file.</p>
                <p>Position: ${this.currentPosition.toFixed(1)}s</p>
            `;
        } else {
            const notesList = document.createElement('ul');

            visibleNotes.forEach(note => {
                const li = document.createElement('li');

                // Format note name with accidental
                let noteName = note.step;
                if (note.alter === 1) noteName += "♯";
                else if (note.alter === -1) noteName += "♭";

                // Calculate time relative to current position
                const relativeTime = (note.start - this.currentPosition).toFixed(1);
                const sign = relativeTime >= 0 ? '+' : '';

                // Highlight currently playing notes
                const isPlaying = note.start <= this.currentPosition &&
                    (note.start + note.duration) > this.currentPosition;

                li.innerHTML = `<span class="${isPlaying ? 'playing-note' : ''}">${noteName}${note.octave}</span> 
                              <span class="note-timing">(${sign}${relativeTime}s)</span>`;

                notesList.appendChild(li);
            });

            // Add title and info
            simpleNotation.innerHTML = `
                <h3>Current Notes</h3>
                <div class="position-info">Position: ${this.currentPosition.toFixed(1)}s</div>
                <div class="speed-info">Tempo: ${this.bpm} BPM</div>
                <div class="playback-status">${this.isPlaying ? 'Playing' : 'Paused'}</div>
            `;

            simpleNotation.appendChild(notesList);
        }

        this.notationContainer.appendChild(simpleNotation);
    }

    // Helper to add playhead and info panel overlays
    addNotationOverlays(svgContainer) {
        // Add playhead position indicator
        const indicator = document.createElement('div');
        indicator.className = 'notation-position-indicator';
        indicator.style.left = '10px';
        svgContainer.appendChild(indicator);

        // Add position and playback info panel
        const infoPanel = document.createElement('div');
        infoPanel.className = 'notation-info-panel';
        infoPanel.innerHTML = `
            <div class="position-info">Position: ${this.currentPosition.toFixed(1)}s</div>
            <div class="speed-info">Tempo: ${this.bpm} BPM</div>
            <div class="playback-status">${this.isPlaying ? 'Playing' : 'Paused'}</div>
        `;
        infoPanel.style.position = 'absolute';
        infoPanel.style.top = '10px';
        infoPanel.style.right = '10px';
        svgContainer.appendChild(infoPanel);
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.pausePlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastRenderTime = performance.now();

        // Update play/pause button in the original controls
        const playPauseButton = document.querySelector('.piano-play-pause');
        if (playPauseButton) {
            playPauseButton.textContent = 'Pause';
        }

        // Resume animations in the note bar container
        if (this.noteBarContainer) {
            this.noteBarContainer.classList.remove('paused');
        }

        // Initialize note bars on playback start
        this.updateNoteBars();

        // Start animation loop
        this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
    }

    pausePlayback() {
        this.isPlaying = false;

        // Update play/pause button
        const playPauseButton = document.querySelector('.piano-play-pause');
        if (playPauseButton) {
            playPauseButton.textContent = 'Play';
        }

        // Pause all animations in the note bar container
        if (this.noteBarContainer) {
            this.noteBarContainer.classList.add('paused');
        }

        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    highlightPianoKeys(notes) {
        // Remove existing highlights
        const keys = this.pianoVisualizationContainer.querySelectorAll('.piano-key');
        keys.forEach(key => key.classList.remove('active'));

        // Add highlights to current notes
        notes.forEach(note => {
            const key = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
            if (key) {
                key.classList.add('active');
            }
        });
    }

    // Mouse wheel controls playback speed
    adjustPlaybackSpeed(event) {
        // Determine direction of scroll
        const delta = Math.sign(event.deltaY) * -5; // Change by 5 BPM increments

        // Calculate new BPM (between 40 and 240)
        this.bpm = Math.max(40, Math.min(240, this.bpm + delta));

        // Update UI
        const speedValue = this.analyzer.container.querySelector('.speed-value');
        if (speedValue) {
            speedValue.textContent = `${this.bpm} BPM`;
        }

        // Update speed slider if it exists
        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        if (speedControl) {
            speedControl.value = this.bpm;
        }

        console.log(`BPM adjusted to ${this.bpm} via scroll`);
    }

    // Start dragging to scrub through music
    startDragging(event) {
        this.isDragging = false; // Start as false until we've moved enough
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY; // Track Y position too
        this.dragStartPosition = this.currentPosition;
        this.hasDragged = false; // New flag to track if actual dragging occurred
        this.mouseDownTime = Date.now(); // Track when the mouse went down

        // Change cursor to indicate potential dragging
        event.currentTarget.style.cursor = 'grab';

        // Store playing state
        this.wasPlayingBeforeDrag = this.isPlaying;
        // We'll pause only if we actually start dragging, not on just a click
    }

    // Handle dragging to scrub through music
    handleDragging(event) {
        if (this.dragStartX === undefined) return; // Not in drag mode

        // Calculate distance moved
        const dragDistanceX = event.clientX - this.dragStartX;
        const dragDistanceY = event.clientY - this.dragStartY;
        const totalDragDistance = Math.sqrt(dragDistanceX * dragDistanceX + dragDistanceY * dragDistanceY);

        // Only start actual dragging if moved more than a small threshold (5px)
        if (totalDragDistance > 5) {
            // Now we're officially dragging
            if (!this.isDragging) {
                this.isDragging = true;
                event.currentTarget.style.cursor = 'grabbing';

                // Now we pause if was playing
                if (this.isPlaying) {
                    this.pausePlayback();
                }
            }

            // Convert drag distance to time position
            // The sensitivity factor controls how fast the scrubbing happens
            const sensitivity = 0.02;
            const newPosition = this.dragStartPosition + (dragDistanceX * sensitivity);

            // Update position (don't allow negative values)
            this.currentPosition = Math.max(0, newPosition);
            this.hasDragged = true;

            // Update visualizations
            this.renderNotation();
        }
    }

    // Stop dragging
    stopDragging() {
        if (this.dragStartX === undefined) return; // Not in drag mode

        // If we didn't actually drag significantly, treat it as a click
        if (!this.hasDragged) {
            // Check if this was a quick click (not a long press)
            const clickDuration = Date.now() - this.mouseDownTime;
            if (clickDuration < 300) { // Less than 300ms is considered a click
                this.togglePlayback(); // Toggle play/pause
            }
        }
        else if (this.hasDragged) {
            // Handle position change after dragging
            this.handlePositionSeek();

            // Restore playback if it was playing before drag started
            if (this.wasPlayingBeforeDrag) {
                this.startPlayback();
            }
        }

        // Reset cursor
        if (this.notationContainer) {
            this.notationContainer.style.cursor = 'default';
        }

        // Reset drag tracking variables
        this.isDragging = false;
        this.hasDragged = false;
        this.dragStartX = undefined;
        this.dragStartY = undefined;
    }

    handlePositionSeek() {
        // Clear existing note bars
        if (this.noteBarContainer) {
            this.noteBarContainer.innerHTML = '';
            this.noteBars = [];
        }

        // Reset animation frame to ensure accurate timing
        if (this.isPlaying) {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            this.lastRenderTime = performance.now();
            this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
        } else {
            // For paused state, still update notes and visualization
            this.updateNoteBars();
            this.renderNotation();
        }
    }

    closePianoVisualization() {
        // Stop playback
        this.pausePlayback();

        // Make sure all animations are stopped
        if (this.noteBarContainer) {
            // Remove all animations explicitly
            this.noteBars.forEach(bar => {
                if (bar.element) {
                    bar.element.style.animation = 'none';
                }
            });
        }

        // Hide visualization
        if (this.pianoVisualizationContainer) {
            this.pianoVisualizationContainer.style.display = 'none';
        }

        // Show music analyzer panel again
        this.analyzer.panel.style.display = 'block';
    }

    processData(data) {
        // This mode doesn't use the real-time analysis data
    }

    // Replace setPlaybackSpeed utility with direct BPM setting
    setBPM(bpm) {
        // Store old BPM for recalculation
        const oldBPM = this.bpm;

        // Ensure BPM is within valid range
        this.bpm = Math.max(40, Math.min(240, bpm));

        // If we have notes already parsed and there's a significant BPM change
        if (this.parsedNotes.length > 0 && Math.abs(oldBPM - this.bpm) > 1) {
            // Recalculate all note durations with the new tempo
            const tempoRatio = oldBPM / this.bpm;

            this.parsedNotes.forEach(note => {
                // Scale the start times and durations by the tempo ratio
                note.start *= tempoRatio;
                note.duration *= tempoRatio;
            });

            // Also update current position to maintain musical position
            this.currentPosition *= tempoRatio;

            console.log(`Recalculated timing for ${this.parsedNotes.length} notes after tempo change`);
        }

        // Update UI
        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        const speedValue = this.analyzer.container.querySelector('.speed-value');

        if (speedControl) speedControl.value = this.bpm;
        if (speedValue) speedValue.textContent = `${this.bpm} BPM`;

        console.log(`BPM set to ${this.bpm}`);
    }

    // Add this improved function to convert note step/octave to MIDI note number
    stepOctaveToMidiNote(step, octave, alter = 0) {
        const stepValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

        // Validate inputs to prevent NaN results
        if (typeof step !== 'string' || !stepValues.hasOwnProperty(step)) {
            console.warn(`Invalid note step: ${step}, defaulting to C`);
            step = 'C';
        }

        if (isNaN(octave)) {
            console.warn(`Invalid octave: ${octave}, defaulting to 4`);
            octave = 4;
        }

        return (octave + 1) * 12 + stepValues[step] + alter;
    }
}
