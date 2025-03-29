// Initialize habit tracker categories dropdown

document.addEventListener('DOMContentLoaded', () => {
    // Function to populate category dropdown
    function populateCategoryDropdown() {
        const categorySelect = document.getElementById('habit-category');
        const habitTracker = window.habitTrackerInstance;

        if (!categorySelect) {
            console.warn('Category select element not found');
            return;
        }

        if (!habitTracker) {
            console.warn('Habit tracker instance not found');
            return;
        }

        console.log('Refreshing category dropdown with categories:', habitTracker.categories);

        // Clear all options
        categorySelect.innerHTML = '';

        // Add categories from the habit tracker
        if (habitTracker.categories && habitTracker.categories.length > 0) {
            habitTracker.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.toLowerCase();
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        } else {
            // If no categories exist yet, add default ones
            const defaultCategories = habitTracker.getDefaultCategories();
            defaultCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.toLowerCase();
                option.textContent = category;
                categorySelect.appendChild(option);
            });
        }
    }

    // Function to initialize habit tracker category handling
    function initCategoryHandling() {
        // Wait for habit tracker instance to be available
        if (!window.habitTrackerInstance) {
            setTimeout(initCategoryHandling, 100);
            return;
        }

        // Populate the dropdown with categories
        populateCategoryDropdown();

        // Force refresh heatmap when initialized
        if (window.habitTrackerInstance.refreshHeatmap) {
            window.habitTrackerInstance.refreshHeatmap();
        }

        // Add event listener for goal type changes
        const goalTypeSelect = document.getElementById('goal-type');
        if (goalTypeSelect) {
            goalTypeSelect.addEventListener('change', (e) => {
                const goalUnit = document.getElementById('goal-unit');
                if (goalUnit) {
                    goalUnit.textContent = e.target.value === 'streak' ? 'days' : 'times/week';
                }
            });
        }

        // Add event listener for manage categories button
        const manageCategoriesBtn = document.getElementById('manage-categories-btn');
        if (manageCategoriesBtn) {
            manageCategoriesBtn.addEventListener('click', () => {
                if (window.habitTrackerInstance) {
                    window.habitTrackerInstance.showCategoryManager();
                }
            });
        }

        // Add styling for category badges based on category name
        const refreshCategoryStyles = () => {
            if (!window.habitTrackerInstance) return;

            setTimeout(() => {
                document.querySelectorAll('.habit-category').forEach(badge => {
                    const category = badge.textContent.toLowerCase().trim();

                    // Set the data-category attribute to ensure CSS selectors work
                    badge.setAttribute('data-category', category);

                    // First check if it's a default category
                    const defaultCategories = window.habitTrackerInstance.getDefaultCategories().map(c => c.toLowerCase());
                    if (!defaultCategories.includes(category)) {
                        // Apply custom styling for non-default categories
                        const color = window.habitTrackerInstance.getColorForCategory(category);
                        badge.style.backgroundColor = `${color}30`; // 30 is hex for ~19% opacity
                        badge.style.color = color;
                        badge.style.border = `1px solid ${color}`;
                    } else {
                        // Default categories are handled by CSS attribute selectors
                        // But let's make sure inline styles don't override them
                        badge.style.removeProperty('background-color');
                        badge.style.removeProperty('color');
                        badge.style.removeProperty('border');
                    }
                });
            }, 100);
        };

        // Call the style refresh function after rendering habits
        const originalRenderHabits = window.habitTrackerInstance?.renderHabits;
        if (originalRenderHabits) {
            window.habitTrackerInstance.renderHabits = function () {
                originalRenderHabits.call(window.habitTrackerInstance);
                refreshCategoryStyles();
            };
        }
    }

    // Update category dropdown when habit tracker tab is shown
    const habitTrackerLink = document.getElementById('habit-tracker-link');
    if (habitTrackerLink) {
        habitTrackerLink.addEventListener('click', () => {
            setTimeout(() => {
                initCategoryHandling();
                // Also refresh the heatmap when opening the tab
                if (window.habitTrackerInstance && window.habitTrackerInstance.refreshHeatmap) {
                    window.habitTrackerInstance.refreshHeatmap();
                }
            }, 100);
        });
    }

    // Initialize when page loads directly with habit tracker hash
    if (window.location.hash === '#/habit-tracker' || window.location.hash === '#/NamesAreOverrated.github.io/habit-tracker') {
        setTimeout(() => {
            initCategoryHandling();
            // Also refresh the heatmap when opening via hashchange
            if (window.habitTrackerInstance && window.habitTrackerInstance.refreshHeatmap) {
                window.habitTrackerInstance.refreshHeatmap();
            }
        }, 300);
    }

    // Listen for hashchange events
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#/habit-tracker' || window.location.hash === '#/NamesAreOverrated.github.io/habit-tracker') {
            setTimeout(() => {
                initCategoryHandling();
                // Also refresh the heatmap when opening via hashchange
                if (window.habitTrackerInstance && window.habitTrackerInstance.refreshHeatmap) {
                    window.habitTrackerInstance.refreshHeatmap();
                }
            }, 300);
        }
    });

    // Listen for custom events to refresh categories
    window.addEventListener('habit-data-imported', () => {
        setTimeout(populateCategoryDropdown, 100);
    });

    // Export function to global scope for other scripts to use
    window.refreshCategoryDropdown = populateCategoryDropdown;
});
