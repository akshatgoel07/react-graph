require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testEmbeddings() {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await model.embedContent("Hello, world!");
    console.log("Full result:", JSON.stringify(result, null, 2)); // Log the entire response
    console.log("Embedding:", result.embedding); // Log just the embedding property
    if (result.embedding && Array.isArray(result.embedding)) {
      console.log("Embedding length:", result.embedding.length);
      console.log("First few values:", result.embedding.slice(0, 5));
    } else {
      console.log("Embedding is not an array or is undefined");
    }
  } catch (error) {
    console.error("Embedding error:", error);
  }
}

testEmbeddings();
