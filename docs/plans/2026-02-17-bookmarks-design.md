# Bookmarks Design

## Overview

Trip-independent bookmark feature. Users save places they discover on SNS or articles as lightweight memos, organize them into lists, and optionally share via profile pages.

## Requirements

- Minimal data per bookmark: name, memo, URL
- Lists group bookmarks (e.g., "Tokyo Cafes", "Kyoto Sightseeing")
- Visibility per list: private (self only) or public (visible on profile)
- Profile page at `/users/:userId` shows public lists
- No trip integration in initial release
- Authenticated users manage their own bookmarks; profile pages are public

## Data Model

### bookmark_lists

| Column     | Type                         | Description          |
|------------|------------------------------|----------------------|
| id         | uuid PK                      |                      |
| userId     | uuid FK → user               | List owner           |
| name       | varchar(100)                 | List name            |
| visibility | enum("private", "public")    | Access control       |
| sortOrder  | int                          | Display order        |
| createdAt  | timestamp                    |                      |
| updatedAt  | timestamp                    |                      |

### bookmarks

| Column    | Type           | Description              |
|-----------|----------------|--------------------------|
| id        | uuid PK        |                          |
| listId    | uuid FK → bookmark_lists |                  |
| name      | varchar(200)   | Place name               |
| memo      | text (max 2000)| Notes                    |
| url       | varchar(2000)  | Single URL               |
| sortOrder | int            | Order within list        |
| createdAt | timestamp      |                          |
| updatedAt | timestamp      |                          |

### Indexes

- bookmark_lists: (userId, sortOrder)
- bookmarks: (listId, sortOrder)

### Limits

- Max 5 lists per user
- Max 20 bookmarks per list

## API

### Bookmark Lists (requireAuth)

```
GET    /api/bookmark-lists                    # Own lists
POST   /api/bookmark-lists                    # Create list
PATCH  /api/bookmark-lists/:listId            # Update (name, visibility)
DELETE /api/bookmark-lists/:listId            # Delete list + bookmarks
PATCH  /api/bookmark-lists/reorder            # Reorder lists
```

### Bookmarks (requireAuth)

```
GET    /api/bookmark-lists/:listId/bookmarks              # List bookmarks
POST   /api/bookmark-lists/:listId/bookmarks              # Add bookmark
PATCH  /api/bookmark-lists/:listId/bookmarks/:bookmarkId  # Update
DELETE /api/bookmark-lists/:listId/bookmarks/:bookmarkId  # Delete
PATCH  /api/bookmark-lists/:listId/bookmarks/reorder      # Reorder
```

### Profile (public, no auth required)

```
GET    /api/users/:userId/bookmark-lists              # Public lists
GET    /api/users/:userId/bookmark-lists/:listId      # Public list + bookmarks
```

## Frontend

### Pages

**`/bookmarks`** (authenticated)
- Two-column layout: list sidebar + bookmark content area
- Create/edit lists via dialog
- Add bookmarks with name + memo + URL form (dialog)
- Drag-and-drop reorder
- Visibility toggle per list (private/public icon)

**`/users/:userId`** (public profile)
- Shows user display name and avatar
- Lists public bookmark lists
- Click/expand list to show bookmarks
- Accessible without login

### Navigation

- Add "Bookmarks" link to authenticated header navigation

## Access Control

| Operation              | Rule                                      |
|------------------------|-------------------------------------------|
| CRUD own lists/items   | Authenticated, userId matches              |
| View public lists      | Anyone, visibility = "public" only         |
| View private lists     | Owner only                                 |

## Validation (Zod schemas in packages/shared)

- List name: 1-100 chars, required
- Bookmark name: 1-200 chars, required
- Bookmark memo: max 2000 chars, optional
- Bookmark URL: max 2000 chars, optional, HTTP(S) only
- Visibility: "private" | "public"

## Future Extensions

- Copy bookmark to trip candidate
- Import/export bookmarks
- Tags or categories for bookmarks
- Location data (lat/lng) for map view
