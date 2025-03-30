/**
 * Creates a gentle notification sound using the Web Audio API
 */
class NotificationSound {
    constructor() {
        this.audioContext = null;
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async play() {
        try {
            await this.init();

            // Create oscillator and gain node
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            // Connect nodes
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Configure sound
            const now = this.audioContext.currentTime;

            // Use a soft sine wave
            oscillator.type = 'sine';

            // Gentle notification tone
            oscillator.frequency.setValueAtTime(587.33, now); // D5
            oscillator.frequency.setValueAtTime(880, now + 0.1); // A5

            // Fade in and out for a smoother sound
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.3);

            // Start and stop
            oscillator.start(now);
            oscillator.stop(now + 0.3);

            return new Promise(resolve => {
                setTimeout(resolve, 300);
            });
        } catch (error) {
            console.warn('Error playing notification sound:', error);
        }
    }
}

export default NotificationSound;
