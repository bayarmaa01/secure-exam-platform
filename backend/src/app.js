import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import examRoutes from "./routes/exam.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";

dotenv.config();

const app = express();   // ✅ CREATE APP FIRST

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Swagger docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/ai", aiRoutes);

app.get("/health", (_, res) => res.json({ status: "OK" }));

app.use(errorHandler);

export default app;
