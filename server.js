import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Keep alive endpoint
app.get("/keepalive", (req, res) => res.send("ok"));

// helper: extract HDV from section
function decodeHKVSection(text, label){
    const section = text.match(new RegExp(label + "[^\\S\\r\\n]*([\\s\\S]+?)\\n\\n"));
    if(!section) return null;

    const numbers = section[1].match(/\b\d{12}\b/g);
    if(!numbers) return null;

    return numbers.map(hkv => {
        const last7 = hkv.slice(-7);
        return `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
    });
}

app.post("/parse", async (req, res) => {
    const { url } = req.body;

    try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const data = await pdf(Buffer.from(buffer));
        const text = data.text;

        // dátum + čas
        const dateTime =
            text.match(/\b(\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2})/)?.[1];

        // vlak – prvé ID v texte
        const train =
            text.match(/^\s*0*(\d{1,6})\b/m)?.[1];

        // HDV – prvé 12-ciferné
        const hkv =
            text.match(/\b(\d{12})\b/)?.[1];

        let hdv = null;
        if(hkv){
            const last7 = hkv.slice(-7);
            hdv = `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        // rušňovodič + tel
        const driverMatch = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\s*\/\+?(\d+)/);

        let phoneFmt = null;
        if(driverMatch?.[2]){
            phoneFmt = driverMatch[2]
                .replace(/^421/, "0")
                .replace(/(\d{4})(\d{3})(\d{3})/, "$1/$2 $3");
        }

        // počet vozidiel
        const wagons = text.match(/Počet dopravovaných vozidiel.*?(\d+)/)?.[1];

        // ďalšie HKV sekcie
        const vlakove = decodeHKVSection(text,"Vlakové");
        const priprahove = decodeHKVSection(text,"Príprahové");
        const postrkove = decodeHKVSection(text,"Postrkové");
        const vlozene = decodeHKVSection(text,"Vložené");
        const pohotove = decodeHKVSection(text,"Na službu pohotové");
        const necInne = decodeHKVSection(text,"Nečinné");

        res.json({
            dateTime,
            train,
            hdv,
            driver: driverMatch?.[1],
            phone: phoneFmt,
            wagons,
            vlakove,
            priprahove,
            postrkove,
            vlozene,
            pohotove,
            necInne
        });

    } catch {

        res.status(500).json({ error: "PDF sa nepodarilo spracovať" });

    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>{
    console.log("Server running on port: "+PORT);
});
