# Landing Page Spec

## Purpose

The landing page for `app.omatrust.org` should act as the **product entry point** for OMATrust. It is not a marketing homepage and it is not a schema browser.

Its job is to help users quickly choose between the two primary actions in the system:

1. **Publish trust data**
2. **Manage trust for their own service**

It should also provide a lightweight public signal that the system is active and gaining momentum.

---

## Primary goals

The page should:

* help first-time users understand how to use OMATrust
* help returning users quickly choose the right path
* avoid forcing users to understand attestation types before they act
* avoid making users read documentation before they can proceed
* provide some visible system activity as social proof

---

## Non-goals

The page should **not**:

* act like a marketing hero page
* lead with raw attestation schemas
* force users to choose a persona
* require sign-in before users understand what the app does
* look like a developer tool homepage

---

# Overall page structure

## 1. Top navigation

### Required nav items

* Home
* Docs
* Sign In

### Notes

* Remove or rename anything labeled **“Registry”** for now unless it is actually live and relevant
* Remove **“Attestation Portal”** language
* Keep nav simple

### Sign In behavior

Clicking **Sign In** should **not** immediately open the wallet modal.

Instead it should open a lightweight chooser:

* **Sign in to an existing account**
* **Create a new account**

If the user chooses **Sign in to an existing account**, then show login/auth options.

If the user chooses **Create a new account**, Take the user through the new modal account flow mentioned in plan.md and spec.md.

---

## 2. Page title area

Use a simple title. No big marketing hero needed.  Match `omatrust-landing` style.  It's too plain now.

### Recommended page title

**OMATrust Portal**

### Optional subtitle

A short single-line explanation is okay, but optional. For example:

**Publish trust data on services or manage trust for your own.**

This should stay short and purely functional.

---

## 3. Primary action section

This is the core of the page.

Use **two equal boxes/cards in two columns** on desktop, stacked on mobile.

Each card should include:

* title
* short description
* one primary button

Do **not** include bullet lists inside the cards.

Do **not** include “Learn more” or “Use cases” links inside the cards.

---

### Card 1: Publish trust data

#### Title

**Publish Trust Data**

#### Description

**Submit reviews, audits, certifications, or endorsements for services.**

#### Primary button

**Start Publishing**

#### Destination

This should lead the /publish page.

When an unauthenticated user selects a schema tile on /publish and attempts to submit, the sign-up wizard modal launches as described in plan.md and spec.md in this folder.

---

### Card 2: Manage your service trust

#### Title

**Manage Your Service Trust**

#### Description

**Authorize signing keys, link identities, and respond to reviews.**

#### Primary button

**Open Dashboard**

#### Destination

This should go to the Current  /dashboard page.

If the user is not signed in yet, this can trigger the appropriate sign-in flow.

---

## 4. Optional use-case support section

Because some users will need more context before clicking, add a lightweight section **below** the two cards, not inside them.

### Section title

**How OMATrust is used**

### Format

Simple short rows or small tiles, not long prose.

### Example items

* Developers authorize signing keys for their services
* Auditors publish security assessments
* Certification bodies issue verifiable certifications
* Users submit reviews and endorsements
* Service providers respond to user reviews

This section should be short and scannable.

It should exist to help users recognize themselves, not to document the system.

---

## 5. Activity / social proof section

Keep the Latest Attestations section that exists today.

### Notes

This section should be visually secondary to the two main actions.

Its purpose is:

* momentum
* public proof
* credibility

Not discovery-first exploration.

---

# Content and UX guidance

## Tone

* direct
* clear
* product-oriented
* minimal jargon

## Avoid

* “portal” language as the main framing
* “attestation” as the only user-facing concept
* unexplained technical terms in primary entry points

## Use

* trust data
* service trust
* reviews
* audits
* certifications
* keys
* identities

---

# Visual guidance

## Layout

* clean
* centered
* not overly dense
* two-column action section
* strong spacing between major sections

## Cards

* equal visual weight
* concise copy
* one main CTA each
* no clutter

## Hero

No large traditional marketing hero is required.

A compact title area is enough.

That is better than a large generic hero that says little and delays action.

---

# Recommended information architecture

## Top of page

* nav
* compact title
* two primary action cards

## Mid-page

* How OMATrust is used
* Latest Activity

## Lower page

* advanced trust data types
* docs / resources links if needed

---

# Entry flow summary

## Unauthenticated first-time user

* lands on app landing page
* sees two core actions
* can browse and understand without committing
* signs in only when needed

## Returning user

* clicks Sign In
* chooses existing-account path
* authenticates
* reaches dashboard

## Curious user

* scans use-case section
* sees recent activity
* understands OMATrust without reading docs first

---

# What to remove from the current page

Remove from the primary top area:

* giant attestation-type list
* raw schema-first organization
* current hero copy if it is only decorative
* immediate wallet modal on Sign In

---

# Publish Page /publish

This serves the same role as the current landing page: attestation tiles; however the page should ask something like:

**What do you want to publish?**

And then present translated options such as:

* Review an app or service
* Publish a security assessment
* Issue a certification
* Endorse a service
* Link two identities under common ownership
* Authorize a key

The wording there can still map to underlying schemas, but should not begin with raw internal labels only. It's possible that the code that creates the tiles programmatically creates them. In which case you'll have to change the text. 

---

# Account Page /account

The account page is described in spec.md. It shows subscription status, usage, wallet info, and upgrade options.

It should appear as a navigation link (e.g., in the header or as a user menu item) on both the `/publish` and `/dashboard` pages once the user has created an account. It is not visible to unauthenticated users.

This page will be implemented later. For now, note its placement in the navigation architecture.


