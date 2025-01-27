// This is where you can define global setup for Cypress tests
// Import custom commands (if any)
import './commands';

// Add event listeners or global hooks (optional)
Cypress.on('uncaught:exception', (err, runnable) => {
    // Prevent failing tests on uncaught exceptions
    return false;
});
