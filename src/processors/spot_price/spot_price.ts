import IngesterNotification from "@lib/ingester_notification";
import SpotPriceSourceIds, { default_spot_price_source } from "@processors/spot_price/spot_price_sources";

import TimescaleSource from '@lib/timescale_source';
import { CronJob } from 'cron';

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
            d.bid,
            d.ask,
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


async function setCloseStatsForToday() {
    const db = TimescaleSource.getInstance();

    const query = `WITH latest_prices AS(
            SELECT DISTINCT ON (date, symbol, source)
                (time_bucket('1 day', time, 'America/Toronto')::date) AS date,
                symbol,
                source,
                mid AS "close"
            FROM spot_prices_real_time
            WHERE time > ((now() AT TIME ZONE 'America/Toronto')::date - INTERVAL '1 day')
                AND time < (time_bucket('1 day', time, 'America/Toronto') + INTERVAL '17 hours')
            ORDER BY date, symbol, source, time DESC
        )
        UPDATE spot_prices_daily_stats ds
        SET close = lp.close
        FROM latest_prices lp
        WHERE ds.time = lp.date
            AND ds.symbol = lp.symbol
            AND ds.source = lp.source`;
    
    await db.query(query);
}

async function setCloseStatsForPreviousDay() {
    const db = TimescaleSource.getInstance();

    const query = `WITH latest_stats AS (
            SELECT
                time, source, symbol, close
            FROM
                spot_prices_daily_stats ds
            WHERE
                time = ((now() AT TIME ZONE 'America/Toronto')::date - INTERVAL '1 day')
        )
        UPDATE spot_prices_daily_stats ds
        SET previous_day_close = ls.close
        FROM latest_stats ls
        WHERE ds.time = ((now() AT TIME ZONE 'America/Toronto')::date)
            AND ds.symbol = ls.symbol
            AND ds.source = ls.source`;

    const results = await db.query(query);    
}

(async () => {
    console.log('init spot cron');
    const job1 = CronJob.from({
        cronTime: '0 1 17,18,19,20,21,22 * * *', // every day at 5:01pm

        onTick: async () => {
            console.log('get close stats for the day')
            await setCloseStatsForToday();
        },
        start: true
    });

    const job2 = CronJob.from({
        cronTime: '0 1 0,1,2,5,7 * * *', // every day at 12:01am

        onTick: async () => {
            console.log('set previous close stats for today')
            await setCloseStatsForPreviousDay();
        },
        start: true
    });
})();