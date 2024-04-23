import { Pool } from "pg";
import AsyncLock from 'async-lock';
import pgFormat from 'pg-format';

// export default function GetTimescaleSource() {
//     return  TimescaleSource.getInstance();
// }

export default class TimescaleSource {
    private static instance: TimescaleSource;

    // @ts-ignore
    private pool: any;
    private lock: AsyncLock;

    private constructor() {
        this.lock = new AsyncLock();
    }

    private async initialize() {
        const pool_config = {
            host: process.env.timescale_host,
            database: process.env.timescale_database,
            user: process.env.timescale_user,
            password: process.env.timescale_password,
            port: Number(process.env.timescale_port),
            max: 1
        };

        console.log('timescale initialize()');

        // console.log(pool_config);
        this.pool = new Pool(pool_config);

    }

    public static getInstance(): TimescaleSource {
        if (!TimescaleSource.instance) {
            console.log('TimescaleSource getInstance()');
            TimescaleSource.instance = new TimescaleSource();
        }

        return TimescaleSource.instance;
    }

    private async getPool(): Promise<any> {
        await this.lock.acquire('timescale_get_pool', async () => {
            if (typeof(this.pool) === 'undefined') {
                await this.initialize();
            }
        });

        return this.pool;
    }

    public async query(query: string, values: any[] = []): Promise<any> {
        const pool = await this.getPool();
        const q = pgFormat(query, values);
        const  result = await pool.query(q);

        return result;
    }
    
}

