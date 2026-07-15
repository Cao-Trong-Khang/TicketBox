import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import request = require('supertest');
import { JwtStrategy } from "../auth/jwt.strategy";
import { RateLimitGuard } from "../rate-limit/rate-limit.guard";
import { PermissionService } from "../rbac/permission.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

test("order reads require JWT and use only its subject as owner", async (t) => {
  const historyCalls: string[] = [];
  const orderCalls: Array<{ userId: string; orderId: string }> = [];
  const ownedOrderId = "00000000-0000-4000-8000-000000000001";
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: "jwt" }),
      JwtModule.register({ secret: "history-test-secret" }),
    ],
    controllers: [OrdersController],
    providers: [
      JwtStrategy,
      {
        provide: ConfigService,
        useValue: new ConfigService({
          JWT_ACCESS_SECRET: "history-test-secret",
        }),
      },
      {
        provide: OrdersService,
        useValue: {
          getOrderHistory: async (userId: string) => {
            historyCalls.push(userId);
            return [];
          },
          getOrderForCheckout: async (userId: string, orderId: string) => {
            orderCalls.push({ userId, orderId });
            return {
              orderId,
              orderCode: "ORD-1",
              status: "PENDING",
              totalAmountVnd: 150000,
              expiresAt: "2026-07-15T10:00:00.000Z",
            };
          },
        },
      },
      {
        provide: PermissionService,
        useValue: { userHasPermissions: async () => true },
      },
    ],
  })
    .overrideGuard(RateLimitGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  t.after(async () => app.close());

  await request(app.getHttpServer()).get("/orders/history").expect(401);
  await request(app.getHttpServer()).get("/orders/" + ownedOrderId).expect(401);
  await request(app.getHttpServer())
    .get("/orders/history")
    .set("Authorization", "Bearer invalid-token")
    .expect(401);

  const token = app.get(JwtService).sign({
    sub: "jwt-owner",
    email: "audience@ticketbox.local",
  });
  const response = await request(app.getHttpServer())
    .get("/orders/history?userId=foreign-user")
    .set("Authorization", "Bearer " + token)
    .expect(200);

  assert.deepEqual(response.body, []);
  assert.deepEqual(historyCalls, ["jwt-owner"]);

  const orderResponse = await request(app.getHttpServer())
    .get("/orders/" + ownedOrderId + "?userId=foreign-user")
    .set("Authorization", "Bearer " + token)
    .expect(200);

  assert.deepEqual(orderResponse.body, {
    orderId: ownedOrderId,
    orderCode: "ORD-1",
    status: "PENDING",
    totalAmountVnd: 150000,
    expiresAt: "2026-07-15T10:00:00.000Z",
  });
  assert.deepEqual(orderCalls, [{ userId: "jwt-owner", orderId: ownedOrderId }]);
});
