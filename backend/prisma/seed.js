const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

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
  CHECKIN_STAFF: ['concert:read', 'checkin:scan', 'checkin:sync'],
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

  await seedConcerts(organizerUser.id);
}

async function seedConcerts(organizerId) {
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
  }
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
