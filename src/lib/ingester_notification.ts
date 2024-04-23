import RedisSource from "@lib/redis_source";


export default class IngesterNotification {
    private redis_source;


    constructor() {
        this.redis_source = RedisSource.getInstance();
    }

    public async publish(type: string, data: any) {
        const db = await this.redis_source.dbObject();
        // @ts-ignore
        await db.publish(type, JSON.stringify(data));
    }

    public async subscribe (type: string,  callback: (data: any) => void) {
        const db = await this.redis_source.dbObject();

        // @ts-ignore
        const client = db.duplicate();
        await client.connect();
        await client.subscribe(type, (message:any) => {
            callback(message);
        })
    }
}