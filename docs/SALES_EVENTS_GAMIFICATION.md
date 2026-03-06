# Sales Events Gamification Enhancement

The existing `Sales Events` module (originally designed for webinars and conferences) has been extended with a second mode targeting internal sales contests.

## Key new features

* **Goal tracking** – users can define a metric and numeric target (deals closed, revenue, etc.)
* **Leaderboards** – the API exposes `/sales-events/{id}/leaderboard`; the UI shows a live ranking with user names, avatars, progress bars and trending icons for the top performers.
* **Tiered rewards & caps** – each event carries `reward_points`, `total_budget_cap` and the system tracks `distributed_so_far`.
* **Time‑boxing** – start/end dates already existed and are reused.
* **Eligibility filters** – events can now restrict participation to one or more departments (`eligible_dept_ids` JSON list).  Registration and progress updates are validated accordingly.
* **Automated payout** – `POST /sales-events/{id}/progress` handles user progress increments, enforces eligibility, and, once the goal is reached, moves points from the department budget to the user wallet within a single transaction.
* **Near-goal notifications** – users receive an in‑app notification when they cross 80% of their goal; the system will only send one warning per event.
* **Campaign manager view** – marketing/department leads see a burn‑rate tile in the Sales Events page showing budget consumption vs. elapsed time.

### Database changes

- `sales_events` table altered to add columns: `dept_id`, `goal_metric`, `goal_value`, `reward_points`, `total_budget_cap`, `distributed_so_far`.
- New table `event_progress` created to store per-user progress and reward state.

### API additions

- `POST /sales-events/{id}/progress` – increment a user's progress and trigger reward logic. Only managers may invoke.
- `GET /sales-events/{id}/leaderboard` – returns ranking list.

Existing CRUD endpoints accept the new fields for create/update.

### Frontend

- Sales Events page now includes a 4-step creation wizard covering core info, rules, funding and invitations.
- Live Contest card placed atop the list shows progress and embeds a simple leaderboard component.

### Testing

Comprehensive unit tests verify progress behaviour, cap enforcement, and auto‑rewarding.

## Next steps / roadmap

1. **Eligibility filters** – add department/region selectors and enforce on registration.
2. **Leaderboard UI polishing** – show user names, avatars, and progress bars.
3. **Campaign manager view** – allow marketing users to see point burn rate, historical pace.
4. **Notifications** – inform users when they are within reach of reward.

This document serves both as a summary of changes and a guide for future enhancements.