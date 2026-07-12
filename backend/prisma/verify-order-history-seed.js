const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const {
  HISTORY_ORDER_SEEDS,
  seedOrderHistory,
} = require("./order-history-seed");

const prisma = new PrismaClient();

async function snapshot() {
  const orders = await prisma.order.findMany({
    where: { orderCode: { startsWith: "DEMO-HISTORY-" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      orderCode: true,
      status: true,
      items: { select: { id: true } },
      payments: { select: { id: true } },
      tickets: { select: { id: true } },
    },
  });
  return {
    orderCodes: orders.map((order) => order.orderCode),
    statuses: orders.map((order) => order.status),
    itemCounts: orders.map((order) => order.items.length),
    paymentCount: orders.reduce((sum, order) => sum + order.payments.length, 0),
    ticketCount: orders.reduce((sum, order) => sum + order.tickets.length, 0),
  };
}

async function main() {
  await seedOrderHistory(prisma);
  const first = await snapshot();
  await seedOrderHistory(prisma);
  const second = await snapshot();

  assert.deepEqual(second, first);
  assert.equal(second.orderCodes.length, HISTORY_ORDER_SEEDS.length);
  assert.deepEqual(second.statuses, [
    "PENDING",
    "PAID",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
  ]);
  assert.deepEqual(second.itemCounts, [1, 2, 1, 1, 1]);
  assert.equal(second.paymentCount, 0);
  assert.equal(second.ticketCount, 0);
  console.log("Order history seed is idempotent:", second);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
