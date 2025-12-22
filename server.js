import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// keep alive
app.get("/keepalive", (req,res)=>res.send("ok"));

// funkcia čo extrahuje HKV zo sekcií
function decodeHKVSection(text,label){

    // nájde blok medzi nadpisom a ďalším prázdnym riadkom
    const block = text.match(new RegExp(label + "\\s*([\\s\\S]*?)\\n\\s*\\n"));
    if(!block) return null;

    // nájde všetky 12-ciferné kódy
    const matches = block[1].match(/\b\d{12}\b/g);
    if(!matches) return null;

    return matches.map(str=>{
        const last7 = str.slice(-7);
        return `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
    });
}

app.post("/parse", async (req,res)=>{

    try {
        const r = await fetch(req.body.url);
        const arr = await r.arrayBuffer();
        const parsed = await pdf(Buffer.from(arr));
        const text = parsed.text;

        // dátum + čas
        const dateTime = text.match(/\b\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/)?.[0];

        // extrakcia vlaku – číselný blok pred názvom vlaku
        const train = text.match(/^\s*0*(\d{1,6})\s+[A-Z]/m)?.[1];

        // prvé HDV
        const fullHKV = text.match(/\b\d{12}\b/)?.[0];
        let hdv=null;

        if(fullHKV){
            const last7 = fullHKV.slice(-7);
            hdv = `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        // rušňovodič + phone
        const drv = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\s*\/\+?(\d+)/);

        let phoneFmt = null;
        if(drv?.[2]){
            phoneFmt = drv[2]
                .replace(/^421/,"0")
                .replace(/(\d{4})(\d{3})(\d{3})/,"$1/$2 $3");
        }

        const wagons = text.match(/Počet dopravovaných vozidiel.*?(\d+)/)?.[1];

        // sekcie
        const result = {
            dateTime,
            train,
            hdv,
            driver:drv?.[1],
            phone:phoneFmt,
            wagons,
            priprahove:decodeHKVSection(text,"Príprahové"),
            postrkove:decodeHKVSection(text,"Postrkové"),
            vlozene:decodeHKVSection(text,"Vložené"),
            pohotove:decodeHKVSection(text,"Na službu pohotové"),
            necinne:decodeHKVSection(text,"Nečinné")
        };

        res.json(result);

    }catch(err){
        res.status(500).json({error:"PDF sa nedá spracovať"});
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>{
    console.log("Server running on port "+PORT);
});
