export const PERMISSIONS_KEY = 'ticketbox:permissions';

export const ROLE_CODES = {
  audience: 'AUDIENCE',
  organizer: 'ORGANIZER',
  gateStaff: 'GATE_STAFF',
} as const;

export const PERMISSION_CODES = {
  concertRead: 'concert:read',
  concertCreate: 'concert:create',
  concertUpdate: 'concert:update',
  concertCancel: 'concert:cancel',
  concertStats: 'concert:stats',
  ticketPurchase: 'ticket:purchase',
  ticketReadOwn: 'ticket:read-own',
  documentUpload: 'document:upload',
  aiBioRead: 'aibio:read',
  checkinScan: 'checkin:scan',
  checkinSync: 'checkin:sync',
} as const;
