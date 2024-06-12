import IngesterNotification from "@lib/ingester_notification";
import ForecastSourceIds from "@processors/forecast/forecast_sources";
import TimescaleSource from '@lib/timescale_source';

import { markAsProcessed } from '@lib/ingester';

import dotenv from "dotenv";
dotenv.config();

import AsyncLock from 'async-lock';
let lock = new AsyncLock();

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

    console.info(d.uuid, 'New forecast data received');
        
    await lock.acquire('forecast_processor', async () => {
            // insert into db
        await saveData(d);
      
        // mark database as processed
        await markAsProcessed(d.uuid);

        const elapsed_ms = new Date().getTime() - start_time.getTime();
        console.info(d.uuid, 'Forecast data processed in ' +  elapsed_ms / 1000 + ' seconds');
    });
}



async function saveData(data: any, options = {}) {
    const db = TimescaleSource.getInstance();

    const query = 'INSERT INTO forecast_history(time, source_id, tag, value) VALUES %L ON CONFLICT DO NOTHING';
    const values = [];
    for(const d of data.data) {
        const source_id  = ForecastSourceIds[data.source_name];
        if (typeof(source_id) === 'undefined') {
            console.warn('Unknown source: ', data.source_name);

            process.exit(1);
            continue;
        }

        const ts = d.ts_date;
        const tsFormatted = new Date(ts).toISOString(); // Convert to ISO 8601 format and keep timezone info
        const value = [
            tsFormatted, 
            source_id, 
            d.source,
            d.value,
        ];

        // console.debug(d);
        console.debug(value);
        
        // @ts-ignore
        values.push(value);
    }
    if (values.length > 0) {
        await db.query(query, values);
    }
}

