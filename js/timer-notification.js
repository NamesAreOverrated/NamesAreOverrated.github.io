import NotificationSound from './notification-sound.js';

class TimerNotification {
    constructor() {
        this.notificationEnabled = JSON.parse(localStorage.getItem('timerNotificationEnabled') || 'true');
        this.soundEnabled = JSON.parse(localStorage.getItem('timerSoundEnabled') || 'true');
        this.permission = Notification.permission;
        this.notificationSound = new NotificationSound();

        // Initialize UI state
        this.initializeUI();
        this.setupEventListeners();

        // Initialize audio context on user interaction
        document.addEventListener('click', () => {
            this.notificationSound.init().catch(console.warn);
        }, { once: true });
    }

    initializeUI() {
        // Update notification status
        this.updateNotificationUI();

        // Set initial sound toggle state
        document.getElementById('sound-toggle').checked = this.soundEnabled;
    }

    setupEventListeners() {
        // Notification permission button
        document.getElementById('notification-permission').addEventListener('click', () => this.requestPermission());

        document.getElementById('sound-toggle').addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
            localStorage.setItem('timerSoundEnabled', this.soundEnabled);
        });
    }

    updateNotificationUI() {
        const statusContainer = document.querySelector('.notification-status');
        const statusText = statusContainer.querySelector('.status-text');
        const permissionBtn = document.getElementById('notification-permission');

        if (this.permission === 'granted' && this.notificationEnabled) {
            statusContainer.classList.remove('disabled');
            statusContainer.classList.add('enabled');
            statusText.textContent = 'Enabled';
            permissionBtn.textContent = 'Disable';
        } else {
            statusContainer.classList.remove('enabled');
            statusContainer.classList.add('disabled');
            statusText.textContent = 'Disabled';
            permissionBtn.textContent = this.permission === 'granted' ? 'Enable' : 'Request Permission';
        }
    }

    async requestPermission() {
        if (this.permission === 'granted') {
            // Toggle notification state
            this.notificationEnabled = !this.notificationEnabled;
            localStorage.setItem('timerNotificationEnabled', this.notificationEnabled);
            this.updateNotificationUI();
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            if (permission === 'granted') {
                this.notificationEnabled = true;
                localStorage.setItem('timerNotificationEnabled', true);
            }
            this.updateNotificationUI();
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    async notify({ title = 'Timer', body = 'Time is up!', pattern = null, phaseIndex = null, isLastPhase = false }) {
        // Play notifications
        if (this.permission === 'granted' && this.notificationEnabled) {
            this.showDesktopNotification(title, body);
        }
        if (this.soundEnabled) {
            this.playSound();
        }

        // Only show in-page notification if we're on the timer page
        if (window.location.hash === '#/timer') {
            this.showInPageNotification(title, body, pattern);
        } else {
            // Create or update a "return to timer" button with phase information
            this.showReturnToTimerNotification(title, body, pattern, phaseIndex, isLastPhase);
        }
    }

    showReturnToTimerNotification(title, body, pattern, phaseIndex, isLastPhase) {
        // Remove any existing notification first
        const existingNotification = document.getElementById('timer-return-notification');
        if (existingNotification) {
            document.body.removeChild(existingNotification);
        }

        // Create the notification element
        const notificationElement = document.createElement('div');
        notificationElement.id = 'timer-return-notification';
        notificationElement.className = 'timer-return-notification';
        document.body.appendChild(notificationElement);

        // Store phase data as attributes for when user returns to timer
        if (pattern && phaseIndex !== null) {
            notificationElement.dataset.pattern = pattern;
            notificationElement.dataset.phaseIndex = phaseIndex;
            notificationElement.dataset.isLastPhase = isLastPhase;
            // Add the current timestamp to track when notification was created
            notificationElement.dataset.timestamp = Date.now();
        }

        // Update the notification content
        notificationElement.innerHTML = `
            <div>
                <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
                <div>${body}</div>
            </div>
            <button id="return-to-timer-btn">Return to Timer</button>
        `;

        // Slide in the notification after a short delay (to ensure animation works)
        setTimeout(() => {
            notificationElement.style.transform = 'translateY(0)';
        }, 10);

        // Add click handler to the button
        document.getElementById('return-to-timer-btn').addEventListener('click', () => {
            window.location.hash = '#/timer';
            // Hide the notification
            notificationElement.classList.add('hiding');
            setTimeout(() => {
                if (notificationElement.parentNode) {
                    document.body.removeChild(notificationElement);
                }
            }, 300); // Match the animation duration
        });

        // Auto-hide after 10 seconds
        setTimeout(() => {
            notificationElement.classList.add('hiding');
            setTimeout(() => {
                if (notificationElement.parentNode) {
                    document.body.removeChild(notificationElement);
                }
            }, 300); // Match the animation duration
        }, 10000);
    }

    async showDesktopNotification(title, body) {
        const notification = new Notification(title, {
            body,
            icon: `${window.siteBaseUrl || '/'}favicon.ico`,
            tag: 'timer-notification'
        });

        notification.onclick = () => {
            window.focus();
            window.location.hash = '#/timer';
            notification.close();
        };

        return new Promise(resolve => {
            notification.onclose = resolve;
            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);
        });
    }

    async playSound() {
        try {
            await this.notificationSound.play();
        } catch (error) {
            console.warn('Error playing notification sound:', error);
        }
    }

    showInPageNotification(title, body, pattern) {
        const timeDisplay = document.querySelector('.timer-display .time');
        if (timeDisplay) {
            timeDisplay.classList.add('flash');
            setTimeout(() => timeDisplay.classList.remove('flash'), 3000);
        }

        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo) {
            const oldText = phaseInfo.textContent;
            phaseInfo.textContent = body;
            setTimeout(() => phaseInfo.textContent = oldText, 3000);
        }
    }
}

export default TimerNotification;
