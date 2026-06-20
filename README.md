# Manalio

Manalio is a public prototype for childcare teacher training schools. It helps students review their own practicum notes, notice privacy-sensitive wording before using AI support, and connect feedback from the practicum site to the next day's observation.

This is not a diary-writing shortcut, an auto-grading tool, or a production deployment.

## What This Prototype Shows

- A student-facing flow for writing observation notes in their own words.
- A privacy-aware pre-check before reflection support.
- Follow-up prompts that help students think about what to observe next.
- A teacher-facing summary for conversations, class discussion, and student self-check.
- A public read-only demo route with fictional sample data only.

## BootCamp Progress

This repository also includes public-safe progress notes for Singularity Society BootCamp:

    docs/ss-bootcamp-progress/weekly-updates/

These notes are intentionally limited to product progress, validation status, and next questions. They do not include private review links, credentials, school names, educator names, student data, practicum-site information, or internal work logs.

## Safety Boundaries

- Do not enter real student names, child names, school names, practicum site names, phone numbers, addresses, diagnoses, family situations, or other personal information.
- The included sample content is fictional.
- The prototype is for BootCamp review and small-scope validation, not for formal school operation.
- AI support is framed as reflection and preparation, not as final diary generation or grade judgment.

## Local Demo

Install dependencies and run the local server.

    npm install
    npm run dev

Open:

    http://localhost:3000/demo

The `/demo` route is the safest first screen for reviewers because it is read-only and uses fictional sample data.

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
