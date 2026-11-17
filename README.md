# Smart Campus – Room Availability Checker

Single fictional room, fictional bookings, no login, no database.

## Run
```
npm install
npm run dev
npm test
npm run build
```

## Acceptance contract
- AC1 reject invalid input
- AC2 reject past times
- AC3 duration 30–120 min
- AC4 reject overlap with an existing booking
- AC5 reject requests for a blocked room
- AC6 stored booking data is never mutated by a check
- AC7 (UI) clear availability feedback; usable on desktop and mobile
