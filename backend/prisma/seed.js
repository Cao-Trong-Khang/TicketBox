const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

const roles = [
  { code: 'AUDIENCE', name: 'Audience' },
  { code: 'ORGANIZER', name: 'Organizer' },
  { code: 'CHECKIN_STAFF', name: 'Check-in Staff' },
];

const permissions = [
  { code: 'concert:read', description: 'Read published concert information' },
  { code: 'concert:create', description: 'Create concerts' },
  { code: 'concert:update', description: 'Update concerts' },
  { code: 'concert:cancel', description: 'Cancel concerts' },
  { code: 'concert:ticket_type:manage', description: 'Manage concert ticket types' },
  { code: 'concert:analytics:read', description: 'Read concert analytics' },
  { code: 'ticket:purchase', description: 'Purchase tickets' },
  { code: 'ticket:read_own', description: 'Read own tickets' },
  { code: 'checkin:preload', description: 'Preload assigned check-in event data' },
  { code: 'checkin:scan', description: 'Scan and validate tickets at check-in' },
  { code: 'checkin:sync', description: 'Synchronize offline check-in records' },
];

const rolePermissions = {
  AUDIENCE: ['concert:read', 'ticket:purchase', 'ticket:read_own'],
  ORGANIZER: [
    'concert:read',
    'concert:create',
    'concert:update',
    'concert:cancel',
    'concert:ticket_type:manage',
    'concert:analytics:read',
  ],
  CHECKIN_STAFF: ['concert:read', 'checkin:preload', 'checkin:scan', 'checkin:sync'],
};

const concertSeeds = [
  {
    title: 'Anh Trai Say Hi Concert 2026',
    artistName: 'Various Artists',
    description:
      'Đêm nhạc quy tụ các nghệ sĩ nổi bật từ chương trình Anh Trai Say Hi, mang đến sân khấu hoành tráng, âm nhạc trẻ trung và trải nghiệm bùng nổ cho khán giả.',
    venueName: 'Sân vận động Mỹ Đình',
    venueAddress: 'Nam Từ Liêm, Hà Nội',
    bannerUrl: 'https://placehold.co/1200x500?text=Anh+Trai+Say+Hi+Concert',
    seatingSvg:
      '<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#f5f5f5"/><text x="400" y="60" text-anchor="middle" font-size="28">STAGE</text><rect x="300" y="100" width="200" height="80" fill="#ffd700"/><text x="400" y="145" text-anchor="middle">SVIP</text><rect x="220" y="200" width="360" height="80" fill="#ff9999"/><text x="400" y="245" text-anchor="middle">VIP</text><rect x="150" y="310" width="500" height="70" fill="#99ccff"/><text x="400" y="350" text-anchor="middle">CAT1</text><rect x="100" y="400" width="600" height="60" fill="#b6e3b6"/><text x="400" y="435" text-anchor="middle">GA</text></svg>',
    status: 'PUBLISHED',
    startsAt: new Date('2026-08-20T19:30:00+07:00'),
    endsAt: new Date('2026-08-20T22:30:00+07:00'),
    ticketTypes: [
      {
        code: 'SVIP',
        name: 'SVIP',
        priceVnd: 3500000,
        totalQuantity: 200,
        perUserLimit: 2,
      },
      {
        code: 'VIP',
        name: 'VIP',
        priceVnd: 2500000,
        totalQuantity: 800,
        perUserLimit: 2,
      },
      {
        code: 'CAT1',
        name: 'CAT 1',
        priceVnd: 1800000,
        totalQuantity: 2000,
        perUserLimit: 4,
      },
      {
        code: 'CAT2',
        name: 'CAT 2',
        priceVnd: 1200000,
        totalQuantity: 3000,
        perUserLimit: 4,
      },
      {
        code: 'GA',
        name: 'General Admission',
        priceVnd: 800000,
        totalQuantity: 5000,
        perUserLimit: 6,
      },
    ],
  },
  {
    title: 'Chị Đẹp Đạp Gió Rẽ Sóng Live Concert 2026',
    artistName: 'Various Artists',
    description:
      'Concert đặc biệt dành cho khán giả yêu thích chương trình Chị Đẹp Đạp Gió Rẽ Sóng, với các tiết mục trình diễn được dàn dựng công phu.',
    venueName: 'Nhà thi đấu Quân khu 7',
    venueAddress: '202 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP. Hồ Chí Minh',
    bannerUrl: 'https://placehold.co/1200x500?text=Chi+Dep+Dap+Gio+Concert',
    seatingSvg:
      '<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#f5f5f5"/><text x="400" y="60" text-anchor="middle" font-size="28">STAGE</text><rect x="260" y="110" width="280" height="80" fill="#ff9999"/><text x="400" y="155" text-anchor="middle">VIP</text><rect x="180" y="220" width="440" height="80" fill="#99ccff"/><text x="400" y="265" text-anchor="middle">CAT1</text><rect x="130" y="330" width="540" height="65" fill="#b6e3b6"/><text x="400" y="368" text-anchor="middle">CAT2</text><rect x="90" y="420" width="620" height="50" fill="#dddddd"/><text x="400" y="452" text-anchor="middle">GA</text></svg>',
    status: 'PUBLISHED',
    startsAt: new Date('2026-09-15T20:00:00+07:00'),
    endsAt: new Date('2026-09-15T23:00:00+07:00'),
    ticketTypes: [
      {
        code: 'VIP',
        name: 'VIP',
        priceVnd: 2200000,
        totalQuantity: 1000,
        perUserLimit: 2,
      },
      {
        code: 'CAT1',
        name: 'CAT 1',
        priceVnd: 1500000,
        totalQuantity: 2500,
        perUserLimit: 4,
      },
      {
        code: 'CAT2',
        name: 'CAT 2',
        priceVnd: 900000,
        totalQuantity: 4000,
        perUserLimit: 4,
      },
      {
        code: 'GA',
        name: 'General Admission',
        priceVnd: 600000,
        totalQuantity: 8000,
        perUserLimit: 6,
      },
    ],
  },
  {
    title: 'Em Xinh Say Hi Fan Concert 2026',
    artistName: 'Various Artists',
    description:
      'Fan concert dành cho cộng đồng yêu thích Em Xinh Say Hi, kết hợp âm nhạc, giao lưu và các sân khấu đặc biệt.',
    venueName: 'SECC',
    venueAddress: '799 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh',
    bannerUrl: 'https://placehold.co/1200x500?text=Em+Xinh+Say+Hi+Concert',
    seatingSvg:
      '<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#f5f5f5"/><text x="400" y="60" text-anchor="middle" font-size="28">STAGE</text><rect x="280" y="120" width="240" height="80" fill="#ffd700"/><text x="400" y="165" text-anchor="middle">SVIP</text><rect x="200" y="230" width="400" height="80" fill="#ff9999"/><text x="400" y="275" text-anchor="middle">VIP</text><rect x="140" y="340" width="520" height="70" fill="#99ccff"/><text x="400" y="380" text-anchor="middle">CAT1</text><rect x="100" y="430" width="600" height="45" fill="#b6e3b6"/><text x="400" y="458" text-anchor="middle">GA</text></svg>',
    status: 'PUBLISHED',
    startsAt: new Date('2026-10-10T19:30:00+07:00'),
    endsAt: new Date('2026-10-10T22:30:00+07:00'),
    ticketTypes: [
      {
        code: 'SVIP',
        name: 'SVIP',
        priceVnd: 3200000,
        totalQuantity: 300,
        perUserLimit: 2,
      },
      {
        code: 'VIP',
        name: 'VIP',
        priceVnd: 2000000,
        totalQuantity: 1200,
        perUserLimit: 2,
      },
      {
        code: 'CAT1',
        name: 'CAT 1',
        priceVnd: 1300000,
        totalQuantity: 3000,
        perUserLimit: 4,
      },
      {
        code: 'GA',
        name: 'General Admission',
        priceVnd: 700000,
        totalQuantity: 6000,
        perUserLimit: 6,
      },
    ],
  },
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: roleCode },
    });

    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const organizerEmail = process.env.ORGANIZER_EMAIL || 'organizer@ticketbox.local';
  const organizerPassword = process.env.ORGANIZER_PASSWORD || 'Organizer@123456';

  const organizerPasswordHash = await bcrypt.hash(organizerPassword, BCRYPT_SALT_ROUNDS);

  const organizerUser = await prisma.user.upsert({
    where: { email: organizerEmail },
    update: {
      displayName: 'Default Organizer',
      status: 'ACTIVE',
    },
    create: {
      email: organizerEmail,
      passwordHash: organizerPasswordHash,
      displayName: 'Default Organizer',
      status: 'ACTIVE',
    },
  });

  const organizerRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'ORGANIZER' },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: organizerUser.id,
        roleId: organizerRole.id,
      },
    },
    update: {},
    create: {
      userId: organizerUser.id,
      roleId: organizerRole.id,
    },
  });

  const seededConcerts = await seedConcerts(organizerUser.id);
  await seedCheckInDemo(seededConcerts[0]);
}

async function seedConcerts(organizerId) {
  const seededConcerts = [];

  for (const concertSeed of concertSeeds) {
    const { ticketTypes, ...concertData } = concertSeed;

    let concert = await prisma.concert.findFirst({
      where: {
        title: concertData.title,
        organizerId,
      },
    });

    if (concert) {
      concert = await prisma.concert.update({
        where: { id: concert.id },
        data: {
          artistName: concertData.artistName,
          description: concertData.description,
          venueName: concertData.venueName,
          venueAddress: concertData.venueAddress,
          bannerUrl: concertData.bannerUrl,
          seatingSvg: concertData.seatingSvg,
          status: concertData.status,
          startsAt: concertData.startsAt,
          endsAt: concertData.endsAt,
        },
      });
    } else {
      concert = await prisma.concert.create({
        data: {
          ...concertData,
          organizerId,
        },
      });
    }

    for (const ticketTypeSeed of ticketTypes) {
      await prisma.ticketType.upsert({
        where: {
          concertId_code: {
            concertId: concert.id,
            code: ticketTypeSeed.code,
          },
        },
        update: {
          name: ticketTypeSeed.name,
          priceVnd: ticketTypeSeed.priceVnd,
          totalQuantity: ticketTypeSeed.totalQuantity,
          perUserLimit: ticketTypeSeed.perUserLimit,
          saleStartAt: new Date('2026-06-01T20:00:00+07:00'),
          saleEndAt: concert.startsAt,
          status: 'ACTIVE',
        },
        create: {
          concertId: concert.id,
          code: ticketTypeSeed.code,
          name: ticketTypeSeed.name,
          priceVnd: ticketTypeSeed.priceVnd,
          totalQuantity: ticketTypeSeed.totalQuantity,
          reservedQuantity: 0,
          soldQuantity: 0,
          perUserLimit: ticketTypeSeed.perUserLimit,
          saleStartAt: new Date('2026-06-01T20:00:00+07:00'),
          saleEndAt: concert.startsAt,
          status: 'ACTIVE',
        },
      });
    }

    seededConcerts.push(concert);
  }

  return seededConcerts;
}

async function seedCheckInDemo(concert) {
  if (!concert) {
    return;
  }

  const staffPasswordHash = await bcrypt.hash(
    process.env.CHECKIN_STAFF_PASSWORD || 'Checkin@123456',
    BCRYPT_SALT_ROUNDS,
  );
  const audiencePasswordHash = await bcrypt.hash('Audience@123456', BCRYPT_SALT_ROUNDS);

  const staffUser = await prisma.user.upsert({
    where: { email: process.env.CHECKIN_STAFF_EMAIL || 'checkin@ticketbox.local' },
    update: {
      displayName: 'Demo Check-in Staff',
      status: 'ACTIVE',
    },
    create: {
      email: process.env.CHECKIN_STAFF_EMAIL || 'checkin@ticketbox.local',
      passwordHash: staffPasswordHash,
      displayName: 'Demo Check-in Staff',
      status: 'ACTIVE',
    },
  });

  const audienceUser = await prisma.user.upsert({
    where: { email: 'audience@ticketbox.local' },
    update: {
      displayName: 'Demo Audience',
      status: 'ACTIVE',
    },
    create: {
      email: 'audience@ticketbox.local',
      passwordHash: audiencePasswordHash,
      displayName: 'Demo Audience',
      status: 'ACTIVE',
    },
  });

  await assignRole(staffUser.id, 'CHECKIN_STAFF');
  await assignRole(audienceUser.id, 'AUDIENCE');

  await seedCheckInAssignment(staffUser.id, concert.id, 'Gate A', 'demo-device-a');
  await seedCheckInAssignment(staffUser.id, concert.id, 'Gate B', 'demo-device-b');

  const ticketType = await prisma.ticketType.findFirstOrThrow({
    where: {
      concertId: concert.id,
      status: 'ACTIVE',
    },
    orderBy: { priceVnd: 'asc' },
  });

  const order = await prisma.order.upsert({
    where: { orderCode: 'DEMO-CHECKIN-ORDER-001' },
    update: {
      status: 'PAID',
      paidAt: new Date('2026-06-15T12:00:00.000Z'),
    },
    create: {
      orderCode: 'DEMO-CHECKIN-ORDER-001',
      userId: audienceUser.id,
      concertId: concert.id,
      status: 'PAID',
      totalAmountVnd: ticketType.priceVnd * 2,
      expiresAt: new Date('2026-06-15T13:00:00.000Z'),
      paidAt: new Date('2026-06-15T12:00:00.000Z'),
      idempotencyKey: 'demo-checkin-order-001',
    },
  });

  let orderItem = await prisma.orderItem.findFirst({
    where: {
      orderId: order.id,
      ticketTypeId: ticketType.id,
    },
  });

  if (!orderItem) {
    orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: ticketType.id,
        quantity: 2,
        unitPriceVnd: ticketType.priceVnd,
        subtotalVnd: ticketType.priceVnd * 2,
      },
    });
  }

  await seedTicket({
    ticketCode: 'DEMO-CHECKIN-TICKET-001',
    qrHash: 'qr-ticket-demo-valid-001',
    orderId: order.id,
    orderItemId: orderItem.id,
    ownerUserId: audienceUser.id,
    concertId: concert.id,
    ticketTypeId: ticketType.id,
  });
  await seedTicket({
    ticketCode: 'DEMO-CHECKIN-TICKET-002',
    qrHash: 'qr-ticket-demo-valid-002',
    orderId: order.id,
    orderItemId: orderItem.id,
    ownerUserId: audienceUser.id,
    concertId: concert.id,
    ticketTypeId: ticketType.id,
  });

  let vipImport = await prisma.vipGuestImport.findFirst({
    where: {
      concertId: concert.id,
      fileName: 'demo-checkin-vip.csv',
    },
  });

  if (!vipImport) {
    vipImport = await prisma.vipGuestImport.create({
      data: {
        concertId: concert.id,
        sourceName: 'LOCAL_DEMO',
        fileName: 'demo-checkin-vip.csv',
        sourceFingerprint: 'demo-checkin-vip-20260615',
        status: 'COMPLETED',
        totalRows: 3,
        acceptedRows: 3,
        importedAt: new Date('2026-06-15T12:00:00.000Z'),
      },
    });
  } else {
    vipImport = await prisma.vipGuestImport.update({
      where: { id: vipImport.id },
      data: {
        sourceName: 'LOCAL_DEMO',
        sourceFingerprint: 'demo-checkin-vip-20260615',
        status: 'COMPLETED',
        totalRows: 3,
        acceptedRows: 3,
        rejectedRows: 0,
        duplicateRows: 0,
        failureCode: null,
        failureMessage: null,
        importedAt: new Date('2026-06-15T12:00:00.000Z'),
      },
    });
  }

  await seedVipGuest(vipImport.id, concert.id, {
    externalGuestKey: 'VIP-DEMO-001',
    qrHash: 'qr-vip-demo-valid-001',
    fullName: 'Demo VIP Guest One',
    email: 'vip.one@example.test',
    phone: '+84901230001',
    sponsorCompany: 'TicketBox Partners',
    invitedBy: 'Sponsor Team',
    guestType: 'Artist Guest',
    allowedGate: 'VIP Gate',
    notes: 'Demo guest with full metadata',
    sourceRowNumber: 2,
  });
  await seedVipGuest(vipImport.id, concert.id, {
    externalGuestKey: 'VIP-DEMO-002',
    qrHash: 'qr-vip-demo-valid-002',
    fullName: 'Demo VIP Guest Two',
    email: 'vip.two@example.test',
    phone: '+84901230002',
    sponsorCompany: 'Media Partner',
    invitedBy: 'Press Desk',
    guestType: 'Press',
    allowedGate: 'Gate A',
    notes: 'Press entrance',
    sourceRowNumber: 3,
  });
  await seedVipGuest(vipImport.id, concert.id, {
    externalGuestKey: 'VIP-DEMO-003',
    qrHash: 'qr-vip-demo-checked-in-003',
    fullName: 'Demo VIP Guest Three',
    email: 'vip.three@example.test',
    phone: '+84901230003',
    sponsorCompany: 'Production Partner',
    invitedBy: 'Production Office',
    guestType: 'Production Guest',
    allowedGate: 'Gate B',
    notes: 'Already checked in duplicate fixture',
    sourceRowNumber: 4,
    status: 'CHECKED_IN',
    checkedInAt: new Date('2026-06-15T12:15:00.000Z'),
  });
}

async function assignRole(userId, roleCode) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
    },
  });
}

async function seedCheckInAssignment(staffUserId, concertId, gateName, sourceDeviceId) {
  await prisma.checkInAssignment.upsert({
    where: {
      staffUserId_concertId_gateName: {
        staffUserId,
        concertId,
        gateName,
      },
    },
    update: {
      sourceDeviceId,
      active: true,
    },
    create: {
      staffUserId,
      concertId,
      gateName,
      sourceDeviceId,
      active: true,
    },
  });
}

async function seedTicket(ticket) {
  const status = ticket.status || 'ACTIVE';
  const checkedInAt = ticket.checkedInAt || null;

  await prisma.ticket.upsert({
    where: { ticketCode: ticket.ticketCode },
    update: {
      qrHash: ticket.qrHash,
      status,
      checkedInAt,
    },
    create: {
      ...ticket,
      status,
      checkedInAt,
    },
  });
}

async function seedVipGuest(importId, concertId, guest) {
  const normalized = normalizeVipGuestIdentity(guest);
  const status = guest.status || 'ACTIVE';
  const checkedInAt = guest.checkedInAt || null;

  await prisma.vipGuest.upsert({
    where: {
      concertId_sponsorSource_externalGuestKey: {
        concertId,
        sponsorSource: 'LOCAL_DEMO',
        externalGuestKey: guest.externalGuestKey,
      },
    },
    update: {
      qrHash: guest.qrHash,
      fullName: guest.fullName,
      email: guest.email,
      phone: guest.phone || null,
      normalizedFullName: normalized.fullName,
      normalizedEmail: normalized.email,
      normalizedPhone: normalized.phone,
      normalizedIdentityKey: normalized.identityKey,
      sourceRowNumber: guest.sourceRowNumber || null,
      sponsorCompany: guest.sponsorCompany || null,
      invitedBy: guest.invitedBy || null,
      guestType: guest.guestType || null,
      allowedGate: guest.allowedGate || null,
      notes: guest.notes || null,
      status,
      checkedInAt,
    },
    create: {
      importId,
      concertId,
      sponsorSource: 'LOCAL_DEMO',
      externalGuestKey: guest.externalGuestKey,
      qrHash: guest.qrHash,
      fullName: guest.fullName,
      email: guest.email,
      phone: guest.phone || null,
      normalizedFullName: normalized.fullName,
      normalizedEmail: normalized.email,
      normalizedPhone: normalized.phone,
      normalizedIdentityKey: normalized.identityKey,
      sourceRowNumber: guest.sourceRowNumber || null,
      sponsorCompany: guest.sponsorCompany || null,
      invitedBy: guest.invitedBy || null,
      guestType: guest.guestType || null,
      allowedGate: guest.allowedGate || null,
      notes: guest.notes || null,
      status,
      checkedInAt,
    },
  });
}

function normalizeVipGuestIdentity(guest) {
  const fullName = normalizeName(guest.fullName);
  const email = guest.email ? guest.email.trim().toLowerCase() : null;
  const phone = guest.phone ? guest.phone.replace(/[^0-9+]/g, '') || null : null;
  const identityKey = guest.externalGuestKey ? null : sha256([email || '', phone || '', fullName].join('|'));

  return {
    fullName,
    email,
    phone,
    identityKey,
  };
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
