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

const corsOptions = process.env.FRONTEND_URL
  ? {
      origin: "http://localhost:5173", // Ganti dengan domain asal frontend
      methods: ["GET", "POST", "PUT", "DELETE"],
      // Jika kamu pakai cookie atau auth header
    }
  : null;

// Middleware
app.use(cors(corsOptions));
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

// Fungsi untuk regresi linear menggunakan tahun ke-n
function linearRegression(yData) {
  // Buat array tahun ke-n (1, 2, 3, 4, 5) sebagai x
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

// Fungsi prediksi
function predictValue(year, startYear, slope, intercept) {
  // Konversi tahun menjadi tahun ke-n
  const yearIndex = year - startYear + 1;
  return slope * yearIndex + intercept;
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
    const startYear = historicalData[0].tahun; // 2019
    const mobilData = historicalData.map((item) => item.mobil);
    const motorData = historicalData.map((item) => item.motor);

    const mobilRegression = linearRegression(mobilData);
    const predictionMobil = predictValue(year, startYear, mobilRegression.slope, mobilRegression.intercept);

    const motorRegression = linearRegression(motorData);
    const predictionMotor = predictValue(year, startYear, motorRegression.slope, motorRegression.intercept);

    // Buat persamaan yang lebih informatif (menggunakan tahun ke-n)
    const yearIndex = year - startYear + 1;
    const mobilEquation = `y = ${mobilRegression.slope.toFixed(2)} × (tahun ke-${yearIndex}) + ${mobilRegression.intercept.toFixed(2)}`;
    const motorEquation = `y = ${motorRegression.slope.toFixed(2)} × (tahun ke-${yearIndex}) + ${motorRegression.intercept.toFixed(2)}`;

    const result = {
      year: year,
      mobil: Math.round(predictionMobil),
      motor: Math.round(predictionMotor),
      total: Math.round(predictionMobil + predictionMotor),
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
