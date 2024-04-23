import 'module-alias/register';
import express, { Express, Request, Response } from "express";
import { Eta } from 'eta';
import path from "path";

import dotenv from "dotenv";
dotenv.config();

import initSpotPriceProcessor, {processData as processSpotPriceData} from '@processors/spot_price';

import '@lib/console';

const app: Express = express();
const port = process.env.port || 3000;

app.use(express.json());

let viewpath = path.join(__dirname, "views");
let eta = new Eta({ 
    views: viewpath,
    cache: false,
});


// make template renderer available to all widgets
app.locals.eta = eta;

app.get("/", (req: Request, res: Response) => {
    res.status(200).send( eta.render('index.eta', {}));
});


app.get("/catchup/do", (req: Request, res: Response) => {
    // get unprocessed data, then process it
    
        
});

app.get("/catchup", (req: Request, res: Response) => {
    res.status(200).send( eta.render('catchup.eta', {}));
});


app.listen(port, () => {
    // @ts-ignore
    console.log(`[server]: Server is running at :${port}`);
});



initSpotPriceProcessor();

// catch up any unprocessed data
(async () => {
    let remaining = 1; //1;
    
    while (remaining > 0) {
        remaining = await catchupProcessing();
        console.log('Remaining = ' + remaining);
    }

})();


async function catchupProcessing() {
    const url = process.env.ingester_url + '/catchup/spot_price/5';

    let remaining = 0;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(res => res.json())
    .then(async (data:any) => {
        let count = 0;
        for(let i=0; i<data.data.length; i++) {
            let item = data.data[i];
            await processSpotPriceData(item);
            count ++;
        }
        console.log('Caught up and processed ' + count + ' records.');
        remaining = data.remaining;
    })
    .catch(err => {
        console.error('Error:', err);
    });
    return remaining;
}