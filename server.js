import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/keepalive",(req,res)=>res.send("ok"));

// extrahuje jediné HKV za sekciou (prázdne = null)
function extractHKV(text,label){

    const match = text.match(new RegExp(label + "\\s+(\\d{12})"));
    if(!match) return null;

    const raw = match[1];
    const last7 = raw.slice(-7);
    return `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
}

app.post("/parse", async(req,res)=>{

    try{
        const pdfResp = await fetch(req.body.url);
        const buf = await pdfResp.arrayBuffer();
        const parsed = await pdf(Buffer.from(buf));
        const text = parsed.text;

        // dátum + čas
        const dateTime = text.match(/\b\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/)?.[0];

        // vlak – skutočný formát:
        // 000912 R 22.12.2025
        const train = text.match(/\b0*(\d{3,6})\s+[A-Z]\s+\d{2}\.\d{2}\.\d{4}/)?.[1];

        // hlavné HKV – 12 číslic
        const firstHKV = text.match(/\b\d{12}\b/)?.[0];

        let hdv=null;
        if(firstHKV){
            const last7 = firstHKV.slice(-7);
            hdv = `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        // rušňovodič
        const drv = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\/\+?(\d+)/);

        let phoneFmt=null;
        if(drv?.[2]){
            phoneFmt = drv[2]
                .replace(/^421/,"0")
                .replace(/(\d{4})(\d{3})(\d{3})/,"$1/$2 $3");
        }

        const wagons = text.match(/Počet dopravovaných vozidiel.*?(\d+)/)?.[1];

        const result = {
            dateTime,
            train,
            hdv,
            driver: drv?.[1],
            phone: phoneFmt,
            wagons,
            necinne: extractHKV(text,"Nečinné"),
            priprahove: extractHKV(text,"Príprahové"),
            postrkove: extractHKV(text,"Postrkové"),
            vlozene: extractHKV(text,"Vložené"),
            pohotove: extractHKV(text,"Na službu pohotové")
        };

        res.json(result);

    }catch(e){
        res.status(500).json({error:"PDF sa nepodarilo načítať"});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>console.log("Server running on port",PORT));
