import {processData as processForecastData} from '@processors/forecast/forecast';
import {processData as processSentimentData} from '@processors/sentiment/sentiment';
import {processData as processSpotPricetData} from '@processors/spot_price/spot_price';


import { CronJob } from 'cron';
import AsyncLock from 'async-lock';
// catch up any unprocessed data

const lock = new AsyncLock();

const process_handlers = {
    'forecast': processForecastData,
    'sentiment': processSentimentData,
    'spot_price': processSpotPricetData
};

export async function catchupProcessing(): Promise<number> {
    const url = process.env.ingester_url + '/catchup/forecast,sentiment/5';

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

            // @ts-ignore
            await process_handlers[item.type](item);
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

async function catchUp() {
    if (lock.isBusy('catchup_processing')) {
        return;
    }

    await lock.acquire('catchup_processing', async () => {
        let remaining:number = 1;
    
        console.log('Start catchUp loop');
        while (remaining > 0) {
            remaining = await catchupProcessing();
            console.log('Remaining = ' + remaining);
        }
        console.log('End catchUp loop');
    });
}


(async () => {
    console.log('General catch up');
    await catchUp();

    const job = CronJob.from({
        cronTime: '0 */5 * * * *', // every 5 minutes

        onTick: async () => {
            console.log('call catchup from cronjob')
            await catchUp();
            console.log('done catchup from cronjob')
        },
        start: true
    });
})();


export default {};