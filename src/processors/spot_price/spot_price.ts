import IngesterNotification from "@lib/ingester_notification";
import SpotPriceSourceIds, { default_spot_price_source } from "@processors/spot_price/spot_price_sources";

import TimescaleSource from '@lib/timescale_source';

import dotenv from "dotenv";
dotenv.config();

import AsyncLock from 'async-lock';
let lock = new AsyncLock();

export default async function initSpotPriceProcessor () {
    const ingester_notification = new IngesterNotification();
    ingester_notification.subscribe('new data: spot_price', processData);
};

export async function processData(data: any): Promise<any> {
    const start_time = new Date();
    let d;
    if (typeof(data) == 'string') {
        d = JSON.parse(data);
    } else {
        d = data;
    }

    if (! d) {
        console.warn('Invalid JSON: ', data);
        return;
    }

    // console.debug(d);

    console.info(d.uuid, 'New spot price data received');
        
    await lock.acquire('spot_price_processor', async () => {
            // insert into db
        await saveData(d);
        
        // mark database as processed
        await markAsProcessed(d.uuid);

        await postProcessData(d);

        const elapsed_ms = new Date().getTime() - start_time.getTime();
        console.info(d.uuid, 'Spot price data processed in ' +  elapsed_ms / 1000 + ' seconds');
    });
}



async function saveData(data: any, options = {}) {
    const db = TimescaleSource.getInstance();

    const query = 'INSERT INTO spot_prices_real_time(time, symbol, source, bid, ask, mid) VALUES %L ON CONFLICT DO NOTHING';
    const values = []
    for(const d of data.data) {
        const source_id  = SpotPriceSourceIds[d.source];
        if (typeof(source_id) === 'undefined') {
            console.warn('Unknown source: ', d.source);
            continue;
        }

        const ts = d.timestamp_source;
        const tsFormatted = new Date(ts).toISOString(); // Convert to ISO 8601 format and keep timezone info
        const value= [
            tsFormatted, 
            d.symbol,
            source_id, 
            d.ask,
            d.bid,
            d.mid
        ];

        // console.debug(d);
        // console.debug(value);
        
        values.push(value);
    }
    if (values.length > 0) {
        await db.query(query, values);
    }
}

async function markAsProcessed(uuid: string, options = {}) {
    const url = process.env.ingester_url + '/processed';

    console.info(uuid, 'Marking spot price data as processed in ingester');
    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uuids: [uuid]
        })
    });
}


async function postProcessData(data: any, options = {}) {

}


async function fetchWithRetry(url:string, options: any, maxRetries = 3) {
    let retries = 0;
  
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        retries++;
        console.error(`Fetch failed (${retries}/${maxRetries}), retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 seconds before retrying
      }
    }
  
    console.error(`Fetch failed after ${maxRetries} retries.`);
}