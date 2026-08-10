"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentTenant = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentTenant = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.tenantContext) {
        throw new common_1.UnauthorizedException('Tenant context not found. Is JwtAuthGuard applied?');
    }
    return request.tenantContext;
});
//# sourceMappingURL=current-tenant.decorator.js.map