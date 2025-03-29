// Habit tracker functionality

// Habit class with enhanced goal capabilities
class Habit {
    constructor(id, name, goalType = 'streak', goalValue = 7, category = 'General') {
        this.id = id;
        this.name = name;
        this.streak = 0;
        this.lastCompletedDate = null;
        this.completedToday = false;
        this.goalType = goalType; // 'streak' or 'frequency'
        this.goalValue = parseInt(goalValue); // target streak or times per week
        this.weeklyCompletions = []; // Array of dates completed this week
        this.weekStartDate = this.getWeekStartDate(); // Keep track of current week
        this.completionHistory = {}; // Store historical completion data by date
        this.category = category; // New: category field for the habit
        this.weekStreak = 0; // New: Track weeks streak for frequency habits
        this.completedWeeks = 0; // New: Track total number of completed weeks
    }

    // Calculate the start of the current week (Monday instead of Sunday)
    getWeekStartDate() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        // Calculate days to subtract to get to Monday (if today is Sunday, subtract -6 days)
        const daysToSubtract = dayOfWeek === 0 ? -6 : dayOfWeek - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysToSubtract);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.toISOString();
    }

    // Check if goal is achieved 
    isGoalAchieved() {
        if (this.goalType === 'streak') {
            return this.streak >= this.goalValue;
        } else { // frequency
            return this.weeklyCompletions.length >= this.goalValue;
        }
    }

    // Get progress percentage
    getProgressPercentage() {
        if (this.goalType === 'streak') {
            return Math.min(100, Math.round((this.streak / this.goalValue) * 100));
        } else { // frequency
            return Math.min(100, Math.round((this.weeklyCompletions.length / this.goalValue) * 100));
        }
    }

    // New: Record completion in history
    recordCompletion(date) {
        this.completionHistory[date] = true;
    }

    // New: Remove completion from history
    removeCompletion(date) {
        delete this.completionHistory[date];
    }

    // New: Check if a week is completed (achieved the goal)
    isWeekCompleted() {
        if (this.goalType !== 'frequency') return false;
        return this.weeklyCompletions.length >= this.goalValue;
    }
}

// HabitTracker class
class HabitTracker {
    constructor() {
        this.habits = [];
        this.categories = []; // Start with empty categories, will be populated dynamically
        this.loadHabits();

        // Helper method to safely add event listeners
        const addListener = (selector, eventType, handler) => {
            const element = document.getElementById(selector);
            if (element) element.addEventListener(eventType, handler);
        };

        // Set up event listeners more concisely
        addListener('habit-form', 'submit', (e) => {
            e.preventDefault();
            this.addHabit();
        });

        addListener('habit-input', 'keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addHabit();
            }
        });

        // Add category dropdown event
        const categorySelect = document.getElementById('habit-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                const customCategoryContainer = document.getElementById('custom-category-container');
                if (e.target.value === 'custom') {
                    customCategoryContainer.style.display = 'block';
                    document.getElementById('custom-category').focus();
                } else {
                    customCategoryContainer.style.display = 'none';
                }
            });
        }

        // Add data management listeners
        addListener('export-data', 'click', () => this.exportData());
        addListener('import-data', 'click', () => document.getElementById('import-file').click());
        addListener('import-file', 'change', (e) => this.importData(e));
        addListener('reset-data', 'click', () => this.resetData());
        addListener('copy-logseq', 'click', () => this.copyAsLogseqBlock());

        // Tab navigation
        addListener('stats-tab-button', 'click', () => this.showStatsTab());
        addListener('habits-tab-button', 'click', () => this.showHabitsTab());

        // Initialize UI elements
        this.renderHabits();
        this.setupCategoryFilter();
        this.updateStorageUsage();

        // Use event delegation for goal actions
        document.addEventListener('click', (e) => {
            if (e.target.matches('.goal-action-btn')) {
                const habitId = e.target.closest('.habit-item').dataset.habitId;
                const action = e.target.dataset.action;
                this.handleGoalAction(habitId, action);
            }
        });
    }

    // Use this method only as fallback to get default categories
    getDefaultCategories() {
        return ['health', 'work', 'project', 'learning', 'personal', 'general'];
    }

    // New method to extract categories from habits
    extractCategoriesFromHabits() {
        // Start with default categories as base
        const defaultCategories = this.getDefaultCategories();
        const uniqueCategories = new Set(defaultCategories);

        // Add any custom categories from habits
        this.habits.forEach(habit => {
            if (habit.category) {
                uniqueCategories.add(habit.category.toLowerCase());
            }
        });

        // Convert Set back to array
        return Array.from(uniqueCategories);
    }

    cleanup() {
        // Store reference to resize handlers in the instance
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }

        if (this._tooltipPositionHandler) {
            window.removeEventListener('scroll', this._tooltipPositionHandler);
            window.removeEventListener('resize', this._tooltipPositionHandler);
        }

        // Remove tooltip element
        const tooltip = document.getElementById('heatmap-tooltip');
        if (tooltip) tooltip.remove();

        // Clear any cached data
        this._completionCache = null;
        this._weekStartDate = null;

        console.log('Habit tracker cleaned up');
    }

    // Load habits from localStorage
    loadHabits() {
        const storedHabits = localStorage.getItem('habits');
        // Try to load saved categories first
        const storedCategories = localStorage.getItem('habitCategories');

        if (storedHabits) {
            // Parse stored habits and ensure instances are proper Habit objects
            const parsedHabits = JSON.parse(storedHabits);
            this.habits = parsedHabits.map(habit => {
                const newHabit = new Habit(
                    habit.id,
                    habit.name,
                    habit.goalType || 'streak',
                    habit.goalValue || 7,
                    habit.category || 'General'
                );

                // Copy over properties using Object.assign for cleaner code
                Object.assign(newHabit, {
                    streak: habit.streak || 0,
                    lastCompletedDate: habit.lastCompletedDate,
                    completedToday: habit.completedToday || false,
                    weeklyCompletions: habit.weeklyCompletions || [],
                    weekStartDate: habit.weekStartDate || newHabit.getWeekStartDate(),
                    completionHistory: habit.completionHistory || {},
                    weekStreak: habit.weekStreak || 0,
                    completedWeeks: habit.completedWeeks || 0
                });

                return newHabit;
            });

            // Extract categories from habits
            if (storedCategories) {
                try {
                    this.categories = JSON.parse(storedCategories);
                } catch (e) {
                    console.error("Error parsing stored categories, regenerating...", e);
                    this.categories = this.extractCategoriesFromHabits();
                }
            } else {
                // If no stored categories, extract them from habits
                this.categories = this.extractCategoriesFromHabits();
            }

            this.checkDayChange();
            this.checkWeekChange();
        } else {
            // Initialize with default categories if no habits exist
            this.categories = this.getDefaultCategories();
        }

        // Save categories after initialization
        this.saveCategories();

        // Refresh the category dropdown after loading habits
        setTimeout(() => {
            if (window.refreshCategoryDropdown) {
                window.refreshCategoryDropdown();
            }
        }, 100);
    }

    // New method to save categories
    saveCategories() {
        localStorage.setItem('habitCategories', JSON.stringify(this.categories));
    }

    // Helper method to get appropriate background color for toast type
    getToastBackgroundColor(type) {
        switch (type) {
            case 'success': return '#4caf50';  // Green
            case 'error': return '#f44336';    // Red
            case 'save': return 'var(--accent-color)';
            case 'info':
            default: return '#2196f3';         // Blue
        }
    }
    // Add this method to your HabitTracker class
    showToast(message, options = {}) {
        const {
            type = 'info',      // 'info', 'success', 'error', 'save'
            icon = null,        // Override icon if needed
            duration = 3000,    // How long to show the toast
            position = 'bottom-left', // Position on screen
        } = options;

        // Create the toast element
        const toastElement = document.createElement('div');
        toastElement.className = `toast toast-${type} toast-${position}`;

        // Determine icon based on type
        let iconContent;
        if (icon) {
            iconContent = icon;
        } else {
            switch (type) {
                case 'success': iconContent = '✅'; break;
                case 'error': iconContent = '❌'; break;
                case 'save': iconContent = '💾'; break;
                default: iconContent = 'ℹ️';
            }
        }

        // Set toast content
        toastElement.innerHTML = `
        <span class="toast-icon">${iconContent}</span>
        <span class="toast-message">${message}</span>
    `;

        // Position styles
        Object.assign(toastElement.style, {
            position: 'fixed',
            bottom: position.includes('bottom') ? '20px' : 'auto',
            top: position.includes('top') ? '20px' : 'auto',
            left: position.includes('left') ? '20px' : 'auto',
            right: position.includes('right') ? '20px' : 'auto',
            backgroundColor: this.getToastBackgroundColor(type),
            color: '#000',
            padding: '5px 10px',
            borderRadius: '4px',
            opacity: '0',
            transform: 'translateY(20px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            zIndex: '999',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        // Add to DOM
        document.body.appendChild(toastElement);

        // Trigger animation
        setTimeout(() => {
            toastElement.style.opacity = '1';
            toastElement.style.transform = 'translateY(0)';
        }, 10);

        // Remove after duration
        setTimeout(() => {
            toastElement.style.opacity = '0';
            toastElement.style.transform = 'translateY(20px)';

            setTimeout(() => {
                if (document.body.contains(toastElement)) {
                    document.body.removeChild(toastElement);
                }
            }, 300);
        }, duration);

        return toastElement;
    }

    // Save habits to localStorage
    saveHabits() {
        localStorage.setItem('habits', JSON.stringify(this.habits));
        // Also save categories to ensure they persist
        this.saveCategories();
        this.updateStorageUsage();
    }

    // Calculate local storage usage
    calculateStorageUsage() {
        let totalBytes = 0;

        // Calculate habits data size
        const habitsData = JSON.stringify(this.habits);
        totalBytes += habitsData.length * 2; // Each character is 2 bytes in UTF-16

        // Return size in KB with 2 decimal places
        return {
            bytes: totalBytes,
            kb: (totalBytes / 1024).toFixed(2),
            percent: ((totalBytes / (5 * 1024 * 1024)) * 100).toFixed(2) // 5MB is typical localStorage limit
        };
    }

    // Update storage usage display
    updateStorageUsage() {
        const storageUsageElement = document.getElementById('storage-usage');
        if (storageUsageElement) {
            const usage = this.calculateStorageUsage();

            // Update the display
            storageUsageElement.innerHTML = `
                <div class="usage-value">${usage.kb} KB</div>
                <div class="usage-bar">
                    <div class="usage-fill" style="width: ${Math.min(100, usage.percent)}%"></div>
                </div>
                <div class="usage-percent">${usage.percent}% used</div>
            `;

            // Change color based on usage
            const usageFill = storageUsageElement.querySelector('.usage-fill');
            if (parseFloat(usage.percent) > 80) {
                usageFill.style.backgroundColor = '#f44336';
            } else if (parseFloat(usage.percent) > 50) {
                usageFill.style.backgroundColor = '#ff9800';
            }
        }
    }

    // Add a new habit
    addHabit() {
        const habitInput = document.getElementById('habit-input');
        const habitName = habitInput.value.trim();

        if (habitName) {
            const id = Date.now().toString();
            const goalType = document.getElementById('goal-type').value;
            const goalValue = parseInt(document.getElementById('goal-value').value, 10);
            const categorySelect = document.getElementById('habit-category');
            let category = categorySelect.value;

            // Better validation with specific error messages
            if (isNaN(goalValue) || goalValue <= 0) {
                this.showNotification('Please enter a positive number for your goal target.', 'error');
                return;
            }

            // Reasonable upper limits to prevent unrealistic goals
            if (goalType === 'streak' && goalValue > 365) {
                this.showNotification('Streak goal should be 365 days or less.', 'error');
                return;
            }
            if (goalType === 'frequency' && goalValue > 7) {
                this.showNotification('Weekly frequency should be 7 times or less.', 'error');
                return;
            }

            // Create and add the new habit with selected category
            const habit = new Habit(id, habitName, goalType, goalValue, category);
            habit.weekStreak = 0;
            habit.completedWeeks = 0;

            // Initialize the weekStartDate for new habits
            habit.weekStartDate = habit.getWeekStartDate();

            this.habits.push(habit);
            this.saveHabits();
            this.renderHabits();

            // Refresh the category dropdown
            if (window.refreshCategoryDropdown) {
                window.refreshCategoryDropdown();
            } else {
                this.refreshCategoryDropdownDirectly();
            }

            // Reset form
            habitInput.value = '';
            habitInput.focus();
            categorySelect.value = 'general';
            document.getElementById('goal-type').value = 'streak';
            document.getElementById('goal-value').value = '7';
            document.getElementById('goal-unit').textContent = 'days';

            // Visual feedback
            this.showNotification(`New habit "${habitName}" added!`, 'success');
        } else {
            this.showNotification('Please enter a habit name.', 'error');
        }
    }

    // Delete a habit
    deleteHabit(id) {
        // Show confirmation before deleting
        if (confirm('Are you sure you want to delete this habit?')) {
            this.habits = this.habits.filter(habit => habit.id !== id);
            this.saveHabits();
            this.renderHabits();
            //showNotification
            this.showNotification('Habit deleted successfully.', 'success');
        }
    }

    // Toggle habit completion
    toggleHabit(id) {
        const habit = this.habits.find(h => h.id === id);

        if (habit) {
            const today = new Date();
            const todayString = today.toDateString();
            const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!habit.completedToday) {
                // Mark as completed
                habit.completedToday = true;
                habit.lastCompletedDate = todayString;

                // Handle streak logic
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toDateString();

                // Increase streak if this is first completion or if yesterday was completed
                if (habit.streak === 0 || habit.lastCompletedDate === yesterdayString) {
                    habit.streak++;

                    // Celebrate milestone streak achievements
                    if (habit.streak % 7 === 0) { // Weekly milestone
                        this.showNotification(`🔥 ${habit.streak} day streak for "${habit.name}"!`, 'success');
                    } else if (habit.streak % 30 === 0) { // Monthly milestone
                        this.showNotification(`🏆 Amazing! ${habit.streak} day streak for "${habit.name}"!`, 'success');
                    } else if (habit.streak % 100 === 0) { // Major milestone
                        this.showNotification(`🌟 INCREDIBLE! ${habit.streak} day streak for "${habit.name}"!`, 'success');
                    }

                    // Check if goal was just achieved with this completion
                    if (habit.goalType === 'streak' && habit.streak === habit.goalValue) {
                        this.handleGoalAchievement(habit);
                    }
                }

                // Add to weekly completions if not already there
                if (!habit.weeklyCompletions.includes(todayISO)) {
                    habit.weeklyCompletions.push(todayISO);

                    // Check if this completion achieves the weekly goal
                    if (habit.goalType === 'frequency' &&
                        habit.weeklyCompletions.length === habit.goalValue) {
                        this.showNotification(`Weekly goal achieved for "${habit.name}"! 🎯`, 'success');
                        // Handle frequency goal achievement
                        this.handleGoalAchievement(habit);
                    }
                }

                // Record in completion history
                habit.recordCompletion(todayISO);
            } else {
                // Mark as not completed
                habit.completedToday = false;

                // Remove from weekly completions
                habit.weeklyCompletions = habit.weeklyCompletions.filter(date => date !== todayISO);

                // Remove from completion history
                habit.removeCompletion(todayISO);

                // If we're removing today's completion and it was adding to the streak, 
                // decrement the streak
                if (habit.streak > 0) {
                    habit.streak--;
                }
            }

            this.saveHabits();
            this.renderHabits();
        }
    }

    // Check if day has changed and reset completedToday status
    checkDayChange() {
        const today = new Date().toDateString();

        this.habits.forEach(habit => {
            // If habit was completed on a previous day (not today)
            if (habit.lastCompletedDate && habit.lastCompletedDate !== today) {
                habit.completedToday = false;

                // If we have a streak, check if it should be broken
                if (habit.streak > 0) {
                    const lastCompletedDate = new Date(habit.lastCompletedDate);
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);

                    // Break streak only if last completion was before yesterday
                    if (lastCompletedDate.toDateString() !== yesterday.toDateString()) {
                        console.log(`${habit.name}: Streak broken. Was: ${habit.streak}`);
                        habit.streak = 0;
                    }
                }
            }
        });

        this.saveHabits();
    }

    // Check if week has changed and reset weekly completions
    checkWeekChange() {
        const currentWeekStart = new Date().toISOString().split('T')[0]; // Just get today for comparison

        this.habits.forEach(habit => {
            if (!habit.weekStartDate || habit.weekStartDate !== currentWeekStart) {
                // Fix: Create a new Habit instance only once for getting the week start date
                if (!this._weekStartDate) {
                    this._weekStartDate = new Habit(null, null).getWeekStartDate();
                }

                if (habit.weekStartDate !== this._weekStartDate) {
                    // Before resetting, check if previous week's goal was achieved
                    if (habit.goalType === 'frequency') {
                        const previousGoalAchieved = habit.weeklyCompletions.length >= habit.goalValue;

                        // Update week streak based on previous week's achievement
                        if (previousGoalAchieved) {
                            habit.weekStreak++;
                            habit.completedWeeks++;
                        } else if (habit.weeklyCompletions.length > 0) {
                            // Only reset streak if there was at least one completion but goal wasn't met
                            if (habit.weekStreak > 0) {
                                habit.weekStreak = 0;
                            }
                        }
                    }

                    // Week has changed, reset weekly tracking
                    habit.weeklyCompletions = [];
                    habit.weekStartDate = this._weekStartDate;
                }
            }
        });

        // Save changes after processing all habits
        this.saveHabits();
    }

    // Get the day names for current week (starting with Monday)
    getWeekDayNames() {
        // Rearranged days to start with Monday
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date();
        // Convert JavaScript's day of week (0=Sun to 6=Sat) to our custom index (0=Mon to 6=Sun)
        const currentDayOfWeek = today.getDay();
        // Fix the conversion formula:
        const adjustedDayOfWeek = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
        const result = [];

        for (let i = 0; i < 7; i++) {
            // Calculate the date for each day of the current week
            const dayOffset = i - adjustedDayOfWeek;
            const date = new Date(today);
            date.setDate(today.getDate() + dayOffset);

            result.push({
                name: days[i],
                isToday: i === adjustedDayOfWeek,
                date: date.toISOString().split('T')[0]
            });
        }

        return result;
    }

    // Render habits to the DOM
    renderHabits() {
        const habitsList = document.getElementById('habits-list');
        habitsList.innerHTML = '';

        if (this.habits.length === 0) {
            habitsList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">No habits added yet. Add your first habit below!</p>';
            return;
        }

        // Get day names for the week
        const weekDays = this.getWeekDayNames();

        // Separate habits into completed and uncompleted
        const completedHabits = this.habits.filter(habit => habit.completedToday);
        const uncompletedHabits = this.habits.filter(habit => !habit.completedToday);

        // NEW: Add achievements summary at the top if there are any achievements
        const achievements = this.getAchievements();
        if (achievements.length > 0 || this.calculateTotalCompletions() > 0) {
            const achievementsSummary = document.createElement('div');
            achievementsSummary.className = 'achievements-summary-section';

            // Add total completions counter
            const totalCompletions = this.calculateTotalCompletions();
            const totalCompletionsHTML = `
                <div class="total-completions-summary">
                    <div class="total-count-small">${totalCompletions}</div>
                    <div class="summary-label">Total Completions</div>
                    ${this.getTotalCompletionAchievements(totalCompletions) ?
                    `<div class="achievement-badges-small">${this.getTotalCompletionAchievements(totalCompletions)}</div>` : ''}
                </div>
            `;

            // Add recent achievement counter
            const recentAchievementsHTML = `
                <div class="recent-achievements-summary">
                    <div class="achievement-count">${achievements.length}</div>
                    <div class="summary-label">Goals Achieved</div>
                    ${achievements.length > 0 ? '<div class="view-achievements-link">View in Statistics tab</div>' : ''}
                </div>
            `;

            achievementsSummary.innerHTML = `
                <div class="achievements-flex-container">
                    ${totalCompletionsHTML}
                    ${recentAchievementsHTML}
                </div>
            `;

            // Add click event to switch to statistics tab
            setTimeout(() => {
                const viewLink = achievementsSummary.querySelector('.view-achievements-link');
                if (viewLink) {
                    viewLink.addEventListener('click', () => this.showStatsTab());
                }
            }, 0);

            habitsList.appendChild(achievementsSummary);

        }

        // Create container for uncompleted habits
        if (uncompletedHabits.length > 0) {
            const uncompletedSection = document.createElement('div');
            uncompletedSection.className = 'habits-section uncompleted-section';

            const uncompletedHeader = document.createElement('h4');
            uncompletedHeader.innerHTML = '> Pending_Today';
            uncompletedHeader.className = 'section-header';
            uncompletedSection.appendChild(uncompletedHeader);

            // Add habits to the uncompleted section
            uncompletedHabits.forEach(habit => {
                const habitElement = this.createHabitElement(habit, weekDays);
                uncompletedSection.appendChild(habitElement);
            });

            habitsList.appendChild(uncompletedSection);
        }

        // Create container for completed habits
        if (completedHabits.length > 0) {
            const completedSection = document.createElement('div');
            completedSection.className = 'habits-section completed-section';

            const completedHeader = document.createElement('h4');
            completedHeader.innerHTML = '> Completed_Today';
            completedHeader.className = 'section-header';
            completedSection.appendChild(completedHeader);

            // Add habits to the completed section
            completedHabits.forEach(habit => {
                const habitElement = this.createHabitElement(habit, weekDays);
                completedSection.appendChild(habitElement);
            });

            habitsList.appendChild(completedSection);
        }
        // Show stats if we have habits
        if (this.habits.length > 0) {
            const statsSection = document.createElement('div');
            statsSection.className = 'habits-stats';
            statsSection.innerHTML = `
                <div class="stats-info">
                    <span>✅ ${completedHabits.length}/${this.habits.length} completed today</span>
                    <span class="stats-percentage">${Math.round((completedHabits.length / this.habits.length) * 100)}%</span>
                </div>
                <div class="stats-bar">
                    <div class="stats-bar-fill" style="width: ${(completedHabits.length / this.habits.length) * 100}%"></div>
                </div>
            `;
            habitsList.appendChild(statsSection);
        }


        // Add heatmap if we have habits with history
        if (this.habits.length > 0) {
            this.renderHeatmap(habitsList);
        }

        // Add categories filter if we have habits
        if (this.habits.length > 0) {
            this.setupCategoryFilter();
        }

        // Update storage usage when rendering habits
        this.updateStorageUsage();

        // Add statistics dashboard if we have habits
        if (this.habits.length > 0) {
            this.renderStatisticsDashboard();
        }
    }

    // Helper method to create a habit element (extracted from renderHabits)
    createHabitElement(habit, weekDays) {
        const habitElement = document.createElement('div');
        habitElement.className = `habit-item ${habit.completedToday ? 'completed' : ''}`;
        habitElement.dataset.category = habit.category;  // Add category as a data attribute
        habitElement.dataset.goalType = habit.goalType;  // Add goal type as a data attribute
        habitElement.dataset.habitId = habit.id; // NEW: Add habit ID as data attribute

        // Remove the code that tries to style the category directly here
        // We'll handle styling with the refreshCategoryStyles function instead

        // Create progress percentage
        const progressPercentage = habit.getProgressPercentage();
        const isGoalAchieved = habit.isGoalAchieved();

        // Create goal status element - different for streak vs frequency habits
        const goalStatusClass = isGoalAchieved ? 'goal-achieved' : 'goal-not-achieved';

        // Only show goal icon for frequency goals, not streak goals
        const goalStatusIcon = habit.goalType === 'frequency' ? (isGoalAchieved ? '🎯' : '🔄') : '';

        // Build weekly tracker HTML
        let weeklyTracker = '<div class="weekly-tracker">';
        weekDays.forEach(day => {
            const isCompleted = habit.weeklyCompletions.includes(day.date);
            const today = day.isToday ? 'title="Today"' : '';
            weeklyTracker += `<div class="day-marker${isCompleted ? ' completed' : ''}" ${today} data-date="${day.date}" title="${day.name}"></div>`;
        });
        weeklyTracker += '</div>';

        // Different progress text based on habit type
        const progressText = habit.goalType === 'streak'
            ? `${habit.streak}/${habit.goalValue}`
            : `${habit.weeklyCompletions.length}/${habit.goalValue} this week`;

        // Weekly stats for frequency habits
        const weeklyStatsHtml = habit.goalType === 'frequency'
            ? `<div class="weekly-stats">
                <span class="week-streak-badge">⚡ ${habit.weekStreak} week streak</span>
                <span>Completed ${habit.completedWeeks} weeks total</span>
              </div>`
            : '';

        // NEW: Add special class for achieved goals
        if (isGoalAchieved) {
            habitElement.classList.add('goal-achieved-item');
        }

        // NEW: Add goal achievement actions if goal is achieved
        let goalActionsHtml = '';
        if (isGoalAchieved && !habit.goalAcknowledged) {
            goalActionsHtml = `
                <div class="goal-achievement-actions">
                    <div class="goal-achieved-message">🎉 Goal achieved! What's next?</div>
                    <button class="goal-action-btn" data-action="increaseGoal">Increase Goal</button>
                    <button class="goal-action-btn" data-action="acknowledgeGoal">Keep Going</button>
                </div>
            `;
        }

        // Simplified habit display - removed goal type indicator
        habitElement.innerHTML = `
            <div class="habit-info">
                <div class="habit-header">
                    <div class="habit-title">
                        <span class="habit-name">${habit.name}</span>
                        <span class="habit-category" data-category="${habit.category.toLowerCase()}">${habit.category}</span>
                    </div>
                    <span class="streak-badge ${habit.streak > 0 ? 'has-streak' : ''}">
                        ${habit.goalType === 'streak' ? '⚡ ' + habit.streak : '📅 ' + habit.weeklyCompletions.length}
                    </span>
                </div>
                
                <div class="progress-area">
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                        <span class="goal-info ${goalStatusClass}">
                            ${goalStatusIcon} ${progressText}
                        </span>
                    </div>
                    
                    <div class="weekly-indicator">
                        ${weeklyTracker}
                    </div>
                    
                    ${weeklyStatsHtml}
                </div>
                
                ${goalActionsHtml}
            </div>
            <div class="habit-actions">
                <button class="btn-complete">${habit.completedToday ? '↩️ Undo' : '✅ Complete'}</button>
                <button class="btn-delete">🗑️ Delete</button>
            </div>
        `;

        // Add event listeners
        const completeBtn = habitElement.querySelector('.btn-complete');
        const deleteBtn = habitElement.querySelector('.btn-delete');

        completeBtn.addEventListener('click', () => this.toggleHabit(habit.id));
        deleteBtn.addEventListener('click', () => this.deleteHabit(habit.id));

        return habitElement;
    }

    // New helper method to generate a color for a custom category
    getColorForCategory(category) {
        // Simple hash function to generate a consistent color from a string
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Convert the hash to a hex color
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }

        return color;
    }

    // New: Generate dates for last N weeks (starting with Monday)
    getLastNWeeks(weeks = 13) { // About 3 months
        const dates = [];
        const today = new Date();
        const totalDays = weeks * 7;

        // Pre-calculate today string for comparison
        const todayString = today.toISOString().split('T')[0];

        // More efficient approach - calculate dates once and reuse
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            // Calculate day of week once
            const dateDayOfWeek = date.getDay();
            const adjustedDayOfWeek = dateDayOfWeek === 0 ? 6 : dateDayOfWeek - 1;

            // Format date string once
            const dateString = date.toISOString().split('T')[0];

            dates.unshift({
                date: dateString,
                dayOfWeek: adjustedDayOfWeek,
                month: date.getMonth(),
                isToday: dateString === todayString
            });
        }

        return dates;
    }

    // New: Organize dates by week for the heatmap - FIXED to properly handle week starts
    organizeDatesByWeek(dates) {
        const weeks = [];
        let currentWeek = Array(7).fill(null); // Initialize with 7 null slots for Monday-Sunday
        let currentWeekStartDate = null;

        dates.forEach(dateObj => {
            // Check if we need to start a new week
            if (dateObj.dayOfWeek === 0) { // Monday - start of week
                // If we have a current week with data, push it
                if (currentWeekStartDate !== null) {
                    weeks.push([...currentWeek]);
                }
                // Reset the week array
                currentWeek = Array(7).fill(null);
                currentWeekStartDate = dateObj.date;
            }

            // Place this date in the right position (dayOfWeek is 0-6 for Mon-Sun)
            currentWeek[dateObj.dayOfWeek] = dateObj;
        });

        // Push the last week if it has any data
        if (currentWeekStartDate !== null) {
            weeks.push(currentWeek);
        }

        return weeks;
    }
    // Add these methods to your HabitTracker class
    createTooltip() {
        // Remove any existing tooltip
        const existingTooltip = document.getElementById('heatmap-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // Create new tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.id = 'heatmap-tooltip';
        document.body.appendChild(tooltip);

        return tooltip;
    }

    updateTooltip(tooltip, content, rect) {
        if (!tooltip) return;

        tooltip.textContent = content;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 5}px`;
        tooltip.style.opacity = '1';
    }

    hideTooltip(tooltip) {
        if (!tooltip) return;
        tooltip.style.opacity = '0';
    }


    // New: Render GitHub-style heatmap visualization (improved alignment and fixed layout)
    renderHeatmap(container) {
        const heatmapSection = document.createElement('div');
        heatmapSection.className = 'habit-heatmap-section';
        heatmapSection.innerHTML = '<h4 class="section-header">> Activity_Heatmap</h4>';

        const heatmapContainer = document.createElement('div');
        heatmapContainer.className = 'heatmap-container';

        // Get dates for last 13 weeks (approximately 3 months)
        const dates = this.getLastNWeeks(13);

        // Group dates by month for better positioning
        const datesByMonth = {};
        dates.forEach(dateObj => {
            const month = dateObj.month;
            if (!datesByMonth[month]) {
                datesByMonth[month] = [];
            }
            datesByMonth[month].push(dateObj);
        });

        // Create month labels with improved positioning
        const monthLabels = document.createElement('div');
        monthLabels.className = 'month-labels';

        // Calculate month positions more accurately
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Create a count of days per month to calculate positions
        const daysPerMonth = {};
        let currentMonth = -1;
        let currentPosition = 0;

        dates.forEach(dateObj => {
            if (currentMonth !== dateObj.month) {
                currentMonth = dateObj.month;
                daysPerMonth[currentMonth] = 1;
            } else {
                daysPerMonth[currentMonth]++;
            }
        });

        // Create month labels with proper positioning
        Object.keys(daysPerMonth).forEach(month => {
            const label = document.createElement('div');
            label.className = 'month-label';
            label.textContent = monthNames[parseInt(month)];

            // Calculate proper width based on days count
            const daysInMonth = daysPerMonth[month];
            if (daysInMonth > 7) {
                label.style.minWidth = `${Math.ceil(daysInMonth / 7) * 18}px`;
            }

            monthLabels.appendChild(label);
        });

        // Create day labels (Mon-Sun)
        const dayLabels = document.createElement('div');
        dayLabels.className = 'day-labels';

        // Updated day names starting with Monday
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        for (let i = 0; i < 7; i++) {
            const label = document.createElement('div');
            label.className = 'day-label';

            // Show all day labels for better grid alignment
            label.textContent = dayNames[i].charAt(0);

            dayLabels.appendChild(label);
        }

        // Create a wrapper for the heatmap layout
        const heatmapWrapper = document.createElement('div');
        heatmapWrapper.className = 'heatmap-wrapper';

        // Create the heatmap grid
        const heatmapGrid = document.createElement('div');
        heatmapGrid.className = 'heatmap-grid';

        // Calculate completion rate for each date
        const dateStats = {};
        dates.forEach(dateObj => {
            const date = dateObj.date;
            const completed = this.habits.filter(habit => habit.completionHistory && habit.completionHistory[date]).length;
            const total = this.habits.length;
            dateStats[date] = {
                count: completed,
                percentage: total > 0 ? (completed / total) * 100 : 0
            };
        });

        // Create tooltip element
        const tooltip = this.createTooltip();

        // Organize dates by week columns - using our fixed function
        const weeks = this.organizeDatesByWeek(dates);

        // Generate grid cells in correct order for all weeks
        for (let col = 0; col < weeks.length; col++) {
            const week = weeks[col];

            for (let row = 0; row < 7; row++) {
                const dateObj = week[row];
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';

                // Position cell in grid
                cell.style.gridRow = (row + 1).toString();
                cell.style.gridColumn = (col + 1).toString();

                // If we have data for this day
                if (dateObj) {
                    const date = dateObj.date;
                    const stats = dateStats[date];

                    // Determine intensity level (0-4)
                    let intensityLevel = 0;
                    if (stats && stats.percentage > 0) {
                        if (stats.percentage < 25) intensityLevel = 1;
                        else if (stats.percentage < 50) intensityLevel = 2;
                        else if (stats.percentage < 75) intensityLevel = 3;
                        else intensityLevel = 4;
                    }

                    cell.classList.add(`intensity-${intensityLevel}`);
                    cell.dataset.date = date;
                    cell.dataset.count = stats ? stats.count : 0;

                    // Highlight today's cell
                    const today = new Date().toISOString().split('T')[0];
                    if (date === today) {
                        cell.classList.add('today');
                    }

                    // Add hover tooltip functionality with improved positioning
                    cell.addEventListener('mouseenter', (e) => {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        });

                        const content = `${formattedDate}: ${stats.count} habit${stats.count !== 1 ? 's' : ''} completed`;
                        this.updateTooltip(tooltip, content, cell.getBoundingClientRect());
                    });

                    cell.addEventListener('mouseleave', () => {
                        this.hideTooltip(tooltip);
                    });
                } else {
                    // Empty cell for padding/alignment
                    cell.classList.add('empty-cell');
                }

                heatmapGrid.appendChild(cell);
            }
        }

        // Add everything to the heatmap
        heatmapWrapper.appendChild(dayLabels);
        heatmapWrapper.appendChild(heatmapGrid);

        heatmapContainer.appendChild(monthLabels);
        heatmapContainer.appendChild(heatmapWrapper);

        // Add legend
        const legend = document.createElement('div');
        legend.className = 'heatmap-legend';
        legend.innerHTML = `
            <div class="legend-item"><span class="legend-color intensity-0"></span><span>No habits</span></div>
            <div class="legend-item"><span class="legend-color intensity-1"></span><span>1-25%</span></div>
            <div class="legend-item"><span class="legend-color intensity-2"></span><span>26-50%</span></div>
            <div class="legend-item"><span class="legend-color intensity-3"></span><span>51-75%</span></div>
            <div class="legend-item"><span class="legend-color intensity-4"></span><span>76-100%</span></div>
        `;

        heatmapContainer.appendChild(legend);
        heatmapSection.appendChild(heatmapContainer);
        container.appendChild(heatmapSection);

        // Add responsive class for mobile view
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            heatmapContainer.classList.add('mobile-view');
        }

        this._resizeHandler = () => {
            if (window.innerWidth < 768) {
                heatmapContainer.classList.add('mobile-view');
            } else {
                heatmapContainer.classList.remove('mobile-view');
            }
        };

        // Store tooltip position handler reference
        this._tooltipPositionHandler = () => {
            const activeCell = document.querySelector('.heatmap-cell:hover');
            if (activeCell && tooltip.style.opacity !== '0') {
                const rect = activeCell.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 5}px`;
            }
        };

        // Add listeners with our stored references
        window.addEventListener('resize', this._resizeHandler, { passive: true });
        window.addEventListener('scroll', this._tooltipPositionHandler, { passive: true });
        window.addEventListener('resize', this._tooltipPositionHandler, { passive: true });

    }

    // Setup category filter
    setupCategoryFilter() {
        // Create filter container if it doesn't exist
        const habitsList = document.getElementById('habits-list');
        let filterContainer = document.getElementById('category-filters');

        if (!filterContainer) {
            filterContainer = document.createElement('div');
            filterContainer.id = 'category-filters';
            filterContainer.className = 'category-filters';
            habitsList.parentNode.insertBefore(filterContainer, habitsList);
        }

        // Clear existing filters first
        filterContainer.innerHTML = '<span class="filter-label">Filter: </span>';

        // Add "All" filter first
        const allButton = document.createElement('button');
        allButton.textContent = 'All';
        allButton.className = 'category-filter active';
        allButton.dataset.category = 'all';
        filterContainer.appendChild(allButton);

        // Add filters for each category
        this.categories.forEach(category => {
            // Only add filters for categories that actually have habits
            if (this.habits.some(habit => habit.category.toLowerCase() === category.toLowerCase())) {
                const button = document.createElement('button');
                button.textContent = category;
                button.className = 'category-filter';
                button.dataset.category = category;
                filterContainer.appendChild(button);
            }
        });

        // Add event listeners to filters
        const filters = document.querySelectorAll('.category-filter');
        filters.forEach(filter => {
            filter.addEventListener('click', () => {
                // Remove active class from all filters
                filters.forEach(f => f.classList.remove('active'));
                // Add active class to clicked filter
                filter.classList.add('active');

                const category = filter.dataset.category;
                this.filterHabitsByCategory(category);
            });
        });
    }

    // Filter habits by category
    filterHabitsByCategory(category) {
        const habitItems = document.querySelectorAll('.habit-item');

        habitItems.forEach(item => {
            if (category === 'all' || item.dataset.category === category) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Add a new method to display week streak information in the console for debugging
    displayWeekStreakInfo() {
        console.group('Week Streak Information');
        this.habits.forEach(habit => {
            if (habit.goalType === 'frequency') {
                const progress = `${habit.weeklyCompletions.length}/${habit.goalValue}`;
                const weekRemaining = this.getDaysRemainingInWeek();
                console.log(`${habit.name}: ${progress} | Streak: ${habit.weekStreak} | Days left in week: ${weekRemaining}`);
            }
        });
        console.groupEnd();
    }

    // Helper method to get days remaining in current week
    getDaysRemainingInWeek() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        // If today is Sunday, return 0 (week is over), otherwise calculate days left
        return dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    }

    // Export habits data to a JSON file
    exportData() {
        const dataStr = JSON.stringify({
            habits: this.habits,
            categories: this.categories,
            exportDate: new Date().toISOString(),
            version: '1.0'
        });

        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const downloadLink = document.createElement('a');
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        downloadLink.download = `habit-tracker-backup-${date}.json`;
        downloadLink.href = url;
        downloadLink.click();

        URL.revokeObjectURL(url);

        // Show a success notification
        this.showNotification('Data exported successfully! 📥', 'success');
    }

    // Import habits data from a JSON file
    importData(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Validate imported data structure
                if (!data.habits || !Array.isArray(data.habits)) {
                    throw new Error('Invalid data format');
                }

                // Show confirmation dialog
                if (confirm('This will replace your current habits. Continue?')) {
                    // Restore habits with proper class instances
                    this.habits = data.habits.map(habit => {
                        const newHabit = new Habit(
                            habit.id || Date.now().toString(),
                            habit.name,
                            habit.goalType || 'streak',
                            habit.goalValue || 7,
                            habit.category || 'General'
                        );

                        // Copy over properties
                        newHabit.streak = habit.streak || 0;
                        newHabit.lastCompletedDate = habit.lastCompletedDate;
                        newHabit.completedToday = habit.completedToday || false;
                        newHabit.weeklyCompletions = habit.weeklyCompletions || [];
                        newHabit.weekStartDate = habit.weekStartDate || newHabit.getWeekStartDate();
                        newHabit.completionHistory = habit.completionHistory || {};
                        newHabit.weekStreak = habit.weekStreak || 0;
                        newHabit.completedWeeks = habit.completedWeeks || 0;

                        return newHabit;
                    });

                    // Restore categories if present in import
                    if (data.categories && Array.isArray(data.categories)) {
                        this.categories = data.categories;
                    } else {
                        // Extract categories from imported habits if categories not included
                        this.categories = this.extractCategoriesFromHabits();
                    }

                    // Save both habits and categories
                    this.saveHabits();
                    this.saveCategories();
                    this.renderHabits();

                    // Update storage usage after import
                    this.updateStorageUsage();

                    // Check for day/week changes
                    this.checkDayChange();
                    this.checkWeekChange();

                    // Refresh the category dropdown after import
                    if (window.refreshCategoryDropdown) {
                        window.refreshCategoryDropdown();
                    } else {
                        // Direct refresh if function not available
                        this.refreshCategoryDropdownDirectly();
                    }

                    this.showNotification('Data imported successfully! 📤', 'success');
                } else {
                    this.showNotification('Import cancelled', 'info');
                }
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification('Error importing data. Invalid file format.', 'error');
            }
        };

        reader.readAsText(file);

        // Reset the file input
        event.target.value = '';
    }

    // Add a direct method to refresh category dropdown (for cases where the global function isn't available)
    refreshCategoryDropdownDirectly() {
        const categorySelect = document.getElementById('habit-category');
        if (!categorySelect) return;

        // Clear all options
        categorySelect.innerHTML = '';

        // Add categories from this instance
        if (this.categories && this.categories.length > 0) {
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.toLowerCase();
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    }

    // Reset all habit data
    resetData() {
        // Double confirmation to prevent accidental data loss
        if (confirm('WARNING: This will permanently delete all your habit data. Are you sure?')) {
            // Second confirmation with more explicit warning
            if (confirm('FINAL WARNING: This action cannot be undone. All habits and tracking history will be lost. Continue?')) {
                // Clear habits array
                this.habits = [];

                // Reset categories to defaults
                this.categories = this.getDefaultCategories();

                // Clear localStorage for both habits and categories
                localStorage.removeItem('habits');
                localStorage.removeItem('habitCategories');

                // Render empty habits list
                this.renderHabits();

                // Update storage usage after reset
                this.updateStorageUsage();

                // Show notification
                this.showNotification('All habit data has been reset!', 'error');

                // Remove any category filters
                const filterContainer = document.getElementById('category-filters');
                if (filterContainer) {
                    filterContainer.innerHTML = '';
                }

                // Refresh the category dropdown to reflect default categories
                if (window.refreshCategoryDropdown) {
                    window.refreshCategoryDropdown();
                } else {
                    // If running in GitHub Pages, ensure categories are refreshed
                    setTimeout(() => {
                        const categorySelect = document.getElementById('habit-category');
                        if (categorySelect) {
                            // Clear current options
                            categorySelect.innerHTML = '';

                            // Add default categories
                            this.categories.forEach(category => {
                                const option = document.createElement('option');
                                option.value = category.toLowerCase();
                                option.textContent = category;
                                categorySelect.appendChild(option);
                            });

                            // Add custom option at the end
                            const customOption = document.createElement('option');
                            customOption.value = 'custom';
                            customOption.textContent = '+ Add Custom Category';
                            categorySelect.appendChild(customOption);
                        }
                    }, 100);
                }
            }
        }
    }

    // Display notification message
    showNotification(message, type = 'info') {
        this.showToast(message, { type });
    }

    // New method: Show statistics tab
    showStatsTab() {
        const statsTab = document.getElementById('stats-tab');
        const habitsTab = document.getElementById('habits-tab');
        const statsButton = document.getElementById('stats-tab-button');
        const habitsButton = document.getElementById('habits-tab-button');

        if (statsTab && habitsTab) {
            statsTab.style.display = 'block';
            habitsTab.style.display = 'none';
            statsButton.classList.add('active');
            habitsButton.classList.remove('active');

            // Render statistics when tab is shown
            this.renderStatisticsDashboard();
        }
    }

    // New method: Show habits tab
    showHabitsTab() {
        const statsTab = document.getElementById('stats-tab');
        const habitsTab = document.getElementById('habits-tab');
        const statsButton = document.getElementById('stats-tab-button');
        const habitsButton = document.getElementById('habits-tab-button');

        if (statsTab && habitsTab) {
            statsTab.style.display = 'none';
            habitsTab.style.display = 'block';
            statsButton.classList.remove('active');
            habitsButton.classList.add('active');
        }
    }

    // New method: Generate statistics dashboard
    renderStatisticsDashboard() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;

        // Clear previous content
        statsContainer.innerHTML = '';

        if (this.habits.length === 0) {
            statsContainer.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Add some habits to see statistics!</p>';
            return;
        }

        // Create dashboard structure
        const dashboard = document.createElement('div');
        dashboard.className = 'stats-dashboard';

        // Keep Total Completions card in the stats tab too for consistency
        const totalCompletions = this.calculateTotalCompletions();
        const totalCompletionsCard = this.createStatCard(
            this.generateTotalCompletionsHTML(totalCompletions),
            'Total Habit Completions',
            'The total number of times you\'ve completed habits since you started tracking',
            'success'
        );
        dashboard.appendChild(totalCompletionsCard);

        // 1. Overall Completion Rate
        const completionRate = this.calculateOverallCompletionRate();
        const completionRateCard = this.createStatCard(
            `${completionRate}%`,
            'Overall Completion Rate',
            'The percentage of habit completions over the last 30 days',
            completionRate > 80 ? 'success' : completionRate > 50 ? 'warning' : 'danger'
        );
        dashboard.appendChild(completionRateCard);

        // 2. Current Streaks Summary
        const streaksHTML = this.generateStreaksSummary();
        const streaksCard = this.createStatCard(
            'Current Streaks',
            streaksHTML,
            'Your longest active streaks across all habits'
        );
        dashboard.appendChild(streaksCard);

        // 3. Category Performance
        const categoryPerformance = this.calculateCategoryPerformance();
        const categoryCard = this.createStatCard(
            'Category Performance',
            this.generateCategoryChart(categoryPerformance),
            'Completion rates by habit category'
        );
        dashboard.appendChild(categoryCard);

        // 4. Daily Trends Chart (Last 30 Days)
        const trendsData = this.calculateDailyTrends();
        const trendsCard = this.createStatCard(
            'Daily Completion Trend (Last 30 Days)',
            this.generateTrendsChart(trendsData),
            'Number of habits completed each day'
        );
        dashboard.appendChild(trendsCard);

        // 5. Statistics Summary Table
        const summaryTable = this.generateStatsSummaryTable();
        const summaryCard = this.createStatCard(
            'Habit Statistics Summary',
            summaryTable,
            'Key metrics for all your habits'
        );
        dashboard.appendChild(summaryCard);

        // Add dashboard to the page
        statsContainer.appendChild(dashboard);

        // Add achievements card if we have any
        const achievements = this.getAchievements();
        if (achievements.length > 0) {
            const achievementsCard = this.createStatCard(
                this.generateAchievementsHTML(achievements),
                'Recent Achievements',
                'Goals you\'ve successfully completed',
                'success'
            );
            dashboard.appendChild(achievementsCard);
        }
    }

    // New helper: Calculate total completions across all habits
    calculateTotalCompletions() {
        let totalCount = 0;
        // Sum up all completions from each habit's history
        this.habits.forEach(habit => {
            if (habit.completionHistory) {
                totalCount += Object.keys(habit.completionHistory).length;
            }
        });
        return totalCount;
    }

    // New helper: Generate HTML for total completions card
    generateTotalCompletionsHTML(count) {
        const achievements = this.getTotalCompletionAchievements(count);
        return `
            <div class="total-completions">
                <div class="total-count">${count}</div>
                <div class="total-label">Total Completions</div>
                ${achievements ? `<div class="achievement-badges">${achievements}</div>` : ''}
            </div>
        `;
    }

    // New helper: Generate achievement badges based on total count
    getTotalCompletionAchievements(count) {
        const badges = [];
        // Add achievement badges based on milestones
        if (count >= 10) badges.push('<span class="achievement" title="Beginner: 10+ completions">🌱</span>');
        if (count >= 50) badges.push('<span class="achievement" title="Consistent: 50+ completions">🌿</span>');
        if (count >= 100) badges.push('<span class="achievement" title="Dedicated: 100+ completions">🌳</span>');
        if (count >= 500) badges.push('<span class="achievement" title="Master: 500+ completions">🏆</span>');
        if (count >= 1000) badges.push('<span class="achievement" title="Legend: 1000+ completions">🏅</span>');

        return badges.length > 0 ? badges.join('') : null;
    }

    // Helper: Create a stat card
    createStatCard(title, content, description, status = '') {
        const card = document.createElement('div');
        card.className = `stat-card ${status}`;
        card.innerHTML = `
            <h4 class="stat-title">${title}</h4>
            <div class="stat-content">${content}</div>
            ${description ? `<p class="stat-description">${description}</p>` : ''}
        `;

        return card;
    }

    // Helper: Calculate overall completion rate
    calculateOverallCompletionRate() {
        const last30Days = [];
        // Get the last 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last30Days.push(date.toISOString().split('T')[0]);
        }

        // Count completions and total opportunities
        let totalCompletions = 0;
        let totalOpportunities = 0;
        this.habits.forEach(habit => {
            // Only count habits that existed during this period
            if (!habit.completionHistory || Object.keys(habit.completionHistory).length === 0) {
                return;
            }

            // Assuming the first completion date is close to creation date
            const firstCompletionDate = this.getFirstCompletionDate(habit);

            last30Days.forEach(date => {
                // Only count days since the habit was created
                if (!firstCompletionDate || new Date(date) >= new Date(firstCompletionDate)) {
                    totalOpportunities++;
                    if (habit.completionHistory[date]) {
                        totalCompletions++;
                    }
                }
            });
        });

        return totalOpportunities > 0 ? Math.round((totalCompletions / totalOpportunities) * 100) : 0;
    }

    // Helper: Get first completion date for a habit
    getFirstCompletionDate(habit) {
        if (!habit.completionHistory || Object.keys(habit.completionHistory).length === 0) {
            return null;
        }

        const dates = Object.keys(habit.completionHistory).sort();
        return dates[0];
    }

    // Helper: Generate streaks summary HTML
    generateStreaksSummary() {
        // Find habits with longest streaks
        const withStreaks = this.habits.filter(h => h.streak > 0)
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 5);

        if (withStreaks.length === 0) {
            return '<p>No active streaks yet. Complete habits to build streaks!</p>';
        }

        let html = '<div class="streaks-list">';
        withStreaks.forEach(habit => {
            const streakClass = habit.streak >= habit.goalValue ? 'achieved' :
                habit.streak >= Math.floor(habit.goalValue * 0.7) ? 'almost' : '';

            html += `
                <div class="streak-item ${streakClass}">
                    <div class="streak-badge">⚡ ${habit.streak}</div>
                    <div class="streak-details">
                        <span class="streak-name">${habit.name}</span>
                        <div class="streak-category">${habit.category}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    // Helper: Calculate category performance
    calculateCategoryPerformance() {
        const categoryStats = {};
        // Initialize stats for each category that has habits
        this.habits.forEach(habit => {
            const category = habit.category || 'General';
            if (!categoryStats[category]) {
                categoryStats[category] = {
                    total: 0,
                    completed: 0,
                    rate: 0,
                    habits: 0
                };
            }
            // Count how many habits are in each category
            categoryStats[category].habits++;
        });

        const last30Days = [];
        // Get the last 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last30Days.push(date.toISOString().split('T')[0]);
        }

        // Calculate completion stats for each habit by category
        this.habits.forEach(habit => {
            const category = habit.category || 'General';
            // Skip if we somehow don't have this category (shouldn't happen)
            if (!categoryStats[category]) return;

            // Count completions for this habit in the last 30 days
            let habitCompletions = 0;
            let habitOpportunities = 0;

            // Only count days after habit was created
            const firstCompletionDate = this.getFirstCompletionDate(habit);

            last30Days.forEach(date => {
                if (!firstCompletionDate || new Date(date) >= new Date(firstCompletionDate)) {
                    habitOpportunities++;
                    if (habit.completionHistory && habit.completionHistory[date]) {
                        habitCompletions++;
                    }
                }
            });

            // Add to category totals
            categoryStats[category].completed += habitCompletions;
            categoryStats[category].total += habitOpportunities;
        });

        // Calculate completion rates and filter out empty categories
        Object.keys(categoryStats).forEach(category => {
            const stats = categoryStats[category];
            if (stats.total === 0) {
                // No opportunities to complete (new habit with no history)
                stats.rate = 0;
            } else {
                stats.rate = Math.round((stats.completed / stats.total) * 100);
            }
        });

        // Filter out categories with no habits
        return Object.fromEntries(
            Object.entries(categoryStats).filter(([_, stats]) => stats.habits > 0)
        );
    }

    // Helper: Generate category chart HTML
    generateCategoryChart(categoryPerformance) {
        // Sort categories by completion rate
        const categories = Object.keys(categoryPerformance)
            .filter(cat => categoryPerformance[cat].habits > 0)
            .sort((a, b) => categoryPerformance[b].rate - categoryPerformance[a].rate);

        if (categories.length === 0) {
            return '<p>No category data available yet.</p>';
        }

        let html = '<div class="category-chart">';
        categories.forEach(category => {
            const stats = categoryPerformance[category];
            const percentage = stats.rate;
            const completionClass = percentage >= 70 ? 'good' :
                percentage >= 40 ? 'average' : 'low';

            // Generate chart bar with improved styling
            html += `
                <div class="chart-item">
                    <div class="chart-label" title="${category}">${category}</div>
                    <div class="chart-bar-container">
                        <div class="chart-bar ${completionClass}" style="width: ${percentage}%"></div>
                        <span class="chart-value">${percentage}%</span>
                    </div>
                    <div class="chart-details">
                        <span class="completion-count" title="${stats.completed} out of ${stats.total} opportunities">${stats.completed}/${stats.total}</span>
                        <span class="habit-count" title="${stats.habits} habit${stats.habits !== 1 ? 's' : ''}">
                            (${stats.habits} habit${stats.habits !== 1 ? 's' : ''})
                        </span>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // Helper: Calculate daily trends for the last 30 days
    calculateDailyTrends() {
        const trendData = [];

        // Get the last 30 days in reverse order (oldest first)
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];

            // Count completions for this date
            const totalHabitsExisting = this.habits.length;
            let completedCount = 0;
            this.habits.forEach(habit => {
                if (habit.completionHistory && habit.completionHistory[dateString]) {
                    completedCount++;
                }
            });

            trendData.push({
                date: dateString,
                completed: completedCount,
                total: totalHabitsExisting,
                formattedDate: date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            });
        }

        return trendData;
    }

    // Helper: Generate trends chart HTML
    generateTrendsChart(trendsData) {
        if (!trendsData || trendsData.length === 0) {
            return '<p>No trend data available yet.</p>';
        }

        // Find maximum value for scaling
        const maxValue = Math.max(...trendsData.map(day => day.completed), 1);

        let html = '<div class="trends-chart">';

        // Generate bars
        trendsData.forEach((day, index) => {
            const height = day.completed > 0 ? (day.completed / maxValue) * 100 : 0;
            const tooltip = `${day.formattedDate}: ${day.completed} habit${day.completed !== 1 ? 's' : ''} completed`;

            // Special class for today
            const isToday = index === trendsData.length - 1;

            html += `
                <div class="trend-bar-container" title="${tooltip}">
                    <div class="trend-bar ${isToday ? 'today' : ''}" style="height: ${height}%"></div>
                    ${index % 5 === 0 ? `<div class="trend-date">${day.formattedDate.split(' ')[1]}</div>` : ''}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    // Helper: Generate statistics summary table
    generateStatsSummaryTable() {
        // Sort habits by streak (descending)
        const sortedHabits = [...this.habits].sort((a, b) => b.streak - a.streak);

        if (sortedHabits.length === 0) {
            return '<p>No habits to summarize yet!</p>';
        }

        let html = `
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Habit</th>
                            <th>Streak</th>
                            <th>7 Day</th>
                            <th>30 Day</th>
                            <th>Goal Progress</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedHabits.forEach(habit => {
            const last7Days = this.calculateCompletionRateForPeriod(habit, 7);
            const last30Days = this.calculateCompletionRateForPeriod(habit, 30);
            const progressPercentage = habit.getProgressPercentage();
            const progressClass = progressPercentage >= 100 ? 'achieved' :
                progressPercentage >= 70 ? 'good' :
                    progressPercentage >= 40 ? 'average' : 'low';

            html += `
                <tr>
                    <td>
                        <div class="table-habit-name" title="${habit.name}">${habit.name}</div>
                        <div class="table-habit-category">${habit.category}</div>
                    </td>
                    <td><span class="badge streak-badge">${habit.streak}</span></td>
                    <td><span class="completion-rate ${last7Days >= 70 ? 'good' : 'low'}">${last7Days}%</span></td>
                    <td><span class="completion-rate ${last30Days >= 70 ? 'good' : 'low'}">${last30Days}%</span></td>
                    <td>
                        <div class="progress-minibar-container">
                            <div class="progress-minibar ${progressClass}" style="width: ${progressPercentage}%"></div>
                        </div>
                        <div class="progress-text">${progressPercentage}%</div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    // Helper: Calculate completion rate for a specific period
    calculateCompletionRateForPeriod(habit, days) {
        let completed = 0;
        const period = [];
        // Get the dates for the period
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            period.push(date.toISOString().split('T')[0]);
        }

        // Count completions
        period.forEach(date => {
            if (habit.completionHistory && habit.completionHistory[date]) {
                completed++;
            }
        });

        return Math.round((completed / days) * 100);
    }

    // NEW: Handle goal achievement
    handleGoalAchievement(habit) {
        // Record the achievement if not already recorded
        if (!habit.achievements) {
            habit.achievements = [];
        }

        // Record this achievement with timestamp
        const achievement = {
            date: new Date().toISOString(),
            goalType: habit.goalType,
            goalValue: habit.goalValue,
            streak: habit.streak,
            weeklyCompletions: [...habit.weeklyCompletions]
        };

        habit.achievements.push(achievement);

        // Visual celebration
        this.showGoalAchievementCelebration(habit);

        // Update habit status - we'll add a flag to track if user has acknowledged the achievement
        if (!habit.goalAcknowledged) {
            habit.goalAcknowledged = false;
        }

        this.saveHabits();
    }

    // NEW: Show celebration for goal achievement
    showGoalAchievementCelebration(habit) {
        // Fancy notification for goal achievement
        const message = habit.goalType === 'streak'
            ? `🏆 GOAL ACHIEVED! ${habit.streak}-day streak for "${habit.name}"!`
            : `🏆 GOAL ACHIEVED! Completed "${habit.name}" ${habit.goalValue} times this week!`;

        this.showNotification(message, 'success');

        // Play achievement sound if enabled
        if (!localStorage.getItem('habitsSoundDisabled')) {
            try {
                const audio = new Audio('data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaGR0YQAAAAxNYWRlIHdpdGggR1NNZAAR/+MYxAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxDsAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/+MYxMQAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
                audio.volume = 0.5;
                audio.play();
            } catch (e) {
                console.log("Sound couldn't play:", e);
            }
        }
    }

    // NEW: Handle goal action buttons
    handleGoalAction(habitId, action) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        switch (action) {
            case 'increaseGoal':
                // Increase the goal based on current goal type
                if (habit.goalType === 'streak') {
                    habit.goalValue = Math.ceil(habit.goalValue * 1.5); // Increase by 50%
                } else {
                    // For frequency goals, increase by 1 (max 7)
                    habit.goalValue = Math.min(7, habit.goalValue + 1);
                }
                habit.goalAcknowledged = true;
                this.showNotification(`Goal for "${habit.name}" increased to ${habit.goalValue}!`, 'info');
                break;
            case 'acknowledgeGoal':
                // Simply acknowledge the goal was achieved
                habit.goalAcknowledged = true;
                this.showNotification(`Keep up the great work with "${habit.name}"!`, 'info');
                break;
        }

        this.saveHabits();
        this.renderHabits();
    }

    // New: Get achievements for statistics
    getAchievements() {
        let allAchievements = [];
        this.habits.forEach(habit => {
            if (habit.achievements && habit.achievements.length > 0) {
                const habitAchievements = habit.achievements.map(achievement => ({
                    ...achievement,
                    habitId: habit.id,
                    habitName: habit.name,
                    category: habit.category
                }));
                allAchievements = [...allAchievements, ...habitAchievements];
            }
        });

        // Sort by date (newest first)
        return allAchievements.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Generate HTML for achievements list
    generateAchievementsHTML(achievements) {
        if (achievements.length === 0) {
            return '<p>No achievements yet. Complete your goals to see them here!</p>';
        }

        let html = '<div class="achievements-list">';

        // Show the 5 most recent achievements
        achievements.slice(0, 5).forEach(achievement => {
            const date = new Date(achievement.date).toLocaleDateString();
            let achievementDesc = '';
            if (achievement.goalType === 'streak') {
                achievementDesc = `Reached a ${achievement.streak}-day streak`;
            } else {
                achievementDesc = `Completed ${achievement.weeklyCompletions.length} times in a week`;
            }

            html += `
                <div class="achievement-item">
                    <div class="achievement-icon">🏆</div>
                    <div class="achievement-details">
                        <div class="achievement-title">${achievement.habitName}</div>
                        <div class="achievement-desc">${achievementDesc}</div>
                        <div class="achievement-date">${date}</div>
                    </div>
                </div>
            `;
        });

        if (achievements.length > 5) {
            html += `<div class="more-achievements">+${achievements.length - 5} more achievements</div>`;
        }

        html += '</div>';
        return html;
    }

    // New method to format and copy habit data as Logseq blocks
    copyAsLogseqBlock() {
        try {
            // Get today's date in YYYY-MM-DD format for Logseq page reference
            const today = new Date();
            const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD

            // Format the current date for display
            const displayDate = today.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Start building the Logseq formatted text
            let logseqBlock = `- [[Habit Tracker]]\n`;

            // Group habits by completion status
            const completedHabits = this.habits.filter(habit => habit.completedToday);
            const pendingHabits = this.habits.filter(habit => !habit.completedToday);

            // Add completed habits
            if (completedHabits.length > 0) {
                logseqBlock += `  - Completed habits\n`;
                completedHabits.forEach(habit => {
                    logseqBlock += `    - DONE ${habit.name} #[[${habit.category}]]\n`;
                });
            }

            // Add pending habits
            if (pendingHabits.length > 0) {
                logseqBlock += `  - Pending habits\n`;
                pendingHabits.forEach(habit => {
                    logseqBlock += `    - TODO ${habit.name} #[[${habit.category}]]\n`;
                });
            }

            // Add completion stats
            logseqBlock += `  - Stats\n`;
            const completionPercentage = Math.round((completedHabits.length / this.habits.length) * 100) || 0;
            logseqBlock += `    - ${completedHabits.length}/${this.habits.length} habits completed (${completionPercentage}%)\n`;

            // Check for today's achievements
            const todayAchievements = [];

            // Collect all of today's achievements
            this.habits.forEach(habit => {
                if (habit.achievements && Array.isArray(habit.achievements)) {
                    const achievedToday = habit.achievements.filter(achievement => {
                        // Check if achievement date is from today
                        const achievementDate = new Date(achievement.date).toISOString().split('T')[0];
                        return achievementDate === todayISO;
                    });

                    if (achievedToday.length > 0) {
                        achievedToday.forEach(achievement => {
                            todayAchievements.push({
                                habitName: habit.name,
                                category: habit.category,
                                goalType: achievement.goalType,
                                goalValue: achievement.goalValue,
                                streak: achievement.streak,
                                weeklyCompletions: achievement.weeklyCompletions?.length || 0
                            });
                        });
                    }
                }
            });

            // Add today's achievements section if we have any
            if (todayAchievements.length > 0) {
                logseqBlock += `  - 🏆 Today's Achievements #achievement\n`;
                todayAchievements.forEach(achievement => {
                    if (achievement.goalType === 'streak') {
                        logseqBlock += `    - Reached ${achievement.streak} day streak for "${achievement.habitName}" #[[${achievement.category}]]\n`;
                    } else {
                        logseqBlock += `    - Completed "${achievement.habitName}" ${achievement.weeklyCompletions} times this week (goal: ${achievement.goalValue}) #[[${achievement.category}]]\n`;
                    }
                });
            }

            // Add notable streaks (top 3)
            const topStreaks = [...this.habits]
                .filter(habit => habit.streak >= 3)  // Only include streaks of 3 or more
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 3);

            if (topStreaks.length > 0) {
                logseqBlock += `  - Notable streaks\n`;
                topStreaks.forEach(habit => {
                    logseqBlock += `    - ${habit.name}: ${habit.streak} days ⚡\n`;
                });
            }

            // Copy to clipboard
            navigator.clipboard.writeText(logseqBlock).then(() => {
                this.showToast(`Logseq block copied to clipboard for ${displayDate}`, {
                    type: 'success',
                    icon: '📋',
                    duration: 3000
                });
            }, err => {
                console.error('Could not copy text: ', err);
                this.showToast('Failed to copy to clipboard. See console for details.', {
                    type: 'error'
                });
            });
        } catch (error) {
            console.error('Error copying as Logseq block:', error);
            this.showToast('Error formatting Logseq block', { type: 'error' });
        }
    }

    // Method to show category management modal
    showCategoryManager() {
        // Create modal container if it doesn't exist
        let modal = document.getElementById('category-manager-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'category-manager-modal';
            modal.className = 'modal';

            document.body.appendChild(modal);
        }

        // Populate modal with current categories
        this.renderCategoryManagerContent(modal);

        // Show modal with fade-in effect
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);
    }

    // Render category manager content
    renderCategoryManagerContent(modal) {
        // Get categories with counts
        const categoryCounts = this.getCategoryUsageCounts();

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Category Manager</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="description">Manage your habit categories. <span class="warning-text">Warning: Deleting a category can affect habits assigned to it.</span></p>
                    
                    <div class="category-list">
                        ${this.categories.map(category => {
            const count = categoryCounts[category.toLowerCase()] || 0;
            const isDefault = this.getDefaultCategories().map(c => c.toLowerCase()).includes(category.toLowerCase());

            return `
                                <div class="category-item" data-category="${category.toLowerCase()}">
                                    <div class="category-badge" data-category="${category.toLowerCase()}">${category}</div>
                                    <span class="category-count">${count} habit${count !== 1 ? 's' : ''}</span>
                                    <div class="category-actions">
                                        <button class="btn-edit-category" data-category="${category}">${isDefault ? 'Rename' : 'Edit'}</button>
                                        <button class="btn-delete-category" data-category="${category}" ${isDefault ? 'disabled title="Default categories cannot be deleted"' : ''}>${isDefault ? 'Default' : 'Delete'}</button>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                    
                    <div class="add-category-form">
                        <h4>Add New Category</h4>
                        <div class="form-row">
                            <input type="text" id="new-category-name" placeholder="Enter category name">
                            <button id="add-category-btn">Add Category</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="close-category-manager">Close</button>
                </div>
            </div>
        `;

        // Add event listeners
        setTimeout(() => {
            // Close button
            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeCategoryManager());
            }

            // Close button in footer
            const closeFooterBtn = modal.querySelector('#close-category-manager');
            if (closeFooterBtn) {
                closeFooterBtn.addEventListener('click', () => this.closeCategoryManager());
            }

            // Add category button
            const addCategoryBtn = modal.querySelector('#add-category-btn');
            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', () => {
                    const input = document.getElementById('new-category-name');
                    const categoryName = input.value.trim();

                    if (categoryName) {
                        this.addCategory(categoryName);
                        input.value = '';
                        this.renderCategoryManagerContent(modal);
                    } else {
                        this.showNotification('Please enter a category name', 'error');
                    }
                });
            }

            // Enter key for adding category
            const newCategoryInput = modal.querySelector('#new-category-name');
            if (newCategoryInput) {
                newCategoryInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('add-category-btn').click();
                    }
                });
            }

            // Edit category buttons
            const editBtns = modal.querySelectorAll('.btn-edit-category');
            editBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const category = btn.dataset.category;
                    this.showEditCategoryModal(category);
                });
            });

            // Delete category buttons
            const deleteBtns = modal.querySelectorAll('.btn-delete-category:not([disabled])');
            deleteBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const category = btn.dataset.category;
                    this.showDeleteCategoryModal(category);
                });
            });
        }, 0);
    }

    // Close category manager
    closeCategoryManager() {
        const modal = document.getElementById('category-manager-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // Match transition duration in CSS
        }
    }

    // Get usage count for each category
    getCategoryUsageCounts() {
        const counts = {};

        this.habits.forEach(habit => {
            const category = habit.category.toLowerCase();
            counts[category] = (counts[category] || 0) + 1;
        });

        return counts;
    }

    // Add a new category
    addCategory(categoryName) {
        // Check if category already exists (case-insensitive)
        if (this.categories.some(cat => cat.toLowerCase() === categoryName.toLowerCase())) {
            this.showNotification('This category already exists', 'error');
            return false;
        }

        // Add the new category
        this.categories.push(categoryName);
        this.saveCategories();

        // Update category dropdown
        if (window.refreshCategoryDropdown) {
            window.refreshCategoryDropdown();
        } else {
            this.refreshCategoryDropdownDirectly();
        }

        this.showNotification(`Category "${categoryName}" added`, 'success');
        return true;
    }

    // Show modal to edit category
    showEditCategoryModal(categoryName) {
        // Create modal container if it doesn't exist
        let modal = document.getElementById('edit-category-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'edit-category-modal';
            modal.className = 'modal';

            document.body.appendChild(modal);
        }

        // Populate modal
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Edit Category</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Edit the name for category "${categoryName}"</p>
                    <div class="form-row">
                        <input type="text" id="edit-category-name" value="${categoryName}" placeholder="New category name">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-edit-category">Cancel</button>
                    <button id="save-category-edit" data-original-category="${categoryName}">Save Changes</button>
                </div>
            </div>
        `;

        // Show modal with fade-in effect
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('visible');
            // Focus on input
            document.getElementById('edit-category-name').focus();
        }, 10);

        // Add event listeners
        setTimeout(() => {
            // Close buttons
            modal.querySelector('.close-modal').addEventListener('click', () => this.closeEditCategoryModal());
            modal.querySelector('#cancel-edit-category').addEventListener('click', () => this.closeEditCategoryModal());

            // Save button
            modal.querySelector('#save-category-edit').addEventListener('click', () => {
                const originalCategory = categoryName;
                const newCategoryName = document.getElementById('edit-category-name').value.trim();

                if (newCategoryName && newCategoryName !== originalCategory) {
                    this.editCategory(originalCategory, newCategoryName);
                    this.closeEditCategoryModal();

                    // Refresh category manager
                    const categoryManager = document.getElementById('category-manager-modal');
                    if (categoryManager) {
                        this.renderCategoryManagerContent(categoryManager);
                    }
                } else if (!newCategoryName) {
                    this.showNotification('Category name cannot be empty', 'error');
                }
            });

            // Enter key
            document.getElementById('edit-category-name').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('save-category-edit').click();
                }
            });
        }, 0);
    }

    // Close edit category modal
    closeEditCategoryModal() {
        const modal = document.getElementById('edit-category-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    // Edit a category name
    editCategory(originalCategory, newCategory) {
        // Validate new category name doesn't already exist
        if (this.categories.some(cat =>
            cat !== originalCategory && cat.toLowerCase() === newCategory.toLowerCase())) {
            this.showNotification('This category already exists', 'error');
            return false;
        }

        // Update the category in the categories array
        const index = this.categories.findIndex(cat => cat === originalCategory);
        if (index !== -1) {
            this.categories[index] = newCategory;
        }

        // Update all habits with this category
        let habitCount = 0;
        this.habits.forEach(habit => {
            if (habit.category === originalCategory) {
                habit.category = newCategory;
                habitCount++;
            }
        });

        // Save changes
        this.saveCategories();
        this.saveHabits();

        // Update dropdown and render habits
        if (window.refreshCategoryDropdown) {
            window.refreshCategoryDropdown();
        } else {
            this.refreshCategoryDropdownDirectly();
        }

        this.renderHabits();

        this.showNotification(`Category renamed and updated for ${habitCount} habit${habitCount !== 1 ? 's' : ''}`, 'success');
        return true;
    }

    // Show delete category confirmation modal
    showDeleteCategoryModal(categoryName) {
        // Get count of habits in this category
        const habitCount = this.habits.filter(h => h.category === categoryName).length;

        // Create modal container if it doesn't exist
        let modal = document.getElementById('delete-category-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'delete-category-modal';
            modal.className = 'modal';

            document.body.appendChild(modal);
        }

        // Populate modal
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Delete Category</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="warning-text">Are you sure you want to delete the category "${categoryName}"?</p>
                    
                    ${habitCount > 0 ? `
                        <p>This category is used by ${habitCount} habit${habitCount !== 1 ? 's' : ''}. Please choose what to do with these habits:</p>
                        
                        <div class="radio-option">
                            <input type="radio" id="reassign-habits" name="delete-option" value="reassign" checked>
                            <label for="reassign-habits">Reassign habits to another category</label>
                        </div>
                        
                        <div class="reassign-container">
                            <select id="reassign-category">
                                ${this.categories
                    .filter(cat => cat !== categoryName)
                    .map(cat => `<option value="${cat}">${cat}</option>`)
                    .join('')}
                            </select>
                        </div>
                        
                        <div class="radio-option">
                            <input type="radio" id="delete-habits" name="delete-option" value="delete">
                            <label for="delete-habits">Delete all habits in this category</label>
                        </div>
                    ` : `
                        <p>This category is not currently used by any habits.</p>
                    `}
                </div>
                <div class="modal-footer">
                    <button id="cancel-delete-category">Cancel</button>
                    <button id="confirm-delete-category" data-category="${categoryName}" class="danger-btn">Delete Category</button>
                </div>
            </div>
        `;

        // Show modal with fade-in effect
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);

        // Add event listeners
        setTimeout(() => {
            // Close buttons
            modal.querySelector('.close-modal').addEventListener('click', () => this.closeDeleteCategoryModal());
            modal.querySelector('#cancel-delete-category').addEventListener('click', () => this.closeDeleteCategoryModal());

            // Radio buttons for habit handling
            if (habitCount > 0) {
                const reassignRadio = document.getElementById('reassign-habits');
                const deleteRadio = document.getElementById('delete-habits');
                const reassignContainer = document.querySelector('.reassign-container');

                reassignRadio.addEventListener('change', () => {
                    reassignContainer.style.display = 'block';
                });

                deleteRadio.addEventListener('change', () => {
                    reassignContainer.style.display = 'none';
                });
            }

            // Delete button
            modal.querySelector('#confirm-delete-category').addEventListener('click', () => {
                const category = categoryName;
                let action = 'delete'; // Default action
                let targetCategory = null;

                // If there are habits in this category, check what to do with them
                if (habitCount > 0) {
                    const reassignRadio = document.getElementById('reassign-habits');
                    if (reassignRadio.checked) {
                        action = 'reassign';
                        targetCategory = document.getElementById('reassign-category').value;
                    }
                }

                this.deleteCategory(category, action, targetCategory);
                this.closeDeleteCategoryModal();

                // Refresh category manager
                const categoryManager = document.getElementById('category-manager-modal');
                if (categoryManager) {
                    this.renderCategoryManagerContent(categoryManager);
                }
            });
        }, 0);
    }

    // Close delete category modal
    closeDeleteCategoryModal() {
        const modal = document.getElementById('delete-category-modal');
        if (modal) {
            modal.classList.remove('visible');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    // Delete a category
    deleteCategory(category, action = 'delete', targetCategory = null) {
        // Cannot delete default categories
        if (this.getDefaultCategories().map(c => c.toLowerCase()).includes(category.toLowerCase())) {
            this.showNotification('Cannot delete default categories', 'error');
            return false;
        }

        // Get affected habits
        const affectedHabits = this.habits.filter(h => h.category === category);

        // Handle habits based on selected action
        if (action === 'reassign' && targetCategory) {
            // Reassign habits to target category
            affectedHabits.forEach(habit => {
                habit.category = targetCategory;
            });

            this.saveHabits();
            this.showNotification(`Reassigned ${affectedHabits.length} habit${affectedHabits.length !== 1 ? 's' : ''} to "${targetCategory}"`, 'info');
        } else if (action === 'delete') {
            // Delete all habits in this category
            this.habits = this.habits.filter(h => h.category !== category);
            this.saveHabits();

            if (affectedHabits.length > 0) {
                this.showNotification(`Deleted ${affectedHabits.length} habit${affectedHabits.length !== 1 ? 's' : ''} in category "${category}"`, 'info');
            }
        }

        // Remove the category
        this.categories = this.categories.filter(c => c !== category);
        this.saveCategories();

        // Update category dropdown and render habits
        if (window.refreshCategoryDropdown) {
            window.refreshCategoryDropdown();
        } else {
            this.refreshCategoryDropdownDirectly();
        }

        this.renderHabits();
        this.showNotification(`Category "${category}" deleted`, 'success');
        return true;
    }
}

// Enhanced initialization to handle GitHub Pages routing
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#/habit-tracker') {
        const habitTrackerSection = document.getElementById('habit-tracker-section');
        if (habitTrackerSection) {
            habitTrackerSection.style.display = 'block';
            if (!window.habitTrackerInstance) {
                window.habitTrackerInstance = new HabitTracker();
            } else {
                window.habitTrackerInstance.renderHabits();
            }
        }
    }

    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});

// At the end of your file, update the hashchange handler
window.addEventListener('hashchange', () => {
    const habitTrackerSection = document.getElementById('habit-tracker-section');
    if (window.location.hash === '#/habit-tracker') {
        if (habitTrackerSection) {
            habitTrackerSection.style.display = 'block';
            if (!window.habitTrackerInstance) {
                window.habitTrackerInstance = new HabitTracker();
            } else {
                window.habitTrackerInstance.renderHabits();
            }
        }
    } else if (habitTrackerSection) {
        habitTrackerSection.style.display = 'none';
        // Clean up when navigating away from habit tracker
        if (window.habitTrackerInstance) {
            window.habitTrackerInstance.cleanup();
        }
    }
});
