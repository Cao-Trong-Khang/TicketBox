const HISTORY_ORDER_SEEDS = [
  {
    orderCode: "DEMO-HISTORY-PENDING",
    idempotencyKey: "demo-history-pending-v1",
    status: "PENDING",
    createdAt: new Date("2026-07-05T09:00:00.000Z"),
    expiresAt: new Date("2026-07-05T09:15:00.000Z"),
    paidAt: null,
    quantities: [1],
  },
  {
    orderCode: "DEMO-HISTORY-PAID",
    idempotencyKey: "demo-history-paid-v1",
    status: "PAID",
    createdAt: new Date("2026-07-04T09:00:00.000Z"),
    expiresAt: new Date("2026-07-04T09:15:00.000Z"),
    paidAt: new Date("2026-07-04T09:05:00.000Z"),
    quantities: [1, 2],
  },
  {
    orderCode: "DEMO-HISTORY-FAILED",
    idempotencyKey: "demo-history-failed-v1",
    status: "FAILED",
    createdAt: new Date("2026-07-03T09:00:00.000Z"),
    expiresAt: new Date("2026-07-03T09:15:00.000Z"),
    paidAt: null,
    quantities: [2],
  },
  {
    orderCode: "DEMO-HISTORY-EXPIRED",
    idempotencyKey: "demo-history-expired-v1",
    status: "EXPIRED",
    createdAt: new Date("2026-07-02T09:00:00.000Z"),
    expiresAt: new Date("2026-07-02T09:15:00.000Z"),
    paidAt: null,
    quantities: [1],
  },
  {
    orderCode: "DEMO-HISTORY-CANCELLED",
    idempotencyKey: "demo-history-cancelled-v1",
    status: "CANCELLED",
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
    expiresAt: new Date("2026-07-01T09:15:00.000Z"),
    paidAt: null,
    quantities: [1],
  },
];

async function seedOrderHistory(prisma) {
  const audience = await prisma.user.findUniqueOrThrow({
    where: { email: "audience@ticketbox.local" },
    select: { id: true },
  });
  const concert = await prisma.concert.findFirstOrThrow({
    where: { ticketTypes: { some: { status: "ACTIVE" } } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      ticketTypes: {
        where: { status: "ACTIVE" },
        orderBy: [{ priceVnd: "asc" }, { id: "asc" }],
        take: 2,
        select: { id: true, priceVnd: true },
      },
    },
  });

  for (const fixture of HISTORY_ORDER_SEEDS) {
    const lines = fixture.quantities.map((quantity, index) => {
      const ticketType = concert.ticketTypes[index];
      if (!ticketType) {
        throw new Error(
          "Order history seed requires at least two active ticket types",
        );
      }
      return {
        ticketTypeId: ticketType.id,
        quantity,
        unitPriceVnd: ticketType.priceVnd,
        subtotalVnd: ticketType.priceVnd * quantity,
      };
    });
    const totalAmountVnd = lines.reduce(
      (sum, line) => sum + line.subtotalVnd,
      0,
    );
    const order = await prisma.order.upsert({
      where: { orderCode: fixture.orderCode },
      update: {
        userId: audience.id,
        concertId: concert.id,
        status: fixture.status,
        totalAmountVnd,
        expiresAt: fixture.expiresAt,
        paidAt: fixture.paidAt,
        idempotencyKey: fixture.idempotencyKey,
        createdAt: fixture.createdAt,
      },
      create: {
        orderCode: fixture.orderCode,
        userId: audience.id,
        concertId: concert.id,
        status: fixture.status,
        totalAmountVnd,
        expiresAt: fixture.expiresAt,
        paidAt: fixture.paidAt,
        idempotencyKey: fixture.idempotencyKey,
        createdAt: fixture.createdAt,
      },
    });

    for (const line of lines) {
      const existing = await prisma.orderItem.findFirst({
        where: { orderId: order.id, ticketTypeId: line.ticketTypeId },
        select: { id: true },
      });
      if (existing) {
        await prisma.orderItem.update({
          where: { id: existing.id },
          data: line,
        });
      } else {
        await prisma.orderItem.create({ data: { orderId: order.id, ...line } });
      }
    }
  }
}

module.exports = { HISTORY_ORDER_SEEDS, seedOrderHistory };
