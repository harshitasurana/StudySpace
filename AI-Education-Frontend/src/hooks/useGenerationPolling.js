import { useEffect, useRef } from 'react';

// Generalizes the setInterval-based status-polling loop originally
// hand-written in MindMap.jsx for background AI-generation jobs (mind
// map variants, quiz/mock-test/pre-assessment generation, flashcards,
// etc.) — every feature on this pattern needs the same shape: poll a
// status endpoint while a job is still processing, stop once it resolves
// or the thing being watched changes/unmounts.
//
// `active` gates whether polling should be running at all (e.g. false
// once generation_status is already 'completed'/'failed', or there's no
// job to watch yet — pass a stable value like `` `${attemptId}:processing` ``
// if you need the effect to restart when the watched job itself changes).
// `checkStatus` is called every `intervalMs`; its result is handed to
// `isComplete`/`isFailed` to decide which of `onComplete`/`onFailed`
// fires. A transient poll failure (network blip) is swallowed and simply
// retried next tick, same as MindMap.jsx's own poll loop — callers don't
// need to handle that themselves.
const useGenerationPolling = ({ active, checkStatus, isComplete, isFailed, onComplete, onFailed, intervalMs = 5000 }) => {
  const callbacksRef = useRef({ checkStatus, isComplete, isFailed, onComplete, onFailed });
  callbacksRef.current = { checkStatus, isComplete, isFailed, onComplete, onFailed };

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const result = await callbacksRef.current.checkStatus();
        if (cancelled) return;
        if (callbacksRef.current.isComplete(result)) {
          callbacksRef.current.onComplete(result);
        } else if (callbacksRef.current.isFailed(result)) {
          callbacksRef.current.onFailed(result);
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    };

    // setInterval's first tick doesn't fire until intervalMs has
    // elapsed — fine for a job that just started, but it meant reopening
    // an already-completed past set/attempt (see Flashcards.jsx/Quiz.jsx's
    // resumeGenerating) sat idle for a full interval before the one status
    // check it actually needed ever ran, even though that check is just an
    // instant DB read. Check immediately on activation, then fall back to
    // the interval for jobs that are genuinely still processing.
    tick();
    const interval = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs]);
};

export default useGenerationPolling;
