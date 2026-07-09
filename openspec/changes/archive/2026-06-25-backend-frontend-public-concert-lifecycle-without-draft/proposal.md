# Proposal: Backend/Frontend — Public Concert Lifecycle Without Draft

## Summary

Remove the draft-first organizer concert flow and make concerts public immediately when created. The organizer experience will shift to a lifecycle-based model where concerts are displayed as upcoming, ongoing, ended, or canceled based on their event time and stored status.

## Problem

The current organizer flow still treats concerts as draft-first and relies on a separate publish step. That creates confusion for organizers and leaves the public experience tied to a publish workflow that no longer matches the product decision.

## Goals

- Create organizer concert records as public immediately.
- Remove the publish step from the organizer frontend experience.
- Derive a lifecycle status for organizer displays using event timing.
- Allow edit and cancel only for upcoming, non-canceled concerts.
- Keep public APIs aligned with the current public visibility rules and ensure canceled concerts are not publicly visible.
- Avoid database migration churn and avoid touching payment, notification, QR, or check-in flows.

## Non-goals

- Prisma migration
- Payment/refund changes
- Notifications
- E-ticket QR
- Check-in
- Ticket-type lifecycle restrictions
- Anti-bot/rate-limiting work

## Scope

### Backend
- Create organizer concerts as `PUBLISHED` immediately.
- Add backend-derived `lifecycleStatus` to organizer list/detail responses.
- Enforce edit rules based on stored status and lifecycle status.
- Add organizer cancel endpoint `POST /organizer/concerts/:id/cancel` for upcoming, non-canceled concerts.
- Invalidate public list/detail/ticket-type caches after create, update, and cancel where relevant.
- Keep public concert APIs using the existing public status rule (`PUBLISHED`) and keep canceled concerts hidden from public endpoints.

### Frontend
- Remove publish-related UI from create/edit flows.
- Show success messaging that the created concert is public immediately.
- Display lifecycle/status labels in organizer dashboard and edit view.
- Disable edit and cancel for ongoing, ended, and canceled concerts.
- Keep ticket management available for MVP.

## Why now

The product decision is clear: organizer-created concerts should become public immediately and the UI should reflect event lifecycle instead of draft/publish semantics. Implementing this now will remove ambiguity for organizers and align the frontend with the intended public experience.
