import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
    constructor() {
        this.client = redis.createClient();

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('True');
        });


        this.getAsync = promisify(this.client.get).bind(this.client);
        this.setAsync = promisify(this.client.set).bind(this.client);
        this.delAsync = promisify(this.client.del).bind(this.client);
        this.pingAsync = promisify(this.client.ping).bind(this.client);
    }

    async isAlive() {
        try {
            const pong = await this.pingAsync();
            return pong === 'PONG';
        } catch (error) {
            return false;
        }
    }

    async get(key) {
        try {
            return await this.getAsync(key);
        } catch (error) {
            console.error(`Error getting key ${key}:`, error);
            return null;
        }
    }

    async set(key, value, duration) {
        try {
            await this.setAsync(key, value, 'EX', duration);
        } catch (error) {
            console.error(`Error setting key ${key}:`, error);
        }
    }

    async del(key) {
        try {
            await this.delAsync(key);
        } catch (error) {
            console.error(`Error deleting key ${key}:`, error);
        }
    }
}

const redisClient = new RedisClient();
export default redisClient;
