export type CheckInResultCode =
  | 'accepted'
  | 'duplicate'
  | 'invalid'
  | 'expired'
  | 'unauthorized'
  | 'conflict';

export type CheckInAssignmentDto = {
  assignmentId: string;
  concertId: string;
  title: string;
  venueName: string;
  status: string;
  gateName: string | null;
  sourceDeviceId: string | null;
  startsAt: string;
  endsAt: string | null;
};

export type CheckInPreloadDto = {
  concert: {
    id: string;
    title: string;
    venueName: string;
    venueAddress: string | null;
    status: string;
    startsAt: string;
    endsAt: string | null;
  };
  assignments: {
    assignmentId: string;
    gateName: string | null;
    sourceDeviceId: string | null;
  }[];
  snapshot: {
    generatedAt: string;
    version: string;
  };
  tickets: {
    id: string;
    ticketCode: string;
    qrHash: string;
    status: string;
    issuedAt: string;
    checkedInAt: string | null;
    attendeeName: string | null;
    attendeeEmail: string | null;
    zoneOrSeat: string | null;
    previousCheckIn: {
      scannedAt: string;
      gate: string | null;
      staffName: string | null;
    } | null;
    ticketType: {
      code: string;
      name: string;
    };
  }[];
  vipGuests: {
    id: string;
    qrHash: string | null;
    externalGuestKey: string | null;
    fullName: string;
    email: string | null;
    phone: string | null;
    sponsorSource: string;
    sponsorCompany: string | null;
    invitedBy: string | null;
    guestType: string | null;
    allowedGate: string | null;
    status: string;
    checkedInAt: string | null;
    notes: string | null;
  }[];
};

export type CheckInSyncOutcomeDto = {
  localScanId: string | null;
  checkInId: string;
  resultCode: CheckInResultCode;
  status: string;
  message: string;
  syncedAt: string | null;
  serverCheckInAt: string | null;
  idempotent: boolean;
};

export type CheckInSyncResponseDto = {
  sourceDeviceId: string;
  concertId: string;
  syncedAt: string;
  outcomes: CheckInSyncOutcomeDto[];
};
