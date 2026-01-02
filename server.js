import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import pdfParse from "pdf-parse";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ===== ROOT ===== */
app.get("/", (req, res) => {
    res.send("OK");
});

/* ===== KEEPALIVE ===== */
app.get("/ping", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
});

/* ===== PARSE PDF ===== */
app.post("/parse", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: "Missing URL" });
        }

        const pdfResponse = await fetch(url);
        if (!pdfResponse.ok) {
            throw new Error("PDF download failed");
        }

        const buffer = Buffer.from(await pdfResponse.arrayBuffer());
        const pdfData = await pdfParse(buffer);

        const text = pdfData.text.replace(/\r/g, "");

        /* ===== DÁTUM A ČAS ===== */
        const dateTimeMatch = text.match(
            /(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2})/
        );
        const dateTime = dateTimeMatch ? dateTimeMatch[1] : null;

        /* ===== HDV (POSLEDNÝCH 7 ČÍSLIC) ===== */
        let hdv = null;
        const hdvRawMatch = text.match(/\b(\d{7,})\b/);

        if (hdvRawMatch) {
            const raw = hdvRawMatch[1];
            const last7 = raw.slice(-7); // napr. 7540834
            hdv = `${last7.slice(0, 3)}.${last7.slice(3, 6)}-${last7.slice(6)}`;
        }

        /* ===== RUŠŇOVODIČ + TEL ===== */
        const driverMatch = text.match(
            /-\s*([A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][^\n\/]+)\/\+421(\d{9})/
        );

        const driver = driverMatch ? driverMatch[1].trim() : null;

        let phone = null;
        if (driverMatch) {
            const p = driverMatch[2];
            phone = "0" + p.slice(0, 3) + "/" + p.slice(3, 6) + " " + p.slice(6);
        }

        /* ===== VOZIDLÁ ===== */
        const wagonsMatch = text.match(
            /Počet dopravovaných vozidiel vo vlaku:\s*(\d+)/
        );
        const wagons = wagonsMatch ? wagonsMatch[1] : null;

        res.json({
            dateTime,
            train: null, // úmyselne nezobrazujeme
            hdv,
            driver,
            phone,
            wagons
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Parse failed" });
    }
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
