import { createClient, RedisClientType } from "redis";
import AsyncLock from 'async-lock';
import process from 'process';


class RedisSource {
    private static instance: RedisSource;
    // @ts-ignore
    private db: RedisClientType;
    private lock: AsyncLock;

    /**
     * The Singleton's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
    private constructor() {
        this.lock = new AsyncLock();
    }

    private async initialize() {
        await this.lock.acquire('redis_init', async () => {
            if (typeof(this.db) === 'undefined') {
                const redis_config = {
                    username: process.env.redis_username,
                    password: process.env.redis_password,
                    socket: {
                        host: process.env.redis_host,
                        port: Number(process.env.redis_port),
                        tls: (process.env.redis_tls == 'true'),
                    }
                }

                this.db = await createClient(redis_config);
                console.log('redis connected');
        
                this.db.on('error', (err) => {
                    console.log('Redis Client Error', err);
                    process.exit();
                });
                    
        
        
                await this.db.connect();
            }
        });
    }

    /**
     * The static method that controls the access to the singleton instance.
     *
     * This implementation let you subclass the Singleton class while keeping
     * just one instance of each subclass around.
     */
    public static getInstance(): RedisSource {
        if (!RedisSource.instance) {
            RedisSource.instance = new RedisSource();
        }

        return RedisSource.instance;
    }

    /**
     * Finally, any singleton should define some business logic, which can be
     * executed on its instance.
     */
    public async getData(key:string): Promise<any> {
        await this.initialize();

        let raw = await this.db.get(key);
        // console.log(raw);
        let data = null;
        if (raw) {
            data = await JSON.parse(raw);
        }
    }


    public async setData(key: string, data: any){
        await this.initialize();

        // convert to json
        const json = JSON.stringify(data);

        // save
        await this.db.set(key, json);
    }

    public async delete(key: string) {
        await this.initialize();

        await this.db.del(key);
    }

    public async getKeys(pattern: string): Promise<string[]> {
        await this.initialize();

        return await this.db.keys(pattern);
    }
    
    public async dbObject(): Promise <any> {
        await this.initialize();

        return this.db;
    }

    
}

export default RedisSource;