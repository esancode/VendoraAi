"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    adapterConstructor;
    async connectToRedis(redisUrl) {
        const url = redisUrl || process.env.REDIS_URL;
        if (url) {
            const pubClient = new ioredis_1.Redis(url, { maxRetriesPerRequest: null });
            const subClient = pubClient.duplicate();
            pubClient.on('error', (err) => console.error('Redis PubClient Error:', err.message));
            subClient.on('error', (err) => console.error('Redis SubClient Error:', err.message));
            this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
        }
        else {
            const pubClient = new ioredis_1.Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                maxRetriesPerRequest: null
            });
            const subClient = pubClient.duplicate();
            pubClient.on('error', (err) => console.error('Redis PubClient Error:', err.message));
            subClient.on('error', (err) => console.error('Redis SubClient Error:', err.message));
            this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
        }
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: true,
                credentials: true,
            },
        });
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map