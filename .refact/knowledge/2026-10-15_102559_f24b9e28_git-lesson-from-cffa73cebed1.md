---
id: 2443faac-9620-409b-822d-c302cdb66193
title: Git lesson from cffa73cebed1
tags:
- git
- lesson
created: 2026-10-15
updated: 2026-10-17
filenames:
- ceo-dashboard/backend/src/config/database.ts
- ceo-dashboard/backend/src/routes/bookingRoutes.ts
- ceo-dashboard/backend/src/routes/scheduleRoutes.ts
- ceo-dashboard/backend/src/services/scheduleService.ts
- ceo-dashboard/backend/src/services/slotService.ts
- ceo-dashboard/frontend/book.html
- ceo-dashboard/frontend/css/style.css
- ceo-dashboard/frontend/index.html
- ceo-dashboard/frontend/ts/api.js
- ceo-dashboard/frontend/ts/api.ts
- ceo-dashboard/frontend/ts/app.js
- ceo-dashboard/frontend/ts/app.ts
links: []
kind: lesson
status: proposed
superseded_by: null
deprecated_at: null
review_after: 2026-10-17
source_chat_id: null
created_at: 2026-10-15T04:55:59.311900900+00:00
summary: null
description: null
entities: []
related_files: []
related_entities: []
content_hash: 5f8f324a2c448ef458cf47aa2ed7330ebbcf1bc2a26c4e71350b850b8c7562ca
source_tool: buddy_memory_lifecycle:git
source_confidence: 0.8600000143051147
source_trajectory_id: null
source_message_range: null
source_commit: cffa73cebed1af3af56fec8159a905e14880c1dc
topic: null
last_used_at: null
use_count: 0
last_injected_at: null
dismissed_count: 0
source_content_hash: 5f8f324a2c448ef458cf47aa2ed7330ebbcf1bc2a26c4e71350b850b8c7562ca
review_needed: true
occurrences: 0
---

Git lesson from cffa73cebed1

Source commit: cffa73cebed1
Paths: ceo-dashboard/backend/src/config/database.ts, ceo-dashboard/backend/src/routes/bookingRoutes.ts, ceo-dashboard/backend/src/routes/scheduleRoutes.ts, ceo-dashboard/backend/src/services/scheduleService.ts, ceo-dashboard/backend/src/services/slotService.ts, ceo-dashboard/frontend/book.html, ceo-dashboard/frontend/css/style.css, ceo-dashboard/frontend/index.html, ceo-dashboard/frontend/ts/api.js, ceo-dashboard/frontend/ts/api.ts, ceo-dashboard/frontend/ts/app.js, ceo-dashboard/frontend/ts/app.ts
Summary: feat: automatic availability engine, weekly schedule dashboards, booking slot fixes - slotService: working hours minus schedules/focus/bookings for all slot math - public slots endpoint + final availability check on booking create (409 with suggestions) - weekly schedule grid, stats, appointments modal, CSV export for