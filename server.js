import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import pdfParse from "pdf-parse";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ROOT */
app.get("/", (req, res) => {
    res.send("OK");
});

/* KEEPALIVE */
app.get("/ping", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
});

app.get("/keepalive", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
});

/* PARSE PDF */
app.post("/parse", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "Missing URL" });

        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const pdf = await pdfParse(buffer);
        const text = pdf.text.replace(/\r/g, "");

        /* ===== DÁTUM A ČAS ===== */
        const dateTimeMatch = text.match(
            /(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2})/
        );
        const dateTime = dateTimeMatch
            ? `${dateTimeMatch[1]} ${dateTimeMatch[2]}`
            : null;

        /* ===== HDV – výpočet z 12-miestneho čísla ===== */
        let hdv = null;
        const hdvRawMatch = text.match(/\b9\d{11}\b/);
        if (hdvRawMatch) {
            const raw = hdvRawMatch[0]; // napr. 925617540834
            const series = raw.substring(4, 7); // 754
            const number = raw.substring(7, 10); // 083
            const check = raw.substring(10, 11); // 4
            hdv = `${series}.${number}-${check}`;
        }

        /* ===== RUŠŇOVODIČ + TEL ===== */
        const driverMatch = text.match(
            /-\s*([A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][^\n\/]+)\/\+421(\d{9})/
        );

        const driver = driverMatch ? driverMatch[1].trim() : null;

        let phone = null;
        if (driverMatch) {
            const p = driverMatch[2];
            phone = `0${p.slice(0,3)}/${p.slice(3,6)} ${p.slice(6)}`;
        }

        /* ===== VOZIDLÁ ===== */
        const wagonsMatch = text.match(
            /Počet dopravovaných vozidiel vo vlaku:\s*(\d+)/
        );
        const wagons = wagonsMatch ? wagonsMatch[1] : null;

        res.json({
            dateTime,
            train: null, // zámerne nevypisujeme
            hdv,
            driver,
            phone,
            wagons
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Parse failed" });
    }
});

/* START */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
