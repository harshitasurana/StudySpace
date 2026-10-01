// Groups a flat, already-recency-sorted list (My Quizzes / My Flashcards /
// My Mind Maps / My Learning Decks all return their items newest-first)
// into subject sections, without needing a date field at all: a subject's
// position in the result is simply where its first item appeared in the
// incoming list, so "the subject I touched most recently" naturally floats
// to the top. Items within a section keep their original relative order.
export const groupItemsBySubject = (items) => {
  const order = [];
  const groups = new Map();

  for (const item of items) {
    const key = item.subject_id ?? item.subject_name ?? 'unknown';
    if (!groups.has(key)) {
      groups.set(key, { key, subjectName: item.subject_name || 'Other', items: [] });
      order.push(key);
    }
    groups.get(key).items.push(item);
  }

  return order.map((key) => groups.get(key));
};

export default groupItemsBySubject;
