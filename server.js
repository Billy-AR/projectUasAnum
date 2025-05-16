import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "./public")));

// Initialize data sources on startup
async function initializeDataSources() {
  try {
    // Create default data sources if they don't exist
    await prisma.dataSource.upsert({
      where: { name: "database" },
      update: {},
      create: { name: "database", isActive: true },
    });

    // No manual data source anymore, we only use database
  } catch (error) {
    console.error("Error initializing data sources:", error);
  }
}

// API Routes
app.get("/api/historical-data", async (req, res) => {
  try {
    const activeSource = await prisma.dataSource.findFirst({
      where: { isActive: true },
    });

    if (activeSource?.name === "database") {
      const data = await prisma.historicalData.findMany({
        orderBy: { tahun: "asc" },
      });
      return res.json({
        data,
        source: activeSource.name,
      });
    } else {
      return res.status(400).json({ error: "Data source is not set to database" });
    }
  } catch (error) {
    console.error("Error fetching historical data:", error);
    res.status(500).json({ error: "Error fetching data from database" });
  }
});

app.get("/api/data-sources", async (req, res) => {
  try {
    const sources = await prisma.dataSource.findMany();
    res.json(sources);
  } catch (error) {
    console.error("Error fetching data sources:", error);
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

app.post("/api/switch-data-source", async (req, res) => {
  const { sourceName } = req.body;

  try {
    // Deactivate all sources
    await prisma.dataSource.updateMany({
      data: { isActive: false },
    });

    // Activate selected source
    await prisma.dataSource.update({
      where: { name: sourceName },
      data: { isActive: true },
    });

    res.json({ success: true, activeSource: sourceName });
  } catch (error) {
    console.error("Error switching data source:", error);
    res.status(500).json({ error: "Failed to switch data source" });
  }
});

app.post("/api/historical-data", async (req, res) => {
  try {
    const { tahun, mobil, motor } = req.body;

    const existingData = await prisma.historicalData.findUnique({
      where: { tahun },
    });

    if (existingData) {
      return res.status(400).json({ error: `Data untuk tahun ${tahun} sudah ada` });
    }

    const newData = await prisma.historicalData.create({
      data: { tahun, mobil, motor },
    });

    res.json(newData);
  } catch (error) {
    console.error("Error creating historical data:", error);
    res.status(500).json({ error: "Failed to create historical data" });
  }
});

app.delete("/api/historical-data/:tahun", async (req, res) => {
  try {
    const tahun = parseInt(req.params.tahun);

    await prisma.historicalData.delete({
      where: { tahun },
    });

    res.json({ success: true, message: `Data tahun ${tahun} berhasil dihapus` });
  } catch (error) {
    console.error("Error deleting historical data:", error);
    res.status(500).json({ error: "Failed to delete historical data" });
  }
});

app.put("/api/historical-data/:tahun", async (req, res) => {
  try {
    const tahun = parseInt(req.params.tahun);
    const { mobil, motor } = req.body;

    const updatedData = await prisma.historicalData.update({
      where: { tahun },
      data: { mobil, motor },
    });

    res.json(updatedData);
  } catch (error) {
    console.error("Error updating historical data:", error);
    res.status(500).json({ error: "Failed to update historical data" });
  }
});

// Linear regression functions
function linearRegression(yData) {
  const xData = Array.from({ length: yData.length }, (_, i) => i + 1);
  const n = xData.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += xData[i];
    sumY += yData[i];
    sumXY += xData[i] * yData[i];
    sumXX += xData[i] * xData[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, xData };
}

function predictValue(year, startYear, slope, intercept) {
  const yearIndex = year - startYear + 1;
  return slope * yearIndex + intercept;
}

app.post("/api/predict", async (req, res) => {
  const { year } = req.body;

  if (!year) {
    return res.status(400).json({ error: "Year is required" });
  }

  try {
    const activeSource = await prisma.dataSource.findFirst({
      where: { isActive: true },
    });

    let historicalData;
    if (activeSource?.name === "database") {
      historicalData = await prisma.historicalData.findMany({
        orderBy: { tahun: "asc" },
      });
    } else {
      return res.status(400).json({ error: "Data source is not set to database" });
    }

    if (historicalData.length === 0) {
      return res.status(400).json({ error: "No historical data available" });
    }

    const startYear = historicalData[0].tahun;
    const mobilData = historicalData.map((item) => item.mobil);
    const motorData = historicalData.map((item) => item.motor);

    const mobilRegression = linearRegression(mobilData);
    const predictionMobil = predictValue(year, startYear, mobilRegression.slope, mobilRegression.intercept);

    const motorRegression = linearRegression(motorData);
    const predictionMotor = predictValue(year, startYear, motorRegression.slope, motorRegression.intercept);

    const yearIndex = year - startYear + 1;
    const mobilEquation = `y = ${mobilRegression.slope.toFixed(2)} × (tahun ke-${yearIndex}) + ${mobilRegression.intercept.toFixed(2)}`;
    const motorEquation = `y = ${motorRegression.slope.toFixed(2)} × (tahun ke-${yearIndex}) + ${motorRegression.intercept.toFixed(2)}`;

    const result = {
      year: year,
      mobil: Math.round(predictionMobil),
      motor: Math.round(predictionMotor),
      total: Math.round(predictionMobil + predictionMotor),
      source: activeSource?.name || "manual",
      details: {
        mobil: {
          slope: mobilRegression.slope,
          intercept: mobilRegression.intercept,
          equation: mobilEquation,
        },
        motor: {
          slope: motorRegression.slope,
          intercept: motorRegression.intercept,
          equation: motorEquation,
        },
      },
    };

    res.json(result);
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Failed to calculate prediction" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "./public", "index.html"));
});

app.use("*", (req, res) => {
  res.status(404).json({ msg: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    await initializeDataSources();
    app.listen(port, () => {
      console.log(`Server listening on port ${port}...`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

start();

// Cleanup on process termination
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
