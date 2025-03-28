// Terminal typing effect
const messages = [
    "Hello, World!",
    "Welcome!",
    "I Installed Arch all by myself btw.",
    "Are you impressed?",
    "Please love me.",
    "Mwah Mwah.",
];

let typedTextElement;
let messageIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingDelay = 100;

/**
 * Initializes the typing effect
 */
function initTypingEffect() {
    typedTextElement = document.getElementById("typed-text");

    // Only start typing if the element exists
    if (typedTextElement) {
        typeText();
    }
}

/**
 * Creates a typing effect in the terminal
 */
function typeText() {
    const currentMessage = messages[messageIndex];

    if (isDeleting) {
        typedTextElement.textContent = currentMessage.substring(0, charIndex - 1);
        charIndex--;
        typingDelay = 50;
    } else {
        typedTextElement.textContent = currentMessage.substring(0, charIndex + 1);
        charIndex++;
        typingDelay = 100;
    }

    if (!isDeleting && charIndex === currentMessage.length) {
        isDeleting = true;
        typingDelay = 1000;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        messageIndex = (messageIndex + 1) % messages.length;
        typingDelay = 500;
    }

    setTimeout(typeText, typingDelay);
}

export { initTypingEffect };
