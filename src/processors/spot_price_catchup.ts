import {processData as processSpotPriceData} from '@processors/spot_price';
import { CronJob } from 'cron';
import AsyncLock from 'async-lock';
// catch up any unprocessed data

const lock = new AsyncLock();

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

async function catchUp() {
    if (lock.isBusy()) {
        return;
    }

    await lock.acquire('spot_price_catchup', async () => {
        let remaining = 1;
    
        while (remaining > 0) {
            remaining = await catchupProcessing();
            console.log('Remaining = ' + remaining);
        }
    });
}


(async () => {
    await catchUp();

    const job = CronJob.from({
        cronTime: '* */10 * * * *', // every 10 minutes
        onTick: async () => {
            await catchUp();
        },
        start: true
    });
})();


export default {};