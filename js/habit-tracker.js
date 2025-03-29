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
        const diff = now.getDate() - daysToSubtract;
        const weekStart = new Date(now.setDate(diff));
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
        this.categories = ['Health', 'Work', 'Learning', 'Personal', 'General']; // Default categories
        this.loadHabits();

        // Set up event listeners
        document.getElementById('habit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addHabit();
        });

        // Add event for Enter key in habit input
        document.getElementById('habit-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addHabit();
            }
        });

        // Add event listeners for data import/export
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const importFile = document.getElementById('import-file');
        const resetBtn = document.getElementById('reset-data');

        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
        if (importBtn) importBtn.addEventListener('click', () => document.getElementById('import-file').click());
        if (importFile) importFile.addEventListener('change', (e) => this.importData(e));
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetData());

        // Add console message for nerdy users who check the console
        console.log("%c✅ Habit Tracker initialized", "color: #0f0; font-weight: bold;");
        console.log("%c📊 Your data is stored locally in this browser", "color: #0cf;");

        // Display week streak information on load (for debugging)
        if (this.habits.length > 0) {
            this.displayWeekStreakInfo();
        }

        // Initialize habits list
        this.renderHabits();

        // Set up category filter event listeners
        this.setupCategoryFilter();
    }

    // Load habits from localStorage
    loadHabits() {
        const storedHabits = localStorage.getItem('habits');
        if (storedHabits) {
            // Parse stored habits and ensure instances are proper Habit objects
            const parsedHabits = JSON.parse(storedHabits);
            this.habits = parsedHabits.map(habit => {
                const newHabit = new Habit(
                    habit.id,
                    habit.name,
                    habit.goalType || 'streak',
                    habit.goalValue || 7,
                    habit.category || 'General'  // Add the category parameter
                );
                // Copy over properties that might be in the stored object
                newHabit.streak = habit.streak || 0;
                newHabit.lastCompletedDate = habit.lastCompletedDate;
                newHabit.completedToday = habit.completedToday || false;
                newHabit.weeklyCompletions = habit.weeklyCompletions || [];
                newHabit.weekStartDate = habit.weekStartDate || newHabit.getWeekStartDate();
                newHabit.completionHistory = habit.completionHistory || {}; // New: Load completion history
                newHabit.weekStreak = habit.weekStreak || 0;
                newHabit.completedWeeks = habit.completedWeeks || 0;
                return newHabit;
            });

            // Extract custom categories from loaded habits
            this.habits.forEach(habit => {
                if (habit.category && !this.categories.includes(habit.category)) {
                    this.categories.push(habit.category);
                }
            });

            this.checkDayChange();
            this.checkWeekChange();
        }
    }

    // Save habits to localStorage
    saveHabits() {
        localStorage.setItem('habits', JSON.stringify(this.habits));

        // Add visual feedback when saving - position on bottom-left to avoid disco button
        const saveIndicator = document.createElement('div');
        saveIndicator.textContent = '💾 Saved';
        saveIndicator.style.position = 'fixed';
        saveIndicator.style.bottom = '20px';
        saveIndicator.style.left = '20px'; // Changed from right to left
        saveIndicator.style.backgroundColor = 'var(--accent-color)'; // Using site's accent color
        saveIndicator.style.color = '#000';
        saveIndicator.style.padding = '5px 10px';
        saveIndicator.style.borderRadius = '4px';
        saveIndicator.style.opacity = '0.9';
        saveIndicator.style.zIndex = '999'; // Ensure it's above other elements
        document.body.appendChild(saveIndicator);

        setTimeout(() => {
            saveIndicator.style.opacity = '0';
            saveIndicator.style.transition = 'opacity 0.5s ease';

            setTimeout(() => {
                document.body.removeChild(saveIndicator);
            }, 500);
        }, 1000);
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

            // Validate goal value is a positive number
            if (isNaN(goalValue) || goalValue <= 0) {
                alert('Please enter a valid positive number for your goal target.');
                return;
            }

            // Handle custom category properly
            if (category === 'custom') {
                const customCategory = document.getElementById('custom-category').value.trim();
                if (customCategory) {
                    category = customCategory; // Use the custom category name directly
                    if (!this.categories.includes(customCategory)) {
                        this.categories.push(customCategory);
                    }
                } else {
                    alert('Please enter a valid custom category name');
                    return;
                }
            }

            // Create and add the new habit with selected/custom category
            const habit = new Habit(id, habitName, goalType, goalValue, category);
            habit.weekStreak = 0;
            habit.completedWeeks = 0;

            // Initialize the weekStartDate for new habits
            habit.weekStartDate = habit.getWeekStartDate();

            this.habits.push(habit);
            this.saveHabits();
            this.renderHabits();

            // Reset form
            habitInput.value = '';
            habitInput.focus();
            categorySelect.value = 'General';
            document.getElementById('custom-category-container').style.display = 'none';
            document.getElementById('custom-category').value = '';

            // Visual feedback
            const formElement = document.getElementById('habit-form');
            formElement.classList.add('success-submit');
            setTimeout(() => {
                formElement.classList.remove('success-submit');
            }, 1000);
        }
    }

    // Delete a habit
    deleteHabit(id) {
        // Show confirmation before deleting
        if (confirm('Are you sure you want to delete this habit?')) {
            this.habits = this.habits.filter(habit => habit.id !== id);
            this.saveHabits();
            this.renderHabits();
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

                // Update streak logic
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayString = yesterday.toDateString();

                if (habit.lastCompletedDate === yesterdayString || habit.streak === 0) {
                    habit.streak++;
                }

                // Add to weekly completions if not already there
                if (!habit.weeklyCompletions.includes(todayISO)) {
                    habit.weeklyCompletions.push(todayISO);

                    // Check if this completion achieves the weekly goal
                    if (habit.goalType === 'frequency' &&
                        habit.weeklyCompletions.length === habit.goalValue) {
                        console.log(`${habit.name}: Weekly goal achieved! (${habit.goalValue} times this week)`);
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

                // If streak is now 0, also reset the lastCompletedDate
                if (habit.streak === 0) {
                    habit.lastCompletedDate = null;
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
            if (habit.lastCompletedDate && habit.lastCompletedDate !== today) {
                habit.completedToday = false;

                // Check if streak should be broken
                const lastCompleted = new Date(habit.lastCompletedDate);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                // Only break streak if it's more than 1 day since last completion AND we have a streak
                if (habit.streak > 0 && lastCompleted.toDateString() !== yesterday.toDateString()) {
                    console.log(`${habit.name}: Streak broken. Was: ${habit.streak}`);
                    habit.streak = 0;
                    habit.lastCompletedDate = null; // Reset last completed date when streak is broken
                }
            }
        });

        this.saveHabits();
    }

    // Check if week has changed and reset weekly completions
    checkWeekChange() {
        const currentWeekStart = new Habit(null, null).getWeekStartDate();

        this.habits.forEach(habit => {
            if (habit.weekStartDate !== currentWeekStart) {
                console.log(`Week changed for ${habit.name}`);

                // Before resetting, check if previous week's goal was achieved
                if (habit.goalType === 'frequency') {
                    const previousGoalAchieved = habit.weeklyCompletions.length >= habit.goalValue;

                    // Update week streak based on previous week's achievement
                    if (previousGoalAchieved) {
                        habit.weekStreak++;
                        habit.completedWeeks++;
                        console.log(`${habit.name}: Week completed! Streak now: ${habit.weekStreak}`);
                    } else if (habit.weeklyCompletions.length > 0) {
                        // Only reset streak if there was at least one completion but goal wasn't met
                        // This avoids resetting streak for habits that weren't relevant that week
                        if (habit.weekStreak > 0) {
                            console.log(`${habit.name}: Week streak broken. Was: ${habit.weekStreak}`);
                            habit.weekStreak = 0;
                        }
                    }
                    // If there were zero completions and it's a recently added habit (this week),
                    // we don't penalize by resetting streak
                }

                // Week has changed, reset weekly tracking
                habit.weeklyCompletions = [];
                habit.weekStartDate = currentWeekStart;
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
    }

    // Helper method to create a habit element (extracted from renderHabits)
    createHabitElement(habit, weekDays) {
        const habitElement = document.createElement('div');
        habitElement.className = `habit-item ${habit.completedToday ? 'completed' : ''}`;
        habitElement.dataset.category = habit.category;  // Add category as a data attribute
        habitElement.dataset.goalType = habit.goalType;  // Add goal type as a data attribute

        // For custom categories that aren't in our predefined list, generate a color
        if (habit.category && !['Health', 'Work', 'Learning', 'Personal', 'General'].includes(habit.category)) {
            // Generate a consistent color for the custom category based on its name
            const customColor = this.getColorForCategory(habit.category);
            habitElement.style.borderRight = `3px solid ${customColor}`;

            // Also add a matching style for the category badge (will be applied after element is added to DOM)
            setTimeout(() => {
                const categoryBadge = habitElement.querySelector('.habit-category');
                if (categoryBadge) {
                    categoryBadge.style.backgroundColor = `rgba(${parseInt(customColor.slice(1, 3), 16)}, ${parseInt(customColor.slice(3, 5), 16)}, ${parseInt(customColor.slice(5, 7), 16)}, 0.2)`;
                    categoryBadge.style.color = customColor;
                }
            }, 0);
        }

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

        // Simplified habit display - removed goal type indicator
        habitElement.innerHTML = `
            <div class="habit-info">
                <div class="habit-header">
                    <div class="habit-title">
                        <span class="habit-name">${habit.name}</span>
                        <span class="habit-category">${habit.category}</span>
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
        // Fix the conversion here as well
        const dayOfWeek = today.getDay();
        const mondayBasedIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        // Calculate total days needed (weeks * 7)
        const totalDays = weeks * 7;

        // Loop through days from today backwards
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);

            // Convert day of week for the date to Monday-based index
            const dateDayOfWeek = date.getDay();
            const adjustedDayOfWeek = dateDayOfWeek === 0 ? 6 : dateDayOfWeek - 1;

            dates.unshift({
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                dayOfWeek: adjustedDayOfWeek, // 0-6 for Monday-Sunday
                month: date.getMonth(), // 0-11 for tracking month changes
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
        Object.keys(datesByMonth).forEach(month => {
            const label = document.createElement('div');
            label.className = 'month-label';
            label.textContent = monthNames[parseInt(month)];

            // Calculate proper width based on days count
            const daysInMonth = datesByMonth[month].length;
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
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.id = 'heatmap-tooltip';
        document.body.appendChild(tooltip);

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

                        tooltip.textContent = `${formattedDate}: ${stats.count} habit${stats.count !== 1 ? 's' : ''} completed`;
                        tooltip.style.opacity = '1';

                        // Position the tooltip - use fixed position relative to viewport
                        const rect = cell.getBoundingClientRect();
                        tooltip.style.left = `${rect.left + rect.width / 2}px`;
                        tooltip.style.top = `${rect.top - 5}px`;
                    });

                    cell.addEventListener('mouseleave', () => {
                        tooltip.style.opacity = '0';
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

        // Add window event listener to update tooltip position on scroll/resize
        const updateTooltipPosition = () => {
            const activeCell = document.querySelector('.heatmap-cell:hover');
            if (activeCell && tooltip.style.opacity !== '0') {
                const rect = activeCell.getBoundingClientRect();
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.top - 5}px`;
            }
        };

        window.addEventListener('scroll', updateTooltipPosition, { passive: true });
        window.addEventListener('resize', updateTooltipPosition, { passive: true });

        // Clean up any existing tooltip to prevent duplicates
        const existingTooltip = document.getElementById('heatmap-tooltip');
        if (existingTooltip && existingTooltip !== tooltip) {
            existingTooltip.remove();
        }
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

        // Add filter buttons
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
            if (this.habits.some(habit => habit.category === category)) {
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
                    }

                    // Ensure default categories are included
                    const defaultCategories = ['Health', 'Work', 'Learning', 'Personal', 'General'];
                    defaultCategories.forEach(category => {
                        if (!this.categories.includes(category)) {
                            this.categories.push(category);
                        }
                    });

                    this.saveHabits();
                    this.renderHabits();

                    // Check for day/week changes
                    this.checkDayChange();
                    this.checkWeekChange();

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

    // Reset all habit data
    resetData() {
        // Double confirmation to prevent accidental data loss
        if (confirm('WARNING: This will permanently delete all your habit data. Are you sure?')) {
            // Second confirmation with more explicit warning
            if (confirm('FINAL WARNING: This action cannot be undone. All habits and tracking history will be lost. Continue?')) {
                // Clear habits array
                this.habits = [];

                // Reset categories to defaults
                this.categories = ['Health', 'Work', 'Learning', 'Personal', 'General'];

                // Clear localStorage
                localStorage.removeItem('habits');

                // Render empty habits list
                this.renderHabits();

                // Show notification
                this.showNotification('All habit data has been reset!', 'error');

                // Remove any category filters
                const filterContainer = document.getElementById('category-filters');
                if (filterContainer) {
                    filterContainer.innerHTML = '';
                }
            }
        }
    }

    // Display notification message
    showNotification(message, type = 'info') {
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification ${type}-notification`;
        notificationElement.textContent = message;

        // Add icon based on notification type
        const icon = document.createElement('span');
        icon.className = 'notification-icon';

        switch (type) {
            case 'success':
                icon.innerHTML = '✅';
                break;
            case 'error':
                icon.innerHTML = '❌';
                break;
            case 'info':
            default:
                icon.innerHTML = 'ℹ️';
                break;
        }

        notificationElement.prepend(icon);

        // Add to the DOM - position on bottom-left similar to save indicator
        document.body.appendChild(notificationElement);

        // Fade in
        setTimeout(() => {
            notificationElement.style.opacity = '1';
            notificationElement.style.transform = 'translateY(0)';
        }, 10);

        // Fade out and remove
        setTimeout(() => {
            notificationElement.style.opacity = '0';
            notificationElement.style.transform = 'translateY(20px)';

            setTimeout(() => {
                document.body.removeChild(notificationElement);
            }, 500);
        }, 3000);
    }
}

// Initialize the habit tracker when the page loads or when navigated to
document.addEventListener('DOMContentLoaded', () => {
    // Create the tracker instance if it doesn't exist yet
    if (!window.habitTrackerInstance) {
        window.habitTrackerInstance = new HabitTracker();
        console.log("Habit Tracker initialized on page load");
    }

    // Set the current year in the footer if it exists
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
});

// Add event listener for hash changes to reinitialize tracker if needed
window.addEventListener('hashchange', () => {
    // Check if navigating to habit tracker
    if (window.location.hash === '#/habit-tracker') {
        // If tracker is not initialized, create it
        if (!window.habitTrackerInstance) {
            window.habitTrackerInstance = new HabitTracker();
            console.log("Habit Tracker initialized on navigation");
        } else {
            // If already exists, refresh the habits display
            window.habitTrackerInstance.renderHabits();
            console.log("Habit Tracker refreshed on navigation");
        }
    }
});
