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

        // Store the custom option if it exists
        const customOption = categorySelect.querySelector('option[value="custom"]');

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

        // Always add the custom option at the end
        const newCustomOption = customOption || document.createElement('option');
        newCustomOption.value = 'custom';
        newCustomOption.textContent = '+ Add Custom Category';
        categorySelect.appendChild(newCustomOption);

        // Reset custom category input
        const customCategoryInput = document.getElementById('custom-category');
        if (customCategoryInput) {
            customCategoryInput.value = '';
        }
        const customCategoryContainer = document.getElementById('custom-category-container');
        if (customCategoryContainer) {
            customCategoryContainer.style.display = 'none';
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

        // Add event listener for category selection changes
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
            setTimeout(initCategoryHandling, 100);
        });
    }

    // Initialize when page loads directly with habit tracker hash
    if (window.location.hash === '#/habit-tracker' || window.location.hash === '#/NamesAreOverrated.github.io/habit-tracker') {
        setTimeout(initCategoryHandling, 300);
    }

    // Listen for hashchange events
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#/habit-tracker' || window.location.hash === '#/NamesAreOverrated.github.io/habit-tracker') {
            setTimeout(initCategoryHandling, 300);
        }
    });

    // Listen for custom events to refresh categories
    window.addEventListener('habit-data-imported', () => {
        setTimeout(populateCategoryDropdown, 100);
    });

    // Export function to global scope for other scripts to use
    window.refreshCategoryDropdown = populateCategoryDropdown;
});
