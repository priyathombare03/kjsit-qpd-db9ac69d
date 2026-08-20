# Paper Path — HOD / DQC workflow, year routing and export upgrade

## What changes for users

- Login screen gets an institution/portal selector (radio or dropdown) plus role selection.
- Two primary roles: **HOD** (creates/assigns papers) and **DQC** (reviews papers for the year level they own: SY, TY, LY). Faculty designer and Exam Coordinator stay as secondary roles so the existing generation and distribution flows keep working.
- Academic year is a dropdown; picking a year filters the semester dropdown to only the semesters valid for that year (SY -> III/IV, TY -> V/VI, LY -> VII/VIII).
- Selecting the year auto-routes the paper to the DQC that owns that year level; the assignee is shown before submit and can be overridden.
- Paper sets carry a **BT level** tag of **H** (High) or **M** (Medium) instead of the current Easy/Medium/Hard label.
- **Print direct** button renders the exam-facing paper with Course Outcomes hidden; the internal review view still shows CO/BT columns.
- Downloaded PDFs always print the Somaiya logo in the page header.
- New **Index / Tracking dashboard**: one row per assignment showing course, year, assigned DQC, submitter, submitted-at, and status — so it is clear at a glance who has and has not submitted.

## Proposed database schema

Existing `papers` and `notifications` tables stay; new tables are added around them.

```text
profiles            id (auth user), email, full_name, institution_id, department
institutions        id, code, name              -- powers the login portal selector
user_roles          id, user_id, role           -- enum: hod | dqc | designer | coord
dqc_scopes          id, user_id, year_level     -- enum: SY | TY | LY, one row per year a DQC owns
academic_years      id, label ("2026-27"), is_active
semesters           id, academic_year_id, year_level, label ("V"), is_active
paper_assignments   id, paper_id, assigned_by (HOD), assigned_to (DQC),
                    year_level, academic_year_id, semester_id,
                    status (assigned|in_review|approved|returned),
                    is_primary, submitted_at, decided_at, note
```

`papers` gains: `institution_id`, `year_level`, `academic_year_id`, `semester_id`, and `bt_level` per set (stored inside the existing `sets` JSON as `bt: "H" | "M"`).

Access rules in plain English:
- A user only sees papers from their own institution.
- HOD sees papers in their department, and every assignment they created.
- DQC sees only papers assigned to them (through `paper_assignments`), which naturally limits them to their year levels.
- Roles live in their own table and are checked through a security-definer helper, never read from a profile field.

## Frontend views

| View | Purpose |
| --- | --- |
| `/` login | Institution selector + role selection, then sign in |
| `/hod` | HOD inbox: papers in the department, filter by year/semester/status |
| `/hod/assign/$paperId` | Pick academic year -> semester (filtered) -> auto-resolved DQC, confirm/override, assign |
| `/dqc` | Assigned-to-me queue, grouped by year level |
| `/dqc/paper/$id` | Existing review screen + BT (H/M) per set, approve / return |
| `/index` (tracking) | Table of all assignments: course, year, DQC, submitted by, submitted at, status, overdue flag |
| `/designer/*`, `/coord/*` | Existing generation and distribution flows, updated to the new year/semester dropdowns |
| Print view | Exam-facing layout, CO column hidden, logo header, `window.print()` |

## Routing logic and the overlap edge case

Resolution order when a year level is selected:

1. Look up all active DQC users whose `dqc_scopes` include that year level, scoped to the same institution and department.
2. **Exactly one match** -> assign automatically; the UI shows the resolved name.
3. **No match** -> block auto-assign, surface "No DQC configured for TY", and fall back to a manual picker for the HOD (paper stays unassigned, flagged on the tracking dashboard).
4. **Two or more matches (overlap)** -> do not guess. Two supported behaviours, chosen per department setting:
   - *Choose one* (default): the HOD sees a disambiguation dropdown of the matching DQCs, pre-selected by least current open load (round-robin tiebreak). One assignment row, `is_primary = true`.
   - *Parallel review*: create one `paper_assignments` row per matching DQC, all `is_primary = false` except the first. The paper is approved when **all** primary-eligible reviewers approve, and returned as soon as **any one** returns it, with all notes shown together.

This is why assignment is its own table rather than a column on `papers`: multiple reviewers, reassignment history, and per-reviewer submitted/decided timestamps all fall out of it, and the tracking dashboard is a straight read of that table.

## Technical notes

- Real Supabase auth replaces the current localStorage demo session; the `_authenticated` route gate protects HOD/DQC areas, and RLS policies scope every table by `auth.uid()` and role.
- Year -> semester filtering is data-driven from `semesters`, not hardcoded, so a new academic year needs no code change.
- DQC resolution runs in a server function so scope tables are not exposed to the browser.
- PDF export embeds the logo as a base64 image at the top of page one in `src/lib/export.ts`; the CO block is emitted only when `includeCourseOutcomes` is true (false for print-direct/exam copies).
- Migration is one step: create the new tables with grants and RLS, backfill existing papers to the current institution and derive `year_level` from `className`.

## Suggested build order

1. Migration: institutions, profiles, roles, DQC scopes, academic years/semesters, assignments (+ grants and RLS).
2. Auth rework and login institution selector.
3. Year/semester cascading dropdowns and BT H/M set labels.
4. HOD assign flow with DQC resolution (including overlap handling).
5. DQC queue filtered by assignment.
6. Tracking dashboard.
7. Print-without-CO and logo in PDF export.
