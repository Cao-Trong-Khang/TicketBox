export const PERMISSIONS_KEY = 'ticketbox:permissions';

export const ROLE_CODES = {
  audience: 'AUDIENCE',
  organizer: 'ORGANIZER',
  checkinStaff: 'CHECKIN_STAFF',
} as const;

export const PERMISSION_CODES = {
  concertRead: 'concert:read',
  concertCreate: 'concert:create',
  concertUpdate: 'concert:update',
  concertCancel: 'concert:cancel',
  concertTicketTypeManage: 'concert:ticket_type:manage',
  concertAnalyticsRead: 'concert:analytics:read',
  ticketPurchase: 'ticket:purchase',
  ticketReadOwn: 'ticket:read_own',
  checkinScan: 'checkin:scan',
  checkinSync: 'checkin:sync',
} as const;