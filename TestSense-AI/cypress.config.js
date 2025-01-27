const { defineConfig } = require("cypress");

module.exports = defineConfig({
    e2e: {
        setupNodeEvents(on, config) {},
        specPattern: "cypress/integration/**/*.spec.js",
        supportFile: false,
        reporter: "mochawesome",
        reporterOptions: {
            reportDir: "cypress/reports",
            overwrite: true,
            html: true,
            json: true
        },
    },
});