---
id: 114df13f-bb5f-4de2-b96d-61af2bee9596
title: Git lesson from 1c0ebe4c2bca
tags:
- git
- lesson
created: 2026-10-15
updated: 2026-10-17
filenames:
- ceo-dashboard/backend/.env.example
- ceo-dashboard/backend/dist/config/env.js
- ceo-dashboard/backend/dist/config/env.js.map
- ceo-dashboard/backend/dist/lib/envValidation.d.ts
- ceo-dashboard/backend/dist/lib/envValidation.js
- ceo-dashboard/backend/dist/lib/envValidation.js.map
- ceo-dashboard/backend/dist/lib/envValidation.test.d.ts
- ceo-dashboard/backend/dist/lib/envValidation.test.js
- ceo-dashboard/backend/dist/lib/envValidation.test.js.map
- ceo-dashboard/backend/dist/services/availabilityService.d.ts
- ceo-dashboard/backend/dist/services/availabilityService.js
- ceo-dashboard/backend/dist/services/availabilityService.js.map
links: []
kind: lesson
status: proposed
superseded_by: null
deprecated_at: null
review_after: 2026-10-17
source_chat_id: null
created_at: 2026-10-15T04:55:59.393868300+00:00
summary: null
description: null
entities: []
related_files: []
related_entities: []
content_hash: e21b9de840482d389d4f8e939847f53b5876cd65702ba82f3dcba35022193282
source_tool: buddy_memory_lifecycle:git
source_confidence: 0.8600000143051147
source_trajectory_id: null
source_message_range: null
source_commit: 1c0ebe4c2bcad0c3ccdb784770045b7b817f282e
topic: null
last_used_at: null
use_count: 0
last_injected_at: null
dismissed_count: 0
source_content_hash: e21b9de840482d389d4f8e939847f53b5876cd65702ba82f3dcba35022193282
review_needed: true
occurrences: 0
---

Git lesson from 1c0ebe4c2bca

Source commit: 1c0ebe4c2bca
Paths: ceo-dashboard/backend/.env.example, ceo-dashboard/backend/dist/config/env.js, ceo-dashboard/backend/dist/config/env.js.map, ceo-dashboard/backend/dist/lib/envValidation.d.ts, ceo-dashboard/backend/dist/lib/envValidation.js, ceo-dashboard/backend/dist/lib/envValidation.js.map, ceo-dashboard/backend/dist/lib/envValidation.test.d.ts, ceo-dashboard/backend/dist/lib/envValidation.test.js, ceo-dashboard/backend/dist/lib/envValidation.test.js.map, ceo-dashboard/backend/dist/services/availabilityService.d.ts, ceo-dashboard/backend/dist/services/availabilityService.js, ceo-dashboard/backend/dist/services/availabilityService.js.map
Summary: fix: fail closed on weak JWT config and minimize availability exposure Remove the hardcoded next360-default-secret fallback: production now aborts startup when JWT_SECRET is missing, too short, or publicly known, while development/test uses a per-process ephemeral secret. Add a DB-free env validator with tests and a do