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

        // Add navigation mode state
        this.navigationMode = false;
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

            // Get current position from score model
            this.currentPosition = data.position;

            // Find current measure
            const currentMeasureIndex = this.findCurrentMeasureIndex();

            // Check if we need to change page
            const expectedPage = Math.floor(currentMeasureIndex / this.measuresPerPage);
            if (expectedPage !== this.currentPage) {
                this.currentPage = expectedPage;
                // Force notation redraw on page change
                this.renderNotation();
                return; // Early return as renderNotation will handle everything
            }

            // Normal updates if page didn't change
            requestAnimationFrame(() => {
                this.updateNoteBars();

                // Don't update notation on every frame for performance reasons
                if (Math.floor(data.position * 2) > Math.floor((data.previousPosition || 0) * 2)) {
                    this.renderNotation();
                }

                // Highlight piano keys
                const playingNotes = this.scoreModel.getCurrentlyPlayingNotes();
                this.highlightPianoKeys(playingNotes);
            });
        });

        // Listen for tempo changes to update UI
        this.scoreModel.addEventListener('tempochange', (data) => {
            this.updateTempoDisplay(data.tempo);
        });

        // Listen for play/pause events to update UI
        this.scoreModel.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseButton();

            // Resume animations in the note bar container
            if (this.noteBarContainer) {
                this.noteBarContainer.classList.remove('paused');
            }
        });

        this.scoreModel.addEventListener('pause', () => {
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

        const isRightHand = note.staff === 1 || note.noteNumber >= 60;
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

        const containerRect = this.keyboardContainer.getBoundingClientRect();
        const keyPositions = new Map();

        const timeToPixelRatio = containerHeight / lookAheadTime;

        const MIN_NOTE_HEIGHT = 8;

        const currentTime = this.scoreModel.currentPosition;

        this.noteBars.forEach(bar => {
            const note = bar.note;
            const element = bar.element;

            if (!element) return;

            const keyElement = bar.keyElement;
            if (!keyElement) return;

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

            const isPlaying = noteStart <= currentTime && noteEnd > currentTime;
            const isUpcoming = noteStart > currentTime && noteStart <= currentTime + lookAheadTime;
            const isPartiallyVisible = noteStart < currentTime && noteEnd > currentTime;
            const isPassed = noteEnd <= currentTime && noteEnd > currentTime - 0.5;

            const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

            if (isVisible) {
                element.style.display = 'block';

                const noteHeight = Math.max(MIN_NOTE_HEIGHT, noteDuration * timeToPixelRatio);

                let topPosition;

                if (isPlaying) {
                    const elapsedTime = currentTime - noteStart;
                    const remainingDuration = Math.max(0, noteDuration - elapsedTime);
                    const remainingHeight = remainingDuration * timeToPixelRatio;

                    topPosition = containerHeight - remainingHeight;
                }
                else if (isUpcoming) {
                    const timeToStart = noteStart - currentTime;
                    const distanceFromBottom = timeToStart * timeToPixelRatio;

                    topPosition = containerHeight - distanceFromBottom - noteHeight;
                }
                else if (isPartiallyVisible) {
                    const elapsedTime = currentTime - noteStart;
                    const remainingDuration = Math.max(0, noteDuration - elapsedTime);
                    const remainingHeight = remainingDuration * timeToPixelRatio;

                    topPosition = containerHeight - remainingHeight;
                }
                else if (isPassed) {
                    const timeSinceEnd = currentTime - noteEnd;
                    const opacity = Math.max(0, 0.5 - timeSinceEnd);
                    element.style.opacity = opacity.toString();

                    topPosition = containerHeight;
                }

                element.style.transform = `translate3d(${keyPosition.left - (keyPosition.width / 2)}px, ${topPosition}px, 0)`;
                element.style.width = `${keyPosition.width}px`;
                element.style.height = `${noteHeight}px`;

                element.classList.toggle('playing', isPlaying);

                if (note.staccato) {
                    element.style.height = `${noteHeight * 0.7}px`;
                }

                if (note.accent) {
                    element.style.opacity = '0.95';
                }

                if (note.dynamic) {
                    element.classList.add(`dynamic-${note.dynamic}`);
                }
            } else {
                element.style.display = 'none';
            }
        });
    }

    cleanupInvisibleNoteBars(startTime) {
        const cleanupThreshold = startTime - 1.0;

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
                <div class="navigation-mode-indicator">Navigation Mode</div>
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
        this.navigationIndicator = this.pianoVisualizationContainer.querySelector('.navigation-mode-indicator');

        // Hide the navigation indicator initially
        this.navigationIndicator.style.display = 'none';

        this.generatePianoKeyboard();

        this.closeButton.addEventListener('click', () => {
            this.closePianoVisualization();
        });

        // Replace old mouse event handlers with new navigation mode handlers
        this.setupNavigationHandlers();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.navigationMode) {
                    // If in navigation mode, exit it
                    this.toggleNavigationMode(false);
                } else if (this.pianoVisualizationContainer.style.display !== 'none') {
                    // Otherwise close the visualization
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

        const deltaTime = (timestamp - this.lastRenderTime) / 1000;
        this.lastRenderTime = timestamp;

        this.currentPosition += deltaTime;

        this.updateTempoAtPosition();

        if (Math.floor(this.currentPosition * 2) > Math.floor((this.currentPosition - deltaTime) * 2)) {
            this.renderNotation();
        }

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

        this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
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

        // Clear notation container
        this.notationContainer.innerHTML = '';

        try {
            // Create SVG container with improved dimensions
            const svgContainer = document.createElement('div');
            svgContainer.className = 'notation-svg-container';
            svgContainer.style.width = '100%';
            svgContainer.style.height = '100%';
            this.notationContainer.appendChild(svgContainer);

            // Create page navigation controls
            const pageControls = document.createElement('div');
            pageControls.className = 'notation-page-controls';

            const prevButton = document.createElement('button');
            prevButton.className = 'page-nav prev-page';
            prevButton.innerHTML = '&laquo; Prev';
            prevButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.goToPreviousPage();
            });

            const pageDisplay = document.createElement('span');
            pageDisplay.className = 'page-display';

            const nextButton = document.createElement('button');
            nextButton.className = 'page-nav next-page';
            nextButton.innerHTML = 'Next &raquo;';
            nextButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.goToNextPage();
            });

            pageControls.appendChild(prevButton);
            pageControls.appendChild(pageDisplay);
            pageControls.appendChild(nextButton);

            this.notationContainer.appendChild(pageControls);

            // Initialize VexFlow
            const VF = Vex.Flow;

            // Calculate dimensions based on container size with better margins
            const containerWidth = this.notationContainer.clientWidth;
            const containerHeight = this.notationContainer.clientHeight;

            // Use full container width with small margins
            const width = containerWidth - 40;
            const height = containerHeight - 40;

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

            // Update page display
            pageDisplay.textContent = `Page ${this.currentPage + 1} of ${this.totalPages}`;
            prevButton.disabled = this.currentPage === 0;
            nextButton.disabled = this.currentPage >= this.totalPages - 1;

            // Get time bounds from measure data
            const startPosition = this.measureData[startMeasureIndex].startPosition;
            const endPosition = endMeasureIndex < this.measureData.length - 1
                ? this.measureData[endMeasureIndex + 1].startPosition
                : startPosition + this.measureData[endMeasureIndex].durationSeconds;

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

            // Draw playhead at current position
            this.drawPlayheadAtCurrentPosition(context, staves, startMeasureIndex, endMeasureIndex);

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

                    // Add accidentals
                    noteGroup.forEach((note, i) => {
                        if (note.alter === 1) vfNote.addAccidental(i, new VF.Accidental("#"));
                        else if (note.alter === -1) vfNote.addAccidental(i, new VF.Accidental("b"));
                    });

                    // Add articulations to the first note in the group
                    if (firstNote.staccato) vfNote.addArticulation(0, new VF.Articulation('a.').setPosition(3));
                    if (firstNote.accent) vfNote.addArticulation(0, new VF.Articulation('a>').setPosition(3));
                    if (firstNote.tenuto) vfNote.addArticulation(0, new VF.Articulation('a-').setPosition(3));

                    // Highlight currently playing notes
                    const isNowPlaying = noteGroup.some(note => {
                        const duration = note.visualDuration || note.duration;
                        return note.start <= this.currentPosition &&
                            (note.start + duration) > this.currentPosition;
                    });

                    if (isNowPlaying) {
                        vfNote.setStyle({
                            fillStyle: 'rgba(0, 150, 215, 0.8)',
                            strokeStyle: 'rgba(0, 150, 215, 0.9)'
                        });
                    }

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

        // Add page controls
        const pageControls = document.createElement('div');
        pageControls.className = 'simple-page-controls';
        pageControls.innerHTML = `
            <button class="page-nav prev-page">&laquo; Previous</button>
            <span>Page ${this.currentPage + 1} of ${this.totalPages}</span>
            <button class="page-nav next-page">Next &raquo;</button>
        `;

        // Add event listeners
        pageControls.querySelector('.prev-page').addEventListener('click', () => this.goToPreviousPage());
        pageControls.querySelector('.next-page').addEventListener('click', () => this.goToNextPage());

        // Add header with position info
        simpleNotation.innerHTML = `
            <h3>Notes for Measures ${startMeasureIndex + 1}-${endMeasureIndex + 1}</h3>
            <div class="position-info">Position: ${this.currentPosition.toFixed(2)}s</div>
            <div class="playback-status">${this.isPlaying ? 'Playing' : 'Paused'}</div>
        `;

        // Add the page controls
        simpleNotation.appendChild(pageControls);

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

    drawPlayheadAtCurrentPosition(context, staves, startMeasureIndex, endMeasureIndex) {
        const currentPosition = this.scoreModel.currentPosition;

        for (let i = 0; i < staves.measureIndices.length; i++) {
            const measureIndex = staves.measureIndices[i];

            if (measureIndex < this.measureData.length) {
                const measureStartTime = this.measureData[measureIndex].startPosition;
                const measureEndTime = measureIndex < this.measureData.length - 1
                    ? this.measureData[measureIndex + 1].startPosition
                    : measureStartTime + this.measureData[measureIndex].durationSeconds;

                if (currentPosition >= measureStartTime && currentPosition < measureEndTime) {
                    const measurePos = (currentPosition - measureStartTime) /
                        (measureEndTime - measureStartTime);

                    const trebleStave = staves.treble[i];
                    const bassStave = staves.bass[i];

                    if (!trebleStave || !bassStave) continue;

                    const staveX = trebleStave.getX();
                    const staveWidth = trebleStave.getWidth();

                    const playheadX = staveX + (staveWidth * measurePos);

                    context.save();
                    context.beginPath();
                    const systemStartY = trebleStave.getY() - 10;
                    const systemEndY = bassStave.getY() + bassStave.getHeight() + 10;

                    context.moveTo(playheadX, systemStartY);
                    context.lineTo(playheadX, systemEndY);
                    context.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                    context.lineWidth = 2;
                    context.stroke();
                    context.restore();

                    return;
                }
            }
        }
    }

    togglePlayback() {
        if (this.scoreModel.isPlaying) {
            this.scoreModel.pause();
        } else {
            this.scoreModel.play();
        }
    }

    startPlayback() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastRenderTime = performance.now();

        const playPauseButton = document.querySelector('.piano-play-pause');
        if (playPauseButton) {
            playPauseButton.textContent = 'Pause';
        }

        if (this.noteBarContainer) {
            this.noteBarContainer.classList.remove('paused');
        }

        this.updateNoteBars();

        this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
    }

    pausePlayback() {
        this.isPlaying = false;

        const playPauseButton = document.querySelector('.piano-play-pause');
        if (playPauseButton) {
            playPauseButton.textContent = 'Play';
        }

        if (this.noteBarContainer) {
            this.noteBarContainer.classList.add('paused');
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    highlightPianoKeys(notes) {
        if (!this.pianoVisualizationContainer) return;

        const keys = this.pianoVisualizationContainer.querySelectorAll('.piano-key');
        keys.forEach(key => key.classList.remove('active'));

        notes.forEach(note => {
            const key = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
            if (key) {
                key.classList.add('active');
            }
        });
    }

    adjustPlaybackSpeed(event) {
        const delta = Math.sign(event.deltaY) * -5;

        this.bpm = Math.max(40, Math.min(240, this.bpm + delta));

        const speedValue = this.analyzer.container.querySelector('.speed-value');
        if (speedValue) {
            speedValue.textContent = `${this.bpm} BPM`;
        }

        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        if (speedControl) {
            speedControl.value = this.bpm;
        }

        console.log(`BPM adjusted to ${this.bpm} via scroll`);
    }

    closePianoVisualization() {
        this.scoreModel.pause();

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

        for (const measure of this.measureData) {
            if (this.currentPosition >= measure.startPosition) {
                currentMeasure = measure.number;

                if (measure.startPosition <= this.currentPosition) {
                    const nextMeasureStart = measure.index < this.measureData.length - 1
                        ? this.measureData[measure.index + 1].startPosition
                        : measure.startPosition + measure.durationSeconds;

                    const posInMeasure = (this.currentPosition - measure.startPosition) /
                        (nextMeasureStart - measure.startPosition);

                    currentBeat = Math.floor(posInMeasure * this.timeSignatureNumerator) + 1;
                    if (currentBeat > this.timeSignatureNumerator) currentBeat = this.timeSignatureNumerator;
                }
            } else {
                break;
            }
        }

        const infoPanel = document.createElement('div');
        infoPanel.className = 'notation-info-panel';
        infoPanel.innerHTML = `
            <div class="position-info">Position: ${this.currentPosition.toFixed(1)}s</div>
            <div class="measure-info">Measure: ${currentMeasure}, Beat: ${currentBeat}</div>
            <div class="speed-info">Tempo: ${this.bpm} BPM</div>
            <div class="playback-status">${this.isPlaying ? 'Playing' : 'Paused'}</div>
            <div class="view-info">Page: ${this.currentPage + 1}/${this.totalPages}</div>
            ${this.navigationMode ? '<div class="nav-info">Navigation Mode: Double-click to exit</div>' :
                '<div class="nav-info">Double-click to enter Navigation Mode</div>'}
        `;

        svgContainer.appendChild(infoPanel);
    }

    // Setup navigation handlers - completely rewritten to remove all drag functionality outside navigation mode
    setupNavigationHandlers() {
        // Double click toggles navigation mode
        this.notationContainer.addEventListener('dblclick', (e) => {
            // Toggle navigation mode on double click
            this.toggleNavigationMode(!this.navigationMode);
            e.preventDefault();
        });

        // Single click for play/pause (when not in navigation mode)
        this.notationContainer.addEventListener('click', (e) => {
            if (!this.navigationMode) {
                this.togglePlayback();
            }
        });

        // Mouse wheel event for page navigation (only in navigation mode)
        this.notationContainer.addEventListener('wheel', (e) => {
            if (this.navigationMode) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    // Scroll up = previous page
                    this.goToPreviousPage();
                } else {
                    // Scroll down = next page
                    this.goToNextPage();
                }
            }
        });

        // Mouse move for position seeking (only in navigation mode)
        this.notationContainer.addEventListener('mousemove', (e) => {
            if (this.navigationMode) {
                this.handleNavigationMouseMove(e);
            }
        });
    }

    // Toggle navigation mode on/off
    toggleNavigationMode(enable) {
        this.navigationMode = enable;

        // Show/hide navigation indicator
        if (this.navigationIndicator) {
            this.navigationIndicator.style.display = enable ? 'block' : 'none';
        }

        // Update cursor style
        this.notationContainer.style.cursor = enable ? 'crosshair' : 'pointer';

        // Add/remove class to notation container
        this.notationContainer.classList.toggle('navigation-mode', enable);

        console.log(`Navigation mode ${enable ? 'enabled' : 'disabled'}`);
    }

    // Handle mouse movement in navigation mode - improved to be the only method that changes playback position
    handleNavigationMouseMove(e) {
        if (!this.navigationMode) return;

        // Get mouse position relative to notation container
        const rect = this.notationContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find the current measure indices for this page
        const startMeasureIndex = this.currentPage * this.measuresPerPage;
        const endMeasureIndex = Math.min(
            this.measureData.length - 1,
            startMeasureIndex + this.measuresPerPage - 1
        );

        // Calculate which measure based on horizontal position
        const measureWidth = rect.width / this.measuresPerPage;
        const measureOffset = Math.floor(x / measureWidth);
        const targetMeasureIndex = startMeasureIndex + measureOffset;

        // Ensure valid measure index
        if (targetMeasureIndex >= 0 && targetMeasureIndex <= endMeasureIndex) {
            const measureData = this.measureData[targetMeasureIndex];
            if (!measureData) return;

            // Calculate position within measure based on x position
            const measureX = x - (measureOffset * measureWidth);
            const measurePosition = measureX / measureWidth; // 0-1 position within measure

            // Calculate time within measure
            const measureStartTime = measureData.startPosition;
            const measureDuration = measureData.durationSeconds;
            const targetTime = measureStartTime + (measurePosition * measureDuration);

            // Update position
            this.scoreModel.seekTo(targetTime);

            // Provide visual feedback
            this.renderNotation();
        }
    }
}
