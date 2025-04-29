import 'module-alias/register';
import express, { Express, Request, Response } from "express";
import { Eta } from 'eta';
import path from "path";

import dotenv from "dotenv";
dotenv.config();

import initSpotPriceProcessor, {processData as processSpotPriceData} from '@processors/spot_price/spot_price';

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

app.get("/catchup/:data_type", (req: Request, res: Response) => {
    // get unprocessed data, then process it  
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
// import '@processors/spot_price/spot_price_catchup';

import '@processors/catchup';
import '@processors/spot_price/spot_price';
