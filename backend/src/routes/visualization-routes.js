const express = require("express");
const {
  generateReactFlow,
} = require("../controllers/visualization-controller");

const router = express.Router();

/**
 * @route POST /api/visualization/react-flow
 * @desc Generate React Flow visualization for a repository
 * @access Public
 */
router.post("/react-flow", generateReactFlow);

module.exports = router;
