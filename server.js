import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";

const app = express();
app.use(express.json());

app.post("/parse", async (req, res) => {
    const { url } = req.body;

    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const data = await pdf(Buffer.from(buffer));

        const text = data.text;

        const dateTime = text.match(/(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/)?.[1];
        const train = text.match(/Vlak:\s+0*(\d+)/)?.[1];

        const hkv = text.match(/HKV:\s+(\d{12})/)?.[1];
        let hdv = null;
        if (hkv) {
            const last7 = hkv.slice(-7);
            hdv = `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        const driverMatch = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\s*\/\+?(\d+)/);
        const wagons = text.match(/Počet dopravovaných vozidiel.*?(\d+)/)?.[1];

        res.json({
            dateTime,
            train,
            hdv,
            driver: driverMatch?.[1],
            phone: driverMatch?.[2],
            wagons
        });

    } catch (e) {
        res.status(500).json({ error: "PDF sa nepodarilo spracovať" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server beží na porte: " + PORT);
});

