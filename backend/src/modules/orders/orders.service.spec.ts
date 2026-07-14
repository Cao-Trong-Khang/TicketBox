import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException } from "@nestjs/common";
import {
  ConcertStatus,
  OrderStatus,
  TicketTypeStatus,
} from "@prisma/client";
import { OrdersService } from "./orders.service";

test("orders are rejected before the concert sale window starts", async () => {
  const service = createService({
    concert: {
      id: "concert-1",
      status: ConcertStatus.PUBLISHED,
      startsAt: new Date("2099-08-01T12:00:00.000Z"),
      endsAt: new Date("2099-08-01T15:00:00.000Z"),
    },
  });

  await assert.rejects(
    () =>
      service.createOrder("user-1", {
        concertId: "concert-1",
        idempotencyKey: "idem-1",
        items: [{ ticketTypeId: "ticket-type-1", quantity: 1 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(
        error.message,
        "Ticket sales have not started for this concert",
      );
      return true;
    },
  );
});

test("orders are rejected after the concert sale window ends", async () => {
  const service = createService({
    concert: {
      id: "concert-1",
      status: ConcertStatus.PUBLISHED,
      startsAt: new Date("2000-08-01T12:00:00.000Z"),
      endsAt: new Date("2000-08-01T15:00:00.000Z"),
    },
  });

  await assert.rejects(
    () =>
      service.createOrder("user-1", {
        concertId: "concert-1",
        idempotencyKey: "idem-2",
        items: [{ ticketTypeId: "ticket-type-1", quantity: 1 }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(error.message, "Ticket sales have ended for this concert");
      return true;
    },
  );
});

test("orders are allowed during the concert sale window even when ticket-type sale dates conflict", async () => {
  const createdOrders: Array<{ totalAmountVnd: number }> = [];
  const service = createService(
    {
      concert: {
        id: "concert-1",
        status: ConcertStatus.PUBLISHED,
        startsAt: new Date("2000-08-01T12:00:00.000Z"),
        endsAt: new Date("2999-08-01T15:00:00.000Z"),
      },
      ticketTypes: [
        {
          id: "ticket-type-1",
          concertId: "concert-1",
          status: TicketTypeStatus.ACTIVE,
          priceVnd: 500000,
          totalQuantity: 100,
          reservedQuantity: 0,
          soldQuantity: 0,
          perUserLimit: 4,
          saleStartAt: new Date("2999-08-01T12:00:00.000Z"),
          saleEndAt: new Date("2999-08-01T15:00:00.000Z"),
        },
      ],
    },
    {
      onCreateOrder: (order) => {
        createdOrders.push(order);
      },
    },
  );

  const response = await service.createOrder("user-1", {
    concertId: "concert-1",
    idempotencyKey: "idem-3",
    items: [{ ticketTypeId: "ticket-type-1", quantity: 2 }],
  });

  assert.equal(response.status, OrderStatus.PENDING);
  assert.equal(response.totalAmountVnd, 1_000_000);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0].totalAmountVnd, 1_000_000);
});

function createService(
  state: {
    concert: {
      id: string;
      status: ConcertStatus;
      startsAt: Date;
      endsAt: Date | null;
    };
    ticketTypes?: Array<{
      id: string;
      concertId: string;
      status: TicketTypeStatus;
      priceVnd: number;
      totalQuantity: number;
      reservedQuantity: number;
      soldQuantity: number;
      perUserLimit: number;
      saleStartAt: Date;
      saleEndAt: Date | null;
    }>;
  },
  options?: {
    onCreateOrder?: (order: { totalAmountVnd: number }) => void;
  },
): OrdersService {
  const createdOrders = new Map<
    string,
    {
      id: string;
      orderCode: string;
      status: OrderStatus;
      totalAmountVnd: number;
      expiresAt: Date;
    }
  >();

  const tx = {
    concert: {
      findUnique: async () => state.concert,
    },
    ticketType: {
      findMany: async () => state.ticketTypes ?? [],
    },
    orderItem: {
      aggregate: async () => ({
        _sum: {
          quantity: 0,
        },
      }),
      create: async () => undefined,
    },
    order: {
      create: async ({
        data,
      }: {
        data: {
          userId: string;
          concertId: string;
          status: OrderStatus;
          totalAmountVnd: number;
          expiresAt: Date;
          idempotencyKey: string;
          orderCode: string;
        };
      }) => {
        const order = {
          id: "order-1",
          orderCode: data.orderCode,
          status: data.status,
          totalAmountVnd: data.totalAmountVnd,
          expiresAt: data.expiresAt,
        };
        createdOrders.set(data.idempotencyKey, order);
        options?.onCreateOrder?.({ totalAmountVnd: data.totalAmountVnd });
        return order;
      },
      findUnique: async ({
        where,
      }: {
        where: { userId_idempotencyKey: { userId: string; idempotencyKey: string } };
      }) => createdOrders.get(where.userId_idempotencyKey.idempotencyKey) ?? null,
    },
    $executeRaw: async () => 1,
    $queryRaw: async () => [],
  };

  const prisma = {
    order: {
      findUnique: tx.order.findUnique,
    },
    $transaction: async (
      callback: (innerTx: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  };

  const redisCache = {
    del: async () => undefined,
  };

  const checkoutLocks = {
    withLocks: async (_scopes: string[], operation: () => Promise<unknown>) => operation(),
  };

  return new OrdersService(prisma as never, redisCache as never, checkoutLocks as never);
}
