import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());


app.post("/parse", async (req, res) => {
    const { url } = req.body;

    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const data = await pdf(Buffer.from(buffer));

        const text = data.text;

        // dátum a čas - prvý výskyt dátumu a času
const dateTime =
    text.match(/\b(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})/)?.[1];

// vlak - prvých 6 číslic na začiatku riadku
const train =
    text.match(/\b0*(\d{1,6})\b(?=.*\s+[A-Z]\b)/)?.[1];

// HDV číslo – prvé 12-miestne číslo
const hkv =
    text.match(/\b(\d{12})\b/)?.[1];

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

