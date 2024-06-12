import IngesterNotification from "@lib/ingester_notification";
import SentimentSourceIds from "@processors/sentiment/sentiment_sources";
import TimescaleSource from '@lib/timescale_source';

import { markAsProcessed } from '@lib/ingester';

import dotenv from "dotenv";
dotenv.config();

import AsyncLock from 'async-lock';
import { exit } from "process";
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

    console.info(d.uuid, 'New sentiment data received');
        
    await lock.acquire('sentiment_processor', async () => {
        // insert into db
        await saveData(d);
      
        // mark database as processed
        await markAsProcessed(d.uuid);

        const elapsed_ms = new Date().getTime() - start_time.getTime();
        console.info(d.uuid, 'Sentiment data processed in ' +  elapsed_ms / 1000 + ' seconds');
    });
}



async function saveData(data: any, options = {}) {
    const db = TimescaleSource.getInstance();

    const query = 'INSERT INTO sentiment_history(time, source_id, tag, value, details) VALUES %L ON CONFLICT DO NOTHING';
    const values: any = [];

    for(const d of data.data) {
        let tag = '';
        switch(d.source.toLowerCase()) {
            case '1 day':
            case 'daily':
                tag = 'daily';
                break;

            case '1 week':
                if (data.source_name != 'fxstreet_com') {
                    console.log('skipping', data.source_name, d.source_name);
                    continue;
                }
                tag = '1 week';
                break;
            
            case 'ai_text':
                tag = 'ai_text';
                break;

            default:
                continue;
        }


        
        const source_id  = SentimentSourceIds[data.source_name];
        if (typeof(source_id) === 'undefined') {
            console.warn('Unknown source: ', data.source_name);
            continue;
        }

        const ts = d.ts_date;
        const tsFormatted = new Date(ts).toISOString(); // Convert to ISO 8601 format and keep timezone info

        // const details = 
        const value = [
            tsFormatted, 
            source_id, 
            tag,
            d.score_pc,
            (tag == 'ai_text' ? { 'text': d.extra_data.text } : {} )
        ];

        // console.debug(d);
        console.debug(value);
        
        // @ts-ignore
        values.push(value);
    }
    if (values.length > 0) {
        console.log(query, values);
        await db.query(query, values);
    }
}

