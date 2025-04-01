const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config/env");

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

async function generateContent(prompt, model = "gemini-1.5-flash") {
  try {
    const generativeModel = genAI.getGenerativeModel({ model });
    const result = await generativeModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error(`Failed to generate AI content: ${error.message}`);
  }
}

function parseJsonResponse(response) {
  const cleanedResponse = response
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error("Error parsing AI response as JSON:", error);
    throw new Error("Failed to parse AI response as valid JSON");
  }
}

module.exports = {
  generateContent,
  parseJsonResponse,
};
