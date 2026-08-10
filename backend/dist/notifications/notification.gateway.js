"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
let NotificationGateway = NotificationGateway_1 = class NotificationGateway {
    jwtService;
    server;
    logger = new common_1.Logger(NotificationGateway_1.name);
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    afterInit(server) {
        this.logger.log('WebSocket Gateway initialized');
    }
    async handleConnection(client) {
        try {
            const authHeader = client.handshake.auth?.token || client.handshake.headers?.authorization;
            if (!authHeader) {
                this.logger.warn(`Client disconnected (No token): ${client.id}`);
                client.disconnect();
                return;
            }
            const token = authHeader.replace('Bearer ', '');
            const payload = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET || 'vendora-super-secret-key-12345',
            });
            const tenantId = payload.tenant_id || payload.tenantId;
            if (!tenantId) {
                this.logger.warn(`Client disconnected (No tenantId in token): ${client.id}`);
                client.disconnect();
                return;
            }
            const room = `tenant_room:${tenantId}`;
            client.join(room);
            this.logger.log(`Client ${client.id} joined room: ${room}`);
        }
        catch (error) {
            this.logger.warn(`Client disconnected (Invalid token): ${client.id}`, error.message);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    broadcastToTenant(tenantId, event, payload) {
        const room = `tenant_room:${tenantId}`;
        this.server.to(room).emit(event, payload);
        this.logger.debug(`Broadcasted event ${event} to room ${room}`);
    }
};
exports.NotificationGateway = NotificationGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], NotificationGateway.prototype, "server", void 0);
exports.NotificationGateway = NotificationGateway = NotificationGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], NotificationGateway);
//# sourceMappingURL=notification.gateway.js.map