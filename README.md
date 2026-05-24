# Manalio

Manalio is a PoC-stage prototype for childcare teacher training schools. It helps students review their own practicum notes, notice privacy-sensitive wording before using AI support, and connect feedback from the practicum site to the next day's observation.

This is not a diary-writing shortcut, an auto-grading tool, or a production deployment.

## What This Prototype Shows

- A student-facing flow for writing observation notes in their own words.
- A privacy-aware pre-check before reflection support.
- Follow-up prompts that help students think about what to observe next.
- A teacher-facing summary for conversations, class discussion, and student self-check.
- A public read-only demo route with fictional sample data only.

## Safety Boundaries

- Do not enter real student names, child names, school names, practicum site names, phone numbers, addresses, diagnoses, family situations, or other personal information.
- The included sample content is fictional.
- The prototype is for pre-PoC discussion and review, not for formal school operation.
- AI support is framed as reflection and preparation, not as final diary generation or grade judgment.

## Local Demo

Install dependencies and run the local server.

    npm install
    npm run dev

Open:

    http://localhost:3000/demo

The `/demo` route is the safest first screen for reviewers because it is read-only and uses fictional sample data.

## Checks

Before sharing this public cutout, run these commands in the public repository:

    npm run check
    npm run audit:secrets
    npm run build

In the private working repository, also run the broader pre-export checks before creating this cutout:

    npm run prepare:application-github-candidate
    npm run audit:application-demo
    npm run audit:application-github

## Not Included

This public repository intentionally does not include teacher-review URLs, login credentials, passwords, `.env.local`, generated build artifacts such as `.next/`, meeting notes, internal work logs, archived artifacts, Notion/Obsidian notes, school-specific data, or production database credentials.
