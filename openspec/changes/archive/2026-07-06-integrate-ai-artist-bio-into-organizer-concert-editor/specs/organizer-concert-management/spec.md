## Specification: Concert Creation with Optional AI Artist Bio

## Description

This change extends the Organizer concert creation experience with optional, deferred Artist Bio setup. The concert remains the primary successful result, while ticket-type setup and press-kit queueing are recoverable post-create operations. Audience and Check-in Staff behavior is unchanged. The flow uses the Web Application and existing Backend API, PostgreSQL, MinIO, Kafka, Background Worker, Redis, and AI Model integration.

## Main Flow

1. The Organizer enters concert data, optional ticket drafts, and an optional PDF press kit.
2. The Web Application uploads a selected banner as before and creates the concert through the existing JSON endpoint.
3. After receiving the concert ID, the Web Application independently performs ticket setup and optional press-kit upload.
4. The Web Application collects branch outcomes and navigates to Edit Concert.
5. Edit Concert reports recovery information and monitors asynchronous Artist Bio processing without waiting during creation.

## Failure Scenarios

- Concert validation or creation failure prevents all concert-dependent post-create requests.
- Ticket setup failure does not prevent the independent press-kit upload attempt.
- Press-kit upload or queue failure does not roll back the concert or completed ticket setup.
- If the browser closes after concert creation, the Organizer can recover from the existing Edit Concert page.

## Constraints

- The existing `POST /organizer/concerts` JSON contract remains unchanged.
- Press-kit upload MUST use the returned owned concert ID and existing protected document endpoint.
- The flow MUST NOT delete or roll back a successfully created concert because a post-create branch fails.
- AI completion MUST NOT be awaited before navigation.
- Partial-success feedback MUST not expose storage credentials, AI provider errors, prompts, or internal object details.

## Acceptance Criteria

- Tests verify request ordering, independent post-create branches, every mixed success/failure combination, navigation to the created concert, and unchanged behavior when no PDF is selected.
- Existing concert, banner, ticket-type, authorization, and public browsing regression tests continue to pass.

## ADDED Requirements

### Requirement: Optional Artist Bio setup in Create Concert
The Organizer Create Concert page SHALL accept an optional valid press-kit PDF as client-side form state without changing the concert creation API payload. After successful concert creation, it SHALL upload the PDF using the returned concert ID and SHALL NOT wait for AI extraction or generation to complete.

#### Scenario: Concert is created without a press kit
- **WHEN** an Organizer submits valid concert data without selecting a PDF
- **THEN** the existing concert and ticket setup flow proceeds without an artist-document upload request

#### Scenario: AI processing is asynchronous after creation
- **WHEN** the post-create PDF upload returns HTTP 202
- **THEN** the Web Application treats the biography as queued and navigates without waiting for a terminal generation status

### Requirement: Independent post-create outcomes
After the concert is created, the Web Application MUST attempt ticket-type setup and optional press-kit upload as independent post-create branches. Failure in either branch MUST NOT roll back the concert, MUST NOT prevent the other branch from being attempted, and MUST be represented in recovery feedback.

#### Scenario: Ticket setup fails but press kit is queued
- **WHEN** the concert is created, ticket setup fails, and the press-kit upload succeeds
- **THEN** the concert remains created and the Edit Concert page reports the ticket recovery need while Artist Bio processing continues

#### Scenario: Press-kit upload fails but ticket setup succeeds
- **WHEN** the concert and ticket setup succeed but the press-kit upload fails
- **THEN** the concert remains created and the Edit Concert page reports that the press kit can be uploaded again

#### Scenario: Both post-create branches fail
- **WHEN** the concert is created but ticket setup and press-kit upload both fail
- **THEN** the concert remains created and the Edit Concert page reports both recovery needs

### Requirement: Post-create navigation to Edit Concert
The Organizer Web Application SHALL navigate to `/organizer/concerts/:id/edit` after successful concert creation regardless of post-create branch outcomes and SHALL carry non-secret feedback describing queued work and recoverable failures.

#### Scenario: Successful creation opens the editor
- **WHEN** the Backend API returns a created concert ID
- **THEN** the Web Application navigates to that concert's Edit Concert page where the Organizer can continue ticket management and monitor or retry Artist Bio setup
