# Souvenir List Feature Design

Date: 2026-02-26

## Overview

A personal souvenir wishlist feature scoped to each trip. Users can track what they want to buy during a trip, with optional metadata like recipient, URL, and address.

## Problem

The existing flow — Bookmark → Candidate → Schedule — does not accommodate shopping intentions. Bookmarks are trip-agnostic, and candidates are scoped to schedule planning. There is no place to record "I want to buy X at this trip" without misusing existing features.

## Non-Goals

- Expense tracking (handled by the existing expense feature)
- Linking to schedule items (lifecycle coupling creates edge cases when schedules are deleted or moved to candidates)
- Sharing souvenir lists with other trip members (may be revisited later)
- Global cross-trip view (may be revisited later if demand arises)

## Data Model

New table `souvenir_items`:

| Column        | Type      | Notes                        |
|---------------|-----------|------------------------------|
| id            | uuid      | Primary key                  |
| trip_id       | uuid      | FK → trips                   |
| user_id       | uuid      | FK → users (personal record) |
| name          | text      | Required                     |
| recipient     | text      | Optional. Who it's for       |
| url           | text      | Optional. Product/shop link  |
| address       | text      | Optional. Where to buy       |
| memo          | text      | Optional. Free-form notes    |
| is_purchased  | boolean   | Default false                |
| created_at    | timestamp |                              |

## Access Control

- All trip members (owner / editor / viewer) can create and manage their own items.
- A user can only read, update, and delete their own items.
- Other members' lists are not visible.

## UI

- Added as an independent panel on the trip detail page, following the same pattern as the expense panel.
- Panel shows only the current user's items.
- Add dialog: name (required), recipient / URL / address / memo (all optional).
- Each item shows a checkbox for purchased status, togglable inline.

## Considered Alternatives

**Schedule sub-items**: Attaching a checklist to each schedule was considered, but lifecycle edge cases (delete, move to candidate) made it impractical.

**No feature**: If kept personal and non-shared, a memo app could substitute. Rejected because trip-scoped shopping intent is a legitimate gap not covered by bookmarks or candidates.

**Global header view**: Useful during travel, but adds UI complexity for grouping across shared trips. Deferred.
