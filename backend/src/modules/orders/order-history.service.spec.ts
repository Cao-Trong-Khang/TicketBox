import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrderStatus } from "@prisma/client";
import { OrdersService } from "./orders.service";

const HISTORY_QUERY = {
  where: { userId: "audience-1" },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: 100,
  select: {
    id: true,
    orderCode: true,
    status: true,
    createdAt: true,
    totalAmountVnd: true,
    concert: {
      select: {
        title: true,
        performanceStartAt: true,
        startsAt: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
      },
    },
    items: {
      select: {
        quantity: true,
        ticketType: { select: { name: true } },
      },
    },
  },
};

test("history uses an owned, deterministic, bounded explicit projection", async () => {
  let receivedQuery: unknown;
  const service = createHistoryService(async (query) => {
    receivedQuery = query;
    return [historyRow(OrderStatus.PAID)];
  });

  const result = await service.getOrderHistory("audience-1");

  assert.deepEqual(receivedQuery, HISTORY_QUERY);
  assert.deepEqual(result, [
    {
      orderId: "order-PAID",
      orderCode: "DEMO-PAID",
      status: OrderStatus.PAID,
      createdAt: "2026-07-05T02:00:00.000Z",
      performanceStartAt: "2026-08-01T12:00:00.000Z",
      concertTitle: "TicketBox Live",
      venueName: "Nhà hát Thành phố",
      venueAddress: null,
      bannerUrl: null,
      totalAmountVnd: 1000000,
      tickets: [
        { ticketTypeName: "VIP", quantity: 1 },
        { ticketTypeName: "Standard", quantity: 2 },
      ],
    },
  ]);
});

test("history maps all statuses, multiple items, nullable fields, and empty results", async () => {
  const statuses = [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ];
  const service = createHistoryService(async () => statuses.map(historyRow));

  const result = await service.getOrderHistory("audience-1");

  assert.deepEqual(
    result.map((order) => order.status),
    statuses,
  );
  assert.equal(result[0].tickets.length, 2);
  assert.equal(result[0].venueAddress, null);
  assert.equal(result[0].bannerUrl, null);

  const emptyService = createHistoryService(async () => []);
  assert.deepEqual(await emptyService.getOrderHistory("audience-1"), []);
});

test("history serializes no sensitive fields and performs no writes or cache calls", async () => {
  const service = createHistoryService(async () => [
    historyRow(OrderStatus.PENDING),
  ]);

  const result = await service.getOrderHistory("audience-1");
  const serialized = JSON.stringify(result);

  for (const forbidden of [
    "userId",
    "idempotencyKey",
    "payment",
    "provider",
    "qrHash",
    "reservedQuantity",
    "soldQuantity",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

function createHistoryService(
  findMany: (query: unknown) => Promise<ReturnType<typeof historyRow>[]>,
): OrdersService {
  const fail = () => {
    throw new Error("history must not mutate state or touch cache");
  };
  const prisma = {
    order: {
      findMany,
      create: fail,
      update: fail,
      delete: fail,
    },
    $transaction: fail,
  };
  const redisCache = { get: fail, set: fail, del: fail };
  const checkoutLocks = { withLocks: fail };
  return new OrdersService(prisma as never, redisCache as never, checkoutLocks as never);
}

function historyRow(status: OrderStatus) {
  return {
    id: "order-" + status,
    orderCode: "DEMO-" + status,
    status,
    createdAt: new Date("2026-07-05T02:00:00.000Z"),
    totalAmountVnd: 1000000,
    concert: {
      title: "TicketBox Live",
      performanceStartAt: new Date("2026-08-01T12:00:00.000Z"),
      venueName: "Nhà hát Thành phố",
      venueAddress: null,
      bannerUrl: null,
    },
    items: [
      { quantity: 1, ticketType: { name: "VIP" } },
      { quantity: 2, ticketType: { name: "Standard" } },
    ],
  };
}
