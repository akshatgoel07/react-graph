const express = require("express");
const {
  indexRepo,
  searchRepo,
  askQuestion,
} = require("../controllers/rag-controller");

const router = express.Router();

/**
 * @route POST /api/rag/index
 * @desc Index a repository for RAG search
 * @access Public
 */
router.post("/index", indexRepo);

/**
 * @route POST /api/rag/search
 * @desc Search an indexed repository
 * @access Public
 */
router.post("/search", searchRepo);

/**
 * @route POST /api/rag/ask
 * @desc Ask a question about the codebase
 * @access Public
 */
router.post("/ask", askQuestion);

module.exports = router;
