const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config(); // Load environment variables from .env

// Initialize OpenAI API configuration
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Make sure this is set in your .env file
});

const openai = new OpenAIApi(configuration);

// Test OpenAI API with gpt-3.5-turbo
async function testOpenAI() {
    try {
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo", // Use a supported model
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Say hello!" },
            ],
            max_tokens: 50,
        });

        console.log("API Key is working! Response:", response.data.choices[0].message.content.trim());
    } catch (error) {
        if (error.response) {
            console.error("API Error Response:", error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}

testOpenAI();
