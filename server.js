import dotenv from "dotenv";

dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());

// =====================================
// JSON BODY PARSER
// =====================================
//
// Le webhook Reeserva nécessite le corps brut
// pour la vérification de sa signature.
//
// Le verify permet de conserver le raw body
// dans req.rawBody tout en laissant req.body
// fonctionner normalement pour le reste de l'API.
//

app.use(
    express.json({
        verify: (req, res, buf) => {
            if (req.originalUrl === "/api/webhook") {
                req.rawBody = Buffer.from(buf);
            }
        }
    })
);

// =====================================
// ROUTES API
// =====================================

app.use("/api", paymentRoutes);

// =====================================
// FRONTEND
// =====================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

// =====================================
// START
// =====================================

const PORT = process.env.PORT || 5000;

console.log("================================");
console.log("REESERVA API DIRECT");
console.log("BASE_URL :", process.env.BASE_URL);
console.log("PORT :", PORT);
console.log("================================");

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `🚀 Server running on ${PORT}`
        );
    }
);