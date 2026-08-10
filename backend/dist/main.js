"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const app_module_1 = require("./app.module");
const cookie_1 = __importDefault(require("@fastify/cookie"));
const fastify_raw_body_1 = __importDefault(require("fastify-raw-body"));
const redis_io_adapter_1 = require("./notifications/redis-io.adapter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter(), { cors: { origin: true, credentials: true } });
    await app.register(cookie_1.default, {
        secret: process.env.COOKIE_SECRET || 'vendora-cookie-secret',
    });
    await app.register(fastify_raw_body_1.default, {
        field: 'rawBody',
        global: true,
        encoding: 'utf8',
        runFirst: true,
    });
    const redisIoAdapter = new redis_io_adapter_1.RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map