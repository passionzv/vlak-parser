import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/parse", async (req, res) => {
    try {
        const pdfResp = await fetch(req.body.url);
        const buf = await pdfResp.arrayBuffer();
        const parsed = await pdf(Buffer.from(buf));
        const text = parsed.text;

        /* ===== DÁTUM A ČAS ===== */
        const dateTime =
            text.match(/\b\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/)?.[0] ?? null;

        /* ===== ČÍSLO VLAKU (R / Os / Ex / …) ===== */
        const trainMatch =
            text.match(/\b0*(\d{3,6})\s+[A-Z]{1,3}\s+\d{2}\.\d{2}\.\d{4}/);
        const train = trainMatch ? trainMatch[1] : null;

        /* ===== HKV / HDV ===== */
        const hkvMatch = text.match(/\b\d{12}\b/);
        let hdv = null;
        if (hkvMatch) {
            const s = hkvMatch[0].slice(-7);
            hdv = `${s.slice(0,3)}.${s.slice(3,6)}-${s.slice(6)}`;
        }

        /* ===== RUŠŇOVODIČ + TELEFÓN ===== */
        const drv =
            text.match(/-\s*([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\/\+?(\d+)/);

        let phone = null;
        if (drv?.[2]) {
            phone = drv[2]
                .replace(/^421/, "0")
                .replace(/(\d{4})(\d{3})(\d{3})/, "$1/$2 $3");
        }

        /* ===== POČET VOZIDIEL ===== */
        const wagons =
            text.match(/Počet dopravovaných vozidiel vo vlaku:\s*(\d+)/)?.[1] ?? null;

        res.json({
            dateTime,
            train,
            hdv,
            driver: drv?.[1] ?? null,
            phone,
            wagons
        });

    } catch (e) {
        res.status(500).json({ error: "PDF sa nepodarilo spracovať" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port", PORT);
});
