import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import EducationService from '../../../services/EducationService';
import { navigateToCitation as sharedNavigateToCitation, citationPageLabel } from '../shared/citationNavigation';
import { useFocusMode } from '../../../context/FocusModeContext';

// No Tailwind typography plugin in this app — same explicit component
// styling approach as ChapterReader.jsx's/MyNotes.jsx's markdown
// rendering.
const CHAT_MARKDOWN_COMPONENTS = {
  h2: ({ children }) => <h4 className="font-bold text-body-lg mt-3 mb-1 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="font-bold text-body-md mt-2 mb-1">{children}</h5>,
  p: ({ children }) => <p className="text-body-md mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
};

// Node type -> visual style, using ONLY this app's existing Tailwind
// color tokens (confirmed exact hex values in tailwind.config.js) — no
// new colors introduced. Color communicates the node's TYPE, not
// decoration (per the product spec). Applies at every depth — branches,
// children, and grandchildren are all typed the same way.
const NODE_TYPE_STYLES = {
  concept: { border: 'border-primary', bg: 'bg-primary/5', text: 'text-primary', icon: 'hub' },
  definition: { border: 'border-secondary', bg: 'bg-secondary/5', text: 'text-secondary', icon: 'menu_book' },
  example: { border: 'border-success-mastery', bg: 'bg-success-mastery/5', text: 'text-success-mastery', icon: 'lightbulb' },
  formula: { border: 'border-focus-orange', bg: 'bg-focus-orange/5', text: 'text-focus-orange', icon: 'functions' },
  common_mistake: { border: 'border-risk-red', bg: 'bg-risk-red/5', text: 'text-risk-red', icon: 'warning' },
  related_concept: { border: 'border-border-subtle', bg: 'bg-surface-container', text: 'text-on-surface-variant', icon: 'link' },
};

const RELATIONSHIP_LABELS = {
  causes: 'causes',
  depends_on: 'depends on',
  related_to: 'related to',
  contrasts_with: 'contrasts with',
  part_of: 'part of',
};

// Must match RAGProductionApp's MIND_MAP_LENS_INSTRUCTIONS keys and
// mindmap_service.js's MIND_MAP_VARIANTS exactly — display labels only,
// the ids are what's actually sent/received.
const VARIANT_ORDER = ['concept_overview', 'problem_solving_path', 'compare_contrast', 'building_blocks', 'real_world_applications'];
const VARIANT_LABELS = {
  concept_overview: 'Concept Overview',
  problem_solving_path: 'Problem-Solving Path',
  compare_contrast: 'Compare & Contrast',
  building_blocks: 'Building Blocks',
  real_world_applications: 'Real-World Applications',
};
const DEFAULT_VARIANT = 'concept_overview';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const NODE_WIDTH = 220;
// +20 over Phase 2's 92 for the new description line.
const NODE_HEIGHT = 112;
// Branches with a resolved image get a thumbnail strip on top.
const NODE_HEIGHT_WITH_IMAGE = 192;
const CENTER_NODE_WIDTH = 260;
const CENTER_NODE_HEIGHT = 150;

const nodeDimensions = (type, hasImage) => {
  if (type === 'centerNode') return { width: CENTER_NODE_WIDTH, height: CENTER_NODE_HEIGHT };
  return { width: NODE_WIDTH, height: hasImage ? NODE_HEIGHT_WITH_IMAGE : NODE_HEIGHT };
};

// Fixed-size dagre layout — measuring real DOM node sizes before layout
// runs is the classic dagre+react-flow integration bug (nodes overlap on
// first paint, since dagre needs sizes before anything has actually
// rendered). Every node type gets one fixed size instead, fed straight
// into dagre — a fine trade at this graph's bounded size, and avoids
// that whole class of layout bugs.
function layoutGraph(rawNodes, rawEdges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 90 });

  rawNodes.forEach((n) => {
    const { width, height } = nodeDimensions(n.type, n.data?.hasImage);
    g.setNode(n.id, { width, height });
  });
  rawEdges.forEach((e) => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  return rawNodes.map((n) => {
    const pos = g.node(n.id);
    const { width, height } = nodeDimensions(n.type, n.data?.hasImage);
    return {
      ...n,
      // react-flow only treats a node as "initialized" (a prerequisite
      // for it to draw any edge touching that node) once it has a
      // node.measured.width/height — top-level width/height alone isn't
      // enough. Providing it here means edges render on the very first
      // paint instead of waiting on a ResizeObserver pass (which never
      // fires in a test environment, and is a visible flash/snap in a
      // real browser).
      width,
      height,
      measured: { width, height },
      position: { x: (pos?.x || 0) - width / 2, y: (pos?.y || 0) - height / 2 },
    };
  });
}

// A stable path id is the only way to identify "this exact node" once
// nodes can be nested at arbitrary depth: 'branch-2' -> its 2nd child is
// 'branch-2.child-1' -> that child's 1st child is 'branch-2.child-1.child-0'.
// Only a bare 'branch-N' id maps back to a relationships-eligible branch
// (relationships stay branch-level — see branchIndexFromPathId below).
const branchIndexFromPathId = (pathId) => {
  const match = /^branch-(\d+)$/.exec(pathId || '');
  return match ? Number(match[1]) : null;
};

const flattenDescendantLabels = (node) => {
  const labels = [];
  for (const child of node?.children || []) {
    labels.push(child.label);
    labels.push(...flattenDescendantLabels(child));
  }
  return labels;
};

// --- Custom node components ---

// nodrag/nopan (react-flow's own class-name convention) stop clicks on
// interactive content from also being interpreted as the start of a
// node-drag or canvas-pan gesture — without it, every button inside a
// node fights the canvas for the same mousedown.
const CenterNode = ({ data }) => (
  <div
    className="nodrag nopan rounded-2xl border-2 border-primary bg-primary text-on-primary shadow-lg p-4 flex flex-col items-center gap-2"
    style={{ width: CENTER_NODE_WIDTH }}
  >
    <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    <span className="material-symbols-outlined text-3xl">hub</span>
    <p className="font-bold text-body-lg text-center leading-tight">{data.label}</p>
    <p className="text-xs opacity-80">{data.subjectLabel}</p>
    <div className="flex flex-wrap gap-1.5 justify-center mt-1">
      {data.quickActions.map((qa) => (
        <button
          key={qa.key}
          type="button"
          onClick={(e) => { e.stopPropagation(); qa.onClick(); }}
          title={qa.label}
          className="px-2 py-1 rounded-full bg-on-primary/15 hover:bg-on-primary/25 text-[11px] font-semibold cursor-pointer transition-colors"
        >
          {qa.label}
        </button>
      ))}
    </div>
  </div>
);

// Renders a node at ANY depth (branch, child, or grandchild) — they're
// all typed/cited/expandable the same way now, so one component serves
// every level instead of a separate plain-text component for sub-points.
// `image` is only ever set on branches (see attach_branch_images in
// RAGProductionApp) — children/grandchildren just render without the
// thumbnail block, no special-casing needed here beyond the truthiness
// check.
const ConceptNode = ({ data }) => {
  const style = NODE_TYPE_STYLES[data.type] || NODE_TYPE_STYLES.concept;
  return (
    <div
      onClick={data.onOpenPanel}
      className={`nodrag nopan rounded-xl border-2 ${style.border} ${style.bg} overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition-shadow`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      {data.image?.image_url && (
        <img
          src={data.image.image_url}
          alt={data.image.caption || data.label}
          className="w-full h-20 object-cover"
          loading="lazy"
        />
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`material-symbols-outlined text-[16px] ${style.text}`}>{style.icon}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
            {data.type.replace('_', ' ')}
          </span>
        </div>
        <p className="font-bold text-body-md text-on-surface leading-tight line-clamp-2">{data.label}</p>
        {data.description && (
          <p className="text-[11px] text-on-surface-variant leading-snug line-clamp-2 mt-1">{data.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          {data.childCount > 0 ? (
            <span className="text-[11px] text-on-surface-variant">{data.childCount} sub-topics</span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); data.onExplain(); }}
              title="Explain this concept"
              className="p-1 rounded hover:bg-on-surface/10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">auto_awesome</span>
            </button>
            {data.childCount > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); data.onToggleExpand(); }}
                title={data.expanded ? 'Collapse' : 'Expand'}
                className="p-1 rounded hover:bg-on-surface/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  {data.expanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NODE_TYPES = { centerNode: CenterNode, branchNode: ConceptNode };

const MindMap = () => {
  const { chapterId: routeChapterId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState(routeChapterId ? Number(routeChapterId) : null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [map, setMap] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [mapError, setMapError] = useState('');
  // Shown on the picker screen (mirrors Flashcards.jsx's own "Past Sets"
  // section) so a student can jump straight back into any mind map
  // they've generated before, across every subject/chapter, without
  // needing the separate My Mind Maps page.
  const [pastMindMaps, setPastMindMaps] = useState([]);
  const [loadingPastMindMaps, setLoadingPastMindMaps] = useState(true);
  const { setFocusMode } = useFocusMode();
  const [isFullView, setIsFullView] = useState(false);
  const [bookmarkedNodes, setBookmarkedNodes] = useState(new Set());
  // Path ids (see branchIndexFromPathId) of nodes currently showing
  // their children as child nodes in the graph — works at any depth.
  const [expandedNodeIds, setExpandedNodeIds] = useState(new Set());

  const toggleFullView = useCallback(() => {
    setIsFullView((prev) => {
      const next = !prev;
      setFocusMode(next);
      setTimeout(() => {
        reactFlowRef.current?.fitView({ duration: 300 });
      }, 50);
      return next;
    });
  }, [setFocusMode]);

  // Clean up focus mode on unmount
  useEffect(() => {
    return () => {
      setFocusMode(false);
    };
  }, [setFocusMode]);

  // Listen for Escape key to exit full view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullView) {
        toggleFullView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullView, toggleFullView]);

  // 5 pre-generated variants — which one is currently displayed, and the
  // manifest (variant/status pairs) driving the switcher + polling.
  const [selectedVariant, setSelectedVariant] = useState(DEFAULT_VARIANT);
  const [variantsManifest, setVariantsManifest] = useState([]);
  // Which generation this tab is tracking (several can now exist for the
  // same chapter — see the shared-pool migration). Seeded from ?map=<id>
  // when arriving from MyMindMaps.jsx's "view this one" link — passing it
  // straight through to every generate() call below is what makes that
  // link actually reopen the specific mind map clicked, instead of the
  // shared-pool "give me an unseen one" logic silently substituting a
  // different (or brand new) generation. Also required by
  // getMindMapStatus while polling.
  const [generationGroupId, setGenerationGroupId] = useState(() => searchParams.get('map') || null);
  // Set when we asked for a variant but it wasn't completed yet (still
  // generating elsewhere, e.g. this student's own first request for the
  // chapter is still in flight) — no `map` to show yet, but not an
  // error either; the polling effect fetches it the moment it's ready.
  const [pendingVariant, setPendingVariant] = useState(null);

  // Selected edge (relationship) — "why is this connected" popover.
  const [selectedEdge, setSelectedEdge] = useState(null);

  // "Explore This Concept" contextual panel — modeled directly on
  // ChapterReader.jsx's AI Tutor slide-in drawer (askSliderOpen/
  // askQuestion/chatWithTutor), ported into this page rather than
  // reinventing chat UI. Deliberately session-only (no persisted
  // history load on open) — this is "explore this concept right now,"
  // not "resume this chapter's saved conversation."
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelNode, setPanelNode] = useState(null); // node data, or null for free-form Ask Tutor
  const [panelMessages, setPanelMessages] = useState([]);
  const [panelInput, setPanelInput] = useState('');
  const [panelSending, setPanelSending] = useState(false);
  const panelScrollRef = useRef(null);

  useEffect(() => {
    panelScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [panelMessages, panelSending]);

  const loadPastMindMaps = async () => {
    try {
      const res = await EducationService.listMindMaps();
      setPastMindMaps(res?.data || []);
    } catch {
      // Non-critical — the picker/generate flow works without this.
    } finally {
      setLoadingPastMindMaps(false);
    }
  };

  useEffect(() => {
    loadPastMindMaps();
  }, []);

  // Reopens a specific past generation directly from the picker screen —
  // same shared-pool-bypassing mechanism as arriving via ?map=/&subject=
  // from MyMindMaps.jsx (see generate()'s overrideGroupId/
  // overrideChapterId), just without a navigation round-trip since we're
  // already on this page. Also updates the picker dropdowns to match, so
  // they don't sit showing some other subject/chapter underneath.
  const openPastMindMap = (m) => {
    setSelectedSubjectId(m.subject_id);
    setSelectedChapterId(m.chapter_id);
    generate(DEFAULT_VARIANT, m.generation_group_id, m.chapter_id);
  };

  // Grabbed via <ReactFlow onInit>. The `fitView` boolean prop only
  // auto-fits once, on first mount — switching variants or finishing a
  // fresh generation changes the graph shape afterward, so those need
  // an imperative re-fit to get a smooth camera move instead of staying
  // framed on the previous (now wrong) layout.
  const reactFlowRef = useRef(null);
  useEffect(() => {
    if (map) reactFlowRef.current?.fitView({ duration: 500 });
  }, [map]);

  // Switching chapter/subject invalidates whatever's displayed — a
  // stale map's citations would point at the wrong chapter. Doesn't
  // touch generationGroupId on the very first run (mount) — that's what
  // lets the initial state above seed it from ?map=<id> without this
  // immediately wiping it out; a genuine later chapter switch always
  // clears it, since a ?map= id from the URL belongs to whichever
  // chapter the page originally loaded with, not wherever the student
  // navigates to next.
  const isFirstChapterEffect = useRef(true);
  useEffect(() => {
    setMap(null);
    setVariantsManifest([]);
    setSelectedVariant(DEFAULT_VARIANT);
    setPendingVariant(null);
    setBookmarkedNodes(new Set());
    setExpandedNodeIds(new Set());
    setSelectedEdge(null);
    if (isFirstChapterEffect.current) {
      isFirstChapterEffect.current = false;
    } else {
      setGenerationGroupId(null);
    }
  }, [selectedChapterId]);

  // Deep link from MyMindMaps.jsx ("view this one") — auto-load instead
  // of making the student click "Generate Mind Map" again for content
  // that already exists.
  useEffect(() => {
    if (searchParams.get('map') && selectedChapterId) {
      generate(DEFAULT_VARIANT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBookmarkNode = async (node, pathId) => {
    if (!selectedChapterId || !pathId || bookmarkedNodes.has(pathId)) return;
    setBookmarkedNodes((prev) => new Set(prev).add(pathId)); // optimistic
    try {
      const points = flattenDescendantLabels(node).join('; ');
      await EducationService.createBookmark({
        chapterId: selectedChapterId,
        sourceType: 'concept',
        title: node.label,
        content: points ? `${node.label}: ${points}` : node.label,
      });
    } catch {
      setBookmarkedNodes((prev) => { const next = new Set(prev); next.delete(pathId); return next; });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getMyProfile();
        if (cancelled) return;
        const profileSubjects = (res?.data?.subjects || []).map((s) => ({ id: s.subject_id, label: s.name }));
        setSubjects(profileSubjects);
        const requestedSubject = Number(searchParams.get('subject'));
        const initialSubject = profileSubjects.find((s) => s.id === requestedSubject) || profileSubjects[0];
        if (initialSubject) setSelectedSubjectId(initialSubject.id);
      } catch {
        if (!cancelled) setMetaError("Couldn't load your subjects. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await EducationService.getChapters(selectedSubjectId);
        if (cancelled) return;
        const list = res?.data || [];
        setChapters(list);
        const stillValid = selectedChapterId && list.some((c) => c.chapter_id === selectedChapterId);
        if (!stillValid) setSelectedChapterId(list.length > 0 ? list[0].chapter_id : null);
      } catch {
        if (!cancelled) setMetaError("Couldn't load chapters for this subject.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId]);

  // overrideGroupId/overrideChapterId let a caller (Past Mind Maps below)
  // reopen a SPECIFIC past generation — for a chapter that may not be
  // the currently-selected one — in one call, passing both straight to
  // the API rather than through state, since a just-called setState
  // wouldn't be visible to this same function invocation yet.
  const generate = async (variant = DEFAULT_VARIANT, overrideGroupId, overrideChapterId) => {
    const chapterId = overrideChapterId ?? selectedChapterId;
    if (!chapterId) return;
    setGenerating(true);
    setMapError('');
    try {
      // Passing the currently-tracked generationGroupId (once set, whether
      // seeded from ?map= or from an earlier call this session) is what
      // keeps every subsequent call — including plain variant switches —
      // pinned to the SAME generation, instead of the shared pool's "give
      // me an unseen one" logic reshuffling to a different one mid-session.
      const res = await EducationService.generateMindMap(chapterId, variant, overrideGroupId ?? generationGroupId);
      const data = res?.data;
      setVariantsManifest(data?.variants || []);
      if (data?.generation_group_id) setGenerationGroupId(data.generation_group_id);
      if (data?.status === 'completed') {
        setMap(data);
        setSelectedVariant(data.variant || variant);
        setPendingVariant(null);
        setBookmarkedNodes(new Set());
        setExpandedNodeIds(new Set());
        setSelectedEdge(null);
        loadPastMindMaps();
      } else {
        // Not an error — this variant's generation is already running
        // (e.g. this student's own first-ever request for this chapter
        // is still in flight from a moment ago). The polling effect
        // below notices once it completes and fetches it automatically.
        setSelectedVariant(data?.variant || variant);
        setPendingVariant(data?.variant || variant);
      }
    } catch (err) {
      setMapError("Couldn't generate a mind map right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Poll the lightweight status endpoint while any variant isn't done
  // yet — including "failed": the backend self-heals a failed row too
  // (a real, confirmed failure mode is transient overload on the shared
  // local Ollama instance, not a permanent problem), retrying it a few
  // minutes after it last updated. Without also polling through
  // "failed", a student already looking at an all-failed page would
  // never see it recover on its own — the backend's retry has nothing
  // to report it to. Keeps the switcher's tabs (and pendingVariant, for
  // whichever variant has no `map` to show yet at all) moving from
  // "stuck" to ready without the student needing to refresh or re-click.
  useEffect(() => {
    if (!selectedChapterId || !generationGroupId) return undefined;
    const anyUnsettled = variantsManifest.some((v) => v.status !== 'completed');
    if (!anyUnsettled) return undefined;
    const interval = setInterval(async () => {
      try {
        const res = await EducationService.getMindMapStatus(selectedChapterId, generationGroupId);
        const variants = res?.data?.variants || [];
        setVariantsManifest(variants);
        if (pendingVariant) {
          const entry = variants.find((v) => v.variant === pendingVariant);
          if (entry?.status === 'completed') {
            setPendingVariant(null);
            generate(pendingVariant);
          }
          // Deliberately no "give up" branch on entry?.status === 'failed'
          // — keep waiting and polling; the backend's own retry (see
          // recoverStuckRows in mindmap_service.js) will eventually flip
          // it to completed as long as this tab keeps polling.
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    }, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId, generationGroupId, variantsManifest, pendingVariant]);

  const toggleNodeExpand = (pathId) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(pathId)) next.delete(pathId); else next.add(pathId);
      return next;
    });
  };

  // Citation-navigation — see shared/citationNavigation.js for why this
  // routing exists (content_type-based document resolution) and for
  // citationPageLabel, imported above. Shared with SlideDeck.jsx now
  // that two pages need the identical fix.
  const navigateToCitation = useCallback(
    (citation) => sharedNavigateToCitation(navigate, selectedChapterId, citation),
    [navigate, selectedChapterId]
  );

  const openPanel = (node, pathId) => {
    setPanelNode(node ? { ...node, _pathId: pathId } : null);
    setPanelMessages([]);
    setPanelInput('');
    setPanelOpen(true);
  };
  const closePanel = () => setPanelOpen(false);

  const sendPanelQuestion = (question) => {
    const trimmed = question.trim();
    if (!trimmed || panelSending || !selectedChapterId) return;
    setPanelMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setPanelSending(true);
    EducationService.chatWithTutor(selectedChapterId, trimmed)
      .then((res) => {
        const data = res?.data || {};
        setPanelMessages((prev) => [...prev, { role: 'assistant', content: data.answer || '' }]);
      })
      .catch(() => {
        setPanelMessages((prev) => [...prev, { role: 'assistant', content: "I couldn't get an answer just now. Please try again." }]);
      })
      .finally(() => setPanelSending(false));
  };

  const explainNode = (node, pathId) => {
    openPanel(node, pathId);
    // Deferred so the panel's own state (cleared by openPanel) has
    // settled before the first message is appended.
    setTimeout(() => sendPanelQuestion(`Can you explain ${node.label} in simple terms?`), 0);
  };

  const chapterName = map?.chapter_name || chapters.find((c) => c.chapter_id === selectedChapterId)?.name || '';
  const subjectLabel = subjects.find((s) => s.id === selectedSubjectId)?.label || '';

  const quickActions = useMemo(() => ([
    { key: 'read', label: 'Read Chapter', onClick: () => selectedChapterId && navigate(`/read/${selectedChapterId}`) },
    { key: 'practice', label: 'Practice', onClick: () => selectedChapterId && navigate(`/pre-assessment/${selectedChapterId}`) },
    { key: 'revise', label: 'Flashcards', onClick: () => selectedChapterId && navigate(`/flashcards/${selectedChapterId}`) },
    { key: 'ask', label: 'Ask Tutor', onClick: () => openPanel(null) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [selectedChapterId, navigate]);

  // Builds react-flow nodes/edges from the real generated map, walking
  // `children` recursively to any depth (branch -> child -> grandchild
  // -> ...), then lays them out with dagre. Only currently-expanded
  // nodes materialize their children as graph nodes.
  const { nodes, edges } = useMemo(() => {
    if (!map) return { nodes: [], edges: [] };
    const branches = map.branches || [];
    const relationships = map.relationships || [];

    const rawNodes = [
      {
        id: 'center',
        type: 'centerNode',
        data: { label: map.central_topic, subjectLabel, quickActions },
        position: { x: 0, y: 0 },
      },
    ];
    const rawEdges = [];

    const walk = (node, nodeId, parentId) => {
      const children = node.children || [];
      const expanded = expandedNodeIds.has(nodeId);
      rawNodes.push({
        id: nodeId,
        type: 'branchNode',
        data: {
          label: node.label,
          type: node.type || 'concept',
          description: node.description || '',
          image: node.image || null,
          hasImage: Boolean(node.image?.image_url),
          childCount: children.length,
          expanded,
          onOpenPanel: () => openPanel(node, nodeId),
          onExplain: () => explainNode(node, nodeId),
          onToggleExpand: () => toggleNodeExpand(nodeId),
        },
        position: { x: 0, y: 0 },
      });
      rawEdges.push({
        id: `e-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep',
        style: { stroke: parentId === 'center' ? '#94A3B8' : '#CBD5E1' },
      });

      if (expanded) {
        children.forEach((child, idx) => walk(child, `${nodeId}.child-${idx}`, nodeId));
      }
    };

    branches.forEach((branch, arrIdx) => walk(branch, `branch-${arrIdx + 1}`, 'center'));

    relationships.forEach((rel, rIdx) => {
      const fromId = `branch-${rel.from_branch_index}`;
      const toId = `branch-${rel.to_branch_index}`;
      rawEdges.push({
        id: `rel-${rIdx}`,
        source: fromId,
        target: toId,
        type: 'default',
        // The flowing-dash animation (react-flow's own built-in style)
        // also helps visually separate "why connected" edges from plain
        // structural ones, which otherwise only differ by dash pattern.
        animated: true,
        label: RELATIONSHIP_LABELS[rel.relationship] || rel.relationship,
        labelStyle: { fontSize: 10, fontWeight: 700, fill: '#283593' },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
        style: { stroke: '#283593', strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#283593' },
        data: { isRelationship: true, relationship: rel.relationship, reason: rel.reason, citation: rel.citation },
      });
    });

    return { nodes: layoutGraph(rawNodes, rawEdges), edges: rawEdges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, expandedNodeIds, subjectLabel, quickActions]);

  const onEdgeClick = useCallback((_event, edge) => {
    if (edge.data?.isRelationship) {
      setSelectedEdge(edge);
    }
  }, []);

  const panelBranchIndex = branchIndexFromPathId(panelNode?._pathId);

  // Scoped to the currently-picked chapter — showing every subject's
  // past mind maps here (matching Flashcards.jsx's cross-chapter "Past
  // Sets") was confusing right under a chapter-specific picker/Generate
  // button, so this list is deliberately narrower than pastMindMaps.
  const chapterPastMindMaps = pastMindMaps.filter((m) => m.chapter_id === selectedChapterId);

  return (
    <main className="flex-grow py-6 px-3 sm:px-6 bg-[#F7F3EA] dark:bg-[#0b1324] min-h-[calc(100vh-72px)]">
      <div className="w-full space-y-6">
        
        {/* Top Hero Banner - Concept Map / Mind Map */}
        <div className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start gap-4 z-10 max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/25">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Concept Map</h1>
              <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
                A grounded, explorable breakdown of a chapter's key concepts.
              </p>
            </div>
          </div>

          <div className="relative w-72 h-36 shrink-0 flex items-center justify-center z-10">
            <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-300/40 animate-pulse">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7zM9 21a1 1 0 001 1h4a1 1 0 001-1v-1H9v1z" />
              </svg>
            </div>
            <span className="absolute left-2 top-2 px-2.5 py-1 bg-purple-100 text-purple-700 font-bold text-xs rounded-full shadow-xs border border-purple-200/60">Ideas</span>
            <span className="absolute right-2 top-3 px-2.5 py-1 bg-teal-100 text-teal-700 font-bold text-xs rounded-full shadow-xs border border-teal-200/60">Concepts</span>
            <span className="absolute left-0 bottom-4 px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-xs rounded-full shadow-xs border border-blue-200/60">Connections</span>
            <span className="absolute right-0 bottom-4 px-2.5 py-1 bg-amber-100 text-amber-700 font-bold text-xs rounded-full shadow-xs border border-amber-200/60">Understand</span>
          </div>
        </div>

        {loadingMeta ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-4xl text-indigo-600">progress_activity</span>
          </div>
        ) : metaError ? (
          <div className="bg-white rounded-2xl p-6 text-center text-slate-500 border border-slate-100">{metaError}</div>
        ) : (
          <>
            {/* Selection & Controls Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Subject</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    value={selectedSubjectId || ''}
                    onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-7 space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Select Chapter / Topic</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-60"
                    value={selectedChapterId || ''}
                    onChange={(e) => setSelectedChapterId(Number(e.target.value))}
                    disabled={chapters.length === 0}
                  >
                    {chapters.map((c) => (
                      <option key={c.chapter_id} value={c.chapter_id}>
                        {c.chapter_order ? `Chapter ${c.chapter_order}: ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {mapError && <p className="text-red-600 text-sm font-medium">{mapError}</p>}

              {!map ? (
                pendingVariant ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-slate-500 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <span className="material-symbols-outlined animate-spin text-xl text-indigo-600">progress_activity</span>
                    Still generating this mind map — this can take a minute the first time. It'll appear automatically.
                  </div>
                ) : (
                  <button
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                    onClick={() => generate(DEFAULT_VARIANT)}
                    disabled={generating || !selectedChapterId}
                  >
                    {generating ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        Generating mind map…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate Mind Map →
                      </>
                    )}
                  </button>
                )
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {VARIANT_ORDER.map((variantId) => {
                      const status = variantsManifest.find((v) => v.variant === variantId)?.status || 'pending';
                      const isSelected = selectedVariant === variantId;
                      const isReady = status === 'completed';
                      return (
                        <button
                          key={variantId}
                          type="button"
                          disabled={!isReady || generating}
                          onClick={() => generate(variantId)}
                          title={status === 'processing' ? 'Still generating this view…' : status === 'failed' ? "Couldn't generate this view" : undefined}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-md font-semibold transition-colors cursor-pointer disabled:cursor-default ${
                            isSelected
                              ? 'bg-primary text-on-primary'
                              : isReady
                                ? 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                                : 'bg-surface-container-lowest text-on-surface-variant/60'
                          }`}
                        >
                          {VARIANT_LABELS[variantId]}
                          {status === 'processing' && (
                            <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                          )}
                          {status === 'failed' && (
                            <span className="material-symbols-outlined text-[14px] text-error">error</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={toggleFullView}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-label-md font-semibold transition-colors cursor-pointer shrink-0"
                    title="Open distraction-free full screen view"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isFullView ? 'close_fullscreen' : 'open_in_full'}
                    </span>
                    {isFullView ? 'Exit Full View' : 'Full View'}
                  </button>
                </div>
              )}

            </div>

            {!map && !loadingPastMindMaps && chapterPastMindMaps.length > 0 && (
              <div className="glass-card rounded-xl p-6 space-y-3">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Past Mind Maps for This Chapter</h2>
                <div className="divide-y divide-border-subtle">
                  {chapterPastMindMaps.slice(0, 10).map((m, idx) =>
                    m.status === 'processing' || m.status === 'pending' ? (
                      <button
                        key={m.generation_group_id}
                        onClick={() => openPastMindMap(m)}
                        className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                      >
                        <p className="text-label-md text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                          Generating… ({formatDate(m.created_at)})
                        </p>
                        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                      </button>
                    ) : m.status === 'failed' ? (
                      <div key={m.generation_group_id} className="flex justify-between items-center py-3">
                        <p className="text-label-md text-error">Generation failed ({formatDate(m.created_at)})</p>
                      </div>
                    ) : (
                      <button
                        key={m.generation_group_id}
                        onClick={() => openPastMindMap(m)}
                        className="w-full flex justify-between items-center py-3 text-left cursor-pointer hover:bg-surface-container-low rounded-lg px-2 -mx-2"
                      >
                        <p className="font-bold text-on-surface">
                          Version {chapterPastMindMaps.length - idx} · {formatDate(m.created_at)}
                        </p>
                        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {map && (
              isFullView ? (
                <div className="fixed inset-0 z-50 bg-background dark:bg-[#0b1324] flex flex-col w-screen h-screen overflow-hidden animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle dark:border-[#2e3f5f] bg-surface-container-low/90 dark:bg-[#101a2c]/90 backdrop-blur-md shrink-0 z-20">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleFullView}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                        title="Exit Full View (Esc)"
                      >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-body-md text-on-surface leading-tight">
                            {map?.central_topic || chapterName || 'Mind Map'}
                          </h2>
                          {subjectLabel && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wide">
                              {subjectLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-on-surface-variant">Full Screen View · Press Esc to exit</p>
                      </div>
                    </div>

                    <div className="hidden md:flex flex-wrap items-center gap-1.5">
                      {VARIANT_ORDER.map((variantId) => {
                        const status = variantsManifest.find((v) => v.variant === variantId)?.status || 'pending';
                        const isSelected = selectedVariant === variantId;
                        const isReady = status === 'completed';
                        return (
                          <button
                            key={variantId}
                            type="button"
                            disabled={!isReady || generating}
                            onClick={() => generate(variantId)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer disabled:cursor-default ${
                              isSelected
                                ? 'bg-primary text-on-primary'
                                : isReady
                                  ? 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                                  : 'bg-surface-container-lowest text-on-surface-variant/60'
                            }`}
                          >
                            {VARIANT_LABELS[variantId]}
                            {status === 'processing' && (
                              <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={toggleFullView}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">close_fullscreen</span>
                      Exit Full View
                    </button>
                  </div>

                  <div className="flex-1 w-full h-full relative">
                    <ReactFlowProvider>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={NODE_TYPES}
                        onEdgeClick={onEdgeClick}
                        onInit={(instance) => { reactFlowRef.current = instance; }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        fitView
                        proOptions={{ hideAttribution: true }}
                      >
                        <Background />
                        <Controls showInteractive={false} />
                      </ReactFlow>
                    </ReactFlowProvider>
                  </div>
                </div>
              ) : (
                <div className="glass-card rounded-xl overflow-hidden relative" style={{ height: '70vh' }}>
                  <button
                    type="button"
                    onClick={toggleFullView}
                    className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest/90 dark:bg-[#152238]/90 text-on-surface hover:text-primary shadow-xs border border-border-subtle dark:border-[#2e3f5f] text-xs font-semibold backdrop-blur-sm cursor-pointer transition-colors"
                    title="Enter Full View"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_full</span>
                    Full View
                  </button>
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={NODE_TYPES}
                      onEdgeClick={onEdgeClick}
                      onInit={(instance) => { reactFlowRef.current = instance; }}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      fitView
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
              )
            )}

          </>
        )}
      </div>

      {/* "Why is this connected?" relationship popover */}
      {selectedEdge && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedEdge(null)}>
          <div className="bg-white dark:bg-[#152238] rounded-xl shadow-lg w-full max-w-md p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-sm text-primary uppercase tracking-wide">
              {RELATIONSHIP_LABELS[selectedEdge.data.relationship] || selectedEdge.data.relationship}
            </p>
            <p className="text-body-md text-on-surface">{selectedEdge.data.reason}</p>
            {selectedEdge.data.citation && (
              <button
                onClick={() => { navigateToCitation(selectedEdge.data.citation); setSelectedEdge(null); }}
                className="flex items-center gap-1.5 text-label-md text-primary underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">menu_book</span>
                Source: {selectedEdge.data.citation.chapter || 'chapter'}
                {citationPageLabel(selectedEdge.data.citation)}
              </button>
            )}
            <div className="flex justify-end">
              <button onClick={() => setSelectedEdge(null)} className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Explore This Concept" contextual panel — modeled on
          ChapterReader.jsx's AI Tutor drawer. panelNode is the clicked
          node's data (any depth), or null when opened via the center
          node's "Ask Tutor" quick action, for a free-form question. */}
      {panelOpen && (
        <>
          <div
            className={`sm:hidden fixed inset-x-0 bottom-0 ${isFullView ? 'top-0 z-[65]' : 'top-[72px] z-40'} bg-black/40 animate-fade-in`}
            onClick={closePanel}
            aria-hidden="true"
          />
          <div className={`fixed right-0 bottom-0 ${isFullView ? 'top-0 z-[70]' : 'top-[72px] z-50'} w-full sm:w-[420px] bg-white dark:bg-[#152238] border-l border-border-subtle dark:border-[#2e3f5f] shadow-[-12px_0_35px_rgba(0,0,0,0.12)] dark:shadow-[-12px_0_35px_rgba(0,0,0,0.5)] flex flex-col animate-fade-in`}>

            <div className="flex items-center justify-between p-4 border-b border-border-subtle dark:border-[#2e3f5f] shrink-0 bg-surface-container-low/40 dark:bg-[#101a2c]">
              <div className="min-w-0">
                <span className="font-bold text-sm text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  {panelNode ? panelNode.label : 'Ask Tutor'}
                </span>
                <p className="text-label-md text-on-surface-variant truncate">{chapterName}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close panel"
                className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error/10 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {panelNode && (
              <div className="p-4 border-b border-border-subtle dark:border-[#2e3f5f] space-y-2 shrink-0">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${(NODE_TYPE_STYLES[panelNode.type] || NODE_TYPE_STYLES.concept).text}`}>
                  {panelNode.type?.replace('_', ' ') || 'concept'}
                </span>
                {panelNode.description && (
                  <p className="text-body-md text-on-surface leading-snug">{panelNode.description}</p>
                )}
                <ul className="space-y-1.5">
                  {(panelNode.children || []).map((child, i) => (
                    <li key={i} className="flex items-start gap-2 text-body-md text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-current mt-2 shrink-0 text-on-surface-variant"></span>
                      {child.label}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 pt-1">
                  {panelNode.citation && (
                    <button
                      onClick={() => navigateToCitation(panelNode.citation)}
                      title="Read this in the source chapter"
                      className="flex items-center gap-1.5 text-label-md text-primary underline cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">menu_book</span>
                      Open Textbook
                    </button>
                  )}
                  <button
                    onClick={() => handleBookmarkNode(panelNode, panelNode._pathId)}
                    disabled={bookmarkedNodes.has(panelNode._pathId)}
                    title="Bookmark this concept"
                    className="flex items-center gap-1.5 text-label-md text-primary disabled:text-on-surface-variant disabled:no-underline underline cursor-pointer disabled:cursor-default"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {bookmarkedNodes.has(panelNode._pathId) ? 'bookmark' : 'bookmark_border'}
                    </span>
                    {bookmarkedNodes.has(panelNode._pathId) ? 'Bookmarked' : 'Bookmark'}
                  </button>
                </div>
              </div>
            )}

            {/* Connected concepts — the same data driving the graph's
                relationship edges, surfaced here too since a thin graph
                edge is a genuinely hard click target (mouse precision,
                touch, screen readers). Branch-level only — relationships
                don't extend to children/grandchildren. */}
            {panelNode && panelBranchIndex !== null && (map?.relationships || []).some(
              (rel) => rel.from_branch_index === panelBranchIndex || rel.to_branch_index === panelBranchIndex
            ) && (
              <div className="p-4 border-b border-border-subtle dark:border-[#2e3f5f] space-y-2 shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Connected concepts</p>
                <ul className="space-y-2">
                  {map.relationships
                    .map((rel, rIdx) => ({ rel, rIdx }))
                    .filter(({ rel }) => rel.from_branch_index === panelBranchIndex || rel.to_branch_index === panelBranchIndex)
                    .map(({ rel, rIdx }) => {
                      const otherIdx = rel.from_branch_index === panelBranchIndex ? rel.to_branch_index : rel.from_branch_index;
                      const otherBranch = map.branches?.[otherIdx - 1];
                      if (!otherBranch) return null;
                      return (
                        <li key={rIdx}>
                          <button
                            type="button"
                            onClick={() => setSelectedEdge({ id: `rel-${rIdx}`, data: rel })}
                            className="w-full text-left rounded-lg border border-border-subtle dark:border-[#2e3f5f] p-2.5 hover:bg-surface-container-low cursor-pointer"
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                              {RELATIONSHIP_LABELS[rel.relationship] || rel.relationship}
                            </p>
                            <p className="text-body-md text-on-surface">{otherBranch.label}</p>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {panelMessages.length === 0 ? (
                <p className="text-body-md text-on-surface-variant text-center py-8">
                  {panelNode ? `Ask anything about "${panelNode.label}".` : 'Ask anything about this chapter.'}
                </p>
              ) : (
                panelMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%]">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant mb-0.5 px-1">
                        {msg.role === 'user' ? 'You asked' : 'AI Tutor'}
                      </p>
                      <div
                        className={`rounded-xl px-3 py-2 text-body-md ${
                          msg.role === 'user'
                            ? 'whitespace-pre-wrap bg-primary text-on-primary'
                            : 'bg-surface-container-high text-on-surface border border-border-subtle dark:border-[#2e3f5f]'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <ReactMarkdown components={CHAT_MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {panelSending && (
                <div className="flex justify-start">
                  <div className="bg-surface-container-high border border-border-subtle dark:border-[#2e3f5f] rounded-xl px-4 py-3 flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></span>
                    ))}
                  </div>
                </div>
              )}
              <div ref={panelScrollRef} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); const t = panelInput.trim(); if (!t) return; setPanelInput(''); sendPanelQuestion(t); }}
              className="p-3 border-t border-border-subtle dark:border-[#2e3f5f] flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={panelInput}
                onChange={(e) => setPanelInput(e.target.value)}
                placeholder="Ask about this concept…"
                disabled={panelSending}
                className="flex-1 rounded-full border border-border-subtle dark:border-[#2e3f5f] bg-surface-container-lowest dark:bg-[#1e2d4a] px-4 py-2 text-sm text-on-surface dark:text-[#f1f5f9] disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={panelSending || !panelInput.trim()}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </div>
        </>
      )}
    </main>
  );
};

export default MindMap;
