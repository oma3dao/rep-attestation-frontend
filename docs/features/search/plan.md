# Trust Search — plan.md

## 1. Implementation Goal

Add trust search to the OMATrust portal, consisting of a search bar on the main landing page and a dedicated search results page at `/search`.

This feature is planned as a future addition after the initial portal UI redesign ships. The landing page will initially launch without the search bar; when this feature is built, the search bar will be added above the CTA cards.

## 2. Proposed Routes

```txt
/search           -> Search results page
/search?q=<query> -> Search results page with pre-filled query
```

The landing page (`/`) will gain a search bar component but does not need a new route.

## 3. Phase 1 — Landing Page Search Bar

### 3.1 Component

Create a search bar component for the landing page:

```txt
components/home/TrustSearchBar.tsx
```

Suggested component props:

```ts
type TrustSearchBarProps = {
  defaultQuery?: string;
  onSubmit?: (query: string) => void;
};
```

### 3.2 Behavior

On submit, navigate to the search results page:

```ts
router.push(`/search?q=${encodeURIComponent(query)}`);
```

The search bar does not display inline results. It always navigates to `/search`.

### 3.3 Landing Page Integration

Insert the search bar above the workflow CTA cards in the landing page layout:

```txt
1. Trust search bar        <-- new
2. Four workflow CTA cards
3. Latest trust profiles
4. Latest activity preview
```

## 4. Phase 2 — Search Results Page

### 4.1 Page Route

Create the search results page:

```txt
app/search/page.tsx
```

### 4.2 Query Parsing

Read the `q` parameter from the URL:

```ts
const query = searchParams.get('q') ?? '';
```

### 4.3 Results Component

Suggested components:

```txt
components/search/SearchResults.tsx
components/search/SearchResultCard.tsx
components/search/SearchEmptyState.tsx
components/search/SearchErrorState.tsx
```

### 4.4 Result States

Handle the following states:

1. **Results found** — render result cards with service name, identifier, trust record summary, and link to profile.
2. **No results** — render a neutral empty state. Do not imply the service is untrustworthy.
3. **Invalid input** — render a helpful message.
4. **API error** — render an error state with retry option.
5. **Empty query** — render the search input and optionally suggest popular services.

### 4.5 Search Input on Results Page

Include a search input at the top of the results page, pre-filled with the current query, so users can refine without going back to the landing page.

## 5. Phase 3 — Backend Integration

### 5.1 API Endpoint

The search results page will need a backend endpoint or indexer query. Suggested shape:

```ts
type SearchRequest = {
  query: string;
  limit?: number;
  offset?: number;
};

type SearchResult = {
  id: string;
  name: string;
  domain?: string;
  did?: string;
  trustRecordSummary: {
    reviewCount: number;
    hasKeyBinding: boolean;
    hasControllerWitness: boolean;
    hasCertification: boolean;
    hasSecurityAssessment: boolean;
  };
  profileUrl: string;
};

type SearchResponse = {
  results: SearchResult[];
  total: number;
  query: string;
};
```

### 5.2 Placeholder Implementation

If the backend search endpoint is not ready, implement the page with:

- A static placeholder or mock data.
- A clear "search coming soon" state.
- The search input still functional for navigation purposes.

## 6. Testing Plan

### 6.1 Landing Page Search Bar Tests

Test that:

- Search bar renders on the landing page above the CTA cards.
- Entering a query and submitting navigates to `/search?q=<query>`.
- Empty submission is handled gracefully (either prevented or navigates to `/search`).

### 6.2 Search Results Page Tests

Test that:

- `/search?q=example.com` renders the results page with the query.
- Results are displayed when the API returns matches.
- Empty results show a neutral "not found" state.
- API errors show an error state.
- The search input on the results page is pre-filled with the current query.
- Submitting a new query from the results page updates the URL and results.

### 6.3 Integration Tests

Test that:

- Navigating from landing page search bar to results page preserves the query.
- The search bar and results page use the same `q` parameter.

## 7. Risks and Mitigations

### 7.1 Risk: Backend Search Not Ready

Mitigation:

- Build the frontend with a placeholder/mock data mode.
- Do not block the landing page redesign on search availability.

### 7.2 Risk: Query Classification Complexity

Mitigation:

- Send the raw query to the backend and let it handle classification.
- The frontend does not need to distinguish between domains, DIDs, and addresses before submission.
