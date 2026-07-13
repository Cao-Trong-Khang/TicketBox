import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ArtistDocumentsController } from '../artist-bio/artist-documents.controller';
import { ArtistBioPreviewController } from '../artist-bio/artist-bio-preview.controller';
import { CheckInStaffAssignmentController } from '../check-in/check-in-staff-assignment.controller';
import { BannersController } from '../concerts/banners.controller';
import { OrganizerConcertsController } from '../concerts/organizer-concerts.controller';
import { OrganizerTicketTypesController } from '../concerts/organizer-ticket-types.controller';
import { OrdersController } from '../orders/orders.controller';
import { TicketsController } from '../tickets/tickets.controller';
import { VipImportsController } from '../vip-imports/vip-imports.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY, PERMISSION_CODES } from './rbac.constants';

type ControllerClass = {
  new (...args: any[]): any;
  readonly name: string;
  prototype: any;
};

const permissionMatrix: Array<{
  controller: ControllerClass;
  methods: string[];
  permission: string;
}> = [
  {
    controller: OrdersController,
    methods: ['getOrderHistory'],
    permission: PERMISSION_CODES.ticketReadOwn,
  },
  {
    controller: OrdersController,
    methods: ['createOrder'],
    permission: PERMISSION_CODES.ticketPurchase,
  },
  {
    controller: TicketsController,
    methods: ['listMyTickets'],
    permission: PERMISSION_CODES.ticketReadOwn,
  },
  {
    controller: OrganizerConcertsController,
    methods: ['listOwnedConcerts', 'getOwnedConcert'],
    permission: PERMISSION_CODES.concertRead,
  },
  {
    controller: OrganizerConcertsController,
    methods: ['createConcert'],
    permission: PERMISSION_CODES.concertCreate,
  },
  {
    controller: OrganizerConcertsController,
    methods: ['getOwnedConcertRevenue'],
    permission: PERMISSION_CODES.concertAnalyticsRead,
  },
  {
    controller: OrganizerConcertsController,
    methods: ['updateOwnedConcert'],
    permission: PERMISSION_CODES.concertUpdate,
  },
  {
    controller: OrganizerConcertsController,
    methods: ['cancelOwnedConcert'],
    permission: PERMISSION_CODES.concertCancel,
  },
  {
    controller: OrganizerTicketTypesController,
    methods: [
      'listTicketTypes',
      'createTicketType',
      'updateTicketType',
      'activateTicketType',
      'deactivateTicketType',
    ],
    permission: PERMISSION_CODES.concertTicketTypeManage,
  },
  {
    controller: BannersController,
    methods: ['uploadBanner'],
    permission: PERMISSION_CODES.concertCreate,
  },
  {
    controller: ArtistDocumentsController,
    methods: ['upload', 'list', 'detail', 'updateBio', 'regenerate'],
    permission: PERMISSION_CODES.concertUpdate,
  },
  {
    controller: ArtistBioPreviewController,
    methods: ['preview'],
    permission: PERMISSION_CODES.concertCreate,
  },
  {
    controller: VipImportsController,
    methods: ['listImports', 'getImport'],
    permission: PERMISSION_CODES.concertUpdate,
  },
  {
    controller: CheckInStaffAssignmentController,
    methods: ['assignStaff', 'listStaff', 'removeStaff'],
    permission: PERMISSION_CODES.concertUpdate,
  },
];

test('orders, tickets, and organizer APIs declare authentication and exact permissions', () => {
  for (const entry of permissionMatrix) {
    for (const methodName of entry.methods) {
      const handler = entry.controller.prototype[methodName] as Function;
      assert.equal(typeof handler, 'function', `${methodName} must exist`);

      const permissions =
        Reflect.getMetadata(PERMISSIONS_KEY, handler) ??
        Reflect.getMetadata(PERMISSIONS_KEY, entry.controller);
      assert.deepEqual(
        permissions,
        [entry.permission],
        `${entry.controller.name}.${methodName} has incorrect permission metadata`,
      );

      const guards = [
        ...(Reflect.getMetadata(GUARDS_METADATA, entry.controller) ?? []),
        ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
      ];
      assert.ok(
        guards.includes(JwtAuthGuard),
        `${entry.controller.name}.${methodName} must use JwtAuthGuard`,
      );
      assert.ok(
        guards.includes(PermissionsGuard),
        `${entry.controller.name}.${methodName} must use PermissionsGuard`,
      );
    }
  }
});
