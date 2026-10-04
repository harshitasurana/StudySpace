// Shared by MindMap.jsx and SlideDeck.jsx — both render citations
// resolved server-side by RAGProductionApp's _resolve_node_citation
// (core/tutor_engine.py) and need to route a click to the exact right
// page of the exact right document.
//
// citation.page is 0-indexed (RAG/ingestion convention), but
// ChapterReader.jsx's deep links differ by document: NCERT Notes/
// Solutions are entirely separate PDFs from the raw chapter textbook,
// each with their own 0-indexed page state reachable via
// jumpToNotesPage/jumpToSolutionPage, while the raw PDF's own ?page=
// deep link is 1-indexed. content_type (from the resolved chunk's
// payload) is what tells us which document a citation actually points
// into. Without this, a citation landed on the right chapter but the
// wrong (unrelated) page of the wrong document, every time.
export const navigateToCitation = (navigate, chapterId, citation) => {
  if (!citation || !chapterId) return;
  const page = citation.page;
  if (typeof page !== 'number') {
    navigate(`/read/${chapterId}`);
    return;
  }
  if (citation.content_type === 'ncert_notes') {
    navigate(`/read/${chapterId}?view=notes&page=${page}`);
  } else if (citation.content_type === 'ncert_solution') {
    navigate(`/read/${chapterId}?view=solutions&page=${page}`);
  } else {
    navigate(`/read/${chapterId}?page=${page + 1}`);
  }
};

// citation.page is always 0-indexed regardless of which document it
// points into — the human-readable page number is always +1, whether
// navigateToCitation ends up sending that raw value (notes/solutions) or
// a +1'd value (raw PDF) to get there.
export const citationPageLabel = (citation) =>
  (typeof citation?.page === 'number' ? ` · p. ${citation.page + 1}` : '');
