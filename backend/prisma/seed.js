const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
