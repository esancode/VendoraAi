"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    adapterConstructor;
    async connectToRedis(redisUrl) {
        const pubClient = new ioredis_1.Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
        const subClient = pubClient.duplicate();
        pubClient.on('error', (err) => console.error('Redis PubClient Error:', err.message));
        subClient.on('error', (err) => console.error('Redis SubClient Error:', err.message));
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
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