# Моят Ден — Kids Training Schedule App

A mobile-first, single-screen schedule app for a child athlete. It can run from a hardcoded fallback schedule, or read today’s events from Google Calendar through a Netlify Function.

## Files

| File | Purpose |
|------|---------|
| `Schedule.html` | The app — open this in a browser |
| `tweaks-panel.jsx` | In-page Tweaks UI (loaded by Schedule.html) |
| `netlify/functions/google-calendar.js` | Netlify Function that reads Google Calendar |
| `netlify.toml` | Netlify routing for `/` and `/api/google-calendar` |

## Features

- **Live countdown** to the next event (`MM:SS`), flips to red elapsed time once started
- **Auto-advance** — hero event advances at the halfway point to the next event
- **Готово ✓** button to manually mark an event done and jump to the next
- **Per-event checklists** — tap to check items; state is remembered per event
- **Per-event colours** — page and hero card background shift for each activity type
- **Dark mode** for Лека нощ (bedtime) to reduce eye strain
- **Google Calendar sync** through Netlify Functions, with a hardcoded fallback if credentials are missing

## Schedule

| Time  | Event                  |
|-------|------------------------|
| 6:30  | 🌅 Добро утро           |
| 7:30  | ⛸️ Лед с Албена        |
| 8:45  | 🥐 Закуска              |
| 10:30 | ⛸️ Лед със Стоян       |
| 11:45 | 💪 Суха със Стоян       |
| 13:00 | 🍝 Обяд                 |
| 15:00 | ⛸️ Лед с Андрей        |
| 16:30 | 🍎 Следобедна закуска   |
| 17:00 | 💪 Суха със Стоян       |
| 19:30 | 🥗 Вечеря               |
| 21:00 | 🌙 Лека нощ             |

## Checklists

- **Добро утро** — 🪥 Зъби · 👕 Дрехи · 🪮 Коса · 👟 Обуване
- **Лед** — ⛸️ Кънки · 🪢 Ластик · 💧 Вода
- **Суха** — 🎒 Чанта · 🌀 Постелка · 💧 Вода
- **Лека нощ** — 🪥 Зъби · 🚿 Душ · 🪮 Коса · 👕 Пижама

## Tweaks Panel

Open via the toolbar toggle. Controls:

- **Цвят** — accent colour for the Готово button and checklist checks (`ice` / `aurora` / `sunset`)
- **Събитие** (debug) — jump to any event regardless of real time
- **Таймер** (debug) — force countdown (`обратно`) or elapsed (`изминало`) display

## Google Calendar Setup

This integration uses a **service account**, not a public API key. That is the right choice for a private calendar and keeps secrets on Netlify instead of in the browser.

### Secrets to add in Netlify

- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON` or the pair:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- Optional: `GOOGLE_CALENDAR_TIME_ZONE` or `GOOGLE_TIME_ZONE` if you want to override the default `Europe/Sofia`

### How to generate them

1. Create or open a Google Cloud project.
2. Enable the **Google Calendar API** for that project.
3. Create a **service account** in Google Cloud IAM.
4. Create a **JSON key** for that service account and download it.
5. Copy the JSON contents into `GOOGLE_SERVICE_ACCOUNT_JSON`, or split it into:
   - `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` -> `GOOGLE_PRIVATE_KEY`
6. In Google Calendar, open the calendar you want to use and **share it** with the service account email. Give it at least “See all event details”.
7. Put the calendar’s ID into `GOOGLE_CALENDAR_ID`.

### Which calendar ID to use

- For a primary Google Calendar, the ID is usually your email address.
- For other calendars, open the calendar settings in Google Calendar and copy the value under **Integrate calendar** or **Calendar ID**.

### What the app does

- The page calls `/.netlify/functions/google-calendar` through the `/api/google-calendar` redirect.
- If the function is configured, it loads today’s events from Google Calendar.
- If the function is not configured or fails, the app falls back to the bundled schedule so the page still works.
