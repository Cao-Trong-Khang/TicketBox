"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = new client_1.PrismaClient();
const BCRYPT_SALT_ROUNDS = 10;
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
function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}
function normalizeName(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
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
async function main() {
    console.log('🌱 Starting database seeding with rich dataset...');
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
    console.log('🔒 Generating credentials...');
    const commonPasswordHash = await bcrypt.hash('TicketBox@123456', BCRYPT_SALT_ROUNDS);
    console.log('👥 Seeding users (Organizers, Staff, Audience)...');
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
                status: client_1.UserStatus.ACTIVE,
            }
        });
        await prisma.userRole.create({
            data: { userId: org.id, roleId: organizerRole.id }
        });
        organizers.push(org);
    }
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { code: 'CHECKIN_STAFF' } });
    const staffUsers = [];
    for (let i = 1; i <= 5; i++) {
        const staff = await prisma.user.create({
            data: {
                email: `staff${i}@ticketbox.local`,
                passwordHash: commonPasswordHash,
                displayName: `Check-in Staff Member ${i}`,
                status: client_1.UserStatus.ACTIVE,
            }
        });
        await prisma.userRole.create({
            data: { userId: staff.id, roleId: staffRole.id }
        });
        staffUsers.push(staff);
    }
    const audienceRole = await prisma.role.findUniqueOrThrow({ where: { code: 'AUDIENCE' } });
    const audienceUsers = [];
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
                status: client_1.UserStatus.ACTIVE,
            }
        });
        await prisma.userRole.create({
            data: { userId: aud.id, roleId: audienceRole.id }
        });
        audienceUsers.push(aud);
    }
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
                status: client_1.UserStatus.ACTIVE,
            }
        });
        await prisma.userRole.create({
            data: { userId: aud.id, roleId: audienceRole.id }
        });
        audienceUsers.push(aud);
    }
    console.log('🎸 Seeding rich list of concerts...');
    const defaultOrgId = organizers[0].id;
    const mockSvg = (title) => `<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#eaeaea"/><text x="400" y="60" text-anchor="middle" font-size="28">${title}</text><rect x="300" y="100" width="200" height="80" fill="#ffd700"/><text x="400" y="145" text-anchor="middle">SVIP</text><rect x="220" y="200" width="360" height="80" fill="#ff9999"/><text x="400" y="245" text-anchor="middle">VIP</text><rect x="100" y="300" width="600" height="150" fill="#b6e3b6"/><text x="400" y="380" text-anchor="middle">GA</text></svg>`;
    const concertSeeds = [
        {
            title: 'Anh Trai Say Hi Concert 2027',
            artistName: 'Various Artists',
            description: 'Đêm nhạc quy tụ các nghệ sĩ nổi bật từ chương trình Anh Trai Say Hi, mang đến sân khấu hoành tráng, âm nhạc trẻ trung và trải nghiệm bùng nổ cho khán giả.',
            venueName: 'Sân vận động Mỹ Đình',
            venueAddress: 'Nam Từ Liêm, Hà Nội',
            bannerUrl: 'https://placehold.co/1200x500?text=Anh+Trai+Say+Hi+Concert',
            seatingSvg: mockSvg('ANH TRAI SAY HI'),
            status: client_1.ConcertStatus.PUBLISHED,
            startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            performanceStartAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Chi+Dep+Dap+Gio+Concert',
            seatingSvg: mockSvg('CHI DEP DAP GIO RE SONG'),
            status: client_1.ConcertStatus.PUBLISHED,
            startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            performanceStartAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Vu+Cat+Tuong+Deco',
            seatingSvg: mockSvg('VU CAT TUONG DECO'),
            status: client_1.ConcertStatus.PUBLISHED,
            startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            performanceStartAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Show+cua+Den',
            seatingSvg: mockSvg('SHOW CUA DEN'),
            status: client_1.ConcertStatus.PUBLISHED,
            startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
            performanceStartAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Lan+Nha+Acoustic',
            seatingSvg: mockSvg('LAN NHA ACOUSTIC'),
            status: client_1.ConcertStatus.FINISHED,
            startsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Chan+Troi+Ruc+Ro',
            seatingSvg: mockSvg('STORII CONCERT'),
            status: client_1.ConcertStatus.FINISHED,
            startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Rock+Viet+Alive',
            seatingSvg: mockSvg('ROCK VIET ALIVE'),
            status: client_1.ConcertStatus.CANCELLED,
            startsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
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
            bannerUrl: 'https://placehold.co/1200x500?text=Monsoon+Festival',
            seatingSvg: mockSvg('MONSOON FESTIVAL DRAFT'),
            status: client_1.ConcertStatus.DRAFT,
            startsAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
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
                performanceStartAt: cData.performanceStartAt ?? cData.startsAt,
                organizerId: defaultOrgId,
            }
        });
        const isFinished = concert.status === client_1.ConcertStatus.FINISHED;
        const isCancelled = concert.status === client_1.ConcertStatus.CANCELLED;
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
                    status: isCancelled ? client_1.TicketTypeStatus.INACTIVE : client_1.TicketTypeStatus.ACTIVE,
                }
            });
        }
        seededConcerts.push(concert);
    }
    console.log('📌 Seeding Gate Assignments for Check-in staff...');
    const mainConcert = seededConcerts[0];
    const secConcert = seededConcerts[1];
    const finishedConcert = seededConcerts[5];
    const gates = ['Gate A', 'Gate B', 'Gate C', 'VIP Entrance'];
    for (let i = 0; i < staffUsers.length; i++) {
        const staff = staffUsers[i];
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
    console.log('🛒 Seeding a large loop of Orders, Payments, Tickets, and Scans...');
    let orderCount = 0;
    const generateOrderCode = () => `ORDB-${Date.now().toString().substring(8)}-${(++orderCount).toString().padStart(4, '0')}`;
    const generateTicketCode = (prefix, seed) => `TKT-${prefix}-${seed.toString().padStart(5, '0')}`;
    const generateQrHash = (ticketCode) => crypto.createHash('sha256').update(`${ticketCode}-secret-hmac`).digest('hex');
    const ticketTypesMap = {};
    for (const c of seededConcerts) {
        ticketTypesMap[c.id] = await prisma.ticketType.findMany({ where: { concertId: c.id } });
    }
    let ticketSeq = 1;
    const payProviders = [client_1.PaymentProvider.VNPAY, client_1.PaymentProvider.MOMO];
    const hatConcert = seededConcerts[5];
    const hatTicketTypes = ticketTypesMap[hatConcert.id];
    console.log(`- Seeding orders for finished concert "${hatConcert.title}"...`);
    for (let i = 0; i < 25; i++) {
        const buyer = audienceUsers[i % audienceUsers.length];
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
                status: client_1.OrderStatus.PAID,
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
        await prisma.paymentTransaction.create({
            data: {
                orderId: order.id,
                provider: payProviders[i % payProviders.length],
                providerTransactionId: `TX-HAT-${orderCode}`,
                idempotencyKey: `pay-idemp-hat-${orderCode}`,
                status: client_1.PaymentStatus.SUCCESS,
                amountVnd: subtotal,
                requestedAt: orderTime,
                confirmedAt: new Date(orderTime.getTime() + 5 * 60 * 1000)
            }
        });
        for (let k = 0; k < quantity; k++) {
            const ticketCode = generateTicketCode('HAT', ticketSeq++);
            const qrHash = generateQrHash(ticketCode);
            const isCheckedIn = (i % 8) !== 0;
            const ticket = await prisma.ticket.create({
                data: {
                    ticketCode,
                    qrHash,
                    orderId: order.id,
                    orderItemId: orderItem.id,
                    ownerUserId: buyer.id,
                    concertId: hatConcert.id,
                    ticketTypeId: tt.id,
                    status: isCheckedIn ? client_1.TicketStatus.USED : client_1.TicketStatus.ACTIVE,
                    issuedAt: new Date(orderTime.getTime() + 6 * 60 * 1000),
                    checkedInAt: isCheckedIn ? new Date(hatConcert.startsAt.getTime() + (i * 3 * 60 * 1000) + (k * 1 * 60 * 1000)) : null
                }
            });
            if (isCheckedIn && ticket.checkedInAt) {
                const staff = staffUsers[i % staffUsers.length];
                await prisma.checkIn.create({
                    data: {
                        ticketId: ticket.id,
                        concertId: hatConcert.id,
                        staffUserId: staff.id,
                        mode: client_1.CheckInMode.ONLINE,
                        status: client_1.CheckInStatus.SUCCESS,
                        syncStatus: client_1.CheckInSyncStatus.SYNCED,
                        scannedAt: ticket.checkedInAt,
                        serverReceivedAt: new Date(ticket.checkedInAt.getTime() + 500),
                        serverCheckedInAt: ticket.checkedInAt
                    }
                });
            }
        }
    }
    console.log(`- Seeding orders for active future concerts...`);
    const sayHiConcert = seededConcerts[0];
    const sayHiTicketTypes = ticketTypesMap[sayHiConcert.id];
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
                status: client_1.OrderStatus.PAID,
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
                status: client_1.PaymentStatus.SUCCESS,
                amountVnd: subtotal,
                requestedAt: orderTime,
                confirmedAt: new Date(orderTime.getTime() + 3 * 60 * 1000)
            }
        });
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
                    status: client_1.TicketStatus.ACTIVE,
                    issuedAt: new Date(orderTime.getTime() + 4 * 60 * 1000)
                }
            });
        }
    }
    for (let i = 0; i < 10; i++) {
        const buyer = audienceUsers[(i + 5) % audienceUsers.length];
        const tt = sayHiTicketTypes[i % sayHiTicketTypes.length];
        const quantity = 1;
        const orderCode = generateOrderCode();
        const orderTime = new Date(Date.now() - (i * 3 * 60 * 1000));
        const order = await prisma.order.create({
            data: {
                orderCode,
                userId: buyer.id,
                concertId: sayHiConcert.id,
                status: client_1.OrderStatus.PENDING,
                totalAmountVnd: tt.priceVnd * quantity,
                expiresAt: new Date(orderTime.getTime() + 15 * 60 * 1000),
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
        await prisma.paymentTransaction.create({
            data: {
                orderId: order.id,
                provider: payProviders[i % payProviders.length],
                idempotencyKey: `pay-idemp-hi-pend-${orderCode}`,
                status: client_1.PaymentStatus.INITIATED,
                amountVnd: tt.priceVnd * quantity,
                requestedAt: orderTime
            }
        });
    }
    for (let i = 0; i < 8; i++) {
        const buyer = audienceUsers[(i + 10) % audienceUsers.length];
        const tt = sayHiTicketTypes[i % sayHiTicketTypes.length];
        const orderCode = generateOrderCode();
        const orderTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - i * 60 * 60 * 1000);
        const order = await prisma.order.create({
            data: {
                orderCode,
                userId: buyer.id,
                concertId: sayHiConcert.id,
                status: client_1.OrderStatus.EXPIRED,
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
                status: client_1.PaymentStatus.TIMEOUT,
                amountVnd: tt.priceVnd,
                requestedAt: orderTime
            }
        });
    }
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
                status: client_1.OrderStatus.CANCELLED,
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
    }
    const vctConcert = seededConcerts[2];
    const vctTicketTypes = ticketTypesMap[vctConcert.id];
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
                status: client_1.OrderStatus.PAID,
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
                provider: client_1.PaymentProvider.VNPAY,
                providerTransactionId: `TX-VCT-${orderCode}`,
                idempotencyKey: `pay-idemp-vct-${orderCode}`,
                status: client_1.PaymentStatus.SUCCESS,
                amountVnd: tt.priceVnd,
                requestedAt: orderTime,
                confirmedAt: new Date(orderTime.getTime() + 5 * 60 * 1000)
            }
        });
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
                status: client_1.TicketStatus.ACTIVE,
                issuedAt: new Date(orderTime.getTime() + 6 * 60 * 1000)
            }
        });
    }
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
                status: client_1.ImportStatus.COMPLETED,
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
            const isCheckedIn = c.status === client_1.ConcertStatus.FINISHED || (u % 4 === 0);
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
                    status: isCheckedIn ? client_1.VipGuestStatus.CHECKED_IN : client_1.VipGuestStatus.ACTIVE,
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
    console.log('📊 Re-calculating Ticket Type reserved and sold quantities...');
    const allTicketTypes = await prisma.ticketType.findMany();
    for (const tt of allTicketTypes) {
        const sold = await prisma.ticket.count({
            where: {
                ticketTypeId: tt.id,
                order: { status: client_1.OrderStatus.PAID }
            }
        });
        const reserved = await prisma.orderItem.aggregate({
            where: {
                ticketTypeId: tt.id,
                order: { status: client_1.OrderStatus.PENDING }
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
//# sourceMappingURL=seed.js.map
