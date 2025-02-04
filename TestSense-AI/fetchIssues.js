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

// Extract URLs from the issue description, excluding GitHub links
function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (text.match(urlRegex) || []).filter(url => !url.includes("github.com"));
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

// Post comment to GitHub issue
async function postComment(issueNumber, body) {
    try {
        const response = await axios.post(
            `https://api.github.com/repos/Giveth/giveth-dapps-v2/issues/${issueNumber}/comments`,
            { body },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    "Content-Type": "application/json",
                },
            }
        );
        console.log("Comment posted successfully:", response.data.html_url);
    } catch (error) {
        console.error("Error posting comment to GitHub:", error.message);
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

        const extractedUrls = extractUrls(issue.body);
        console.log("Extracted URLs (excluding GitHub links):", extractedUrls);

        const { testSteps, positiveScenarios, negativeScenarios } = await generateTestStepsAndScenarios(issue.body);
        console.log("\n### Detailed Test Steps for UI Testing:\n", testSteps);
        console.log("\n### Positive Test Scenarios:\n", positiveScenarios);
        console.log("\n### Negative Test Scenarios:\n", negativeScenarios);

        // Post test details as a comment
        const testDetailsComment = `
**Detailed Test Steps for UI Testing:**
${testSteps}

**Positive Test Scenarios:**
${positiveScenarios}

**Negative Test Scenarios:**
${negativeScenarios}
        `.trim();
        await postComment(issueNumber, testDetailsComment);

        if (testSteps === "Failed to generate test steps.") {
            console.error("Skipping test execution as test steps could not be generated.");
            return;
        }

        await generateAndRunCypressTests(issue.body, extractedUrls, testSteps, positiveScenarios, negativeScenarios, issueNumber);
    } catch (error) {
        console.error("Error fetching the issue:", error.message);
    }
}

// Function to generate and run Cypress tests using extracted URLs
// Function to generate and run AI-driven Cypress tests
// Function to fetch page HTML and extract selectors
async function fetchPageHtml(url) {
    try {
        const response = await axios.get(url);
        return response.data; // Return raw HTML
    } catch (error) {
        console.error(`❌ Failed to fetch HTML for ${url}:`, error.message);
        return null;
    }
}

// Function to extract meaningful selectors from the page HTML
function extractValidSelectors(html) {
    const matches = [...html.matchAll(/class="([^"]+)"/g)];
    const uniqueSelectors = [...new Set(matches.map(match => `.${match[1].replace(/\s+/g, '.')}`))];
    return uniqueSelectors.slice(0, 10); // Limit to avoid excessive selectors
}

// Function to generate and run AI-driven Cypress tests
// Function to fetch page HTML and extract selectors
async function fetchPageHtml(url) {
    try {
        const response = await axios.get(url);
        return response.data; // Return raw HTML
    } catch (error) {
        console.error(`❌ Failed to fetch HTML for ${url}:`, error.message);
        return null;
    }
}

// Function to extract meaningful selectors from the page HTML
function extractValidSelectors(html) {
    const matches = [...html.matchAll(/class="([^"]+)"/g)];
    const uniqueSelectors = [...new Set(matches.map(match => `.${match[1].replace(/\s+/g, '.')}`))];
    return uniqueSelectors.slice(0, 10); // Limit to avoid excessive selectors
}

// Function to generate and run AI-driven Cypress tests
async function generateAndRunCypressTests(issueDescription, extractedUrls, testSteps, positiveScenarios, negativeScenarios, issueNumber) {
    try {
        if (!extractedUrls.length) {
            console.error("❌ No valid URLs extracted. Skipping test generation.");
            await postComment(issueNumber, "**Error: No valid test URLs extracted. Skipping Cypress test execution.**");
            return;
        }

        console.log("✅ Extracted URLs for Testing:", extractedUrls);

        let validSelectors = {};
        for (const url of extractedUrls) {
            const html = await fetchPageHtml(url);
            if (html) {
                validSelectors[url] = extractValidSelectors(html);
            }
        }

        console.log("✅ Extracted Valid Selectors:", validSelectors);

        // 🛠 Improved Prompt to Ensure AI Uses Correct Selectors & Test Logic
        const prompt = `
You are a QA engineer and a Cypress expert. Based on the issue description, test steps, and scenarios, generate Cypress test cases **that are relevant to the issue** while using **only real selectors** extracted from the URLs.

---
### **Extracted URLs for Testing**
${extractedUrls.join("\n")}

### **Valid Selectors for Each URL**
${Object.entries(validSelectors).map(([url, selectors]) => `${url}: ${selectors.join(', ')}`).join("\n")}

### **Issue Description**
${issueDescription}

### **Detailed Test Steps for UI Testing**
${testSteps}

### **Positive Test Scenarios**
${positiveScenarios}

### **Negative Test Scenarios**
${negativeScenarios}

---
### **Strict Guidelines**
1. **Tests should be fully aligned with the issue description and scenarios.**
2. **Use only real selectors from the provided URLs. Do NOT invent class names like \`'.endaoment-banner'\` if they don’t exist.**
3. **Ensure each test starts with \`cy.visit()\` and handles dynamically loaded elements using appropriate waiting mechanisms.**
4. **Ensure every element exists before performing assertions** (\`cy.get().should('exist')\`).**
5. **Increase \`defaultCommandTimeout\` to 10000ms to accommodate elements that take longer to appear.**
6. **If an element is missing, log a warning instead of failing immediately.**
7. **Each test should be specific to the extracted URLs and match the issue's test steps and scenarios.**

---
Return **only Cypress test code**, without explanations or markdown formatting.
`;

        // 🔥 Send Request to AI for Cypress Test Generation
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a Cypress expert and a QA engineer." },
                { role: "user", content: prompt },
            ],
            max_tokens: 3000,
        });

        let cypressTestContent = response.data.choices[0].message.content.trim();
        cypressTestContent = cypressTestContent.replace(/^```javascript/, "").replace(/```$/, "").trim();

        console.log("Generated Cypress Test Code:\n", cypressTestContent);

        // Ensure Cypress test directory exists
        const cypressDir = path.join(__dirname, "cypress", "integration");
        if (!fs.existsSync(cypressDir)) {
            fs.mkdirSync(cypressDir, { recursive: true });
        }

        // Save the test file
        const testFilePath = path.join(cypressDir, "generatedTest.spec.js");
        fs.writeFileSync(testFilePath, cypressTestContent, "utf8");
        console.log(`✅ Cypress test script saved to: ${testFilePath}`);

        ensureCypressConfig();

        // Run Cypress Tests
        exec("npx cypress run", async (error, stdout) => {
            const reportHtmlPath = path.join(__dirname, "cypress", "reports", "mochawesome.html");
            let mochaReportUrl = `https://raw.githubusercontent.com/Giveth/giveth-dapps-v2/main/cypress/reports/mochawesome.html`;

            let testResultsComment = `
**Test Results Table:**

\`\`\`
${stdout}
\`\`\`

[📄 View Mocha Report](${mochaReportUrl})
            `.trim();

            console.log("\nTest Results:\n", testResultsComment);
            await postComment(issueNumber, testResultsComment);

            if (error) {
                console.error("❌ Error running Cypress tests:", error.message);
            } else {
                console.log("✅ Cypress tests executed successfully.");
            }
        });
    } catch (error) {
        console.error("❌ Error generating Cypress tests:", error.message);
    }
}


// Function to generate test steps and scenarios
// Function to generate test steps and scenarios
async function generateTestStepsAndScenarios(issueDescription) {
    try {
        const prompt = `
You are a QA engineer. Based on the following issue description, generate:
1. A section titled "Detailed Test Steps for UI Testing" with a numbered list of test steps.
2. A section titled "Positive Test Scenarios" with numbered use cases.
3. A section titled "Negative Test Scenarios" with numbered edge cases.

The response format must strictly follow this structure:

---
### Detailed Test Steps for UI Testing:
1. Step 1
2. Step 2
...

### Positive Test Scenarios:
1. Scenario 1
2. Scenario 2
...

### Negative Test Scenarios:
1. Scenario 1
2. Scenario 2
...

---

**Issue Description:**
${issueDescription}
`;

        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{ role: "system", content: "You are a QA engineer." }, { role: "user", content: prompt }],
            max_tokens: 3000,
        });

        const content = response.data.choices[0].message.content.trim();
        console.log("Full OpenAI Response:\n", content);

        const extractSection = (sectionTitle) => {
            const regex = new RegExp(`### ${sectionTitle}:[\\s\\S]*?(?=###|$)`, "g");
            const match = content.match(regex);
            return match ? match[0].replace(`### ${sectionTitle}:`, "").trim() : "No data generated.";
        };

        return {
            testSteps: extractSection("Detailed Test Steps for UI Testing"),
            positiveScenarios: extractSection("Positive Test Scenarios"),
            negativeScenarios: extractSection("Negative Test Scenarios")
        };
    } catch (error) {
        console.error("Error generating test steps and scenarios:", error.message);
        return {
            testSteps: "Failed to generate test steps.",
            positiveScenarios: "No data generated.",
            negativeScenarios: "No data generated."
        };
    }
}
// Prompt for user input
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

logAllIssues();
rl.question("Enter the GitHub issue number to fetch: ", (issueNumber) => {
    fetchIssue(issueNumber);
    rl.close();
});
