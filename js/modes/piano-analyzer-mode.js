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
        this.playbackSpeed = 1.0;
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

                newSpeedControl.addEventListener('input', (e) => {
                    this.playbackSpeed = parseFloat(e.target.value);
                    speedValue.textContent = `${this.playbackSpeed.toFixed(1)}x`;
                });
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

            // Process the MusicXML into a usable format
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

    parseMusicXML() {
        // Reset any existing parsed data
        this.parsedNotes = [];

        if (!this.musicXML) return;

        try {
            // Basic parsing of notes from MusicXML
            const parts = this.musicXML.getElementsByTagName('part');

            // Process each part in the score
            for (let partIndex = 0; partIndex < parts.length; partIndex++) {
                const part = parts[partIndex];
                const measures = part.getElementsByTagName('measure');

                let currentTime = 0;

                // Process each measure
                for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
                    const measure = measures[measureIndex];
                    const notes = measure.getElementsByTagName('note');

                    // Process each note in the measure
                    for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
                        const note = notes[noteIndex];

                        // Skip note if it's a rest
                        if (note.getElementsByTagName('rest').length > 0) {
                            // Get the duration of the rest
                            const duration = parseInt(note.getElementsByTagName('duration')[0]?.textContent || '0');
                            currentTime += duration / 24; // Assuming quarter note = 24 divisions
                            continue;
                        }

                        // Get pitch information
                        const pitch = note.getElementsByTagName('pitch')[0];
                        if (!pitch) continue;

                        const step = pitch.getElementsByTagName('step')[0]?.textContent;
                        const octave = parseInt(pitch.getElementsByTagName('octave')[0]?.textContent);
                        const alter = parseInt(pitch.getElementsByTagName('alter')[0]?.textContent || '0');

                        // Get duration
                        const duration = parseInt(note.getElementsByTagName('duration')[0]?.textContent || '0');
                        const durationInSeconds = duration / 24; // Simplified timing

                        // Convert pitch to MIDI note number
                        const noteNumber = this.stepOctaveToMidiNote(step, octave, alter);

                        // Add the note to our parsed collection
                        this.parsedNotes.push({
                            noteNumber,
                            start: currentTime,
                            duration: durationInSeconds,
                            step,
                            octave,
                            alter
                        });

                        // If the note isn't a chord, advance the time
                        if (!note.getElementsByTagName('chord').length) {
                            currentTime += durationInSeconds;
                        }
                    }
                }
            }

            // Sort notes by start time
            this.parsedNotes.sort((a, b) => a.start - b.start);

            console.log('Parsed notes:', this.parsedNotes);
        } catch (error) {
            console.error('Error parsing MusicXML:', error);
            throw error;
        }
    }

    // Utility function to convert note step and octave to MIDI note number
    stepOctaveToMidiNote(step, octave, alter = 0) {
        const stepValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        return (octave + 1) * 12 + stepValues[step] + alter;
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
            // Prevent click from also triggering mousedown for drag
            if (!this.isDragging) {
                this.togglePlayback();
            }
        });

        // Add mouse wheel to control playback speed
        this.notationContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.adjustPlaybackSpeed(e);
        });

        // Add drag events to scrub through music
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

        // Calculate time delta and adjust position
        const deltaTime = (timestamp - this.lastRenderTime) / 1000; // Convert to seconds
        this.lastRenderTime = timestamp;

        // Advance current position based on playback speed
        this.currentPosition += deltaTime * this.playbackSpeed;

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

        // Clear notation container - removed instructions
        this.notationContainer.innerHTML = '';

        try {
            // Show simple notation view while VexFlow loads/renders
            const loadingView = document.createElement('div');
            loadingView.className = 'simple-notation';
            loadingView.innerHTML = '<p>Loading notation...</p>';
            this.notationContainer.appendChild(loadingView);

            // Check if VexFlow is properly loaded
            if (typeof Vex === 'undefined' || typeof Vex.Flow === 'undefined') {
                // Replace with useful fallback instead of error message
                this.renderSimpleNotation();
                return;
            }

            // Create SVG container
            const svgContainer = document.createElement('div');
            svgContainer.className = 'notation-svg-container';

            // Initialize VexFlow with simpler approach
            const VF = Vex.Flow;
            const renderer = new VF.Renderer(svgContainer, VF.Renderer.Backends.SVG);
            const width = this.notationContainer.clientWidth - 20;
            const height = 240;

            // Set up renderer
            renderer.resize(width, height);
            const context = renderer.getContext();
            context.setFont("Arial", 10);

            // Create treble and bass staves
            const stave = new VF.Stave(10, 40, width - 20);
            stave.addClef("treble");
            stave.setContext(context).draw();

            const bassStave = new VF.Stave(10, 140, width - 20);
            bassStave.addClef("bass");
            bassStave.setContext(context).draw();

            // Find notes to display
            const startTime = this.currentPosition;
            const endTime = startTime + this.visibleDuration;
            const visibleNotes = this.parsedNotes
                .filter(note => note.start >= startTime && note.start < endTime)
                .sort((a, b) => a.start - b.start);

            // Create single quarter rest if no notes
            if (visibleNotes.length === 0) {
                // Create treble voice with a rest
                const trebleVoice = new VF.Voice({ num_beats: 4, beat_value: 4 });
                trebleVoice.addTickables([
                    new VF.StaveNote({ keys: ["b/4"], duration: "qr" }),
                    new VF.StaveNote({ keys: ["b/4"], duration: "qr" }),
                    new VF.StaveNote({ keys: ["b/4"], duration: "qr" }),
                    new VF.StaveNote({ keys: ["b/4"], duration: "qr" })
                ]);

                // Create bass voice with a rest
                const bassVoice = new VF.Voice({ num_beats: 4, beat_value: 4 });
                bassVoice.addTickables([
                    new VF.StaveNote({ keys: ["d/3"], duration: "qr" }),
                    new VF.StaveNote({ keys: ["d/3"], duration: "qr" }),
                    new VF.StaveNote({ keys: ["d/3"], duration: "qr" }),
                    new VF.StaveNote({ keys: ["d/3"], duration: "qr" })
                ]);

                // Format and draw voices
                new VF.Formatter().joinVoices([trebleVoice]).format([trebleVoice], width - 50);
                new VF.Formatter().joinVoices([bassVoice]).format([bassVoice], width - 50);

                trebleVoice.draw(context, stave);
                bassVoice.draw(context, bassStave);
            } else {
                // Take only a few notes to avoid overcrowding
                const displayNotes = visibleNotes.slice(0, 4);

                // Split notes between treble and bass staves
                const trebleNotes = [];
                const bassNotes = [];

                for (const note of displayNotes) {
                    try {
                        // Create note key string
                        let noteKey = note.step.toLowerCase();
                        if (note.alter === 1) noteKey += "#";
                        else if (note.alter === -1) noteKey += "b";
                        noteKey += `/${note.octave}`;

                        // Always use quarter notes for simplicity
                        const vfNote = new VF.StaveNote({
                            keys: [noteKey],
                            duration: "q"
                        });

                        // Add accidental if needed
                        if (note.alter === 1) {
                            vfNote.addModifier(new VF.Accidental("#"));
                        } else if (note.alter === -1) {
                            vfNote.addModifier(new VF.Accidental("b"));
                        }

                        // Decide which staff based on octave
                        if (note.octave >= 4) {
                            trebleNotes.push(vfNote);
                        } else {
                            bassNotes.push(vfNote);
                        }
                    } catch (err) {
                        console.warn('Error creating note:', note, err);
                    }
                }

                // Fill with rests to complete 4 beats
                while (trebleNotes.length < 4) {
                    trebleNotes.push(new VF.StaveNote({ keys: ["b/4"], duration: "qr" }));
                }

                while (bassNotes.length < 4) {
                    bassNotes.push(new VF.StaveNote({ keys: ["d/3"], duration: "qr" }));
                }

                // Format and draw - we need exactly 4 notes for each voice
                try {
                    // Create voices with exactly 4 beats
                    const trebleVoice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(true);
                    trebleVoice.addTickables(trebleNotes.slice(0, 4));

                    const bassVoice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(true);
                    bassVoice.addTickables(bassNotes.slice(0, 4));

                    // Format and draw
                    new VF.Formatter().joinVoices([trebleVoice]).format([trebleVoice], width - 50);
                    new VF.Formatter().joinVoices([bassVoice]).format([bassVoice], width - 50);

                    trebleVoice.draw(context, stave);
                    bassVoice.draw(context, bassStave);
                } catch (formattingError) {
                    console.error('Error formatting notes:', formattingError);
                    // If formatting fails, create a fallback with only rests
                    this.renderSimpleNotation();
                    return;
                }
            }

            // Replace the loading view with the SVG container
            this.notationContainer.removeChild(loadingView);
            this.notationContainer.appendChild(svgContainer);

            // Add playhead and info panel
            this.addNotationOverlays(svgContainer);

        } catch (error) {
            console.error('Error rendering notation:', error);
            // Fall back to simple text representation when VexFlow fails
            this.renderSimpleNotation();
        }
    }

    // New separate method for simple notation rendering as fallback
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
                <div class="speed-info">Speed: ${this.playbackSpeed.toFixed(1)}x</div>
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
            <div class="speed-info">Speed: ${this.playbackSpeed.toFixed(1)}x</div>
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
        const delta = Math.sign(event.deltaY) * -0.1;

        // Calculate new playback speed (between 0.5 and 3.0)
        this.playbackSpeed = Math.max(0.5, Math.min(3.0, this.playbackSpeed + delta));

        // Update UI
        const speedValue = this.analyzer.container.querySelector('.speed-value');
        if (speedValue) {
            speedValue.textContent = `${this.playbackSpeed.toFixed(1)}x`;
        }

        // Update speed slider if it exists
        const speedControl = this.analyzer.container.querySelector('.piano-speed');
        if (speedControl) {
            speedControl.value = this.playbackSpeed;
        }
    }

    // Start dragging to scrub through music
    startDragging(event) {
        this.isDragging = true;
        this.dragStartX = event.clientX;
        this.dragStartPosition = this.currentPosition;

        // Change cursor to indicate dragging
        event.currentTarget.style.cursor = 'grabbing';

        // We'll temporarily pause playback while dragging
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            // Store the playing state to resume after dragging
            event.currentTarget.dataset.wasPlaying = 'true';
            this.pausePlayback();
        } else {
            event.currentTarget.dataset.wasPlaying = 'false';
        }
    }

    // Handle dragging to scrub through music
    handleDragging(event) {
        if (!this.isDragging) return;

        // Calculate drag distance
        const dragDistance = event.clientX - this.dragStartX;

        // Convert drag distance to time position
        // The sensitivity factor controls how fast the scrubbing happens
        const sensitivity = 0.02;
        const newPosition = this.dragStartPosition + (dragDistance * sensitivity);

        // Update position (don't allow negative values)
        this.currentPosition = Math.max(0, newPosition);

        // Update visualizations
        this.renderNotation();
    }

    // Handle seeking when position changes drastically (after dragging, etc.)
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

    // Stop dragging
    stopDragging() {
        if (!this.isDragging) return;

        this.isDragging = false;

        // Reset cursor
        this.notationContainer.style.cursor = 'default';

        // Resume playback if it was playing before dragging started
        if (this.notationContainer.dataset.wasPlaying === 'true') {
            this.startPlayback();
        }

        // Handle position change after dragging
        this.handlePositionSeek();

        // Clean up
        this.notationContainer.dataset.wasPlaying = 'false';
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
                    // Map the time to note to a position from top of container
                    const percentOfLookahead = timeToNote / lookAheadTime;
                    topPosition = containerHeight * (1 - percentOfLookahead) - noteHeight;
                }

                // Position the note bar
                bar.element.style.left = `${left - (width / 2)}px`;
                bar.element.style.top = `${topPosition}px`;
                bar.element.style.width = `${width}px`;
                bar.element.style.height = `${noteHeight}px`;

                // Highlight currently playing notes
                bar.element.classList.toggle('playing', isPlaying);

                // Apply animation only when the note first appears within our window
                if (timeToNote <= lookAheadTime && timeToNote > lookAheadTime - 0.1) {
                    // Only animate if the note is just appearing at the top
                    bar.element.style.animation = `note-fall ${this.fallDuration / this.playbackSpeed}s linear`;
                }
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
}
