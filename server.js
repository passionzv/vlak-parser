import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import pdfParse from "pdf-parse";

const app = express();

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ===== ROOT (Render potrebuje!) ===== */
app.get("/", (req, res) => {
    res.status(200).send("OK");
});

/* ===== KEEPALIVE ENDPOINTY ===== */
app.get("/ping", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
});

app.get("/keepalive", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
});

/* ===== PDF PARSER ===== */
app.post("/parse", async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: "Missing PDF URL" });
        }

        console.log("Downloading PDF:", url);

        const pdfResponse = await fetch(url);
        if (!pdfResponse.ok) {
            throw new Error("PDF download failed");
        }

        const buffer = Buffer.from(await pdfResponse.arrayBuffer());
        const pdfData = await pdfParse(buffer);
        const text = pdfData.text.replace(/\r/g, "");

        /* ===== DÁTUM A ČAS ===== */
        const dateTimeMatch = text.match(
            /(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})/
        );
        const dateTime = dateTimeMatch ? dateTimeMatch[1] : null;

        /* ===== HDV ===== */
        const hdvMatch = text.match(/\b(7\d{2}\.\d{3}-\d)\b/);
        const hdv = hdvMatch ? hdvMatch[1] : null;

        /* ===== RUŠŇOVODIČ + TEL ===== */
        const driverMatch = text.match(
            /-\s*([A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][^\n\/]+)\/\+421(\d{9})/
        );

        const driver = driverMatch ? driverMatch[1].trim() : null;

        let phone = null;
        if (driverMatch) {
            const raw = driverMatch[2]; // 904893233
            phone = "0" + raw.slice(0, 3) + "/" + raw.slice(3, 6) + " " + raw.slice(6);
        }

        /* ===== VOZIDLÁ ===== */
        const wagonsMatch = text.match(
            /Počet dopravovaných vozidiel vo vlaku:\s*(\d+)/
        );
        const wagons = wagonsMatch ? wagonsMatch[1] : null;

        /* ===== ODPOVEĎ ===== */
        res.json({
            dateTime,
            train: null, // ZÁMERNE – vlak NEZOBRAZUJEME
            hdv,
            driver,
            phone,
            wagons
        });

    } catch (err) {
        console.error("Parse error:", err);
        res.status(500).json({ error: "PDF parse failed" });
    }
});

/* ===== START SERVERA ===== */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
