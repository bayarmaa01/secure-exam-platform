import express from "express";
import aiAuth from "../middleware/ai.middleware.js";
import { receiveAlert } from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/alert", aiAuth, receiveAlert);

export default router;
