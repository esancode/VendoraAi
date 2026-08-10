import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
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

      // Join the tenant room
      const room = `tenant_room:${tenantId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room: ${room}`);
    } catch (error) {
      this.logger.warn(`Client disconnected (Invalid token): ${client.id}`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast an event to a specific tenant room
   */
  broadcastToTenant(tenantId: string, event: string, payload: any) {
    const room = `tenant_room:${tenantId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Broadcasted event ${event} to room ${room}`);
  }
}
