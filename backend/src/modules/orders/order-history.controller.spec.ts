import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import request = require('supertest');
import { JwtStrategy } from "../auth/jwt.strategy";
import { RateLimitGuard } from "../rate-limit/rate-limit.guard";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

test("GET /orders/history requires JWT and uses only its subject as owner", async (t) => {
  const calls: string[] = [];
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
            calls.push(userId);
            return [];
          },
        },
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
  assert.deepEqual(calls, ["jwt-owner"]);
});
