# Trust Search — spec.md

## 1. Purpose

This specification defines the expected behavior of the OMATrust trust search feature. Trust search allows users to look up services, organizations, and identities to view their trust records, attestations, and trust profiles.

This feature is a future addition to the portal UI redesign. When built, it will add a search bar to the main landing page and a dedicated search results page.

## 2. Scope

### 2.1 In Scope

- Search bar on the main landing page.
- Dedicated search results page at `/search`.
- Search by domain, service URL, DID, contract address, or organization name.
- Search result states for known services, unknown services, and error conditions.
- Navigation from landing page search bar to the search results page.

### 2.2 Out of Scope

- Backend indexing logic and search ranking algorithms.
- Full-text search across attestation content.
- Trust scoring or reputation scoring.
- Search within the dashboard.

## 3. Landing Page Search Bar

### 3.1 Placement

When this feature is built, the landing page will include a search bar at the top of the page, above the workflow CTA cards.

### 3.2 Behavior

The search bar should accept free-text input. Example placeholder text:

> Search a service, domain, DID, or contract

When the user enters a query and submits (e.g., presses Enter or clicks a "Go" button), the browser navigates to the search results page with the query:

```txt
/search?q=<encoded_query>
```

The search bar on the landing page does not display inline results. It always navigates to the dedicated search results page.

### 3.3 Supported Query Types

The search bar should accept:

- Domain names (e.g., `example.com`).
- Service URLs (e.g., `https://example.com`).
- DIDs (e.g., `did:web:example.com`).
- Contract addresses (e.g., `0x1234...`).
- Organization names, where supported by the indexer.

The frontend does not need to validate or classify the query type before submission. Classification may happen on the results page or in the backend.

## 4. Search Results Page

### 4.1 Route

```txt
/search?q=<encoded_query>
```

### 4.2 Purpose

The search results page displays matching services, organizations, or identities based on the user's query. It should help users answer: "What does OMATrust know about this service?"

### 4.3 Result States

The search results page must support at least these states:

- **Known service with attestations.** Display the service with a summary of its trust records and a link to its trust profile page.
- **Known service with no trust records.** Display the service but indicate that no trust records have been published. The UI must not imply the service is untrustworthy — it should present the state as "No trust records found" or equivalent.
- **Unknown service/domain.** Indicate that the query did not match any known service. Offer to let the user submit a review or claim the service.
- **Invalid input.** Display a helpful message if the query cannot be processed.
- **Indexer/API unavailable.** Display an error state indicating the search service is temporarily unavailable.
- **Empty query.** If the user navigates to `/search` without a query, show the search input and optionally suggest popular or recently active services.

### 4.4 Result Display

Each search result should show, at minimum:

- Service or organization name.
- Domain or primary identifier.
- Summary of trust record types available (e.g., "3 reviews, key binding verified, 1 certification").
- Link to the full trust profile or service detail page.

### 4.5 Search Input on Results Page

The search results page should include a search input (pre-filled with the current query) so users can refine their search without returning to the landing page.

## 5. Acceptance Criteria

### 5.1 Landing Page Search Bar

- The landing page displays a search bar above the CTA cards.
- Entering a query and submitting navigates to `/search?q=<query>`.
- The search bar does not display inline results on the landing page.

### 5.2 Search Results Page

- `/search?q=example.com` displays results for the query.
- Known services with attestations show a trust record summary.
- Known services with no records show a neutral "no records" state.
- Unknown queries show a "not found" state without implying the service is bad.
- Invalid input shows a helpful error message.
- API unavailable shows an error state.
- The results page includes a search input for refining the query.

### 5.3 Integration with Landing Page

- The landing page search bar and the search results page search input use the same query parameter (`q`).
- Navigation between the two is seamless.

## 6. Non-Goals and Constraints

- Search does not block the initial portal UI redesign. The landing page ships without the search bar initially.
- Search ranking and relevance tuning are backend concerns and not defined here.
- The search bar is not a replacement for the workflow CTA cards. Both coexist on the landing page.
