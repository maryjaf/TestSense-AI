const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
const readline = require("readline");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { exec } = require("child_process");

// Initialize OpenAI Configuration
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

// Ensure Cypress configuration exists
function ensureCypressConfig() {
    const configPath = path.join(__dirname, "cypress.config.js");

    if (!fs.existsSync(configPath)) {
        const configContent = `
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
        `.trim();

        fs.writeFileSync(configPath, configContent, "utf8");
        console.log("Cypress configuration file created at:", configPath);
    } else {
        console.log("Cypress configuration file already exists.");
    }
}

// Log all issues with title and description
async function logAllIssues() {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/Giveth/giveth-dapps-v2/issues`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                },
            }
        );

        console.log("\nAll Issues:\n");
        response.data.forEach((issue) => {
            console.log(`Issue #${issue.number}: ${issue.title}`);
            console.log(`Description: ${issue.body}`);
            console.log("---------------------------------------");
        });
    } catch (error) {
        console.error("Error fetching all issues:", error.message);
    }
}

// Function to fetch a specific GitHub issue and generate test steps
async function fetchIssue(issueNumber) {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/Giveth/giveth-dapps-v2/issues/${issueNumber}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                },
            }
        );

        const issue = response.data;
        console.log(`Issue #${issue.number}: ${issue.title}`);
        console.log(`Description: ${issue.body}`);
        console.log("---------------------------------------");

        const { testSteps, positiveScenarios, negativeScenarios } = await generateTestStepsAndScenarios(issue.body);
        console.log("\n### Detailed Test Steps for UI Testing:\n", testSteps);
        console.log("\n### Positive Test Scenarios:\n", positiveScenarios);
        console.log("\n### Negative Test Scenarios:\n", negativeScenarios);

        if (testSteps === "Failed to generate test steps.") {
            console.error("Skipping test execution as test steps could not be generated.");
            return;
        }

        await generateAndRunCypressTests(issue.body, testSteps, positiveScenarios, negativeScenarios);
    } catch (error) {
        console.error("Error fetching the issue:", error.message);
    }
}

// Function to generate test steps and scenarios
async function generateTestStepsAndScenarios(issueDescription) {
    try {
        const prompt = `
You are a QA engineer. Based on the following issue description, generate:
1. A section titled "Detailed Test Steps for UI Testing" with a numbered list of test steps.
2. A section titled "Positive Test Scenarios" with numbered use cases.
3. A section titled "Negative Test Scenarios" with numbered edge cases.

The response format must strictly follow this structure:

**Detailed Test Steps for UI Testing:**
1. Step 1
2. Step 2
...

**Positive Test Scenarios:**
1. Scenario 1
2. Scenario 2
...

**Negative Test Scenarios:**
1. Scenario 1
2. Scenario 2
...

Issue Description:
${issueDescription}
`;

        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a QA engineer." },
                { role: "user", content: prompt },
            ],
            max_tokens: 3000,
        });

        const content = response.data.choices[0].message.content.trim();
        console.log("Full OpenAI Response:\n", content);

        const extractSection = (sectionTitle) => {
            const regex = new RegExp(`\\*\\*${sectionTitle}:\\*\\*\\s*([\\s\\S]*?)(?=\\*\\*|$)`);
            const match = content.match(regex);
            return match ? match[1].trim() : "No data generated.";
        };

        return {
            testSteps: extractSection("Detailed Test Steps for UI Testing"),
            positiveScenarios: extractSection("Positive Test Scenarios"),
            negativeScenarios: extractSection("Negative Test Scenarios"),
        };
    } catch (error) {
        console.error("Error generating test steps and scenarios:", error.message);
        return {
            testSteps: "Failed to generate test steps.",
            positiveScenarios: "No positive scenarios generated.",
            negativeScenarios: "No negative scenarios generated.",
        };
    }
}

// Function to generate and run Cypress tests
async function generateAndRunCypressTests(issueDescription, testSteps, positiveScenarios, negativeScenarios) {
    try {
        const prompt = `
You are an expert in QA and Cypress testing. Based on the following details, generate Cypress test code without any additional description or markdown formatting.

Issue Description:
${issueDescription}

Detailed Test Steps for UI Testing:
${testSteps}

Positive Test Scenarios:
${positiveScenarios}

Negative Test Scenarios:
${negativeScenarios}
`;

        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a QA engineer and Cypress expert." },
                { role: "user", content: prompt },
            ],
            max_tokens: 2000,
        });

        let cypressCode = response.data.choices[0].message.content.trim();
        cypressCode = cypressCode.replace(/^```javascript/, "").replace(/```$/, "").trim();

        const lastIndex = cypressCode.lastIndexOf("});");
        if (lastIndex !== -1) {
            cypressCode = cypressCode.substring(0, lastIndex + 3);
        }

        console.log("Generated Cypress Test Code:\n", cypressCode);

        const cypressDir = path.join(__dirname, "cypress", "integration");
        if (!fs.existsSync(cypressDir)) {
            fs.mkdirSync(cypressDir, { recursive: true });
        }

        const testFilePath = path.join(cypressDir, "generatedTest.spec.js");
        fs.writeFileSync(testFilePath, cypressCode, "utf8");
        console.log(`Cypress test script saved to: ${testFilePath}`);

        ensureCypressConfig();
        exec("npx cypress run", (error, stdout, stderr) => {
            console.log("Cypress STDOUT:\n", stdout);
            console.error("Cypress STDERR:\n", stderr);
            if (error) {
                console.error(`Error running Cypress tests: ${error.message}`);
            } else {
                console.log("Cypress tests executed successfully.");
            }
        });
    } catch (error) {
        console.error("Error generating Cypress tests:", error.message);
    }
}

// Prompt for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

logAllIssues();
rl.question("Enter the GitHub issue number to fetch: ", (issueNumber) => {
    fetchIssue(issueNumber);
    rl.close();
});