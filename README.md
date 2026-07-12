# Manalio

Manalio is a public prototype for childcare teacher training schools. It turns student-written practicum records into privacy-aware reflection prompts, next-day observation focus, and teacher support materials for small-scope validation. Students revise the result in their own words, while teachers use post-practicum support points and recurring themes for class instruction.

## What This Prototype Shows

- A short student chat that organizes the day's goal and one observed episode.
- A comparison between the student's original notes and an unfinished writing scaffold before editing the school format.
- A privacy-aware pre-check before reflection support.
- A teacher-facing student list with individual support points and recurring class themes after practicum.
- An interactive public demo that runs with fictional sample data only.

## BootCamp Progress

This repository also includes public-safe progress notes for Singularity Society BootCamp:

    docs/ss-bootcamp-progress/weekly-updates/

These notes are intentionally limited to product progress, validation status, and next questions. They do not include private review links, credentials, school names, educator names, student data, practicum-site information, or internal work logs.

## Safety Boundaries

- Do not enter real student names, child names, school names, practicum site names, phone numbers, addresses, diagnoses, family situations, or other personal information.
- The included sample content is fictional.
- The public demo is a safe simulation and does not connect to a school's production data.
- AI support is framed as reflection and preparation from student-written records.

## Local Demo

Install dependencies and run the local server.

    npm install
    npm run dev

Open:

    http://localhost:3000/demo

The `/demo` route is the first screen for reviewers. It is interactive and uses fictional sample data.

The public cutout runs in demo-only mode by default. `npm run dev`, `npm run build`, and `npm run start` go through `scripts/run-public-demo-command.mjs`, which forces `MANABI_PUBLIC_DEMO_ONLY=true`, mock data, disabled Supabase access, disabled public signup, and no reviewer shortcut UI. Do not replace these scripts with raw `next dev`, `next build`, or `next start` before public sharing.

## Checks

Before sharing this public cutout, run these commands in the public repository:

    npm run check
    npm run audit:secrets
    npm run build
    npm run start

In the private working repository, also run the broader pre-export checks before creating this cutout:

    npm run prepare:application-github-candidate
    npm run audit:application-demo
    npm run audit:application-github

## Not Included

This public repository intentionally does not include teacher-review URLs, login credentials, passwords, `.env.local`, generated build artifacts such as `.next/`, meeting notes, internal work logs, archived artifacts, Notion/Obsidian notes, school-specific data, or production database credentials.
