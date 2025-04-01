const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Environment variables configuration
module.exports = {
  // Server config
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // API keys
  geminiApiKey: process.env.GEMINI_API_KEY,
  hfApiKey: process.env.HF_API_KEY,
  voyageApiKey: process.env.VOYAGE_API_KEY,

  // Service URLs
  chromaUrl: process.env.CHROMA_URL,

  // Database
  databaseUrl: process.env.DATABASE_URL,
};
