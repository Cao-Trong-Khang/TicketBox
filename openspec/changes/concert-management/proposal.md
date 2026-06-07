# Proposal: Concert Management

## Problem

Organizer users (ban tổ chức) currently have no integrated system to publish concert details, set up ticket types, configure prices, manage capacities, adjust sale windows, or view real-time sales/revenue statistics. 
Audience users need a unified, high-availability platform to discover concerts, view details, inspect ticket availability, and view seat layouts before purchase.

This proposal introduces the **Concert Management** feature which establishes these components using a NestJS backend and a React/Vite frontend.

## Goals

1. Allow **Organizers** to create, edit, cancel, and manage concerts, upload seating diagrams (SVG), configure ticket types (GA, CAT2, CAT1, VIP, SVIP) with respective pricing, capacities, and per-user limits, and view real-time revenue and sales statistics.
2. Allow **Audience** users to view upcoming concerts and inspect concert details, including interactive seating zone maps with real-time remaining ticket counts per zone.
3. Align with performance constraints: cache concert listing and detail views to reduce database strain under read-heavy traffic, and use a short TTL cache for real-time ticket availability.

## Users and Needs

* **Organizer**: Needs to publish concerts, configure various ticket types, update details, cancel events, and monitor real-time sales figures and ticket quotas.
* **Audience**: Needs to view all upcoming concerts, check concert details, check seat availability by zone, and see a visual indicator of zone status (e.g., Sold Out, On Sale, Countdown to sale).

## Scope

### In Scope
* **Backend (NestJS)**:
  * Database schema for `Concert` and `TicketType`.
  * Public REST endpoints for listing and viewing concerts.
  * Secured REST endpoints for Organizers to create, edit, cancel concerts, and check statistics.
  * Redis caching layer:
    * Concert list cached for 5 minutes (`concerts:list`).
    * Concert detail cached for 5 minutes (`concerts:{id}`).
    * Ticket availability cached for 30 seconds (`concerts:{id}:tickets`).
    * Cache invalidation mechanisms for concert updates and purchase events.
* **Frontend (React + Vite)**:
  * Public routes: `/concerts` (grid listing) and `/concerts/:id` (detail page).
  * Organizer routes: `/admin/concerts` (list), `/admin/concerts/new` (create), `/admin/concerts/:id/edit` (edit).
  * Interactive SVG seat map component that shows zone-based pricing and availability.
  * Status badges (cancellation banner, countdown timers, sold-out indicators, buy button).
* **Seed Data**:
  * 4 default concerts in Vietnam (Anh Trai Say Hi, Anh Trai Vuot Ngan Chong Gai, Em Xinh Say Hi, Chi Dep Dap Gio Re Song) with 5 standard ticket types each (GA, CAT2, CAT1, VIP, SVIP).

### Out of Scope
* Authentication flows (covered by `auth-and-rbac` specification).
* Payment processing or simulated bank gateways.
* Real ticket checkout/purchase execution.

## External Systems
* No new external systems. The feature relies on existing infrastructure (PostgreSQL, Redis).

## Risks and Constraints
* **High Read Load**: Popular concert releases cause massive traffic spikes. Cached read models in Redis are required to protect PostgreSQL.
* **Inventory Freshness**: Showing cached remaining tickets can lead to disappointed users. The TTL for remaining tickets must be short (30s) and programmatically invalidated immediately when an order completes.
