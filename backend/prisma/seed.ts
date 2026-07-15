import { PrismaClient, UserStatus, ConcertStatus, TicketTypeStatus, OrderStatus, PaymentProvider, PaymentStatus, TicketStatus, CheckInMode, CheckInStatus, CheckInSyncStatus, ArtistBioJobStatus, ArtistDocumentStatus, AiArtistBioStatus, ImportStatus, ImportErrorType, VipGuestStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 10; // Use 10 for faster seeding while maintaining good security

// 1. Roles Definition
const roles = [
  { code: 'AUDIENCE', name: 'Audience' },
  { code: 'ORGANIZER', name: 'Organizer' },
  { code: 'CHECKIN_STAFF', name: 'Check-in Staff' },
];

// 2. Permissions Definition
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

const rolePermissions: Record<string, string[]> = {
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

// Help helper for SHA256 hashing (for VIP guest normalize)
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeName(value: string): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeVipGuestIdentity(guest: { fullName: string; email?: string | null; phone?: string | null; externalGuestKey?: string | null }) {
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

async function main() {
  console.log('🌱 Starting database seeding with rich dataset...');

  // --- CLEAN UP EXISTING DATA ---
  console.log('🧹 Cleaning up existing records...');
  await prisma.checkIn.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.vipGuest.deleteMany();
  await prisma.vipGuestImport.deleteMany();
  await prisma.checkInAssignment.deleteMany();
  await prisma.checkInStaffAssignment.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.concert.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();

  // --- SEED ROLES & PERMISSIONS ---
  console.log('🔑 Seeding roles and permissions...');
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
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permissionCode } });
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

  // --- SEED HASHED PASSWORDS ---
  console.log('🔒 Generating credentials...');
  const commonPasswordHash = await bcrypt.hash('TicketBox@123456', BCRYPT_SALT_ROUNDS);

  // --- SEED USERS ---
  console.log('👥 Seeding users (Organizers, Staff, Audience)...');
  
  // Organizers
  const organizerEmails = [
    'organizer@ticketbox.local',
    'organizer2@ticketbox.local',
    'organizer3@ticketbox.local'
  ];
  const organizers = [];
  const organizerRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ORGANIZER' } });

  for (let i = 0; i < organizerEmails.length; i++) {
    const org = await prisma.user.create({
      data: {
        email: organizerEmails[i],
        passwordHash: commonPasswordHash,
        displayName: i === 0 ? 'Default Organizer' : `Secondary Organizer ${i + 1}`,
        status: UserStatus.ACTIVE,
      }
    });
    await prisma.userRole.create({
      data: { userId: org.id, roleId: organizerRole.id }
    });
    organizers.push(org);
  }

  // Checkin Staff
  const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: 'CHECKIN_STAFF' } });
  const staffUsers = [];
  for (let i = 1; i <= 5; i++) {
    const staff = await prisma.user.create({
      data: {
        email: `staff${i}@ticketbox.local`,
        passwordHash: commonPasswordHash,
        displayName: `Check-in Staff Member ${i}`,
        status: UserStatus.ACTIVE,
      }
    });
    await prisma.userRole.create({
      data: { userId: staff.id, roleId: staffRole.id }
    });
    staffUsers.push(staff);
  }

  // Audience Buyers
  const audienceRole = await prisma.role.findUniqueOrThrow({ where: { code: 'AUDIENCE' } });
  const audienceUsers = [];
  
  // Add direct named demo users
  const namedAudiences = [
    { email: 'audience@ticketbox.local', name: 'Demo Audience' },
    { email: 'nguyenvana@gmail.com', name: 'Nguyen Van A' },
    { email: 'tranbanb@gmail.com', name: 'Tran Thi B' },
    { email: 'lequangc@gmail.com', name: 'Le Quang C' },
    { email: 'phamminhd@gmail.com', name: 'Pham Minh D' }
  ];

  for (const named of namedAudiences) {
    const aud = await prisma.user.create({
      data: {
        email: named.email,
        passwordHash: commonPasswordHash,
        displayName: named.name,
        status: UserStatus.ACTIVE,
      }
    });
    await prisma.userRole.create({
      data: { userId: aud.id, roleId: audienceRole.id }
    });
    audienceUsers.push(aud);
  }

  // Create 30 more random buyers
  const firstNames = ['Anh', 'Bình', 'Chi', 'Dương', 'Giang', 'Hương', 'Khánh', 'Linh', 'Minh', 'Nam', 'Phong', 'Quỳnh', 'Sơn', 'Trang', 'Tuấn', 'Vy'];
  const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];
  
  for (let i = 1; i <= 30; i++) {
    const fullName = `${lastNames[Math.floor(Math.random() * lastNames.length)]} ${firstNames[Math.floor(Math.random() * firstNames.length)]}`;
    const username = `buyer${i}`;
    const aud = await prisma.user.create({
      data: {
        email: `${username}@ticketbox.local`,
        passwordHash: commonPasswordHash,
        displayName: fullName,
        status: UserStatus.ACTIVE,
      }
    });
    await prisma.userRole.create({
      data: { userId: aud.id, roleId: audienceRole.id }
    });
    audienceUsers.push(aud);
  }

  // --- SEED CONCERTS & TICKET TYPES ---
  console.log('🎸 Seeding rich list of concerts...');
  const defaultOrgId = organizers[0].id;
  const mockSvg = (title: string) => `<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#eaeaea"/><text x="400" y="60" text-anchor="middle" font-size="28">${title}</text><rect x="300" y="100" width="200" height="80" fill="#ffd700"/><text x="400" y="145" text-anchor="middle">SVIP</text><rect x="220" y="200" width="360" height="80" fill="#ff9999"/><text x="400" y="245" text-anchor="middle">VIP</text><rect x="100" y="300" width="600" height="150" fill="#b6e3b6"/><text x="400" y="380" text-anchor="middle">GA</text></svg>`;

  const concertSeeds = [
    {
      title: 'Anh Trai Say Hi Concert 2027',
      artistName: 'Various Artists',
      description: 'Đêm nhạc quy tụ các nghệ sĩ nổi bật từ chương trình Anh Trai Say Hi, mang đến sân khấu hoành tráng, âm nhạc trẻ trung và trải nghiệm bùng nổ cho khán giả.',
      venueName: 'Sân vận động Mỹ Đình',
      venueAddress: 'Nam Từ Liêm, Hà Nội',
      bannerUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('ANH TRAI SAY HI'),
      status: ConcertStatus.PUBLISHED,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Sales start: 5 days ago
      endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),  // Sales end: 10 days from now
      performanceStartAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Performance: 10 days from now
      ticketTypes: [
        { code: 'SVIP', name: 'SVIP', priceVnd: 3500000, totalQuantity: 300, perUserLimit: 2 },
        { code: 'VIP', name: 'VIP', priceVnd: 2500000, totalQuantity: 1200, perUserLimit: 2 },
        { code: 'CAT1', name: 'CAT 1', priceVnd: 1800000, totalQuantity: 3000, perUserLimit: 4 },
        { code: 'GA', name: 'General Admission', priceVnd: 800000, totalQuantity: 6000, perUserLimit: 6 },
      ]
    },
    {
      title: 'Chị Đẹp Đạp Gió Rẽ Sóng Live Concert 2027',
      artistName: 'Various Female Artists',
      description: 'Concert đặc biệt dành cho khán giả yêu thích chương trình Chị Đẹp Đạp Gió Rẽ Sóng, với các tiết mục trình diễn được dàn dựng công phu.',
      venueName: 'Nhà thi đấu Quân khu 7',
      venueAddress: '202 Hoàng Văn Thụ, Quận Phú Nhuận, TP. Hồ Chí Minh',
      bannerUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('CHI DEP DAP GIO RE SONG'),
      status: ConcertStatus.PUBLISHED,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Sales start: 5 days ago
      endsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),  // Sales end: 20 days from now
      performanceStartAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // Performance: 20 days from now
      ticketTypes: [
        { code: 'VIP', name: 'VIP Zone', priceVnd: 2200000, totalQuantity: 1500, perUserLimit: 2 },
        { code: 'CAT1', name: 'CAT A', priceVnd: 1500000, totalQuantity: 3000, perUserLimit: 4 },
        { code: 'CAT2', name: 'CAT B', priceVnd: 900000, totalQuantity: 5000, perUserLimit: 4 },
        { code: 'GA', name: 'General Admission', priceVnd: 600000, totalQuantity: 8000, perUserLimit: 6 },
      ]
    },
    {
      title: 'Vũ Cát Tường - Deco Concert 2027',
      artistName: 'Vũ Cát Tường',
      description: 'Live concert đánh dấu sự trở lại đầy đột phá nghệ thuật của Vũ Cát Tường trong một không gian âm nhạc mới lạ.',
      venueName: 'Nhà hát lớn Hà Nội',
      venueAddress: '1 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('VU CAT TUONG DECO'),
      status: ConcertStatus.PUBLISHED,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Sales start: 5 days ago
      endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),  // Sales end: 15 days from now
      performanceStartAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Performance: 15 days from now
      ticketTypes: [
        { code: 'SVIP', name: 'Super VIP', priceVnd: 4000000, totalQuantity: 100, perUserLimit: 2 },
        { code: 'VIP', name: 'VIP Premium', priceVnd: 2800000, totalQuantity: 300, perUserLimit: 2 },
        { code: 'GA', name: 'Standard Seat', priceVnd: 1200000, totalQuantity: 600, perUserLimit: 4 },
      ]
    },
    {
      title: 'Đen Vâu - Show của Đen tại Sài Gòn',
      artistName: 'Đen Vâu',
      description: 'Đêm nhạc lớn kỷ niệm hành trình rap của Đen và những người bạn. Cùng sẻ chia những giai điệu mộc mạc và chân thực nhất.',
      venueName: 'Nhà thi đấu Phú Thọ',
      venueAddress: '1 Lữ Gia, Quận 11, TP. Hồ Chí Minh',
      bannerUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('SHOW CUA DEN'),
      status: ConcertStatus.PUBLISHED,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Sales start: 5 days ago
      endsAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),  // Sales end: 25 days from now
      performanceStartAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // Performance: 25 days from now
      ticketTypes: [
        { code: 'VIP', name: 'VIP Standing', priceVnd: 1500000, totalQuantity: 2000, perUserLimit: 4 },
        { code: 'GA', name: 'GA Standing', priceVnd: 750000, totalQuantity: 8000, perUserLimit: 6 },
      ]
    },
    {
      title: 'Lân Nhã - Acoustic Concert (Classic Hits)',
      artistName: 'Lân Nhã',
      description: 'Buổi biểu diễn nhạc Việt trữ tình ấm cúng với ban nhạc acoustic, đưa người nghe qua những miền ký ức tuyệt vời.',
      venueName: 'Nhà hát Bến Thành',
      venueAddress: '6 Mạc Đĩnh Chi, Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      bannerUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('LAN NHA ACOUSTIC'),
      status: ConcertStatus.FINISHED,
      startsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      endsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      ticketTypes: [
        { code: 'VIP', name: 'VIP Chair', priceVnd: 2000000, totalQuantity: 300, perUserLimit: 2 },
        { code: 'GA', name: 'Standard Choice', priceVnd: 1000000, totalQuantity: 700, perUserLimit: 4 },
      ]
    },
    {
      title: 'Hà Anh Tuấn - Storii Concert: Chân Trời Rực Rỡ',
      artistName: 'Hà Anh Tuấn & Kitaro',
      description: 'Chương trình nghệ thuật kể chuyện đặc biệt của Hà Anh Tuấn với thế giới âm nhạc diệu kỳ kết hợp cùng huyền thoại Kitaro.',
      venueName: 'Sân lễ hội đền Vua Đinh Vua Lê',
      venueAddress: 'Hoa Lư, Ninh Bình',
      bannerUrl: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('STORII CONCERT'),
      status: ConcertStatus.FINISHED,
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 3.5 * 60 * 60 * 1000),
      ticketTypes: [
        { code: 'SVIP', name: 'CHÂN TRỜI', priceVnd: 5000000, totalQuantity: 500, perUserLimit: 2 },
        { code: 'VIP', name: 'RỰC RỠ', priceVnd: 3500000, totalQuantity: 1500, perUserLimit: 2 },
        { code: 'CAT1', name: 'TINH TÚ', priceVnd: 2200000, totalQuantity: 3000, perUserLimit: 4 },
        { code: 'GA', name: 'BÌNH MINH', priceVnd: 1000000, totalQuantity: 5000, perUserLimit: 6 },
      ]
    },
    {
      title: 'Rock Việt Alive Festival 2026',
      artistName: 'Bức Tường, Ngũ Cung, Microwave',
      description: 'Lễ hội âm nhạc thổi bùng ngọn lửa nhạc rock Việt Nam, đem lại năng lượng bất tận thông qua những âm thanh guitar điện sấm sét.',
      venueName: 'Sân vận động Hoa Lư',
      venueAddress: '2 Đinh Tiên Hoàng, Đa Kao, Quận 1, TP. Hồ Chí Minh',
      bannerUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('ROCK VIET ALIVE'),
      status: ConcertStatus.CANCELLED,
      startsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // in 8 days (Cancelled)
      endsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
      ticketTypes: [
        { code: 'VIP', name: 'VIP Area', priceVnd: 1200000, totalQuantity: 1000, perUserLimit: 4 },
        { code: 'GA', name: 'GA Moshpit', priceVnd: 500000, totalQuantity: 6000, perUserLimit: 6 },
      ]
    },
    {
      title: 'Monsoon Music Festival 2026 (Draft)',
      artistName: 'International Indie Artists',
      description: 'Lễ hội âm nhạc Gió Mùa lớn nhất miền Bắc quay trở lại, mang tính nghệ thuật sáng tạo đa quốc gia đậm chất văn hoá.',
      venueName: 'Hoàng thành Thăng Long',
      venueAddress: '19C Hoàng Diệu, Điện Biên, Ba Đình, Hà Nội',
      bannerUrl: 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1200&q=80',
      seatingSvg: mockSvg('MONSOON FESTIVAL DRAFT'),
      status: ConcertStatus.DRAFT,
      startsAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // in 120 days
      endsAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
      ticketTypes: [
        { code: 'VIP', name: '3-Day VIP pass', priceVnd: 3000000, totalQuantity: 500, perUserLimit: 2 },
        { code: 'GA', name: '3-Day GA pass', priceVnd: 1500000, totalQuantity: 2000, perUserLimit: 4 },
      ]
    }
  ];

  const seededConcerts = [];
  for (const cSeed of concertSeeds) {
    const { ticketTypes, ...cData } = cSeed;
    const concert = await prisma.concert.create({
      data: {
        ...cData,
        performanceStartAt: (cData as any).performanceStartAt ?? cData.startsAt,
        organizerId: defaultOrgId,
      }
    });

    const isFinished = concert.status === ConcertStatus.FINISHED;
    const isCancelled = concert.status === ConcertStatus.CANCELLED;

    for (const tt of ticketTypes) {
      await prisma.ticketType.create({
        data: {
          concertId: concert.id,
          code: tt.code,
          name: tt.name,
          priceVnd: tt.priceVnd,
          totalQuantity: tt.totalQuantity,
          reservedQuantity: 0,
          soldQuantity: 0,
          perUserLimit: tt.perUserLimit,
          saleStartAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          saleEndAt: concert.startsAt,
          status: isCancelled ? TicketTypeStatus.INACTIVE : TicketTypeStatus.ACTIVE,
        }
      });
    }

    seededConcerts.push(concert);
  }

  // --- SEED CHEK-IN ASSIGNMENTS ---
  console.log('📌 Seeding Gate Assignments for Check-in staff...');
  const mainConcert = seededConcerts[0]; // Say Hi Concert
  const secConcert = seededConcerts[1];  // Chi Dep Concert
  const finishedConcert = seededConcerts[5]; // Ha Anh Tuan Concert
  
  // Assign check-in staff to gates
  const gates = ['Gate A', 'Gate B', 'Gate C', 'VIP Entrance'];
  for (let i = 0; i < staffUsers.length; i++) {
    const staff = staffUsers[i];
    
    // Assign to main Concert
    await prisma.checkInAssignment.create({
      data: {
        staffUserId: staff.id,
        concertId: mainConcert.id,
        gateName: gates[i % gates.length],
        sourceDeviceId: `dev-device-${staff.id.substring(0, 8)}`,
        active: true,
      }
    });
    await prisma.checkInStaffAssignment.create({
      data: {
        userId: staff.id,
        concertId: mainConcert.id,
        gateLabel: gates[i % gates.length],
      }
    });

    // Assign to secondary Concert
    await prisma.checkInAssignment.create({
      data: {
        staffUserId: staff.id,
        concertId: secConcert.id,
        gateName: gates[(i + 1) % gates.length],
        sourceDeviceId: `dev-device-${staff.id.substring(0, 8)}`,
        active: true,
      }
    });
    await prisma.checkInStaffAssignment.create({
      data: {
        userId: staff.id,
        concertId: secConcert.id,
        gateLabel: gates[(i + 1) % gates.length],
      }
    });

    // Assign to finished Concert
    await prisma.checkInAssignment.create({
      data: {
        staffUserId: staff.id,
        concertId: finishedConcert.id,
        gateName: gates[(i + 2) % gates.length],
        sourceDeviceId: `dev-device-legacy-${staff.id.substring(0, 8)}`,
        active: false,
      }
    });
  }

  // --- SEED ORDERS & TICKETS & CHECK-INS (THE BIG BATCH) ---
  console.log('🛒 Seeding a large loop of Orders, Payments, Tickets, and Scans...');
  let orderCount = 0;
  
  // Helper to generate codes
  const generateOrderCode = () => `ORDB-${Date.now().toString().substring(8)}-${(++orderCount).toString().padStart(4, '0')}`;
  const generateTicketCode = (prefix: string, seed: number) => `TKT-${prefix}-${seed.toString().padStart(5, '0')}`;
  const generateQrHash = (ticketCode: string) => crypto.createHash('sha256').update(`${ticketCode}-secret-hmac`).digest('hex');

  // Let's seed for 3 Concerts:
  // 1. Anh Trai Say Hi (Future - 30 days away) -> has PAID and PENDING orders. No check-ins yet except a couple checkin tests
  // 2. Vu Cat Tuong (Future - 15 days away) -> has PAID orders.
  // 3. Ha Anh Tuấn (Finished - 30 days ago) -> has PAID orders and heavily CHECKED IN tickets.

  const ticketTypesMap: Record<string, any[]> = {};
  for (const c of seededConcerts) {
    ticketTypesMap[c.id] = await prisma.ticketType.findMany({ where: { concertId: c.id } });
  }

  let ticketSeq = 1;
  const payProviders: PaymentProvider[] = [PaymentProvider.VNPAY, PaymentProvider.MOMO];

  // --- 1. SEED FOR FINISHED CONCERT (HÀ ANH TUẤN - 30 DAYS AGO) ---
  // We want plenty of PAID orders and high check-in rates (e.g. 50+ tickets, 45+ checked in)
  const hatConcert = seededConcerts[5];
  const hatTicketTypes = ticketTypesMap[hatConcert.id];

  console.log(`- Seeding orders for finished concert "${hatConcert.title}"...`);
  // Generate paid orders for audiences
  for (let i = 0; i < 25; i++) {
    const buyer = audienceUsers[i % audienceUsers.length];
    
    // Choose 1 or 2 random ticket types
    const tt = hatTicketTypes[i % hatTicketTypes.length];
    const quantity = (i % 3) === 0 ? 2 : 1;
    const unitPrice = tt.priceVnd;
    const subtotal = unitPrice * quantity;
    const orderCode = generateOrderCode();
    const idempotency = `idemp-hat-${orderCode}`;

    const orderTime = new Date(hatConcert.startsAt.getTime() - (5 * 24 * 60 * 60 * 1000) + (i * 20 * 60 * 1000));
    
    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: buyer.id,
        concertId: hatConcert.id,
        status: OrderStatus.PAID,
        totalAmountVnd: subtotal,
        expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000),
        paidAt: new Date(orderTime.getTime() + 5 * 60 * 1000),
        idempotencyKey: idempotency,
        createdAt: orderTime
      }
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: tt.id,
        quantity,
        unitPriceVnd: unitPrice,
        subtotalVnd: subtotal
      }
    });

    // Create payment
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: payProviders[i % payProviders.length],
        providerTransactionId: `TX-HAT-${orderCode}`,
        idempotencyKey: `pay-idemp-hat-${orderCode}`,
        status: PaymentStatus.SUCCESS,
        amountVnd: subtotal,
        requestedAt: orderTime,
        confirmedAt: new Date(orderTime.getTime() + 5 * 60 * 1000)
      }
    });

    // Create tickets
    for (let k = 0; k < quantity; k++) {
      const ticketCode = generateTicketCode('HAT', ticketSeq++);
      const qrHash = generateQrHash(ticketCode);
      const isCheckedIn = (i % 8) !== 0; // 87.5% checked in rate
      
      const ticket = await prisma.ticket.create({
        data: {
          ticketCode,
          qrHash,
          orderId: order.id,
          orderItemId: orderItem.id,
          ownerUserId: buyer.id,
          concertId: hatConcert.id,
          ticketTypeId: tt.id,
          status: isCheckedIn ? TicketStatus.USED : TicketStatus.ACTIVE,
          issuedAt: new Date(orderTime.getTime() + 6 * 60 * 1000),
          checkedInAt: isCheckedIn ? new Date(hatConcert.startsAt.getTime() + (i * 3 * 60 * 1000) + (k * 1 * 60 * 1000)) : null
        }
      });

      if (isCheckedIn && ticket.checkedInAt) {
        // Create CheckIn log
        const staff = staffUsers[i % staffUsers.length];
        await prisma.checkIn.create({
          data: {
            ticketId: ticket.id,
            concertId: hatConcert.id,
            staffUserId: staff.id,
            mode: CheckInMode.ONLINE,
            status: CheckInStatus.SUCCESS,
            syncStatus: CheckInSyncStatus.SYNCED,
            scannedAt: ticket.checkedInAt,
            serverReceivedAt: new Date(ticket.checkedInAt.getTime() + 500),
            serverCheckedInAt: ticket.checkedInAt
          }
        });
      }
    }
  }

  // --- 2. SEED FOR FUTURE CONCERTS (SAY HI & VU CAT TUONG) ---
  console.log(`- Seeding orders for active future concerts...`);
  
  // Future Concert: Anh Trai Say Hi
  const sayHiConcert = seededConcerts[0];
  const sayHiTicketTypes = ticketTypesMap[sayHiConcert.id];

  // We want:
  // - 30 PAID orders (tickets active, ready to scan)
  // - 10 PENDING orders (ongoing transactions)
  // - 8 EXPIRED orders (dead orders)
  // - 4 CANCELLED orders
  
  // Paid Orders
  for (let i = 0; i < 30; i++) {
    const buyer = audienceUsers[i % audienceUsers.length];
    const tt = sayHiTicketTypes[i % sayHiTicketTypes.length];
    const quantity = (i % 4) === 0 ? 2 : 1;
    const unitPrice = tt.priceVnd;
    const subtotal = unitPrice * quantity;
    const orderCode = generateOrderCode();
    const orderTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + i * 30 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: buyer.id,
        concertId: sayHiConcert.id,
        status: OrderStatus.PAID,
        totalAmountVnd: subtotal,
        expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000),
        paidAt: new Date(orderTime.getTime() + 3 * 60 * 1000),
        idempotencyKey: `idemp-hi-${orderCode}`,
        createdAt: orderTime
      }
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: tt.id,
        quantity,
        unitPriceVnd: unitPrice,
        subtotalVnd: subtotal
      }
    });

    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: payProviders[i % payProviders.length],
        providerTransactionId: `TX-HI-${orderCode}`,
        idempotencyKey: `pay-idemp-hi-${orderCode}`,
        status: PaymentStatus.SUCCESS,
        amountVnd: subtotal,
        requestedAt: orderTime,
        confirmedAt: new Date(orderTime.getTime() + 3 * 60 * 1000)
      }
    });

    // Create active tickets
    for (let k = 0; k < quantity; k++) {
      const ticketCode = generateTicketCode('SAYHI', ticketSeq++);
      const qrHash = generateQrHash(ticketCode);
      
      await prisma.ticket.create({
        data: {
          ticketCode,
          qrHash,
          orderId: order.id,
          orderItemId: orderItem.id,
          ownerUserId: buyer.id,
          concertId: sayHiConcert.id,
          ticketTypeId: tt.id,
          status: TicketStatus.ACTIVE,
          issuedAt: new Date(orderTime.getTime() + 4 * 60 * 1000)
        }
      });
    }
  }

  // Pending Orders (Recent and active)
  for (let i = 0; i < 10; i++) {
    const buyer = audienceUsers[(i + 5) % audienceUsers.length];
    const tt = sayHiTicketTypes[i % sayHiTicketTypes.length];
    const quantity = 1;
    const orderCode = generateOrderCode();
    const orderTime = new Date(Date.now() - (i * 3 * 60 * 1000)); // created recently (within last 30 mins)

    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: buyer.id,
        concertId: sayHiConcert.id,
        status: OrderStatus.PENDING,
        totalAmountVnd: tt.priceVnd * quantity,
        expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000), // still unexpired!
        paidAt: null,
        idempotencyKey: `idemp-hi-pend-${orderCode}`,
        createdAt: orderTime
      }
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: tt.id,
        quantity,
        unitPriceVnd: tt.priceVnd,
        subtotalVnd: tt.priceVnd * quantity
      }
    });

    // Initiate payment txn
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: payProviders[i % payProviders.length],
        idempotencyKey: `pay-idemp-hi-pend-${orderCode}`,
        status: i === 0 ? PaymentStatus.TIMEOUT : PaymentStatus.INITIATED,
        amountVnd: tt.priceVnd * quantity,
        failureCode: i === 0 ? 'DEMO_UNCERTAIN_PROVIDER_TIMEOUT' : null,
        requestedAt: orderTime
      }
    });
  }

  // Expired Orders (Created days ago, unpaid)
  for (let i = 0; i < 8; i++) {
    const buyer = audienceUsers[(i + 10) % audienceUsers.length];
    const tt = sayHiTicketTypes[i % sayHiTicketTypes.length];
    const orderCode = generateOrderCode();
    const orderTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - i * 60 * 60 * 1000); // 5 days ago

    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: buyer.id,
        concertId: sayHiConcert.id,
        status: OrderStatus.EXPIRED,
        totalAmountVnd: tt.priceVnd,
        expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000),
        paidAt: null,
        idempotencyKey: `idemp-hi-exp-${orderCode}`,
        createdAt: orderTime
      }
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: tt.id,
        quantity: 1,
        unitPriceVnd: tt.priceVnd,
        subtotalVnd: tt.priceVnd
      }
    });

    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: payProviders[i % payProviders.length],
        idempotencyKey: `pay-idemp-hi-exp-${orderCode}`,
        status: PaymentStatus.TIMEOUT,
        amountVnd: tt.priceVnd,
        requestedAt: orderTime
      }
    });
  }

  // Cancelled or Failed Orders
  for (let i = 0; i < 4; i++) {
    const buyer = audienceUsers[(i + 15) % audienceUsers.length];
    const tt = sayHiTicketTypes[i % sayHiTicketTypes.length];
    const orderCode = generateOrderCode();
    const orderTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: buyer.id,
        concertId: sayHiConcert.id,
        status: i === 0 ? OrderStatus.FAILED : OrderStatus.CANCELLED,
        totalAmountVnd: tt.priceVnd,
        expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000),
        paidAt: null,
        idempotencyKey: `idemp-hi-can-${orderCode}`,
        createdAt: orderTime
      }
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: tt.id,
        quantity: 1,
        unitPriceVnd: tt.priceVnd,
        subtotalVnd: tt.priceVnd
      }
    });

    if (i === 0) {
      await prisma.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.VNPAY,
          idempotencyKey: 'pay-idemp-hi-failed-' + orderCode,
          status: PaymentStatus.FAILED,
          amountVnd: tt.priceVnd,
          failureCode: 'DEMO_PROVIDER_DECLINED',
          requestedAt: orderTime,
          confirmedAt: new Date(orderTime.getTime() + 2 * 60 * 1000),
        },
      });
    }
  }

  // Concurrency demo baseline: audienceUsers[2] already owns two paid CAT1 tickets
  // from paid orders i=2 and i=22. Two simultaneous requests for two more tickets
  // must allow at most one winner against CAT1's per-user limit of four.
  console.log('- Concurrency demo: ' + audienceUsers[2].email + ' has 2/4 paid CAT1 tickets');

  // Future Concert: Vũ Cát Tường
  const vctConcert = seededConcerts[2];
  const vctTicketTypes = ticketTypesMap[vctConcert.id];

  // 15 PAID orders for VCT
  console.log(`- Seeding orders for concert "${vctConcert.title}"...`);
  for (let i = 0; i < 15; i++) {
    const buyer = audienceUsers[(i + 8) % audienceUsers.length];
    const tt = vctTicketTypes[i % vctTicketTypes.length];
    const orderCode = generateOrderCode();
    const orderTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        orderCode,
        userId: buyer.id,
        concertId: vctConcert.id,
        status: OrderStatus.PAID,
        totalAmountVnd: tt.priceVnd,
        expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000),
        paidAt: new Date(orderTime.getTime() + 5 * 60 * 1000),
        idempotencyKey: `idemp-vct-${orderCode}`,
        createdAt: orderTime
      }
    });

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        ticketTypeId: tt.id,
        quantity: 1,
        unitPriceVnd: tt.priceVnd,
        subtotalVnd: tt.priceVnd
      }
    });

    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.VNPAY,
        providerTransactionId: `TX-VCT-${orderCode}`,
        idempotencyKey: `pay-idemp-vct-${orderCode}`,
        status: PaymentStatus.SUCCESS,
        amountVnd: tt.priceVnd,
        requestedAt: orderTime,
        confirmedAt: new Date(orderTime.getTime() + 5 * 60 * 1000)
      }
    });

    // Create active tickets
    const ticketCode = generateTicketCode('DECO', ticketSeq++);
    const qrHash = generateQrHash(ticketCode);
    
    await prisma.ticket.create({
      data: {
        ticketCode,
        qrHash,
        orderId: order.id,
        orderItemId: orderItem.id,
        ownerUserId: buyer.id,
        concertId: vctConcert.id,
        ticketTypeId: tt.id,
        status: TicketStatus.ACTIVE,
        issuedAt: new Date(orderTime.getTime() + 6 * 60 * 1000)
      }
    });
  }

  // --- SEED VIP GUESTS (SPONSORS & GUEST LIST IMPORT) ---
  console.log('💎 Seeding VIP Guest lists...');
  const activeConcertsToReceiveVip = [sayHiConcert, secConcert];

  for (const c of activeConcertsToReceiveVip) {
    const importName = `${c.title.substring(0, 8).toUpperCase()}-VIP-IMPORT.csv`;
    const vipImport = await prisma.vipGuestImport.create({
      data: {
        concertId: c.id,
        sourceName: 'SPONSOR_CSV',
        fileName: importName,
        sourceFingerprint: `fingerprint-vip-${c.id.substring(0, 8)}`,
        status: ImportStatus.COMPLETED,
        totalRows: 12,
        acceptedRows: 12,
        duplicateRows: 0,
        rejectedRows: 0,
        importedAt: new Date(),
      }
    });

    const vipNames = [
      'Đặng Lê Nguyên Vũ', 'Phan Sào Nam', 'Phạm Nhật Vượng', 'Trần Đình Long', 'Trần Bá Dương',
      'Nguyễn Đăng Quang', 'Nguyễn Thị Phương Thảo', 'Hồ Hùng Anh', 'Bùi Thành Nhơn',
      'Trương Gia Bình', 'Nguyễn Duy Hưng', 'Thái Hương'
    ];

    for (let u = 0; u < vipNames.length; u++) {
      const vName = vipNames[u];
      const vemail = `vip.guest.${u + 1}@gmail.com`;
      const vphone = `+849182000${(u + 1).toString().padStart(2, '0')}`;
      const vk = `VK-${c.id.substring(0, 4).toUpperCase()}-${u + 1}`;
      const qr = `qr-vip-hash-${c.id.substring(0, 4)}-${u + 1}`;

      const normalized = normalizeVipGuestIdentity({
        fullName: vName,
        email: vemail,
        phone: vphone,
        externalGuestKey: vk
      });

      const isCheckedIn = c.status === ConcertStatus.FINISHED || (u % 4 === 0);

      await prisma.vipGuest.create({
        data: {
          importId: vipImport.id,
          concertId: c.id,
          sponsorSource: 'SPONSOR_CSV',
          externalGuestKey: vk,
          qrHash: qr,
          fullName: vName,
          email: vemail,
          phone: vphone,
          sponsorCompany: u % 2 === 0 ? 'Trung Nguyên Group' : 'Vingroup',
          invitedBy: 'Board of Directors',
          guestType: u % 3 === 0 ? 'VVIP' : 'VIP Sponsor',
          allowedGate: 'VIP Entrance',
          notes: 'Standard VVIP Privilege Invitation Package',
          status: isCheckedIn ? VipGuestStatus.CHECKED_IN : VipGuestStatus.ACTIVE,
          normalizedFullName: normalized.fullName,
          normalizedEmail: normalized.email,
          normalizedPhone: normalized.phone,
          normalizedIdentityKey: normalized.identityKey,
          sourceRowNumber: u + 2,
          checkedInAt: isCheckedIn ? new Date(c.startsAt.getTime() + (u * 2 * 60 * 1000)) : null
        }
      });
    }
  }

  // --- RECALCULATE TICKET COUNT METRICS ---
  console.log('📊 Re-calculating Ticket Type reserved and sold quantities...');
  const allTicketTypes = await prisma.ticketType.findMany();
  for (const tt of allTicketTypes) {
    const sold = await prisma.ticket.count({
      where: {
        ticketTypeId: tt.id,
        order: { status: OrderStatus.PAID }
      }
    });

    const reserved = await prisma.orderItem.aggregate({
      where: {
        ticketTypeId: tt.id,
        order: { status: OrderStatus.PENDING }
      },
      _sum: { quantity: true }
    });

    await prisma.ticketType.update({
      where: { id: tt.id },
      data: {
        soldQuantity: sold,
        reservedQuantity: reserved._sum.quantity || 0
      }
    });
  }

  console.log('✅ Seeding completed successfully!');
  console.log(`Summary of Seeding:`);
  console.log(`- Organizers: ${organizerEmails.length}`);
  console.log(`- Staff: ${staffUsers.length}`);
  console.log(`- Buyers/Audiences: ${audienceUsers.length}`);
  console.log(`- Concerts: ${seededConcerts.length}`);
  console.log(`- Total Orders: ${(await prisma.order.count())}`);
  console.log(`- Total Tickets: ${(await prisma.ticket.count())}`);
  console.log(`- Total Scans: ${(await prisma.checkIn.count())}`);
  console.log(`- Total VIP Guests: ${(await prisma.vipGuest.count())}`);
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
