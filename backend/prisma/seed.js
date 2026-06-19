const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const roles = [
  { code: 'AUDIENCE', name: 'Audience' },
  { code: 'ORGANIZER', name: 'Organizer' },
  { code: 'GATE_STAFF', name: 'Gate Staff' },
];

const permissions = [
  { code: 'concert:read', description: 'Read published concert information' },
  { code: 'concert:create', description: 'Create concerts' },
  { code: 'concert:update', description: 'Update concerts' },
  { code: 'concert:cancel', description: 'Cancel concerts' },
  { code: 'concert:stats', description: 'Read concert revenue and sales statistics' },
  { code: 'ticket:purchase', description: 'Purchase tickets' },
  { code: 'ticket:read-own', description: 'Read own tickets' },
  { code: 'document:upload', description: 'Upload artist press kits' },
  { code: 'aibio:read', description: 'Read AI artist bio status and output' },
  { code: 'checkin:scan', description: 'Scan and validate tickets at check-in' },
  { code: 'checkin:sync', description: 'Synchronize offline check-in records' },
];

const rolePermissions = {
  AUDIENCE: ['concert:read', 'ticket:purchase', 'ticket:read-own'],
  ORGANIZER: [
    'concert:read',
    'concert:create',
    'concert:update',
    'concert:cancel',
    'concert:stats',
    'document:upload',
    'aibio:read',
  ],
  GATE_STAFF: ['checkin:scan', 'checkin:sync'],
};

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
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });

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

  const organizerEmail = process.env.ORGANIZER_EMAIL || 'org.@gmail.com';
  const organizerPassword = process.env.ORGANIZER_PASSWORD || '12345678';

  const organizerPasswordHash = await bcrypt.hash(organizerPassword, 10);

  const organizerUser = await prisma.user.upsert({
    where: { email: organizerEmail },
    update: {
      fullName: 'Default Organizer',
      status: 'ACTIVE',
    },
    create: {
      email: organizerEmail,
      passwordHash: organizerPasswordHash,
      fullName: 'Default Organizer',
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

  const gateEmail = process.env.GATE_STAFF_EMAIL || 'gate@gmail.com';
  const gatePassword = process.env.GATE_STAFF_PASSWORD || '12345678';

  const gatePasswordHash = await bcrypt.hash(gatePassword, 10);

  const gateUser = await prisma.user.upsert({
    where: { email: gateEmail },
    update: {
      fullName: 'Default Gate Staff',
      status: 'ACTIVE',
    },
    create: {
      email: gateEmail,
      passwordHash: gatePasswordHash,
      fullName: 'Default Gate Staff',
      status: 'ACTIVE',
    },
  });

  const gateRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'GATE_STAFF' },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: gateUser.id,
        roleId: gateRole.id,
      },
    },
    update: {},
    create: {
      userId: gateUser.id,
      roleId: gateRole.id,
    },
  });
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
