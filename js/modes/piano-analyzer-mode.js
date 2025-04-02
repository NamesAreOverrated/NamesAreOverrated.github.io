/**
 * Piano Analyzer Mode
 * Visualizes musical notation from MusicXML files
 */

class PianoAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);

        // Create the music score model instance
        this.scoreModel = new MusicScoreModel();

        // Old state variables (some will be removed)
        this.musicXML = null;
        this.isPlaying = false;
        this.currentPosition = 0;

        // UI containers
        this.pianoRollContainer = null;
        this.notationContainer = null;
        this.lastRenderTime = 0;
        this.visibleDuration = 10; // Seconds visible in view

        // Note bar visualization
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

        // Set up event listeners for the score model
        this.setupScoreModelListeners();

        // Add page navigation state
        this.currentPage = 0;
        this.measuresPerPage = 2;
        this.totalPages = 1;

        // Bind methods that need access to 'this'
        this.startUnifiedAnimation = this.startUnifiedAnimation.bind(this);
        this.updatePlayPauseButton = this.updatePlayPauseButton.bind(this);
        this.highlightPianoKeys = this.highlightPianoKeys.bind(this);
        this.togglePlayback = this.togglePlayback.bind(this);

        // Add chord detection variables
        this.chordDisplayElement = null;
        this.currentChord = null;
        this.upcomingChord = null;
        this.chordLookAheadTime = 1.5; // seconds to look ahead for chords
        this.chordDisplayDebounce = null;
        this.lastChordUpdateTime = 0;
    }

    /**
     * Update the play/pause button state
     */
    updatePlayPauseButton() {
        const playPauseButton = this.analyzer.container.querySelector('.piano-play-pause');
        if (playPauseButton) {
            // Ensure button text matches scoreModel state
            playPauseButton.textContent = this.scoreModel.isPlaying ? 'Pause' : 'Play';

            // Add visual indication of current state
            playPauseButton.classList.toggle('playing', this.scoreModel.isPlaying);
        }
    }

    /**
     * Highlight piano keys for currently playing notes
     * @param {Array} notes Array of notes to highlight
     */
    highlightPianoKeys(notes) {
        if (!this.pianoVisualizationContainer) return;

        // First remove all active highlights
        const keys = this.pianoVisualizationContainer.querySelectorAll('.piano-key');
        keys.forEach(key => key.classList.remove('active'));

        // Nothing to highlight if no notes provided
        if (!notes || notes.length === 0) return;

        // Add active class to keys for currently playing notes
        notes.forEach(note => {
            if (!note || !note.noteNumber) return;

            const key = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
            if (key) {
                key.classList.add('active');
            }
        });
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
                newSpeedControl.value = this.scoreModel.bpm; // Set initial value

                newSpeedControl.addEventListener('input', (e) => {
                    this.scoreModel.setTempo(parseFloat(e.target.value));
                    // The update will be handled by the tempochange event listener
                });

                // Initialize the speed display
                speedValue.textContent = `${this.scoreModel.bpm} BPM`;
            }
        }

        // Also update the result display to show Piano mode is ready
        const resultElement = this.analyzer.container.querySelector('.music-result');
        if (resultElement && resultElement.style.display === 'none') {
            resultElement.style.display = 'block';
        }
    }

    /**
     * Set up event listeners for the score model
     */
    setupScoreModelListeners() {
        // Listen for position changes to update visualizations
        this.scoreModel.addEventListener('positionchange', (data) => {
            // Skip visualization updates if containers aren't created yet
            if (!this.pianoVisualizationContainer) return;

            // Store current position
            this.currentPosition = data.position;

            // For large position jumps, update immediately (seeking behavior)
            if (Math.abs(data.position - (data.previousPosition || 0)) > 0.3) {
                // Handle page changes immediately
                const currentMeasureIndex = this.findCurrentMeasureIndex();
                const expectedPage = Math.floor(currentMeasureIndex / this.measuresPerPage);

                if (expectedPage !== this.currentPage) {
                    this.currentPage = expectedPage;
                    // Force notation redraw on page change
                    this.renderNotation();
                    // This will also update position indicator with forceUpdate
                    return;
                }

                // Update position indicator with forceUpdate=true for seeking
                this.updatePositionIndicator(data.position, true);
            }

            // Other updates (note bars, highlighting) run in animation frame for better performance
            if (!this._pendingRafUpdate) {
                this._pendingRafUpdate = true;

                requestAnimationFrame(() => {
                    this._pendingRafUpdate = false;

                    // Update note bars
                    this.updateNoteBars();

                    // Highlight keys
                    const playingNotes = this.scoreModel.getCurrentlyPlayingNotes();
                    this.highlightPianoKeys(playingNotes);
                });
            }
        });

        // Listen for tempo changes to update UI
        this.scoreModel.addEventListener('tempochange', (data) => {
            // Update tempo display and controls
            this.updateTempoControls();
        });

        // Listen for play/pause events to update UI
        this.scoreModel.addEventListener('play', () => {
            // Use the scoreModel's state as the source of truth
            this.isPlaying = true;
            this.updatePlayPauseButton();

            // Resume animations in the note bar container
            if (this.noteBarContainer) {
                this.noteBarContainer.classList.remove('paused');
            }
        });

        this.scoreModel.addEventListener('pause', () => {
            // Use the scoreModel's state as the source of truth
            this.isPlaying = false;
            this.updatePlayPauseButton();

            // Pause all animations in the note bar container
            if (this.noteBarContainer) {
                this.noteBarContainer.classList.add('paused');
            }
        });

        this.scoreModel.addEventListener('stop', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();

            // Clear note bars
            if (this.noteBarContainer) {
                this.noteBarContainer.innerHTML = '';
                this.noteBars = [];
            }
        });

        this.scoreModel.addEventListener('loaded', () => {
            console.log("Score model loaded data successfully");
        });
    }

    loadMusicXMLFile(file) {
        const statusElement = this.analyzer.container.querySelector('.piano-status');
        if (!statusElement) return;

        statusElement.textContent = 'Loading MusicXML file...';

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (file.name.toLowerCase().endsWith('.mxl')) {
                    this.processMXLData(e.target.result).then(xmlString => {
                        this.processMusicXMLString(xmlString, statusElement);
                    }).catch(error => {
                        console.error('Error extracting MXL file:', error);
                        statusElement.textContent = 'Error processing MXL file. Please try another file.';
                    });
                } else {
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
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    }

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

    loadJSZip() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    processMusicXMLString(xmlString, statusElement) {
        try {
            const parser = new DOMParser();
            this.musicXML = parser.parseFromString(xmlString, 'text/xml');

            const parsererror = this.musicXML.getElementsByTagName('parsererror');
            if (parsererror.length > 0) {
                throw new Error('XML parsing error: ' + parsererror[0].textContent);
            }

            const title = this.extractScoreMetadata(this.musicXML);

            console.log(`Processing score: ${title}`);

            this.resetMusicalState();

            this.extractScoreTimingInformation(this.musicXML);

            this.parseScoreContent();

            this.processNoteRelationships();

            const scoreData = {
                title: title,
                composer: this.composer || '',
                notes: this.parsedNotes,
                measures: this.measureData,
                timeSignatures: this.timeSignatureChanges,
                tempoChanges: this.tempoChanges,
                divisions: this.divisions,
                timeSignatureNumerator: this.timeSignatureNumerator,
                timeSignatureDenominator: this.timeSignatureDenominator
            };

            this.scoreModel.setScoreData(scoreData);

            statusElement.textContent = `Loaded: ${title}`;

            this.updateScoreUI();

        } catch (error) {
            console.error('Error processing MusicXML:', error);
            statusElement.textContent = 'Error processing file: ' + error.message;
        }
    }

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

    resetMusicalState() {
        this.divisions = 24;
        this.timeSignatureNumerator = 4;
        this.timeSignatureDenominator = 4;
        this.bpm = 120;
        this.currentPosition = 0;

        this.tempoChanges = [{ position: 0, tempo: this.bpm }];
        this.timeSignatureChanges = [{
            position: 0,
            numerator: this.timeSignatureNumerator,
            denominator: this.timeSignatureDenominator
        }];

        this.parsedNotes = [];
        this.measureData = [];
        this.noteBars = [];
    }

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

        this.updateTempoControls();
    }

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

            if (this.measureData.length > 2) {
                console.log('Sample measure data:', {
                    first: this.measureData[0],
                    second: this.measureData[1],
                    last: this.measureData[this.measureData.length - 1]
                });
            }
        }
    }

    calculateMeasureDurationInTicks(numerator, denominator, divisions) {
        const ticksPerWholeNote = divisions * 4;

        const ticksPerBeat = ticksPerWholeNote / denominator;

        return ticksPerBeat * numerator;
    }

    parseScoreContent() {
        if (!this.musicXML) return;

        console.log("Parsing score content with enhanced accuracy");

        const parts = this.musicXML.getElementsByTagName('part');

        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex];
            const partId = part.getAttribute('id') || `part-${partIndex + 1}`;

            console.log(`Parsing part ${partId} (${partIndex + 1}/${parts.length})`);

            const scorePart = this.musicXML.querySelector(`score-part[id="${partId}"]`);
            const partName = scorePart?.querySelector('part-name')?.textContent || `Part ${partIndex + 1}`;

            this.parsePart(part, partId, partName, partIndex);
        }

        this.parsedNotes.sort((a, b) => a.start - b.start);

        console.log(`Parsed ${this.parsedNotes.length} total notes`);

        if (this.parsedNotes.length > 0) {
            const lastNote = this.parsedNotes[this.parsedNotes.length - 1];
            const scoreDuration = lastNote.start + lastNote.duration;

            console.log(`Score duration: ${scoreDuration.toFixed(2)} seconds`);
            console.log('Sample of parsed notes:', {
                first: this.parsedNotes.slice(0, 3),
                last: this.parsedNotes.slice(-3)
            });
        }
    }

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

    parseMeasure(measure, startTime, divisions, partId, partName, partIndex, measureNumber, tiedNotes) {
        let currentTime = startTime;

        const voicePositions = new Map();

        const elements = Array.from(measure.children);

        const attributes = measure.querySelector('attributes');
        if (attributes) {
            this.processAttributes(attributes, divisions);
        }

        elements.forEach(element => {
            if (element.tagName === 'backup' || element.tagName === 'forward') {
            }
        });

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

    processNoteRelationships() {
        this.processTiedNotes();

        this.applyArticulationEffects();
    }

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

    ticksToSeconds(ticks, divisions, tempo) {
        if (!ticks || ticks <= 0) return 0;

        const quarterNoteSeconds = 60 / tempo;

        const quarterNoteFraction = ticks / divisions;

        return quarterNoteFraction * quarterNoteSeconds;
    }

    updateNoteBars() {
        if (!this.noteBarContainer || !this.scoreModel.notes.length) return;

        if (this.scoreModel.currentPosition < 0.1 && this.noteBars.length > 0) {
            this.noteBarContainer.innerHTML = '';
            this.noteBars = [];
        }

        const startTime = this.scoreModel.currentPosition - 0.5;
        const endTime = this.scoreModel.currentPosition + this.noteBarLookAhead;

        const visibleNotes = this.scoreModel.getVisibleNotes(startTime, endTime);

        this.createMissingNoteBars(visibleNotes);

        this.updateNoteBarsPosition();

        this.cleanupInvisibleNoteBars(startTime);
    }

    getVisibleNotes(startTime, endTime) {
        return this.parsedNotes.filter(note => {
            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = note.start + noteDuration;

            return (
                (note.start >= startTime && note.start <= endTime) ||

                (note.start < startTime && noteEnd > startTime) ||

                (note.start < startTime && noteEnd > startTime && noteEnd <= endTime)
            );
        });
    }

    createMissingNoteBars(visibleNotes) {
        visibleNotes.forEach(note => {
            const noteId = `${note.id}-${note.start.toFixed(6)}`;

            if (!this.noteBars.some(bar => bar.noteId === noteId)) {
                this.createEnhancedNoteBar(note, noteId);
            }
        });
    }

    createEnhancedNoteBar(note, noteId) {
        const keyElement = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
        if (!keyElement) return;

        const noteBar = document.createElement('div');
        noteBar.className = 'note-bar';

        noteBar.style.transition = 'none';

        const isBlackKey = [1, 3, 6, 8, 10].includes(note.noteNumber % 12);
        if (isBlackKey) noteBar.classList.add('black-note');

        // Determine hand based on staff information first, fallback to note number
        const isRightHand = note.staff === 1 || (note.staff === undefined && note.noteNumber >= 60);
        noteBar.classList.add(isRightHand ? 'right-hand' : 'left-hand');

        if (note.staccato) noteBar.classList.add('staccato');
        if (note.accent) noteBar.classList.add('accent');
        if (note.tenuto) noteBar.classList.add('tenuto');
        if (note.fermata) noteBar.classList.add('fermata');

        if (note.hasTie) noteBar.classList.add('tied');
        if (note.isTiedFromPrevious) noteBar.classList.add('tied-continuation');

        noteBar.dataset.noteId = noteId;
        noteBar.dataset.duration = note.visualDuration || note.duration;
        noteBar.dataset.start = note.start;
        noteBar.dataset.part = note.partId;
        noteBar.dataset.voice = note.voice;
        noteBar.dataset.staff = note.staff || "unspecified"; // Add staff info for debugging

        // Add note name to the note bar
        const noteNameElement = document.createElement('div');
        noteNameElement.className = 'note-name';
        noteNameElement.textContent = note.step + (note.alter === 1 ? '#' : note.alter === -1 ? 'b' : '');
        noteBar.appendChild(noteNameElement);

        this.noteBarContainer.appendChild(noteBar);

        this.noteBars.push({
            noteId,
            element: noteBar,
            note,
            keyElement
        });
    }

    updateNoteBarsPosition() {
        if (!this.noteBarContainer || !this.noteBars.length) return;

        const containerHeight = this.noteBarContainer.clientHeight;
        const lookAheadTime = this.noteBarLookAhead;
        const currentTime = this.scoreModel.currentPosition;

        // Cache these calculations outside the loop
        const timeToPixelRatio = containerHeight / lookAheadTime;
        const MIN_NOTE_HEIGHT = 8;

        // Cache DOM rect calculations to avoid layout thrashing
        const containerRect = this.keyboardContainer.getBoundingClientRect();
        const keyPositions = new Map();

        // Batch DOM updates using requestAnimationFrame
        const updates = [];

        this.noteBars.forEach(bar => {
            const note = bar.note;
            const element = bar.element;
            if (!element || !bar.keyElement) return;

            // Calculate position data but don't update DOM yet
            const noteData = this.calculateNoteBarPosition(
                bar, currentTime, containerHeight,
                timeToPixelRatio, MIN_NOTE_HEIGHT,
                containerRect, keyPositions
            );

            if (noteData) {
                updates.push({ element, data: noteData });
            }
        });

        // Apply all DOM updates at once (better performance)
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                updates.forEach(({ element, data }) => {
                    element.style.display = data.display;
                    if (data.display === 'block') {
                        element.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
                        element.style.width = `${data.width}px`;
                        element.style.height = `${data.height}px`;
                        element.style.opacity = data.opacity;
                        element.classList.toggle('playing', data.isPlaying);
                    }
                });
            });
        }
    }

    // Extract calculation logic to separate function
    calculateNoteBarPosition(bar, currentTime, containerHeight, timeToPixelRatio, minHeight, containerRect, keyPositions) {
        const note = bar.note;
        const keyElement = bar.keyElement;

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

        const noteStart = note.start;
        const noteDuration = note.visualDuration || note.duration;
        const noteEnd = noteStart + noteDuration;

        // Visibility checks
        const isPlaying = noteStart <= currentTime && noteEnd > currentTime;
        const isUpcoming = noteStart > currentTime && noteStart <= currentTime + this.noteBarLookAhead;
        const isPartiallyVisible = noteStart < currentTime && noteEnd > currentTime;
        const isPassed = noteEnd <= currentTime && noteEnd > currentTime - 0.5;
        const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

        if (!isVisible) {
            return { display: 'none' };
        }

        // Calculate position
        const noteHeight = Math.max(minHeight, noteDuration * timeToPixelRatio);
        let topPosition, opacity = 1;

        if (isPlaying) {
            const elapsedTime = currentTime - noteStart;
            const remainingDuration = Math.max(0, noteDuration - elapsedTime);
            const remainingHeight = remainingDuration * timeToPixelRatio;
            topPosition = containerHeight - remainingHeight;
        } else if (isUpcoming) {
            const timeToStart = noteStart - currentTime;
            const distanceFromBottom = timeToStart * timeToPixelRatio;
            topPosition = containerHeight - distanceFromBottom - noteHeight;
        } else if (isPartiallyVisible) {
            const elapsedTime = currentTime - noteStart;
            const remainingDuration = Math.max(0, noteDuration - elapsedTime);
            const remainingHeight = remainingDuration * timeToPixelRatio;
            topPosition = containerHeight - remainingHeight;
        } else if (isPassed) {
            const timeSinceEnd = currentTime - noteEnd;
            opacity = Math.max(0, 0.5 - timeSinceEnd);
            topPosition = containerHeight;
        }

        // Apply staccato effect
        let finalHeight = noteHeight;
        if (note.staccato) {
            finalHeight = noteHeight * 0.7;
        }

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

    cleanupInvisibleNoteBars(startTime) {
        const cleanupThreshold = startTime - 1.0;
        const removeList = [];

        // First identify elements to remove (separation of concerns)
        for (let i = 0; i < this.noteBars.length; i++) {
            const bar = this.noteBars[i];
            const note = bar.note;
            const noteDuration = note.visualDuration || note.duration;

            if (note.start + noteDuration < cleanupThreshold) {
                removeList.push(i);
                if (bar.element && bar.element.parentNode) {
                    bar.element.parentNode.removeChild(bar.element);
                }
            }
        }

        // Then remove from array (in reverse to maintain indices)
        for (let i = removeList.length - 1; i >= 0; i--) {
            this.noteBars.splice(removeList[i], 1);
        }

        // Log cleanup for debugging
        if (removeList.length > 0) {
            console.log(`Removed ${removeList.length} invisible note bars, ${this.noteBars.length} remaining`);
        }
    }

    updateTempoControls() {
        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        const speedValue = this.analyzer.container.querySelector('.speed-value');

        if (speedControl && speedValue) {
            speedControl.value = this.bpm;
            speedValue.textContent = `${this.bpm} BPM`;
        }
    }

    updateScoreTitle(title) {
        const songNameElement = document.querySelector('.piano-song-name');
        if (songNameElement) {
            songNameElement.textContent = title;
        }
    }

    showPlaybackControls() {
        const playbackControls = this.analyzer.container.querySelector('.piano-playback-controls');
        if (playbackControls) {
            playbackControls.style.display = 'flex';
        }
    }

    createPianoVisualizationContainer() {
        const existingContainer = document.getElementById('piano-visualization-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        this.pianoVisualizationContainer = document.createElement('div');
        this.pianoVisualizationContainer.id = 'piano-visualization-container';
        this.pianoVisualizationContainer.className = 'piano-visualization-container';

        this.pianoVisualizationContainer.innerHTML = `
            <div class="notation-container">
            </div>
            <div class="note-bar-container">
            </div>
            <div class="piano-keyboard-container">
                <div class="piano-keyboard">
                </div>
            </div>
            <button class="piano-close-btn" title="Close Visualization">×</button>
        `;

        document.body.appendChild(this.pianoVisualizationContainer);

        this.notationContainer = this.pianoVisualizationContainer.querySelector('.notation-container');
        this.keyboardContainer = this.pianoVisualizationContainer.querySelector('.piano-keyboard-container');
        this.noteBarContainer = this.pianoVisualizationContainer.querySelector('.note-bar-container');
        this.closeButton = this.pianoVisualizationContainer.querySelector('.piano-close-btn');

        // Create position indicator once here
        this.positionIndicator = document.createElement('div');
        this.positionIndicator.className = 'notation-position-indicator';
        this.notationContainer.appendChild(this.positionIndicator);

        this.generatePianoKeyboard();

        this.closeButton.addEventListener('click', () => {
            this.closePianoVisualization();
        });

        // Simplified click handler for play/pause
        this.setupSimpleClickHandlers();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.pianoVisualizationContainer.style.display !== 'none') {
                    // Close the visualization
                    this.closePianoVisualization();
                }
            }
        });

        window.addEventListener('resize', () => {
            if (this.pianoVisualizationContainer.style.display !== 'none') {
                this.renderNotation();
                this.updateNoteBarsPosition();
            }
        });

        // Add chord display element
        this.chordDisplayElement = document.createElement('div');
        this.chordDisplayElement.className = 'chord-display';
        this.chordDisplayElement.innerHTML = `
            <div class="chord-name"></div>
            <div class="chord-notes"></div>
            <div class="chord-timing"></div>
        `;
        this.chordDisplayElement.style.opacity = '0';
        this.pianoVisualizationContainer.appendChild(this.chordDisplayElement);
    }

    createVisualization() {
        this.analyzer.panel.style.display = 'none';

        this.createPianoVisualizationContainer();

        this.renderNotation();

        this.pianoVisualizationContainer.style.display = 'block';
    }

    generatePianoKeyboard() {
        const keyboard = this.pianoVisualizationContainer.querySelector('.piano-keyboard');
        keyboard.innerHTML = '';

        for (let i = 21; i <= 108; i++) {
            const isBlackKey = [1, 3, 6, 8, 10].includes(i % 12);
            const keyElement = document.createElement('div');
            keyElement.className = `piano-key ${isBlackKey ? 'black-key' : 'white-key'}`;
            keyElement.dataset.note = i;

            if (!isBlackKey && i % 12 === 0) {
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


        // Calculate current position from elapsed time
        this.previousPosition = this.currentPosition;

        // Use high-precision timing
        const currentTime = this.getTimestamp();
        const elapsedSeconds = (currentTime - this.playbackStartTime) / 1000;

        // Smoother position update with rounding to reduce jitter
        if (!isNaN(elapsedSeconds) && isFinite(elapsedSeconds)) {
            // Round to 3 decimal places to reduce tiny fluctuations
            this.currentPosition = Math.round(elapsedSeconds * 1000) / 1000;
        }


        const deltaTime = (timestamp - this.lastRenderTime) / 1000;
        this.lastRenderTime = timestamp;

        this.currentPosition += deltaTime;

        this.updateTempoAtPosition();



        this.updateNoteBars();

        const notesToPlay = this.parsedNotes.filter(
            note => note.start <= this.currentPosition &&
                note.start + (note.visualDuration || note.duration) > this.currentPosition &&
                !note.isTiedFromPrevious
        );

        this.highlightPianoKeys(notesToPlay);

        const lastNote = this.parsedNotes[this.parsedNotes.length - 1];
        if (lastNote && this.currentPosition > lastNote.start + (lastNote.visualDuration || lastNote.duration) + 2) {
            this.currentPosition = 0;
        }

        // this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
        this.animationFrameId = requestAnimationFrame(this.updatePlayback);
    }

    updateTempoAtPosition() {
        if (!this.tempoChanges || this.tempoChanges.length <= 1) return;

        let currentTempo = this.tempoChanges[0].tempo;

        for (let i = 1; i < this.tempoChanges.length; i++) {
            const tempoChange = this.tempoChanges[i];
            if (tempoChange.position <= this.currentPosition) {
                currentTempo = tempoChange.tempo;
            } else {
                break;
            }
        }

        if (Math.abs(this.bpm - currentTempo) > 0.01) {
            this.bpm = currentTempo;
            this.updateTempoControls();
        }
    }

    renderNotation() {
        if (!this.parsedNotes.length || !this.notationContainer) return;

        if (typeof Vex === 'undefined') {
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
            script.src = 'https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    renderNotationWithVexFlow() {
        if (!this.parsedNotes.length || !this.notationContainer) return;

        const now = performance.now();
        if (this._lastFullRender && now - this._lastFullRender < 500) {
            // Just update position indicator for smoother experience
            this.updatePositionIndicator(this.scoreModel.currentPosition);
            return;
        }
        this._lastFullRender = now;

        // Remove position indicator before clearing container
        if (this.positionIndicator && this.positionIndicator.parentNode) {
            this.positionIndicator.parentNode.removeChild(this.positionIndicator);
        }

        // Clear notation container
        this.notationContainer.innerHTML = '';

        try {
            // Create SVG container with improved dimensions
            const svgContainer = document.createElement('div');
            svgContainer.className = 'notation-svg-container';
            svgContainer.style.width = '100%';
            svgContainer.style.height = '100%';
            this.notationContainer.appendChild(svgContainer);

            // Always create a new position indicator to avoid stale references
            this.notationContainer.appendChild(this.positionIndicator);


            // Initialize VexFlow
            const VF = Vex.Flow;

            // Calculate dimensions based on container size with better margins
            const containerWidth = this.notationContainer.clientWidth;
            const containerHeight = this.notationContainer.clientHeight;

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
            this.totalPages = Math.ceil(this.measureData.length / this.measuresPerPage);

            // Determine the correct page based on current position
            const targetPage = Math.floor(currentMeasureIndex / this.measuresPerPage);
            if (this.currentPage !== targetPage) {
                this.currentPage = targetPage;
            }

            // Calculate start and end measure indices for current page
            const startMeasureIndex = this.currentPage * this.measuresPerPage;
            const endMeasureIndex = Math.min(
                this.measureData.length - 1,
                startMeasureIndex + this.measuresPerPage - 1
            );

            // Get time bounds from measure data
            const startPosition = this.measureData[startMeasureIndex].startPosition;
            const endPosition = endMeasureIndex < this.measureData.length - 1
                ? this.measureData[endMeasureIndex + 1].startPosition
                : startPosition + this.measureData[endMeasureIndex].durationSeconds;

            // Store page time bounds for position indicator calculations
            this.currentPageStartPosition = startPosition;
            this.currentPageEndPosition = endPosition;
            this.currentPageStartX = 20; // Left margin
            this.currentPageEndX = containerWidth - 20; // Right margin

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
                    if (measureIndex === 0 || this.measureData[measureIndex].hasTimeChange) {
                        trebleStave.addTimeSignature(
                            `${this.timeSignatureNumerator}/${this.timeSignatureDenominator}`
                        );
                        bassStave.addTimeSignature(
                            `${this.timeSignatureNumerator}/${this.timeSignatureDenominator}`
                        );
                    }
                } else {
                    // For internal measures, check if time signature changed
                    if (this.measureData[measureIndex].hasTimeChange) {
                        trebleStave.addTimeSignature(
                            `${this.timeSignatureNumerator}/${this.timeSignatureDenominator}`
                        );
                        bassStave.addTimeSignature(
                            `${this.timeSignatureNumerator}/${this.timeSignatureDenominator}`
                        );
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

            // FIX: Improved filtering of notes within the current page's view window
            // Make sure we get all notes for measures on this page
            const visibleNotes = this.parsedNotes.filter(note => {
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

            // FIX: Sort notes into measures with better boundary handling
            visibleNotes.forEach(note => {
                // FIX: More robust method to assign notes to measures
                let assignedToMeasure = false;

                // First, try to find the exact measure this note belongs to
                for (let i = 0; i <= endMeasureIndex - startMeasureIndex; i++) {
                    const measureIndex = startMeasureIndex + i;
                    const measureStartTime = this.measureData[measureIndex].startPosition;
                    const measureEndTime = measureIndex < this.measureData.length - 1
                        ? this.measureData[measureIndex + 1].startPosition
                        : measureStartTime + this.measureData[measureIndex].durationSeconds;

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
                const measureStartTime = this.measureData[measureIndex].startPosition;
                const measureEndTime = measureIndex < this.measureData.length - 1
                    ? this.measureData[measureIndex + 1].startPosition
                    : measureStartTime + this.measureData[measureIndex].durationSeconds;

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

                // FIX: Debug chord grouping
                console.log(`Treble chord groups: ${trebleNotesByTime.length}, Bass chord groups: ${bassNotesByTime.length}`);

                // Create VexFlow notes with improved error handling
                const trebleStaveNotes = this.createVexFlowNotes(
                    trebleNotesByTime, "treble", measureStartTime, measureEndTime
                );

                const bassStaveNotes = this.createVexFlowNotes(
                    bassNotesByTime, "bass", measureStartTime, measureEndTime
                );

                // Format and draw voices for treble stave if we have notes
                if (trebleStaveNotes.length > 0) {
                    try {
                        const trebleVoice = new VF.Voice({
                            num_beats: this.timeSignatureNumerator,
                            beat_value: this.timeSignatureDenominator,
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
                            num_beats: this.timeSignatureNumerator,
                            beat_value: this.timeSignatureDenominator,
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

        } catch (error) {
            console.error('Error rendering notation:', error);
            // Fallback to simpler notation
            this.renderSimpleNotation();
        }
    }

    // FIX: Improved method to create VexFlow notes from grouped notes with better error handling
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

        // Calculate beats per measure from time signature
        const beatsPerMeasure = this.timeSignatureNumerator || 4;

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

                    // Add accidentals - FIX: Use addModifier instead of addAccidental for VexFlow 4.x
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

    updatePositionIndicator(position, forceUpdate = false) {
        // Ensure we have the necessary elements
        if (!this.positionIndicator || !this.notationContainer) return;

        // Get page bounds
        const startPosition = this.currentPageStartPosition || 0;
        const endPosition = this.currentPageEndPosition || 0;

        // Check if position is within current page bounds
        const isInPageBounds = position >= startPosition && position <= endPosition;

        if (!isInPageBounds && !forceUpdate) {
            this.positionIndicator.style.opacity = '0';
            return;
        }

        // Position is on this page, make indicator visible
        this.positionIndicator.style.opacity = '1';

        // Detect large jumps (seeking) vs. normal playback
        const isLargeJump = !this.lastIndicatorPosition ||
            Math.abs(position - this.lastIndicatorPosition) > 0.3;

        // For large jumps/seeking, disable transition temporarily
        if (isLargeJump) {
            this.positionIndicator.style.transition = 'none';

            // Force a reflow to ensure style changes take effect immediately
            void this.positionIndicator.offsetWidth;
        } else if (this.positionIndicator.style.transition === 'none') {
            // Re-enable smooth transition only if it was previously disabled
            this.positionIndicator.style.transition = 'transform 0.05s linear';
        }

        // Store position for next comparison
        this.lastIndicatorPosition = position;

        // Calculate horizontal position
        const containerWidth = this.notationContainer.clientWidth;
        const leftMargin = this.currentPageStartX || 20;
        const rightMargin = 20;
        const usableWidth = containerWidth - leftMargin - rightMargin;

        // Calculate relative position within page timespan
        const pageTimeRange = endPosition - startPosition;
        const relativePos = Math.max(0, Math.min(1, (position - startPosition) / pageTimeRange));

        // Calculate pixel position
        const xPosition = leftMargin + (relativePos * usableWidth);

        // Use transform for better performance
        this.positionIndicator.style.transform = `translateX(${xPosition}px)`;

        // If we disabled transition for a jump, re-enable it on next frame
        if (isLargeJump) {
            requestAnimationFrame(() => {
                this.positionIndicator.style.transition = 'transform 0.05s linear';
            });
        }
    }

    // FIX: Improved helper method to group notes by start time for chord creation
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

    // FIX: Render a simple notation view as fallback if VexFlow fails
    renderSimpleNotation() {
        if (!this.notationContainer || !this.parsedNotes.length) return;

        // Clean container
        this.notationContainer.innerHTML = '';

        // Create simple notation display
        const simpleNotation = document.createElement('div');
        simpleNotation.className = 'simple-notation';

        // Calculate current page bounds
        const startMeasureIndex = this.currentPage * this.measuresPerPage;
        const endMeasureIndex = Math.min(
            this.measureData.length - 1,
            startMeasureIndex + this.measuresPerPage - 1
        );

        const startPosition = this.measureData[startMeasureIndex].startPosition;
        const endPosition = endMeasureIndex < this.measureData.length - 1
            ? this.measureData[endMeasureIndex + 1].startPosition
            : startPosition + this.measureData[endMeasureIndex].durationSeconds;

        // Add page info (instead of controls with buttons)
        const pageInfo = document.createElement('div');
        pageInfo.className = 'simple-page-info';
        pageInfo.innerHTML = `<span>Page ${this.currentPage + 1} of ${this.totalPages}</span>`;

        // Add header with position info
        simpleNotation.innerHTML = `
            <h3>Notes for Measures ${startMeasureIndex + 1}-${endMeasureIndex + 1}</h3>
            <div class="position-info">Position: ${this.currentPosition.toFixed(2)}s</div>
            <div class="playback-status">${this.isPlaying ? 'Playing' : 'Paused'}</div>
        `;

        // Add the page info
        simpleNotation.appendChild(pageInfo);

        // Filter notes for this page
        const visibleNotes = this.parsedNotes.filter(note => {
            const noteDuration = note.visualDuration || note.duration;
            return (note.start >= startPosition && note.start < endPosition) ||
                (note.start < startPosition && note.start + noteDuration > startPosition);
        }).sort((a, b) => a.start - b.start);

        // Create list of notes
        const notesList = document.createElement('ul');

        visibleNotes.forEach(note => {
            const noteName = `${note.step}${note.alter === 1 ? '#' : note.alter === -1 ? 'b' : ''}${note.octave}`;
            const isPlaying = note.start <= this.currentPosition &&
                (note.start + (note.visualDuration || note.duration) > this.currentPosition);

            const item = document.createElement('li');
            item.className = isPlaying ? 'playing-note' : '';
            item.innerHTML = `
                <span>${noteName} (${note.staff === 1 ? 'Treble' : 'Bass'})</span>
                <span class="note-timing">${note.start.toFixed(2)}s - ${(note.start + (note.visualDuration || note.duration)).toFixed(2)}s</span>
            `;

            notesList.appendChild(item);
        });

        simpleNotation.appendChild(notesList);
        this.notationContainer.appendChild(simpleNotation);
    }

    findCurrentMeasureIndex() {
        let currentMeasureIndex = 0;
        const currentPosition = this.scoreModel.currentPosition;

        for (let i = 0; i < this.measureData.length; i++) {
            if (currentPosition >= this.measureData[i].startPosition) {
                currentMeasureIndex = i;
            } else {
                break;
            }
        }

        return currentMeasureIndex;
    }

    calculateOptimalMeasuresPerPage(currentMeasureIndex) {
        let optimalMeasures = 2;

        const containerWidth = this.notationContainer?.clientWidth || 800;

        const basePerPage = Math.max(1, Math.floor(containerWidth / 300));

        try {
            const startMeasure = currentMeasureIndex;
            const endMeasure = Math.min(this.measureData.length - 1, startMeasure + 4);

            let totalNotes = 0;
            let totalMeasures = 0;

            for (let i = startMeasure; i <= endMeasure; i++) {
                const measureStart = this.measureData[i].startPosition;
                const measureEnd = i < this.measureData.length - 1
                    ? this.measureData[i + 1].startPosition
                    : measureStart + this.measureData[i].durationSeconds;

                const notesInMeasure = this.parsedNotes.filter(note =>
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

            const currentTempo = this.bpm;
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

    goToPreviousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderNotation();

            const measureIndex = this.currentPage * this.measuresPerPage;
            if (measureIndex < this.measureData.length) {
                this.scoreModel.seekTo(this.measureData[measureIndex].startPosition);
            }
        }
    }

    goToNextPage() {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            this.renderNotation();

            const measureIndex = this.currentPage * this.measuresPerPage;
            if (measureIndex < this.measureData.length) {
                this.scoreModel.seekTo(this.measureData[measureIndex].startPosition);
            }
        }
    }

    /**
     * Toggle play/pause state with error handling
     */
    togglePlayback() {
        if (this._toggleInProgress) return;
        this._toggleInProgress = true;

        try {
            if (this.scoreModel.isPlaying) {
                this.scoreModel.pause();
                // Cancel ALL animation frames
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                if (this.positionAnimationId) {
                    cancelAnimationFrame(this.positionAnimationId);
                    this.positionAnimationId = null;
                }
            } else {
                this.scoreModel.play();
                // Use a single animation loop that handles everything
                this.startUnifiedAnimation();
            }
        } catch (err) {
            console.error("Error toggling playback:", err);
        } finally {
            setTimeout(() => {
                this._toggleInProgress = false;
            }, 300);
        }
    }

    startUnifiedAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        const animate = (timestamp) => {
            if (!this.scoreModel.isPlaying) return;

            // Update position 
            this.updatePositionIndicator(this.scoreModel.currentPosition);

            // Update note bars
            this.updateNoteBars();

            // Update chord display
            this.updateChordDisplay();

            // Update notation at lower frequency
            if (!this._lastNotationUpdate ||
                timestamp - this._lastNotationUpdate > 500) { // 2fps is enough for notation
                this.renderNotation(false);
                this._lastNotationUpdate = timestamp;
            }

            // Get and highlight playing notes
            const playingNotes = this.scoreModel.getCurrentlyPlayingNotes();
            this.highlightPianoKeys(playingNotes);

            // Continue loop
            this.animationFrameId = requestAnimationFrame(animate);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Update the chord display with upcoming chord information
     * Now separates left and right hand chords based on staff assignment
     */
    updateChordDisplay() {
        // Don't update chords too frequently to avoid flickering
        const now = performance.now();
        if (now - this.lastChordUpdateTime < 500) return;

        // Look ahead for upcoming notes
        const currentPosition = this.scoreModel.currentPosition;
        const lookAheadStart = currentPosition + 0.2; // Small buffer after current position
        const lookAheadEnd = currentPosition + this.chordLookAheadTime;

        // Get upcoming notes within the look-ahead window
        const upcomingNotes = this.scoreModel.getVisibleNotes(lookAheadStart, lookAheadEnd);

        // Skip if no upcoming notes
        if (!upcomingNotes || upcomingNotes.length < 2) {
            if (this.upcomingChord) {
                // Hide chord display if we showed a chord before but no longer have upcoming chords
                this.fadeOutChordDisplay();
                this.upcomingChord = null;
            }
            return;
        }

        // Separate notes into left and right hand based on staff information
        // Staff=1 is treble (right hand), Staff=2 is bass (left hand)
        // In case staff information is missing, fall back to note number
        const leftHandNotes = upcomingNotes.filter(note => {
            // Priority 1: Explicit staff assignment from MusicXML
            if (note.staff !== undefined) {
                return note.staff === 2; // Bass staff = left hand
            }
            // Priority 2: Fall back to note number (below middle C) only if staff is not specified
            return note.noteNumber < 60;
        });

        const rightHandNotes = upcomingNotes.filter(note => {
            // Priority 1: Explicit staff assignment from MusicXML
            if (note.staff !== undefined) {
                return note.staff === 1; // Treble staff = right hand
            }
            // Priority 2: Fall back to note number (above or at middle C) only if staff is not specified
            return note.noteNumber >= 60;
        });

        // Group notes by their starting times for each hand
        const groupNotesByTime = (notes) => {
            const notesByStartTime = {};
            notes.forEach(note => {
                // Skip tied continuation notes
                if (note.isTiedFromPrevious) return;

                // Round to nearest 50ms to group notes that start at almost the same time
                const roundedStart = Math.round(note.start * 20) / 20;
                if (!notesByStartTime[roundedStart]) {
                    notesByStartTime[roundedStart] = [];
                }
                notesByStartTime[roundedStart].push(note);
            });
            return notesByStartTime;
        };

        const leftHandNotesByTime = groupNotesByTime(leftHandNotes);
        const rightHandNotesByTime = groupNotesByTime(rightHandNotes);

        // Find earliest chord for each hand (at least 2 notes)
        const findEarliestChord = (notesByTime) => {
            let earliestTime = Infinity;
            let earliestNotes = null;

            Object.entries(notesByTime).forEach(([startTime, notes]) => {
                if (notes.length >= 2 && parseFloat(startTime) < earliestTime) {
                    earliestTime = parseFloat(startTime);
                    earliestNotes = notes;
                }
            });

            return earliestNotes ? { time: earliestTime, notes: earliestNotes } : null;
        };

        const leftHandChord = findEarliestChord(leftHandNotesByTime);
        const rightHandChord = findEarliestChord(rightHandNotesByTime);

        // If neither hand has a chord, clear display
        if (!leftHandChord && !rightHandChord) {
            if (this.upcomingChord) {
                this.fadeOutChordDisplay();
                this.upcomingChord = null;
            }
            return;
        }

        // Detect chords using MusicTheory for each hand
        const detectChordFromNotes = (notes) => {
            if (!notes || notes.length < 2) return null;

            // Use MusicTheory to detect the chord
            const detectedChord = MusicTheory.detectChord(notes);

            // If chord detection failed, just show the notes
            if (!detectedChord) {
                // Create a simple representation of the notes
                const noteNames = notes.map(note => {
                    const noteName = note.step;
                    const accidental = note.alter === 1 ? '#' : note.alter === -1 ? 'b' : '';
                    return `${noteName}${accidental}`;
                });

                return {
                    name: "Notes",
                    notes: [...new Set(noteNames)], // Remove duplicates
                };
            }

            return detectedChord;
        };

        // Process left and right hand chords
        const leftHandChordData = leftHandChord ? {
            ...detectChordFromNotes(leftHandChord.notes),
            time: leftHandChord.time,
            hand: 'left',
            // Add debug info
            staffInfo: leftHandChord.notes.map(n => n.staff || 'unspecified').join(',')
        } : null;

        const rightHandChordData = rightHandChord ? {
            ...detectChordFromNotes(rightHandChord.notes),
            time: rightHandChord.time,
            hand: 'right',
            // Add debug info
            staffInfo: rightHandChord.notes.map(n => n.staff || 'unspecified').join(',')
        } : null;

        // If neither hand has a chord, clear display
        if (!leftHandChord && !rightHandChord) {
            if (this.upcomingChord) {
                this.fadeOutChordDisplay();
                this.upcomingChord = null;
            }
            return;
        }

        // Choose which chord(s) to display
        let chordsToDisplay = [];

        if (leftHandChordData && rightHandChordData) {
            // If both hands have chords
            const timeDifference = Math.abs(leftHandChordData.time - rightHandChordData.time);

            // If chords are played at similar times (within 0.2s), display both
            if (timeDifference < 0.2) {
                chordsToDisplay = [leftHandChordData, rightHandChordData];
            } else {
                // Otherwise, display the earlier chord
                chordsToDisplay = [leftHandChordData.time < rightHandChordData.time ?
                    leftHandChordData : rightHandChordData];
            }
        } else {
            // Display whichever hand has a chord
            chordsToDisplay = leftHandChordData ? [leftHandChordData] :
                rightHandChordData ? [rightHandChordData] : [];
        }

        // Skip update if no chords to display
        if (chordsToDisplay.length === 0) {
            if (this.upcomingChord) {
                this.fadeOutChordDisplay();
                this.upcomingChord = null;
            }
            return;
        }

        // Check if chords have changed
        const chordSignature = chordsToDisplay.map(c => `${c.hand}-${c.name}-${c.time}`).join('|');
        const previousSignature = this.upcomingChord ?
            (Array.isArray(this.upcomingChord) ?
                this.upcomingChord.map(c => `${c.hand}-${c.name}-${c.time}`).join('|') :
                `${this.upcomingChord.hand}-${this.upcomingChord.name}-${this.upcomingChord.time}`)
            : '';

        // Only update display if chord is different
        if (chordSignature !== previousSignature) {
            this.upcomingChord = chordsToDisplay.length === 1 ? chordsToDisplay[0] : chordsToDisplay;
            this.updateChordDisplayContent(this.upcomingChord);
            this.lastChordUpdateTime = now;
        }
    }

    /**
     * Update the content of the chord display element
     * Now handles multiple chords (left/right hand)
     * @param {Object|Array} chord The chord information to display
     */
    updateChordDisplayContent(chord) {
        if (!this.chordDisplayElement) return;

        // Get the HTML elements
        const nameElement = this.chordDisplayElement.querySelector('.chord-name');
        const notesElement = this.chordDisplayElement.querySelector('.chord-notes');
        const timingElement = this.chordDisplayElement.querySelector('.chord-timing');

        if (!nameElement || !notesElement || !timingElement) return;

        // Reset existing hand classes
        this.chordDisplayElement.classList.remove('left-hand', 'right-hand', 'both-hands');

        // Update with transition effect
        this.chordDisplayElement.classList.remove('fade-in', 'fade-out');
        this.chordDisplayElement.classList.add('fade-in');

        // Format chord name with inversion info if needed
        const formatChordName = (chordData) => {
            if (!chordData) return "";

            let displayName = chordData.name;

            // Only append inversion info for "Notes" if we have a proper root and type
            if (displayName === "Notes" && chordData.root && chordData.type) {
                displayName = `${chordData.root}${chordData.type}`;

                // Add inversion indication if applicable
                if (chordData.inversion > 0 && chordData.notes && chordData.notes.length > 0) {
                    const bassNote = chordData.notes[0]; // First note is bass note
                    displayName += `/${bassNote}`;
                }
            }

            return displayName;
        };

        // If we have an array of chords (both hands)
        if (Array.isArray(chord) && chord.length === 2) {
            // Add both-hands class for styling
            this.chordDisplayElement.classList.add('both-hands');

            const leftChord = chord.find(c => c.hand === 'left') || chord[0];
            const rightChord = chord.find(c => c.hand === 'right') || chord[1];

            // Display both chords with proper formatting
            nameElement.innerHTML = `
                <span class="left-hand-chord">${formatChordName(leftChord)}</span>
                <span class="chord-separator"> | </span>
                <span class="right-hand-chord">${formatChordName(rightChord)}</span>
            `;

            // Display notes from both hands
            notesElement.innerHTML = `
                <span class="left-hand-notes">${leftChord.notes.join(' - ')}</span>
                <span class="notes-separator"> | </span>
                <span class="right-hand-notes">${rightChord.notes.join(' - ')}</span>
            `;

            // Use the earlier time for countdown
            const earliestTime = Math.min(leftChord.time, rightChord.time);
            const timeUntilChord = earliestTime - this.scoreModel.currentPosition;
            const timeUntilChordSec = Math.max(0, timeUntilChord.toFixed(1));

            timingElement.textContent = `in ${timeUntilChordSec}s`;
        } else {
            // Single chord - could be left or right hand
            const singleChord = Array.isArray(chord) ? chord[0] : chord;

            // Add hand-specific class for styling
            if (singleChord.hand) {
                this.chordDisplayElement.classList.add(`${singleChord.hand}-hand`);
            }

            // Format the single chord name
            nameElement.textContent = formatChordName(singleChord);

            // Display the notes
            notesElement.textContent = singleChord.notes.join(' - ');

            // Calculate time until chord
            const timeUntilChord = singleChord.time - this.scoreModel.currentPosition;
            const timeUntilChordSec = Math.max(0, timeUntilChord.toFixed(1));

            timingElement.textContent = `in ${timeUntilChordSec}s`;
        }

        // Show the element if it was hidden
        this.chordDisplayElement.style.opacity = '1';

        // Determine time until earliest chord for pulse effect
        const earliestTime = Array.isArray(chord)
            ? Math.min(...chord.map(c => c.time))
            : chord.time;
        const timeUntilEarliest = earliestTime - this.scoreModel.currentPosition;

        // Add pulse effect if chord is coming soon
        if (timeUntilEarliest < 0.5) {
            this.chordDisplayElement.classList.add('pulse');
        } else {
            this.chordDisplayElement.classList.remove('pulse');
        }
    }

    /**
     * Fade out the chord display
     */
    fadeOutChordDisplay() {
        if (!this.chordDisplayElement) return;

        this.chordDisplayElement.classList.remove('fade-in', 'pulse');
        this.chordDisplayElement.classList.add('fade-out');

        setTimeout(() => {
            if (this.chordDisplayElement) {
                this.chordDisplayElement.style.opacity = '0';
            }
        }, 300);
    }

    cleanup() {
        // Cancel any pending animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.positionAnimationId) {
            cancelAnimationFrame(this.positionAnimationId);
            this.positionAnimationId = null;
        }

        // Clear note bars
        if (this.noteBarContainer) {
            this.noteBarContainer.innerHTML = '';
            this.noteBars = [];
        }

        // Stop any playback
        if (this.scoreModel) {
            this.scoreModel.pause();
        }

        // Remove visualization container if it exists
        if (this.pianoVisualizationContainer && this.pianoVisualizationContainer.parentNode) {
            this.pianoVisualizationContainer.parentNode.removeChild(this.pianoVisualizationContainer);
            this.pianoVisualizationContainer = null;
        }

        // Hide chord display
        if (this.chordDisplayElement) {
            this.chordDisplayElement.style.opacity = '0';
        }
    }

    closePianoVisualization() {
        this.scoreModel.pause();
        this.cleanup();

        if (this.noteBarContainer) {
            this.noteBars.forEach(bar => {
                if (bar.element) {
                    bar.element.style.animation = 'none';
                }
            });
        }

        if (this.pianoVisualizationContainer) {
            this.pianoVisualizationContainer.style.display = 'none';
        }

        this.analyzer.panel.style.display = 'block';
    }

    processData(data) {
    }

    setBPM(bpm) {
        const oldBPM = this.bpm;

        this.bpm = Math.max(40, Math.min(240, bpm));

        if (this.parsedNotes.length > 0 && Math.abs(oldBPM - this.bpm) > 1) {
            const tempoRatio = oldBPM / this.bpm;

            this.parsedNotes.forEach(note => {
                note.start *= tempoRatio;
                note.duration *= tempoRatio;
            });

            this.currentPosition *= tempoRatio;

            console.log(`Recalculated timing for ${this.parsedNotes.length} notes after tempo change`);
        }

        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        const speedValue = this.analyzer.container.querySelector('.speed-value');

        if (speedControl) speedControl.value = this.bpm;
        if (speedValue) speedValue.textContent = `${this.bpm} BPM`;

        console.log(`BPM set to ${this.bpm}`);
    }

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

    updateScoreUI() {
        this.updateScoreTitle(this.scoreModel.title);

        this.showPlaybackControls();

        this.createVisualization();
    }

    addNotationOverlays(svgContainer, startPosition, endPosition) {
        let currentMeasure = 1;
        let currentBeat = 1;

        // Add safety check for the current position
        const safePosition = isNaN(this.currentPosition) || !isFinite(this.currentPosition) ?
            0 : Math.max(0, this.currentPosition);

        for (const measure of this.measureData) {
            if (safePosition >= measure.startPosition) {
                currentMeasure = measure.number;

                if (measure.startPosition <= safePosition) {
                    const nextMeasureStart = measure.index < this.measureData.length - 1
                        ? this.measureData[measure.index + 1].startPosition
                        : measure.startPosition + measure.durationSeconds;

                    const posInMeasure = (safePosition - measure.startPosition) /
                        (nextMeasureStart - measure.startPosition);

                    currentBeat = Math.floor(posInMeasure * this.timeSignatureNumerator) + 1;

                    // Ensure beat number is valid
                    if (currentBeat > this.timeSignatureNumerator || !isFinite(currentBeat)) {
                        currentBeat = this.timeSignatureNumerator;
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
            <div class="speed-info">Tempo: ${this.bpm} BPM</div>
            <div class="playback-status">${this.isPlaying ? 'Playing' : 'Paused'}</div>
            <div class="view-info">Page: ${this.currentPage + 1}/${this.totalPages}</div>
        `;

        svgContainer.appendChild(infoPanel);
    }

    // New simplified event handlers
    setupSimpleClickHandlers() {
        // Simple click for play/pause with improved event handling
        this.notationContainer.addEventListener('click', (e) => {
            // Don't trigger if clicking on specific controls
            if (e.target.closest('.notation-info-panel')) {
                return;
            }

            // Only toggle playback for direct clicks on the main areas
            if (e.target === this.notationContainer ||
                e.target.tagName === 'svg' ||
                e.target.className === 'notation-svg-container' ||
                e.target.closest('.notation-svg-container')) {
                e.preventDefault(); // Prevent any other default behaviors
                e.stopPropagation(); // Stop event from bubbling further
                this.togglePlayback();
            }
        });
    }

    // Update the play/pause button state
    updatePlayPauseButton() {
        const playPauseButton = document.querySelector('.piano-play-pause');
        if (playPauseButton) {
            // Ensure button text matches scoreModel state
            playPauseButton.textContent = this.scoreModel.isPlaying ? 'Pause' : 'Play';

            // Add visual indication of current state
            playPauseButton.classList.toggle('playing', this.scoreModel.isPlaying);
        }
    }

    /**
     * Highlight piano keys for currently playing notes
     * @param {Array} notes Array of notes to highlight
     */
    highlightPianoKeys(notes) {
        if (!this.pianoVisualizationContainer) return;

        // First remove all active highlights
        const keys = this.pianoVisualizationContainer.querySelectorAll('.piano-key');
        keys.forEach(key => key.classList.remove('active'));

        // Nothing to highlight if no notes provided
        if (!notes || notes.length === 0) return;

        // Add active class to keys for currently playing notes
        notes.forEach(note => {
            if (!note || !note.noteNumber) return;

            const key = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
            if (key) {
                key.classList.add('active');
            }
        });
    }

    startPlayback() {
        // ...existing code...
    }

}
