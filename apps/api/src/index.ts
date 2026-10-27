import "./loadEnv.js";
import cors from "cors";
import express from "express";
import { repositories } from "./routes/repositories.js";
import { runs } from "./routes/runs.js";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:5173"],
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "repolens-api" });
});

app.use("/api/repositories", repositories);
app.use("/api/analysis-runs", runs);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`RepoLens API on http://localhost:${port}`);
});
