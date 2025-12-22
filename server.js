import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/keepalive",(req,res)=>res.send("ok"));

app.post("/parse", async(req,res)=>{

    try{
        const pdfResp = await fetch(req.body.url);
        const buf = await pdfResp.arrayBuffer();
        const parsed = await pdf(Buffer.from(buf));
        const text = parsed.text;

        // dátum + čas
        const dateTime = text.match(/\b\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/)?.[0];

        // vlak - jedinečný vzor: číslo, R, dátum
        const train =
            text.match(/\b0*(\d{3,6})\s+R\s+\d{2}\.\d{2}\.\d{4}/)?.[1];

        // HDV - prvé 12 číslic kdekoľvek v texte
        const hkv = text.match(/\b\d{12}\b/)?.[0];

        let hdv = null;
        if(hkv){
            const last7 = hkv.slice(-7);
            hdv = `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        // rušňovodič
        const drv = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\s*\/\+?(\d+)/);

        let phoneFmt=null;
        if(drv?.[2]){
            phoneFmt = drv[2]
                .replace(/^421/,"0")
                .replace(/(\d{4})(\d{3})(\d{3})/,"$1/$2 $3");
        }

        // počet vozidiel
        const wagons = text.match(/Počet dopravovaných vozidiel.*?(\d+)/)?.[1];

        res.json({
            dateTime,
            train,
            hdv,
            driver: drv?.[1],
            phone: phoneFmt,
            wagons
        });

    }catch(e){
        res.status(500).json({error:"PDF sa nepodarilo načítať"});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>{
    console.log("Server running on port "+PORT);
});
