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

    // Process the MusicXML string data
    processMusicXMLString(xmlString, statusElement) {
        try {
            // Parse the MusicXML string into a DOM
            const parser = new DOMParser();
            this.musicXML = parser.parseFromString(xmlString, 'text/xml');

            // Check if the parsing was successful
            const parsererror = this.musicXML.getElementsByTagName('parsererror');
            if (parsererror.length > 0) {
                throw new Error('XML parsing error');
            }

            // Extract the song name if available
            const workTitle = this.musicXML.querySelector('work-title');
            const movementTitle = this.musicXML.querySelector('movement-title');
            const title = workTitle?.textContent || movementTitle?.textContent || 'Untitled Score';

            // *** Order matters: First extract ALL timing information ***

            // Reset timing properties to defaults before extraction
            this.divisions = 24;
            this.timeSignatureNumerator = 4;
            this.timeSignatureDenominator = 4;
            this.bpm = 120;

            // Extract divisions (ticks per quarter note) from the MusicXML
            this.extractDivisionsFromMusicXML(this.musicXML);

            // Extract time signature
            this.extractTimeSignatureFromMusicXML(this.musicXML);

            // Extract tempo information if available
            const tempo = this.extractTempoFromMusicXML(this.musicXML);
            if (tempo) {
                this.bpm = tempo;

                // Update UI controls
                const speedControl = this.analyzer.container.querySelector('.piano-speed');
                const speedValue = this.analyzer.container.querySelector('.speed-value');
                if (speedControl && speedValue) {
                    speedControl.value = this.bpm;
                    speedValue.textContent = `${this.bpm} BPM`;
                }

                console.log(`File tempo set to ${this.bpm} BPM with time signature ${this.timeSignatureNumerator}/${this.timeSignatureDenominator}, divisions: ${this.divisions}`);
            }

            // Now parse notes with correct timing information
            this.parseMusicXML();

            // Show success message with song title
            statusElement.textContent = `Loaded: ${title}`;

            // Set song title in visualization
            const songNameElement = document.querySelector('.piano-song-name');
            if (songNameElement) {
                songNameElement.textContent = title;
            }

            // Show playback controls
            const playbackControls = this.analyzer.container.querySelector('.piano-playback-controls');
            if (playbackControls) {
                playbackControls.style.display = 'flex';
            }

            // Create piano visualization
            this.createVisualization();
        } catch (error) {
            console.error('Error processing MusicXML:', error);
            statusElement.textContent = 'Error processing MusicXML file. Please try another file.';
        }
    }

    // Add a new method to extract tempo from MusicXML
    extractTempoFromMusicXML(musicXML) {
        try {
            // Look for tempo markings in the MusicXML
            const tempoElements = musicXML.querySelectorAll('sound[tempo]');
            if (tempoElements && tempoElements.length > 0) {
                // Use the first tempo marking found
                const tempo = parseInt(tempoElements[0].getAttribute('tempo'));
                if (!isNaN(tempo) && tempo > 0) {
                    return tempo;
                }
            }

            // If no tempo found, return default
            return this.bpm;
        } catch (error) {
            console.error('Error extracting tempo:', error);
            return this.bpm;
        }
    }

    // Extract divisions value from MusicXML
    extractDivisionsFromMusicXML(musicXML) {
        try {
            const divisionsElements = musicXML.querySelectorAll('divisions');
            if (divisionsElements && divisionsElements.length > 0) {
                const divisionsValue = parseInt(divisionsElements[0].textContent);
                if (!isNaN(divisionsValue) && divisionsValue > 0) {
                    this.divisions = divisionsValue;
                    console.log(`Extracted divisions: ${this.divisions} ticks per quarter note`);
                    return;
                }
            }
            // If not found, keep default value
            console.log(`Using default divisions: ${this.divisions} ticks per quarter note`);
        } catch (error) {
            console.error('Error extracting divisions:', error);
        }
    }

    // Extract time signature from MusicXML
    extractTimeSignatureFromMusicXML(musicXML) {
        try {
            const timeElements = musicXML.querySelectorAll('time');
            if (timeElements && timeElements.length > 0) {
                const beats = parseInt(timeElements[0].querySelector('beats')?.textContent);
                const beatType = parseInt(timeElements[0].querySelector('beat-type')?.textContent);

                if (!isNaN(beats) && beats > 0 && !isNaN(beatType) && beatType > 0) {
                    this.timeSignatureNumerator = beats;
                    this.timeSignatureDenominator = beatType;
                    console.log(`Extracted time signature: ${beats}/${beatType}`);
                    return;
                }
            }
            // If not found, keep default values
            console.log(`Using default time signature: ${this.timeSignatureNumerator}/${this.timeSignatureDenominator}`);
        } catch (error) {
            console.error('Error extracting time signature:', error);
        }
    }

    parseMusicXML() {
        // Reset any existing parsed data
        this.parsedNotes = [];

        if (!this.musicXML) return;

        try {
            console.log("Parsing MusicXML with divisions:", this.divisions,
                "time signature:", this.timeSignatureNumerator + "/" + this.timeSignatureDenominator,
                "BPM:", this.bpm);

            // Basic parsing of notes from MusicXML
            const parts = this.musicXML.getElementsByTagName('part');

            // Process each part in the score
            for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                const part = parts[partIndex];
                const measures = part.getElementsByTagName('measure');

                // Stores notes by ID to handle ties
                const tiedNoteMap = new Map();
                let currentTime = 0;

                // Process each measure
                for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
                    const measure = measures[measureIndex];

                    // Check for mid-measure time/tempo changes
                    const timeChanges = Array.from(measure.querySelectorAll('time'));
                    if (timeChanges.length > 0) {
                        // Get the new time signature if present
                        const beats = parseInt(timeChanges[0].querySelector('beats')?.textContent);
                        const beatType = parseInt(timeChanges[0].querySelector('beat-type')?.textContent);
                        if (!isNaN(beats) && beats > 0 && !isNaN(beatType) && beatType > 0) {
                            this.timeSignatureNumerator = beats;
                            this.timeSignatureDenominator = beatType;
                            console.log(`Mid-measure time signature change: ${beats}/${beatType}`);
                        }
                    }

                    // Check for tempo changes
                    const tempoChanges = Array.from(measure.querySelectorAll('sound[tempo]'));
                    if (tempoChanges.length > 0) {
                        const tempo = parseInt(tempoChanges[0].getAttribute('tempo'));
                        if (!isNaN(tempo) && tempo > 0) {
                            this.bpm = tempo;
                            console.log(`Mid-measure tempo change: ${tempo} BPM`);
                        }
                    }

                    // Check for divisions changes
                    const divisionChanges = Array.from(measure.querySelectorAll('divisions'));
                    if (divisionChanges.length > 0) {
                        const divisions = parseInt(divisionChanges[0].textContent);
                        if (!isNaN(divisions) && divisions > 0) {
                            this.divisions = divisions;
                            console.log(`Mid-measure divisions change: ${divisions}`);
                        }
                    }

                    // Group notes by sequence for simultaneous events (chords)
                    let currentChordNotes = [];
                    let inChord = false;
                    const notes = measure.querySelectorAll('note');

                    for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
                        const note = notes[noteIndex];

                        // Is this note part of a chord?
                        const isChordNote = note.querySelector('chord') !== null;

                        // Handle closing previous chord if needed
                        if (inChord && !isChordNote) {
                            // Apply chord note timings and add to parsed notes
                            this.processChordNotes(currentChordNotes, currentTime);
                            currentChordNotes = [];
                            inChord = false;
                        }

                        // Get duration info - needed even for rests
                        const durationElement = note.querySelector('duration');
                        if (!durationElement) continue; // Skip if no duration

                        const duration = parseInt(durationElement.textContent);
                        if (isNaN(duration)) continue; // Skip if invalid duration

                        // Handle rests - just advance time and continue
                        if (note.querySelector('rest')) {
                            if (!isChordNote) { // Only advance time on non-chord rests
                                currentTime += this.ticksToSeconds(duration);
                            }
                            continue;
                        }

                        // Parse pitch information
                        const pitch = note.querySelector('pitch');
                        if (!pitch) continue;

                        const step = pitch.querySelector('step')?.textContent;
                        const octave = parseInt(pitch.querySelector('octave')?.textContent);
                        const alter = parseInt(pitch.querySelector('alter')?.textContent || '0');

                        if (!step || isNaN(octave)) continue;

                        // Note start time depends on whether it's a chord note
                        const noteStart = inChord ? currentTime : currentTime;

                        // Convert to seconds for playback
                        const durationSeconds = this.ticksToSeconds(duration);

                        // Convert to MIDI note number
                        const noteNumber = this.stepOctaveToMidiNote(step, octave, alter);

                        // Check if this note is tied
                        const tie = note.querySelectorAll('tie');
                        const tieStart = Array.from(tie).some(t => t.getAttribute('type') === 'start');
                        const tieEnd = Array.from(tie).some(t => t.getAttribute('type') === 'stop');

                        // Get note ID if available
                        const noteId = note.id || `${noteNumber}-${noteStart}`;

                        // Create note object
                        const noteObj = {
                            noteNumber,
                            start: noteStart,
                            duration: durationSeconds,
                            step,
                            octave,
                            alter,
                            tickDuration: duration,
                            isChordNote: isChordNote,
                            isTieStart: tieStart,
                            isTieEnd: tieEnd,
                            id: noteId
                        };

                        // Handle tied notes
                        if (tieEnd) {
                            // Find the matching start note
                            const tieKey = `${noteNumber}`;
                            if (tiedNoteMap.has(tieKey)) {
                                const startNote = tiedNoteMap.get(tieKey);
                                // Extend duration of the start note
                                startNote.duration += durationSeconds;
                                // Not adding this note separately since it's just an extension
                                console.log(`Extended tied note: ${noteNumber} with ${durationSeconds}s`);
                            } else {
                                // If we couldn't find the tie start, add this note anyway
                                this.parsedNotes.push(noteObj);
                            }
                        }
                        // Store tie start note or regular note
                        else {
                            if (tieStart) {
                                // Store for potential later tie
                                const tieKey = `${noteNumber}`;
                                tiedNoteMap.set(tieKey, noteObj);
                            }

                            // Add to chord notes or directly to parsed notes
                            if (isChordNote) {
                                currentChordNotes.push(noteObj);
                                inChord = true;
                            } else {
                                this.parsedNotes.push(noteObj);
                            }
                        }

                        // If not a chord note, advance time
                        if (!isChordNote && !inChord) {
                            currentTime += durationSeconds;
                        }
                    }

                    // Handle any remaining chord notes at the end of the measure
                    if (currentChordNotes.length > 0) {
                        this.processChordNotes(currentChordNotes, currentTime);
                    }
                }
            }

            // Sort notes by start time
            this.parsedNotes.sort((a, b) => a.start - b.start);

            // Validate and debug output the first few notes
            if (this.parsedNotes.length > 0) {
                console.log('First 5 parsed notes:', this.parsedNotes.slice(0, 5));
                console.log('Last 5 parsed notes:', this.parsedNotes.slice(-5));
                console.log(`Total parsed notes: ${this.parsedNotes.length}`);
            } else {
                console.warn('No notes were parsed from the MusicXML');
            }
        } catch (error) {
            console.error('Error parsing MusicXML:', error);
            throw error;
        }
    }

    // Helper method to process chord notes as a group
    processChordNotes(chordNotes, startTime) {
        if (chordNotes.length === 0) return;

        // All notes in the chord share the same start time
        chordNotes.forEach(note => {
            note.start = startTime;
            this.parsedNotes.push(note);
        });
    }

    // Convert ticks to seconds based on REFERENCE tempo and TIME SIGNATURE
    ticksToSeconds(ticks) {
        if (!ticks || ticks <= 0) return 0;

        // Quarter note duration in seconds at the current tempo
        const quarterNoteSeconds = 60 / this.bpm;

        // Convert ticks to quarter note fraction
        const quarterNoteFraction = ticks / this.divisions;

        // Apply time signature adjustment
        // For example, in 6/8, an eighth note is counted as one beat, not a quarter note
        const beatUnitFactor = 4 / this.timeSignatureDenominator;

        // Final duration calculation with all factors considered
        return quarterNoteFraction * quarterNoteSeconds * beatUnitFactor;
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

        // Re-render notation periodically (not every frame)
        if (Math.floor(this.currentPosition * 2) > Math.floor((this.currentPosition - deltaTime) * 2)) {
            this.renderNotation();
        }

        // Update note bars - add this new function call
        this.updateNoteBars();

        // Find notes that should be triggered at current position
        const notesToPlay = this.parsedNotes.filter(
            note => note.start <= this.currentPosition &&
                note.start + note.duration > this.currentPosition
        );

        // Highlight keys for notes currently playing
        this.highlightPianoKeys(notesToPlay);

        // Check if we've reached the end of the song
        const lastNote = this.parsedNotes[this.parsedNotes.length - 1];
        if (lastNote && this.currentPosition > lastNote.start + lastNote.duration + 2) {
            // End of song, reset to beginning
            this.currentPosition = 0;
        }

        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.updatePlayback.bind(this));
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

    updateNoteBars() {
        if (!this.noteBarContainer || !this.parsedNotes.length) return;

        // Clear existing note bars if playback has restarted
        if (this.currentPosition < 0.1 && this.noteBars.length > 0) {
            this.noteBarContainer.innerHTML = '';
            this.noteBars = [];
        }

        // Get the container dimensions
        const containerHeight = this.keyboardContainer.clientHeight;
        const containerWidth = this.keyboardContainer.clientWidth;

        // Calculate which notes should be visible (within look-ahead window)
        const startTime = this.currentPosition;
        const endTime = startTime + this.noteBarLookAhead;

        // Find which notes should be visible
        const visibleNotes = this.parsedNotes.filter(note =>
            (note.start >= startTime && note.start <= endTime) || // Notes starting within window
            (note.start < startTime && note.start + note.duration > startTime) // Notes already playing
        );

        // Add new note bars for notes that don't have them yet
        visibleNotes.forEach(note => {
            // Check if this note already has a bar
            const existingBar = this.noteBars.find(bar => bar.noteId === note.noteNumber + '-' + note.start);

            if (!existingBar) {
                this.createNoteBar(note, containerHeight);
            }
        });

        // Update positions of all note bars
        this.updateNoteBarsPosition();

        // Remove note bars that are finished and far behind current position
        const cleanupThreshold = startTime - 1; // Remove notes 1 second behind current position
        this.noteBars = this.noteBars.filter(bar => {
            const note = bar.note;
            const isFinished = note.start + note.duration < cleanupThreshold;

            if (isFinished) {
                if (bar.element && bar.element.parentNode) {
                    bar.element.parentNode.removeChild(bar.element);
                }
                return false;
            }
            return true;
        });
    }

    // Create a new note bar element
    createNoteBar(note, containerHeight) {
        // Get piano key element to match position and width
        const keyElement = this.pianoVisualizationContainer.querySelector(`.piano-key[data-note="${note.noteNumber}"]`);
        if (!keyElement) return;

        // Create the note bar element
        const noteBar = document.createElement('div');
        noteBar.className = 'note-bar';

        // Make sure no transition or animation is applied initially
        noteBar.style.transition = 'none';
        noteBar.style.animation = 'none';

        // Add class for black keys
        const isBlackKey = [1, 3, 6, 8, 10].includes(note.noteNumber % 12);
        if (isBlackKey) {
            noteBar.classList.add('black-note');
        }

        // Determine hand (left or right) based on note number
        // This is a simple approximation - middle C (60) and above is right hand
        if (note.noteNumber >= 60) {
            noteBar.classList.add('right-hand');
        } else {
            noteBar.classList.add('left-hand');
        }

        // Set the note bar ID for tracking
        const noteId = note.noteNumber + '-' + note.start;
        noteBar.dataset.noteId = noteId;

        // Add to container
        this.noteBarContainer.appendChild(noteBar);

        // Store reference to this bar
        this.noteBars.push({
            noteId: noteId,
            element: noteBar,
            note: note,
            keyElement: keyElement
        });
    }

    // Update positions of all note bars based on current playback position
    updateNoteBarsPosition() {
        if (!this.noteBarContainer || !this.noteBars.length) return;

        // Get the full container height for the falling notes
        const containerHeight = this.noteBarContainer.clientHeight;

        // Calculate the window where notes should be visible
        // Convert time to position in the container
        const lookAheadTime = this.noteBarLookAhead;

        this.noteBars.forEach(bar => {
            const note = bar.note;
            const keyElement = bar.keyElement;

            if (!keyElement || !bar.element) return;

            // Get key position relative to container for horizontal alignment
            const keyRect = keyElement.getBoundingClientRect();
            const containerRect = this.keyboardContainer.getBoundingClientRect();

            // Calculate left position (center of the key)
            const left = keyRect.left - containerRect.left + (keyRect.width / 2);

            // Calculate width based on key type
            const isBlackKey = keyElement.classList.contains('black-key');
            const width = isBlackKey ? 14 : 22; // Slightly narrower than keys for visual separation

            // Calculate timing information
            const noteStart = note.start;
            const noteDuration = note.duration;
            const noteEnd = noteStart + noteDuration;

            // Calculate how far in advance the note should appear (in pixels)
            // Map the time difference between note start and current position to pixel space
            const timeToNote = noteStart - this.currentPosition;

            // Only show notes that are within our lookahead window or currently playing
            const isPlaying = noteStart <= this.currentPosition &&
                noteStart + noteDuration > this.currentPosition;

            const isUpcoming = timeToNote >= 0 && timeToNote < lookAheadTime;
            const isVisible = isPlaying || isUpcoming;

            if (isVisible) {
                // Make the note visible
                bar.element.style.display = 'block';

                // Calculate vertical position
                // For playing notes: position relative to current time
                // For upcoming notes: position based on how far in the future they are

                // Height of note is proportional to duration
                const noteHeight = Math.max(20, noteDuration * containerHeight / lookAheadTime * 0.8);

                // Position is based on time difference
                let topPosition;

                if (isPlaying) {
                    // For notes currently playing, position them based on how much of the note has been played
                    const percentPlayed = (this.currentPosition - noteStart) / noteDuration;
                    topPosition = containerHeight - (noteHeight * (1 - percentPlayed));
                } else {
                    // For upcoming notes, position them based on when they will be played
                    const percentOfLookahead = timeToNote / lookAheadTime;
                    topPosition = containerHeight * (1 - percentOfLookahead) - noteHeight;
                }

                // Position the note bar - REMOVE ANIMATION, use pure JS positioning
                bar.element.style.left = `${left - (width / 2)}px`;
                bar.element.style.top = `${topPosition}px`;
                bar.element.style.width = `${width}px`;
                bar.element.style.height = `${noteHeight}px`;

                // Remove any animations that might be interfering with positioning
                bar.element.style.animation = 'none';

                // Highlight currently playing notes
                bar.element.classList.toggle('playing', isPlaying);
            } else {
                // Hide notes outside our window
                bar.element.style.display = 'none';
            }
        });
    }

    handleScroll(event) {
        // Now handled by adjustPlaybackSpeed
        this.adjustPlaybackSpeed(event);
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
