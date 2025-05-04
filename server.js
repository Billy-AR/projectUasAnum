// backend/server.js
import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "./public")));

// Data kendaraan
const historicalData = [
  { tahun: 2019, mobil: 3310426, motor: 15868191 },
  { tahun: 2020, mobil: 3365467, motor: 16141380 },
  { tahun: 2021, mobil: 3544492, motor: 16711638 },
  { tahun: 2022, mobil: 3772850, motor: 17347866 },
  { tahun: 2023, mobil: 3836691, motor: 18229176 },
];

// Fungsi untuk regresi linear
function linearRegression(xData, yData) {
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

  return { slope, intercept };
}

// Fungsi prediksi
function predictValue(x, slope, intercept) {
  return slope * x + intercept;
}

// API Routes
app.get("/api/historical-data", (req, res) => {
  res.json(historicalData);
});

app.post("/api/predict", (req, res) => {
  const { year } = req.body;

  if (!year) {
    return res.status(400).json({ error: "Year is required" });
  }

  try {
    const years = historicalData.map((item) => item.tahun);
    const mobilData = historicalData.map((item) => item.mobil);
    const motorData = historicalData.map((item) => item.motor);

    const mobilRegression = linearRegression(years, mobilData);
    const predictionMobil = predictValue(year, mobilRegression.slope, mobilRegression.intercept);

    const motorRegression = linearRegression(years, motorData);
    const predictionMotor = predictValue(year, motorRegression.slope, motorRegression.intercept);

    const result = {
      year: year,
      mobil: Math.round(predictionMobil),
      motor: Math.round(predictionMotor),
      total: Math.round(predictionMobil + predictionMotor),
      details: {
        mobil: {
          slope: mobilRegression.slope,
          intercept: mobilRegression.intercept,
          equation: `y = ${mobilRegression.slope.toFixed(2)}x + ${mobilRegression.intercept.toFixed(2)}`,
        },
        motor: {
          slope: motorRegression.slope,
          intercept: motorRegression.intercept,
          equation: `y = ${motorRegression.slope.toFixed(2)}x + ${motorRegression.intercept.toFixed(2)}`,
        },
      },
    };

    res.json(result);
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Failed to calculate prediction" });
  }
});

// Serve React App
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "./public", "index.html"));
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ msg: "Not Found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const port = process.env.PORT || 5000;

const start = async () => {
  try {
    app.listen(port, () => {
      console.log(`Server listening on ${port}...`);
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

start();
