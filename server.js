import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/keepalive",(req,res)=>res.send("ok"));

// extrakcia z konkrétnej sekcie
function extractHKV(text, label) {

    const regex = new RegExp(label + "[\\s\\S]*?(?=\\n[A-ZÁ-Ža-z ]+\\n|$)");
    const block = text.match(regex);

    if (!block) return null;

    const hkv = block[0].match(/\b\d{12}\b/g);
    if (!hkv) return null;

    return hkv.map(str=>{
        const last7 = str.slice(-7);
        return `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
    });
}


app.post("/parse", async (req,res)=>{

    try{
        const pdfResp = await fetch(req.body.url);
        const buffer = await pdfResp.arrayBuffer();
        const parsed = await pdf(Buffer.from(buffer));
        const text = parsed.text;

        // dátum + čas
        const dateTime = text.match(/\b\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/)?.[0];

        // vlak – ignorujeme čísla staníc, berieme priamo 0+vlakovú formu
        const train = text.match(/\b0*(\d{3,6})\s+[A-Z](?=\s+\d\d\.)/)?.[1];

        // HDV – 12 ciferné číslo
        const fullHKV = text.match(/\b\d{12}\b/)?.[0];
        let hdv=null;

        if(fullHKV){
            const last7 = fullHKV.slice(-7);
            hdv=`${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        // rušňovodič
        const drv = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\/\+?(\d+)/);
        let phoneFmt=null;

        if(drv?.[2]){
            phoneFmt = drv[2]
                .replace(/^421/,"0")
                .replace(/(\d{4})(\d{3})(\d{3})/,"$1/$2 $3");
        }

        // počet vozidiel
        const wagons = text.match(/Počet dopravovaných vozidiel.*?(\d+)/)?.[1];

        // sekcie
        const priprah = extractHKV(text,"Príprahové");
        const postrk = extractHKV(text,"Postrkové");
        const vloz   = extractHKV(text,"Vložené");
        const pohot  = extractHKV(text,"Na službu pohotové");
        const nec    = extractHKV(text,"Nečinné");

        const result={
            dateTime,
            train,
            hdv,
            driver:drv?.[1],
            phone:phoneFmt,
            wagons,
            priprahove:priprah,
            postrkove:postrk,
            vlozene:vloz,
            pohotove:pohot,
            necinne:nec
        };

        res.json(result);

    }catch{
        res.status(500).json({error:"PDF sa nepodarilo načítať"});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>console.log("Server running on port",PORT));
