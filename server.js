import express from "express";
import fetch from "node-fetch";
import pdf from "pdf-parse";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// keepalive – Web service never sleeps
app.get("/keepalive", (req,res)=>res.send("ok"));

function decodeHKVSection(text,label){

    const block = text.match(new RegExp(label + "[^\\S\\r\\n]*([\\s\\S]+?)\\n\\n"));
    if(!block) return null;

    const raw = block[1].match(/\b\d{12}\b/g);
    if(!raw) return null;

    return raw.map(hkv=>{
        const last7 = hkv.slice(-7);
        return `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
    });
}

app.post("/parse",async(req,res)=>{

    try{

        const response = await fetch(req.body.url);
        const arr = await response.arrayBuffer();
        const parsed = await pdf(Buffer.from(arr));
        const text = parsed.text;

        // dátum a čas
        const dateTime = text.match(/\b\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/)?.[0];

        // číslo vlaku = prvé 6 miestne ID z hlavičky
        const train = text.match(/^\s*0*(\d{1,6})\s+[A-Z]/m)?.[1];

        // základné HDV – prvé 12 miestne číslo
        const fullHKV = text.match(/\b\d{12}\b/)?.[0];

        let hdv=null;
        if(fullHKV){
            const last7 = fullHKV.slice(-7);
            hdv = `${last7.slice(0,3)}.${last7.slice(3,6)}-${last7.slice(6)}`;
        }

        // rušňovodič + phone
        const drv = text.match(/-\s+([A-Za-zÁ-ž]+\s+[A-Za-zÁ-ž]+)\s*\/\+?(\d+)/);
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
            driver:drv?.[1],
            phone:phoneFmt,
            wagons,
            vlakove: decodeHKVSection(text,"Vlakové"),
            priprahove:decodeHKVSection(text,"Príprahové"),
            postrkove:decodeHKVSection(text,"Postrkové"),
            vlozene:decodeHKVSection(text,"Vložené"),
            pohotove:decodeHKVSection(text,"Na službu pohotové"),
            necinne:decodeHKVSection(text,"Nečinné")
        };

        res.json(result);

    }catch(err){

        res.status(500).json({error:"Nepodarilo sa spracovať PDF."});
    }
});

// Render PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT,"0.0.0.0",()=>{
    console.log("Server running on port "+PORT);
});
