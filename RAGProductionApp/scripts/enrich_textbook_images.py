"""
scripts/enrich_textbook_images.py

Sprint 15 — Educational Visual Enrichment Pipeline.
Sprint 15.1 — Pipeline Foundation.
Sprint 15.2 — Discover Accepted Visuals.
Sprint 15.3 — Metadata Loading.

A second, standalone pipeline that runs *after* ingestion
(scripts/ingest_textbook_images.py) has already finished a chapter.
Where ingestion's job is "get every accepted visual, its image, and
its base metadata into local storage/Qdrant", this pipeline's job is
"take what's already there and make it educationally useful":

    Read Accepted Visual Metadata (local storage)
     |
     v
    Download Image (local storage)
     |
     v
    Analyze with Qwen Vision
     |
     v
    Generate Educational Metadata
     |
     v
    Update Metadata JSON (local storage)
     |
     v
    Update Existing Qdrant Payload

This module must never perform ingestion — no PDF is ever opened here,
no OCR/extraction/caption/validation logic is duplicated or
re-implemented, and nothing about scripts/ingest_textbook_images.py is
imported or invoked. The only thing this pipeline reads from that
world is what ingestion already wrote to local storage: the per-visual
metadata JSON Sprint 14.5 introduced (page_<NNN>/<filename>.json,
"asset_type": "visual_asset", with empty "education" / "retrieval" /
"visual_analysis" / "assessment" sections reserved for this pipeline
to fill in — see ingest_textbook_images.py's MetadataBuilder for where
that JSON is written).

Sprint 15.1 scope — everything in this file today:
    - CLI arguments (subject / chapter / page filters, --force,
      --dry-run, --log-level)
    - logging
    - configuration loading (env-driven, same convention as
      ingest_textbook_images.py)
    - local storage initialization (fail-fast — this pipeline cannot
      do anything without it)
    - Qdrant initialization (best-effort — not queried or written to
      yet this sprint)
    - Ollama/Qwen initialization (best-effort — no image is analyzed
      yet this sprint)
    - discovering every accepted visual asset's metadata JSON in
      local storage, matching it against the given filters, and
      reporting how many were found

Sprint 15.2 scope — added in this file today:
    - for every matched visual, resolving the local storage object_key
      its metadata recorded for its own image (Sprint 14.5's
      storage.object_key) and confirming that image object actually
      exists in local storage — a visual whose metadata survived but
      whose image was never uploaded, or was since deleted, is skipped
      rather than passed on to Qwen with nothing to download
    - skipping visuals that already have educational metadata
      ("education" section non-empty) unless --force is given — this
      is where --force first changes discovery's output rather than
      just being logged
    - VisualAsset: the lightweight unit of work (image_path /
      metadata_path — the two local storage keys) that Sprint 15.3's
      processing loop iterates over, instead of the raw
      VisualAssetRecord

Sprint 15.3 scope — added in this file today:
    - structuring and validating each VisualAsset's already-downloaded
      metadata (asset.record.data — no second local storage read) into a typed
      VisualMetadata object: subject/chapter/page/storage/ocr/visual,
      matching the schema _build_visual_asset_metadata in
      ingest_textbook_images.py writes
    - rejecting (and skipping, never crashing the batch on) any visual
      missing a field enrichment cannot proceed without — this is
      "load and validate", nothing about a visual's actual content is
      interpreted or generated yet
    - "education"/"retrieval"/"visual_analysis"/"assessment" are
      carried through unread on VisualMetadata.raw for Sprint 15.4+ to
      fill in and write back — this sprint does not touch them

Sprint 15.4 scope — added in this file today:
    - for every VisualMetadata Sprint 15.3 loaded, downloading its own
      image bytes from local storage (storage.bucket/storage.object_key —
      already validated to exist by discover_accepted_visuals) via
      storage.download_object(), and decoding them into a PIL.Image
      (bytes -> BytesIO -> PIL.Image.open()) so the rest of the
      pipeline never touches raw bytes or local storage again
    - validating the download itself: the object's bytes are
      non-empty, PIL can actually open them as an image, and the
      decoded image has real (>0 x >0) dimensions — a truncated or
      corrupt object is caught here, not two stages later inside Qwen
    - never raising out of a single visual's download/decode — same
      resilience posture as Sprint 15.1's _load_visual_asset and
      Sprint 15.3's load_visual_metadata_batch: one bad image is
      logged and skipped, the rest of the batch continues
    - EnrichmentVisual: pairs the decoded PIL.Image with its
      VisualMetadata, the unit of work Sprint 15.5's Qwen analysis
      reads from — no educational analysis happens yet

Sprint 15.5 scope — added in this file today:
    - for every EnrichmentVisual Sprint 15.4 produced, building the
      grounded multimodal prompt Sprint 15.6's Qwen Vision call will
      actually send — this sprint only builds the prompt text, it
      does not call Qwen, parse a response, or write anything back
    - the prompt casts Qwen as an experienced Class 9 textbook
      teacher, not an image captioning model: it must identify the
      scientific/mathematical concept(s) the visual teaches, ground
      everything in what's actually visible plus the supplied
      subject/chapter/caption/OCR/visual-type/reference-number
      context, explicitly refuse to invent anything not evidenced by
      the image or that context, and explain at a level a Class 9
      student can follow
    - the prompt also defines the exact JSON schema Qwen must reply
      with (mapping onto the "education" / "visual_analysis" /
      "retrieval" / "assessment" sections Sprint 14.5 left empty in
      each visual's metadata) and forbids markdown, prose, or any
      text outside that single JSON object — Sprint 15.6 is what will
      actually parse that reply
    - PromptPackage: pairs the same PIL.Image Sprint 15.6 will send
      with the finished prompt string, the unit of work Sprint 15.6's
      Qwen call reads from

Sprint 15.6 scope — added in this file today:
    - actually calling Qwen Vision with each PromptPackage Sprint 15.5
      built (image + prompt, via Ollama's /api/chat, "format": "json"
      — same request shape ingest_textbook_images.py's
      OllamaQwenBackend already uses for validation, so this pipeline
      talks to Ollama exactly one way) and parsing its reply back into
      a plain dict
    - the response schema Qwen is instructed to fill in
      (_RESPONSE_JSON_SCHEMA) now matches this sprint's four sections
      exactly: education (grounded_description, student_explanation,
      teaches, curriculum_topics, learning_objectives), retrieval
      (retrieval_keywords, student_search_examples, answerable_queries,
      useful_for_questions), visual_analysis (visible_entities,
      concept_relationships, visual_role, pedagogical_value,
      grounding_confidence), and assessment (misconceptions,
      practice_questions, difficulty) — every field grounded in what's
      actually visible plus the CONTEXT block, nothing invented
    - generate_educational_metadata / generate_educational_metadata_batch:
      Sprint 15.6's entry points, returning the raw JSON dict Qwen
      replied with for each visual, exactly as received — no
      renaming, defaulting, reshaping, or schema validation happens
      here, and nothing is written back into a visual's metadata JSON
      or its Qdrant payload yet
    - one bad Qwen call or unparseable reply is logged and skipped,
      never allowed to crash the batch — same resilience posture as
      every earlier stage in this file

Sprint 15.7 scope — added in this file today:
    - LLMs are inconsistent: Qwen's raw JSON reply (EnrichedVisual.
      education_data, exactly as Sprint 15.6 parsed it — untyped,
      unvalidated, occasionally the wrong shape) is converted here into
      a single stable internal schema, NormalizedMetadata, that every
      later stage can rely on without re-checking types
    - strings are trimmed, stripped of markdown formatting, and turned
      into None (dropped) if empty after cleaning
    - arrays tolerate None (-> []), a bare string (split on commas),
      or a list with junk in it (each item cleaned the same way
      strings are, duplicates removed case-insensitively)
    - numbers — currently just grounding_confidence — accept a float,
      an int, a numeric string ("0.91"), a percentage string ("91%"),
      or one of the "high"/"medium"/"low" words Qwen was actually
      asked for, and are always clamped into [0.0, 1.0]
    - every field Qwen omitted, mistyped, or invented gets its
      section's documented default (e.g. "curriculum_topics": []
      rather than None) instead of that field going missing or this
      stage raising — normalization never fails a visual, it only
      produces a fully-populated NormalizedMetadata for it
    - keys not in _RESPONSE_JSON_SCHEMA (typos, extra commentary
      fields, anything Qwen invented) are silently ignored rather than
      carried through
    - NormalizedVisual / normalize_enriched_visual_batch: pairs each
      EnrichedVisual with its NormalizedMetadata, the unit of work
      Sprint 15.8's grounding validation reads from

Sprint 15.8 scope — added in this file today:
    - grounding validation: deciding whether a NormalizedMetadata is
      educationally *reliable*, not just well-typed — normalization
      (Sprint 15.7) guarantees shape, this stage checks trustworthiness
    - required-field rules: grounded_description and
      student_explanation must both be non-empty, education.teaches
      must name at least one teaching concept, and
      visual_analysis.grounding_confidence must exceed a configurable
      threshold (default 0.60)
    - OCR consistency: the generated description must not name a
      concrete term (e.g. a shape) that conflicts with a different
      concrete term OCR actually read off the page (e.g. "Triangle"
      vs. "Circle")
    - caption consistency: the generated explanation must share at
      least one meaningful word with the visual's own caption/title,
      when one exists
    - hallucination detection: flags visible_entities with no support
      anywhere in this visual's own OCR text/summary/caption/title —
      invisible objects, imaginary labels, and other ungrounded claims
    - ValidationResult / validate_normalized_visual_batch: pairs each
      NormalizedVisual with an accepted/rejected verdict and every
      reason behind it, never dropping a visual or raising — the same
      resilience posture every earlier stage in this file uses
    - all of the above are heuristic, best-effort checks (word/keyword
      level, not a real NLP or fact-checking model) — they catch the
      cases this sprint calls out explicitly, not every possible way
      generated metadata could be wrong

Sprint 15.9 scope — added in this file today:
    - metadata write-back: for every visual Sprint 15.8 marked
      accepted=True, overwriting its own metadata JSON object in
      local storage — the exact object it was loaded from (VisualMetadata.
      metadata_key/metadata_bucket, threaded through since Sprint
      15.3 for exactly this) — with its "education" / "retrieval" /
      "visual_analysis" / "assessment" sections filled in from its
      validated NormalizedMetadata
    - never overwrites ingestion metadata: build_updated_metadata()
      starts from a copy of the visual's original raw dict (id, page,
      subject, chapter, ocr, storage, visual/caption, asset_type,
      and anything else ingestion wrote) and replaces only those four
      sections — every other field survives byte-for-byte
    - never writes a new JSON object — always the same key/bucket the
      visual's metadata was read from, so this pipeline can be re-run
      idempotently over the same chapter
    - visuals Sprint 15.8 rejected are never written back — this
      pipeline does not persist metadata it has itself flagged as
      educationally unreliable; that's left for a future regeneration
      sprint, not silently written anyway
    - MetadataWriteError / write_visual_metadata_batch: same
      resilience posture as every earlier stage — one visual's failed
      upload is logged and skipped, never allowed to crash the batch
    - wired into main(): validation now runs on every non-dry-run
      pass, and its accepted visuals are written back; --dry-run
      still stops before any of this (no download, no Qwen call, no
      write) exactly as before

Sprint 15.10 scope — added in this file today:
    - Qdrant payload update: for every visual Sprint 15.9 actually
      wrote to local storage, locating that visual's *existing* Qdrant
      point (deterministic uuid5 of its metadata "id" — the exact same
      derivation ingest_textbook_images.py's Qdrant Upload stage
      already used, so this always resolves to the point ingestion
      created, never a new one) and updating only that point's
      payload via set_payload — never upsert, never a new point
    - Add: a nested "education_metadata" object (the same four
      sections just written to local storage), a "pass2_retrieval_text"
      string built from the generated education/retrieval content
      (a second retrieval document distinct from ingestion's own
      "search_text" payload key), an "enrichment_timestamp", a
      "pipeline_version", and a top-level "grounding_confidence" for
      direct filtering
    - Preserve: set_payload merges by key, so every payload key
      ingestion's Qdrant Upload stage already wrote ("metadata",
      "image", "search_text", "storage_key", "public_url") is left
      exactly as it was; the point's vector and id are never touched
      by a payload-only call
    - Do NOT: generate an embedding, call upsert, or otherwise create
      a point — a visual with no existing Qdrant point (ingestion's
      Qdrant Upload never ran for it, or it was never accepted then)
      is logged and skipped, never inserted here
    - QdrantPayloadUpdateError / update_qdrant_payload_batch: same
      resilience posture as Sprint 15.9's MetadataWriteError /
      write_visual_metadata_batch — one visual's failed lookup or
      update is logged and skipped, never crashes the batch; a
      completely unreachable Qdrant client (None, from Sprint 15.1's
      best-effort init_qdrant_client) skips the whole batch with one
      warning rather than one per visual
    - wired into main(): runs immediately after Sprint 15.9's
      metadata write-back, over exactly the visuals that write
      actually wrote (never a rejected or failed-write visual)

Sprint 15.11 scope — added in this file today:
    - build_pass2_retrieval_text expanded from an education/retrieval-
      only draft into the actual educational search representation
      students search against: it now also draws on the visual's own
      VisualMetadata (subject, chapter, visual type, caption, OCR
      summary) alongside every field Sprint 15.6 generated (grounded
      description, student explanation, concepts taught, curriculum
      topics, learning objectives, retrieval keywords, student search
      examples, answerable queries, visual role, pedagogical value)
    - each piece is its own clearly labeled, blank-line-separated
      block (mirroring ingest_textbook_images.py's
      _build_structured_search_text); a visual missing a given field
      simply omits that block rather than writing an empty header
    - build_qdrant_payload_update now takes the full NormalizedVisual
      (not just its NormalizedMetadata) so it can hand
      build_pass2_retrieval_text both objects it needs; the payload
      keys it writes ("education_metadata", "pass2_retrieval_text",
      "enrichment_timestamp", "pipeline_version",
      "grounding_confidence") are unchanged from Sprint 15.10 — only
      how "pass2_retrieval_text" itself is built has changed
    - stored under the same "pass2_retrieval_text" Qdrant payload key
      Sprint 15.10 introduced — this is a richer build of that same
      key, not a new one, so no migration of existing points is
      needed beyond re-running enrichment with --force

Sprint 15.12 scope — added in this file today:
    - Pipeline Orchestration: every stage from Sprint 15.2's discovery
      through Sprint 15.10's Qdrant payload update is now one
      unbroken chain in main() — Discover -> Load Metadata -> Download
      Image -> Build Prompt -> Qwen Vision Analysis -> Normalize ->
      Validate Grounding -> Update Metadata JSON -> Generate Pass-2
      Search Representation (new, explicit — Pass2SearchVisual /
      build_pass2_search_representation_batch, sitting between the
      metadata write-back and the Qdrant update so Sprint 15.11's
      search text is built exactly once and simply carried into the
      payload update rather than recomputed there) -> Update Qdrant
      Payload -> Progress Logging & Summary
    - Resume support: --force (Sprint 15.2) is unchanged — a visual
      already carrying educational metadata is skipped at discovery
      unless --force is given, so a re-run only ever touches what a
      previous run didn't finish or what --force explicitly asks to
      redo
    - Subject/chapter/page filtering: --subject/--chapter/--page
      (Sprint 15.1/15.2) are unchanged — this sprint doesn't add new
      filters, it wires the existing ones through the same chain
    - Per-visual progress logging: every batch stage
      (load_visual_metadata_batch, download_visual_image_batch,
      generate_educational_metadata_batch,
      validate_normalized_visual_batch, write_visual_metadata_batch,
      build_pass2_search_representation_batch,
      update_qdrant_payload_batch) now logs a "[i/N] <action> for
      <object_key>" line as it starts each visual, not just on
      failure — someone tailing logs on a long run can see exactly
      where it is
    - Error handling: unchanged in substance (every stage already
      caught and logged its own per-visual failures, Sprint 15.1
      onward) — a failed visual anywhere in the chain is skipped, not
      fatal, and the run continues to the next one
    - Configurable model name: --model (default: VISION_MODEL) now
      reaches the actual Qwen Vision call — main() builds one
      OllamaQwenBackend from config.vision_model/config.ollama_url up
      front and passes it into generate_educational_metadata_batch
      explicitly, rather than leaving that batch call to construct
      its own backend from the environment default
    - Configurable confidence threshold: --min-confidence (Sprint
      15.8) is unchanged — still flows into
      validate_normalized_visual_batch via config.confidence_threshold
    - Summary statistics: PipelineStats / compute_pipeline_stats turn
      the per-stage counts main() already collects into four headline
      numbers — processed, enriched, skipped (grounding-validation
      rejections), failed (hard errors at any stage) — plus Qdrant's
      own updated/skipped counts, printed by print_header's new
      "Summary" section at the end of every real (non-dry-run) run

Sprint 16 scope — added in this file today (modifies Sprint 15.8's
grounding validation only; nothing else in this pipeline, and nothing
in ingest_textbook_images.py, changes):
    - Problem: Sprint 15.8's validation rules were written and tuned
      around photographs and text-heavy figures, where OCR text and a
      caption/title reliably corroborate what a visual shows. Applied
      uniformly to diagrams, graphs, and mathematical illustrations —
      where the whole point of a figure is often coordinate axes, an
      origin, gridlines, plotted curves, arrows, or labeled geometric
      shapes that no OCR pass ever transcribes and no caption ever
      spells out — the same rules (chiefly hallucination detection,
      Sprint 15.8's _check_hallucinated_entities) rejected a large
      share of correct, well-grounded metadata simply because nothing
      in the OCR/caption/title text corroborated a visible_entity that
      was, in fact, genuinely visible.
    - _visual_type_category: a single, explicit classification of
      every visual.type this pipeline sees into "text_grounded"
      (photo/table/activity — types where OCR/caption corroboration
      remains a meaningful signal) or "diagrammatic" (diagram/graph/
      illustration/map/flowchart/mixed_region, and any future/unknown
      type — types where visual information routinely outruns OCR).
      Every rule below reads this classification; the classification
      itself is the one deterministic, explainable place visual-type
      awareness lives, not scattered per-rule guessing.
    - Hallucination detection is now visual-type-aware:
      _DIAGRAM_VISUAL_VOCABULARY names the geometric/mathematical
      primitives Sprint 16's own problem statement calls out by name
      (axes, origin, gridlines, points, arrows, curves, triangles,
      circles, and the like — see its definition for the full list).
      For a "diagrammatic" visual, a visible_entity is no longer
      required to be corroborated by OCR/caption/title text if it is
      itself one of these primitives — it is presumed genuinely
      visible, which is exactly what a diagram/graph is for. Entities
      that are neither corroborated by context nor part of this
      vocabulary are still flagged, so a truly invented entity (an
      object with no business being in a coordinate-geometry figure)
      is caught exactly as before. "text_grounded" visuals are
      unaffected — every entity for them still needs OCR/caption/title
      corroboration, same as Sprint 15.8.
    - Confidence threshold is now visual-type-aware:
      GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC (--min-confidence-
      diagrammatic / env var, independently configurable, default
      derived from GROUNDING_CONFIDENCE_THRESHOLD minus a documented
      delta) applies to "diagrammatic" visuals in place of the main
      threshold. This does not disable the confidence floor for
      diagrams — it acknowledges that Qwen's own grounding_confidence
      for a visual whose evidence is entirely pictorial (nothing to
      cross-check against OCR) runs structurally more conservative
      than for a photo/table with corroborating text, without that
      difference implying the diagram's metadata is actually less
      reliable.
    - Caption consistency is now visual-type-aware in one narrow way:
      for a "diagrammatic" visual, the grounding text it's checked
      against also includes OCR text (axis labels, numbers on a
      plotted curve, a table's own column headers) alongside the
      caption/title — an additional legitimate path to agreement, not
      a relaxation of the check itself. "text_grounded" visuals are
      unaffected (caption/title was already the right signal for
      them).
    - OCR-consistency (shape-name conflict) and the required-field /
      teaching-concept rules are unchanged for every visual type —
      Sprint 16's problem statement is specifically about information
      OCR/caption never captures, not about weakening checks that
      catch a real, concrete conflict (e.g. OCR literally reads
      "Triangle" while the generated description says "Circle") or
      about visuals with no generated content at all.
    - Every rule's applied threshold/vocabulary/category is now part
      of ValidationResult's reasons text when it fails, and validation
      logs each visual's category alongside its accept/reject verdict
      — Objective 5 ("keep validation deterministic and explainable")
      means a rejection should always be traceable to a named rule and
      a named category, never an opaque score.
    - Nothing about image extraction, OCR, metadata generation, Qwen
      Vision prompting (Sprint 15.5's build_enrichment_prompt is
      untouched), the metadata schema, local storage, or the Qdrant
      payload structure changes in this sprint — every other stage in
      this file (Sprint 15.1 through 15.7, and 15.9 through 15.12) is
      byte-for-byte the same as before.

Sprint 16.1 scope — added in this file today (Validation Context
Builder; modifies Sprint 15.8's validation stage only):
    - Problem: every grounding check gathered its own subset of
      evidence ad hoc — the hallucination check read OCR text/
      summary/caption/title/type/subtype; the caption check read only
      caption/title — and neither consulted subject, chapter, or the
      figure/table reference number at all, even though all three are
      already sitting in VisualMetadata.
    - ValidationContext / _build_validation_context: one dataclass,
      built once per visual, holding every deterministic field this
      pipeline has — ocr_text, ocr_summary, caption, title, subject,
      chapter, visual_type, visual_subtype, reference_number (whichever
      of figure_number/table_number the visual has). Its
      `grounding_text` property is the single blob of "things already
      known about this visual" every check that needs one now reads.
    - _check_hallucinated_entities now takes this full context instead
      of re-deriving a narrower one — Objective 1 ("use every
      available deterministic field before deciding metadata is
      unsupported") applies to every visual type, independent of
      Sprint 16.2's per-type vocabulary below.
    - _check_caption_consistency deliberately does NOT fold subject/
      chapter/type into its own agreement check even though they're
      on the context it receives — see that function's docstring for
      why (it would make the check trivially pass for any explanation
      on-topic, which isn't what "caption consistency" means).
    - No new fields, no new local storage/Qdrant reads: everything
      ValidationContext holds already existed on VisualMetadata by
      Sprint 15.3; this sprint only stops leaving most of it unused.

Sprint 16.2 scope — added in this file today (Visual-Type-Aware
Validation; modifies Sprint 15.8's validation stage only, replacing
Sprint 16's single text_grounded/diagrammatic split):
    - ValidatorProfile: one specialized validation policy per
      visual-type family, exactly as named in this sprint's brief —
      Diagram, Graph, Table, Photograph — each a plain, inspectable
      bundle of a confidence-threshold family ("strict" -> --min-
      confidence, "relaxed" -> --min-confidence-diagrammatic, Sprint
      16's existing two knobs, unchanged) plus an
      allowed_entity_vocabulary (visible_entities built from these
      words never need OCR/caption/context corroboration) plus
      whether its caption-consistency check may also agree via OCR.
    - Diagram Validator: allows point, line, ray, segment, angle,
      triangle, rectangle, square, circle, coordinate, axis, origin,
      grid, vertex (plus surface-form variants) without requiring
      OCR/caption corroboration.
    - Graph Validator: allows x-axis, y-axis, origin, plotted points,
      curve, bar, scale, trend (plus surface-form variants).
    - Table Validator: no allow-list — validates primarily against
      OCR (a table's headers/values are its OCR text; there is no
      separate structured field for them in this schema), same as
      Photograph in that every entity still needs corroboration, with
      OCR carrying most of that weight in practice.
    - Photograph Validator: remains the strictest — no allow-list, no
      OCR bonus on the caption check, strict confidence threshold.
      Every detected entity still requires evidence, exactly as
      Sprint 15.8 originally specified.
    - _validator_profile_for maps every visual.type this pipeline
      sees to one of the four profiles above ("activity" ->
      Photograph; "illustration"/"map"/"flowchart"/"mixed_region"/
      unrecognized -> Diagram — see that function's docstring for the
      full mapping and reasoning) — never a per-rule conditional
      scattered through the checks themselves; every check runs
      identical code for every visual, parameterized only by which
      profile was resolved.
    - _visual_type_category, _TEXT_GROUNDED_VISUAL_TYPES,
      _DIAGRAMMATIC_VISUAL_TYPES, and _DIAGRAM_VISUAL_VOCABULARY
      (Sprint 16) are removed, replaced by the above — the same
      confidence-relaxation behavior Sprint 16 introduced is
      preserved (now via threshold_family="relaxed" on the Diagram/
      Graph profiles), not reverted.
    - Logging/ValidationResult reasons now name the resolved
      ValidatorProfile ("validator=diagram"/"graph"/"table"/
      "photograph") in place of Sprint 16's "category=" label —
      Objective 5's "deterministic and explainable" is unchanged in
      spirit, just one profile name instead of one of two categories.

Sprint 16.3-16.6 scope — added in this file since (each modifies
Sprint 15.8's validation stage only, see each section's own comment
block further down in the file for full detail): 16.3 adds
_EDUCATIONAL_ENTITY_WHITELIST, a cross-subject controlled vocabulary
(geometry/graphs/science/mathematics) an entity may also be grounded
against, on top of its own ValidatorProfile's vocabulary. 16.4
replaces the old all-or-nothing veto with a weighted score
(_SCORE_WEIGHTS, out of 100, accepted once it clears a configurable
minimum) so one weak component no longer sinks an otherwise-solid
visual. 16.5 names the three-way distinction every entity resolves to
explicitly (_classify_entity_support: context_grounded /
educational_inference / unsupported — only the last ever costs
anything). 16.6 adds a visual-type-consistency check (does the
generated content actually use this visual-type family's own
vocabulary?) as its own scored component.

Sprint 16.7 scope — added in this file today (Detailed Validation
Report; modifies Sprint 15.8's validation stage only):
    - Problem: a rejected visual only ever produced one opaque log
      line ("Rejected: <reasons string>"). Nothing about a visual's
      validation verdict was structured or machine-readable — not
      comparable across a run, not diffable between two runs tuned
      differently, not loadable by anything meant to tune
      _SCORE_WEIGHTS/thresholds later.
    - ValidationReport / build_validation_report: a pure, lossless
      reshaping of a visual's already-computed ValidationResult into
      named fields (ocr_score/caption_score/visual_score/entity_score/
      completeness_score/confidence_score, one per _SCORE_WEIGHTS
      component) plus accepted/overall_score/warnings —
      ValidationReport.to_dict() is the stable JSON shape this
      sprint's brief specifies. Nothing here re-runs a check or
      changes a verdict.
    - validate_normalized_visual_batch now logs one structured JSON
      diagnostics line per visual (in addition to its existing human-
      readable accept/reject line), and — when --validation-report-
      path/VALIDATION_REPORT_PATH is configured (Sprint 16.8's
      pattern) — write_validation_reports_jsonl additionally appends
      the same diagnostics as JSONL to disk for anything beyond a
      run's own logs.
    - Diagnostics-only, as the brief specifies: nothing a
      ValidationReport carries is ever written into a visual's
      metadata JSON (build_updated_metadata/_ENRICHMENT_SECTIONS
      untouched) or its Qdrant payload (build_qdrant_payload_update
      untouched) — this sprint adds a way to observe and tune
      validation, not a new field ingestion or retrieval ever sees.

Sprint 16.8 scope — added in this file today (Configuration; see the
GROUNDING_MIN_SCORE/ALLOW_*_INFERENCE/STRICT_PHOTO_VALIDATION/
ENABLE_ENTITY_WHITELIST constants' own comment block further down for
what each knob does), plus a wiring fix discovered while implementing
16.7:
    - EnrichmentConfig/ValidationConfig gathered every validation knob
      this sprint's brief names behind env vars and matching CLI
      flags (--min-score/--allow-diagram-inference/--allow-graph-
      inference/--strict-photo-validation/--enable-entity-whitelist),
      but validate_normalized_visual/validate_normalized_visual_batch
      never actually accepted a ValidationConfig — the accept/reject
      decision still read the hardcoded _VALIDATION_SCORE_THRESHOLD
      and the fixed _DEFAULT_VALIDATOR_PROFILES built once at import
      time, and the entity-consistency score component never received
      enable_entity_whitelist at all, so those flags parsed correctly
      but never reached the actual decision.
    - Both functions now accept an optional `validation_config`;
      main() builds one from that run's EnrichmentConfig
      (config.to_validation_config()) and passes it through, so every
      knob this sprint's brief names actually reaches the decision
      it's documented to affect. Callers that pass neither argument
      keep this pipeline's original defaults, unchanged.
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Protocol

from dotenv import load_dotenv
from PIL import Image, UnidentifiedImageError

from core.local_image_storage import LocalImageStorage, get_local_image_storage
from core.vision_runtime import VisionRuntime, get_vision_runtime

logger = logging.getLogger(__name__)

load_dotenv()


# ============================================================
# CONFIGURATION
#
# Same env-driven convention scripts/ingest_textbook_images.py already
# uses (default_factory-free here since these are plain module-level
# reads, not a frozen dataclass) — same variable names, so a .env
# already set up for ingestion needs nothing extra for this pipeline
# to run against the same local storage/Qdrant/Ollama deployment.
# ============================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

OLLAMA_URL = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
VISION_MODEL = os.getenv("VISION_MODEL", "qwen2.5vl:7b")
# cpu | gpu | auto — see core/vision_runtime.py.
VISION_RUNTIME = os.getenv("VISION_RUNTIME", "cpu")

QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
IMAGE_COLLECTION = os.getenv("IMAGE_COLLECTION", "textbook_images")

# Sprint 15.8 — grounding validation rejects a visual whose
# visual_analysis.grounding_confidence does not exceed this value.
# 0.60 is a deliberately middling bar: _DEFAULT_CONFIDENCE (Sprint
# 15.7's fallback when Qwen didn't supply a usable confidence at all)
# is 0.5, so an un-scored reply is rejected by default rather than
# waved through.
GROUNDING_CONFIDENCE_THRESHOLD = float(os.getenv("GROUNDING_CONFIDENCE_THRESHOLD", "0.60"))

# Sprint 16 — a separate, independently configurable threshold applied
# to "diagrammatic" visuals (see _visual_type_category below) in place
# of GROUNDING_CONFIDENCE_THRESHOLD. Defaults to the main threshold
# minus a fixed delta rather than a second hardcoded constant, so
# raising/lowering GROUNDING_CONFIDENCE_THRESHOLD moves this one with
# it unless it's explicitly overridden. The delta (0.10) is a
# deliberately modest relaxation: it acknowledges that Qwen's
# confidence for purely pictorial evidence runs structurally more
# conservative than for text-corroborated evidence, without lowering
# the bar so far that ungrounded metadata starts passing.
GROUNDING_CONFIDENCE_THRESHOLD_DELTA = float(
    os.getenv("GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC_DELTA", "0.10")
)
GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC = float(
    os.getenv(
        "GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC",
        str(max(0.0, GROUNDING_CONFIDENCE_THRESHOLD - GROUNDING_CONFIDENCE_THRESHOLD_DELTA)),
    )
)


def _env_bool(name: str, default: bool) -> bool:
    """Parses a boolean environment variable the same permissive way
    every other flag-like env var in this file does — "0"/
    "false"/"no"/"off" (case-insensitive) is False, everything else
    (including unset, which falls back to `default`) is True."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off")


# ============================================================
# SPRINT 16.8 — CONFIGURATION
#
# Every knob Sprint 16's validation stage (16.1-16.7) added is
# hardcoded in this file up to this point — the diagram/graph/table/
# photograph vocabularies, the 70-point acceptance bar, the Sprint
# 16.3 educational whitelist. Sprint 16.8 exposes the five levers
# this sprint's brief names by environment variable (and, below,
# matching CLI flags), so tuning validation strictness for a new
# textbook run never requires editing this file:
#
#   GROUNDING_MIN_SCORE      — Sprint 16.4's acceptance threshold
#                               (was the hardcoded _VALIDATION_SCORE_
#                               THRESHOLD = 70.0).
#   ALLOW_DIAGRAM_INFERENCE  — whether the Diagram Validator's own
#                               allow-list (point/line/angle/...) may
#                               ground an entity with no context
#                               corroboration. False reverts Diagram
#                               to Photograph-strength strictness.
#   ALLOW_GRAPH_INFERENCE    — same, for the Graph Validator's own
#                               allow-list (axis/curve/scale/...).
#   STRICT_PHOTO_VALIDATION  — True (default) keeps the Photograph
#                               Validator the strictest policy exactly
#                               as Sprint 16.2 specified. False relaxes
#                               it to the same confidence threshold and
#                               OCR-in-caption-check treatment Diagram/
#                               Graph get — for pipelines whose
#                               photographs are reliably well-
#                               captioned and don't need the extra
#                               strictness.
#   ENABLE_ENTITY_WHITELIST  — whether Sprint 16.3's cross-subject
#                               educational whitelist (geometry/
#                               graphs/science/mathematics) is
#                               consulted at all. False reverts entity
#                               grounding to "context or this
#                               profile's own vocabulary only" — the
#                               pre-16.3 behavior — useful for A/B-
#                               testing how much 16.3 actually moved
#                               the acceptance rate.
#
# None of these change what any check *measures* — they change how
# strict the policy built from those measurements is, exactly like
# --min-confidence/--min-confidence-diagrammatic already did for
# Sprint 16's confidence relaxation.
# ============================================================

GROUNDING_MIN_SCORE = float(os.getenv("GROUNDING_MIN_SCORE", "70"))
ALLOW_DIAGRAM_INFERENCE = _env_bool("ALLOW_DIAGRAM_INFERENCE", True)
ALLOW_GRAPH_INFERENCE = _env_bool("ALLOW_GRAPH_INFERENCE", True)
STRICT_PHOTO_VALIDATION = _env_bool("STRICT_PHOTO_VALIDATION", True)
ENABLE_ENTITY_WHITELIST = _env_bool("ENABLE_ENTITY_WHITELIST", True)

# Sprint 16.7 — when set, every real (non-dry-run) run appends one
# JSONL line per visual (see ValidationReport / write_validation_
# reports_jsonl) to this path: the structured, machine-readable
# diagnostics this sprint's brief asks for, for future tuning of
# _SCORE_WEIGHTS/thresholds. None (the default) means "log only, write
# nothing to disk" — this is purely additive and off by default.
VALIDATION_REPORT_PATH = os.getenv("VALIDATION_REPORT_PATH") or None

# Sprint 15.10 — stamped into every Qdrant payload this run updates
# ("pipeline_version"), so a payload can always be traced back to the
# enrichment pipeline version that produced it.
PIPELINE_VERSION = os.getenv("ENRICHMENT_PIPELINE_VERSION", "enrichment-15.10")

# This pipeline's entire input lives in local storage (LOCAL_MEDIA_ROOT,
# core/local_image_storage.py) — unlike ingestion, which can still
# extract/validate with storage unavailable, there is nothing for this
# pipeline to read if local storage can't be initialized. There is no
# enable/disable toggle anymore (this is a local-only deployment, no
# remote endpoint to point at or turn off).


@dataclass
class EnrichmentConfig:
    """Every setting this run needs, gathered in one place — mirrors
    PipelineConfig's role in ingest_textbook_images.py, trimmed to
    what enrichment actually uses (no render DPI, no DocLayout
    weights, no embedding model — this pipeline updates an existing
    Qdrant payload, it doesn't re-embed)."""

    # Filters — None means "no restriction", not "match nothing".
    subjects: Optional[list[str]] = None
    chapters: Optional[list[str]] = None
    pages: Optional[list[int]] = None

    force: bool = False
    dry_run: bool = False

    ollama_url: str = OLLAMA_URL
    vision_model: str = VISION_MODEL
    vision_runtime_mode: str = VISION_RUNTIME
    qdrant_url: str = QDRANT_URL
    collection_name: str = IMAGE_COLLECTION
    confidence_threshold: float = GROUNDING_CONFIDENCE_THRESHOLD
    # Sprint 16 — applied instead of confidence_threshold for visuals
    # _visual_type_category classifies as "diagrammatic".
    confidence_threshold_diagrammatic: float = GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC

    # Sprint 16.8 — validation-stage knobs, see the module-level
    # GROUNDING_MIN_SCORE / ALLOW_*_INFERENCE / STRICT_PHOTO_
    # VALIDATION / ENABLE_ENTITY_WHITELIST constants' docstring above
    # for what each one does. Threaded into validate_normalized_
    # visual_batch via to_validation_config() below.
    grounding_min_score: float = GROUNDING_MIN_SCORE
    allow_diagram_inference: bool = ALLOW_DIAGRAM_INFERENCE
    allow_graph_inference: bool = ALLOW_GRAPH_INFERENCE
    strict_photo_validation: bool = STRICT_PHOTO_VALIDATION
    enable_entity_whitelist: bool = ENABLE_ENTITY_WHITELIST

    # Sprint 16.7 — see VALIDATION_REPORT_PATH's own docstring above.
    validation_report_path: Optional[str] = VALIDATION_REPORT_PATH

    def to_validation_config(self) -> "ValidationConfig":
        """Sprint 16.8: the one place an EnrichmentConfig (CLI/env-
        derived) becomes a ValidationConfig (what validate_
        normalized_visual_batch actually reads). Keeps the two
        dataclasses independent — EnrichmentConfig covers this whole
        pipeline run, ValidationConfig covers only the validation
        stage — while ensuring every validation knob this run was
        configured with actually reaches it."""
        return ValidationConfig(
            confidence_threshold=self.confidence_threshold,
            confidence_threshold_diagrammatic=self.confidence_threshold_diagrammatic,
            min_score=self.grounding_min_score,
            allow_diagram_inference=self.allow_diagram_inference,
            allow_graph_inference=self.allow_graph_inference,
            strict_photo_validation=self.strict_photo_validation,
            enable_entity_whitelist=self.enable_entity_whitelist,
        )


# --------------------------------------------------------
# CLI Arguments
# --------------------------------------------------------

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="enrich_textbook_images.py",
        description=(
            "Sprint 15 — Educational Visual Enrichment. Reads accepted "
            "visual metadata that scripts/ingest_textbook_images.py already "
            "wrote to local storage, analyzes each image with Qwen Vision, "
            "and fills in its empty education/retrieval/visual_analysis/"
            "assessment sections. Never performs ingestion itself."
        ),
    )
    parser.add_argument(
        "--subject", type=str, default=None,
        help=(
            "Only enrich visuals whose subject matches one of these "
            "(comma-separated, case-insensitive). Default: all subjects."
        ),
    )
    parser.add_argument(
        "--chapter", type=str, default=None,
        help=(
            "Only enrich visuals whose chapter matches one of these "
            "(comma-separated, case-insensitive). Default: all chapters."
        ),
    )
    parser.add_argument(
        "--page", type=str, default=None,
        help=(
            "Only enrich visuals on these PDF page numbers (comma-separated "
            "integers). Default: all pages."
        ),
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Re-enrich visuals that already have educational metadata (default: skip them).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help=(
            "List what would be enriched without downloading images, calling "
            "Qwen, writing metadata, or updating Qdrant."
        ),
    )
    parser.add_argument(
        "--min-confidence", type=float, default=GROUNDING_CONFIDENCE_THRESHOLD,
        help=(
            "Sprint 15.8 grounding validation: reject a visual whose "
            "visual_analysis.grounding_confidence does not exceed this "
            "value (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--min-confidence-diagrammatic", type=float,
        default=GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC,
        help=(
            "Sprint 16 grounding validation: same as --min-confidence, but "
            "applied instead of it to 'diagrammatic' visuals (diagram/"
            "graph/illustration/map/flowchart/mixed_region — see "
            "_visual_type_category) whose grounding confidence "
            "legitimately runs lower without OCR corroboration "
            "(default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--min-score", type=float, default=GROUNDING_MIN_SCORE,
        help=(
            "Sprint 16.4/16.8 weighted validation score: a visual is "
            "accepted once its earned score (out of 100, across OCR/"
            "caption/visual-type/educational-consistency/entity/"
            "metadata-completeness/confidence components) meets this "
            "threshold, instead of every rule needing to pass outright "
            "(default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--allow-diagram-inference", action=argparse.BooleanOptionalAction,
        default=ALLOW_DIAGRAM_INFERENCE,
        help=(
            "Sprint 16.8: whether the Diagram Validator's own allow-list "
            "(point/line/angle/triangle/circle/...) may ground a visible "
            "entity with no OCR/caption corroboration. Use "
            "--no-allow-diagram-inference to revert Diagram to "
            "Photograph-strength strictness (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--allow-graph-inference", action=argparse.BooleanOptionalAction,
        default=ALLOW_GRAPH_INFERENCE,
        help=(
            "Sprint 16.8: same as --allow-diagram-inference, for the Graph "
            "Validator's own allow-list (axis/curve/scale/...) "
            "(default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--strict-photo-validation", action=argparse.BooleanOptionalAction,
        default=STRICT_PHOTO_VALIDATION,
        help=(
            "Sprint 16.8: keep the Photograph Validator the strictest "
            "policy (default). Use --no-strict-photo-validation to relax "
            "it to Diagram/Graph's confidence threshold and OCR-in-"
            "caption-check treatment (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--enable-entity-whitelist", action=argparse.BooleanOptionalAction,
        default=ENABLE_ENTITY_WHITELIST,
        help=(
            "Sprint 16.8: whether Sprint 16.3's cross-subject educational "
            "entity whitelist (geometry/graphs/science/mathematics) is "
            "consulted when grounding visible entities. Use "
            "--no-enable-entity-whitelist to revert to context/profile-"
            "vocabulary-only grounding (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--validation-report-path", type=str, default=VALIDATION_REPORT_PATH,
        help=(
            "Sprint 16.7: append one structured JSONL diagnostics line per "
            "visual (accepted, overall_score, and every scored component — "
            "see ValidationReport) to this path for logging/future tuning. "
            "Never stored in Qdrant. Default: %(default)s (log only, write "
            "nothing to disk)."
        ),
    )
    parser.add_argument(
        "--model", type=str, default=VISION_MODEL,
        help=(
            "Qwen Vision model name to request from Ollama for every "
            "visual's educational analysis (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--log-level", type=str, default=LOG_LEVEL,
        help="Logging level (default: %(default)s).",
    )
    return parser


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    return build_arg_parser().parse_args(argv)


def _parse_str_list(raw: Optional[str]) -> Optional[list[str]]:
    if not raw:
        return None
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values or None


def _parse_int_list(raw: Optional[str]) -> Optional[list[int]]:
    if not raw:
        return None
    values: list[int] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            values.append(int(item))
        except ValueError:
            raise SystemExit(
                f"--page must be a comma-separated list of integers, got: {item!r}"
            )
    return values or None


def build_config(args: argparse.Namespace) -> EnrichmentConfig:
    return EnrichmentConfig(
        subjects=_parse_str_list(args.subject),
        chapters=_parse_str_list(args.chapter),
        pages=_parse_int_list(args.page),
        force=args.force,
        dry_run=args.dry_run,
        confidence_threshold=args.min_confidence,
        confidence_threshold_diagrammatic=args.min_confidence_diagrammatic,
        vision_model=args.model,
        grounding_min_score=args.min_score,
        allow_diagram_inference=args.allow_diagram_inference,
        allow_graph_inference=args.allow_graph_inference,
        strict_photo_validation=args.strict_photo_validation,
        enable_entity_whitelist=args.enable_entity_whitelist,
        validation_report_path=args.validation_report_path,
    )


# --------------------------------------------------------
# Logging
# --------------------------------------------------------

def init_logging(level: str = LOG_LEVEL) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


# --------------------------------------------------------
# Local Storage Initialization (fail-fast — this pipeline reads its
# entire input from local storage, so a broken configuration must stop
# the run here, not surface many objects into a scan as confusing
# partial results).
# --------------------------------------------------------

def init_storage(config: EnrichmentConfig) -> LocalImageStorage:
    """Local-only deployment: resolves the LocalImageStorage singleton
    (core/local_image_storage.py, under LOCAL_MEDIA_ROOT) and confirms
    its root directory is writable/readable, mirroring
    ingest_textbook_images.py's own _init_storage_at_startup(). This
    pipeline reads every accepted visual's metadata back by the SAME
    keys scripts/ingest_textbook_images.py wrote them under — both
    scripts share one LOCAL_MEDIA_ROOT — so as long as that ingestion
    run already completed, the objects are exactly where this read
    expects them. An unwritable/unreadable LOCAL_MEDIA_ROOT is a setup
    mistake worth stopping for immediately, not discovering mid-scan."""
    try:
        storage = get_local_image_storage()
        storage.verify_connection()
    except OSError as exc:
        logger.error("Local image storage could not be initialized under LOCAL_MEDIA_ROOT:\n%s", exc)
        raise SystemExit(1) from exc

    print(storage.config.startup_report(status="Connected"))
    return storage


# --------------------------------------------------------
# Qdrant Initialization (best-effort — Sprint 15.1 only validates that
# a client can be built and the server is reachable, so later sprints
# (updating existing Qdrant payloads) inject an already-checked
# client. Nothing is queried or written yet, so an unreachable Qdrant
# must not block discovery, which only needs local storage.)
# --------------------------------------------------------

def init_qdrant_client(config: EnrichmentConfig) -> Optional[Any]:
    try:
        from qdrant_client import QdrantClient
    except ImportError:
        logger.warning(
            "qdrant_client is not installed (`pip install qdrant-client`) — "
            "Qdrant payload updates will be unavailable this run."
        )
        return None

    try:
        client = QdrantClient(url=config.qdrant_url)
        client.get_collections()  # cheap reachability probe
    except Exception as exc:
        logger.warning(
            "Qdrant is not reachable at %s (%s) — continuing without it for now.",
            config.qdrant_url, exc,
        )
        return None

    logger.info("Qdrant reachable at %s (collection=%s)", config.qdrant_url, config.collection_name)
    return client


# --------------------------------------------------------
# Ollama/Qwen Initialization (best-effort, same posture as Qdrant
# above — resolved and logged at startup so a later sprint's analysis
# step injects an already-validated runtime, but not required for this
# sprint's discovery/listing to run.)
# --------------------------------------------------------

def init_vision_runtime(config: EnrichmentConfig) -> Optional[VisionRuntime]:
    try:
        runtime = get_vision_runtime(
            config.vision_runtime_mode, host=config.ollama_url, model=config.vision_model,
        )
        runtime.log_startup()
        return runtime
    except Exception:
        logger.exception(
            "Failed to initialize the Qwen vision runtime — continuing without it for now."
        )
        return None


# ============================================================
# VISUAL ASSET DISCOVERY
#
# Reads accepted visual metadata straight out of local storage — the
# page_<NNN>/<filename>.json objects Sprint 14.5's MetadataBuilder
# writes alongside each accepted image. No local filesystem path
# assumptions beyond LocalImageStorage's own, no PDF, no
# ChapterWorkspace/DocumentContext reconstruction: every value used
# to filter or later update a visual comes from the object itself
# (its own key for writing back to, and its own "subject"/"chapter"/
# "page" fields for filtering — the same self-describing schema Sprint
# 14.6 made reliable) or from listing local storage directly.
# ============================================================

@dataclass
class VisualAssetRecord:
    """One discovered visual asset: where its metadata JSON lives in
    local storage (`key`/`bucket` — exactly what a later sprint writes
    an enriched version back to) and the metadata itself (`data`, the
    Sprint 14.5/14.6 schema, parsed)."""
    key: str
    bucket: str
    data: dict = field(default_factory=dict)

    @property
    def id(self) -> Optional[str]:
        return self.data.get("id")

    @property
    def subject(self) -> Optional[str]:
        return self.data.get("subject")

    @property
    def chapter(self) -> Optional[str]:
        return self.data.get("chapter")

    @property
    def page_number(self) -> Optional[int]:
        page_info = self.data.get("page") or {}
        value = page_info.get("pdf", page_info.get("textbook"))
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @property
    def needs_enrichment(self) -> bool:
        """True when this visual's "education" section is still empty
        — i.e. Sprint 15's enrichment has never run on it. Kept here,
        unused by discovery itself, so Sprint 15.2's processing loop
        (and --force, which overrides it) has a single place to ask
        this question rather than re-deriving it."""
        return not self.data.get("education")


def _looks_like_visual_asset_key(key: str) -> bool:
    """Cheap, key-only pre-filter so discovery doesn't download every
    JSON object in the bucket (page renders and images are already
    excluded by the .json suffix; embeddings.json/processing_report.json/
    chapter_metadata.json live at the chapter root, not inside a
    page_<NNN>/ folder; page_<NNN>/metadata.json is the page-level
    accept/reject bookkeeping file Sprint 18.3/19 writes, not a visual
    asset record). This is only a pre-filter — the authoritative check
    is `asset_type == "visual_asset"` on the downloaded, parsed content
    (_load_visual_asset below), since key naming alone was never meant
    to be trusted as the schema's source of truth."""
    if not key.endswith(".json"):
        return False
    parts = key.split("/")
    if parts[-1] == "metadata.json":
        return False
    return any(part.startswith("page_") for part in parts[:-1])


def _load_visual_asset(
    storage: LocalImageStorage, key: str, *, bucket: str
) -> Optional[VisualAssetRecord]:
    """Downloads and parses one candidate key. Returns None (never
    raises) for anything that isn't actually a visual asset record —
    a malformed object, or a same-named .json this pipeline shouldn't
    touch — so one bad object never stops the rest of the scan."""
    try:
        raw = storage.download_object(key, bucket=bucket)
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        logger.exception("Failed to read/parse candidate metadata key=%s", key)
        return None

    if not isinstance(data, dict) or data.get("asset_type") != "visual_asset":
        return None

    return VisualAssetRecord(key=key, bucket=bucket, data=data)


def _matches_any(value: Optional[str], expected: Optional[list[str]]) -> bool:
    if expected is None:
        return True
    if value is None:
        return False
    normalized = str(value).strip().lower()
    return normalized in {item.lower() for item in expected}


def _page_matches(value: Optional[int], expected: Optional[list[int]]) -> bool:
    if expected is None:
        return True
    return value is not None and value in expected


def discover_visual_assets(
    storage: LocalImageStorage,
    *,
    subjects: Optional[list[str]] = None,
    chapters: Optional[list[str]] = None,
    pages: Optional[list[int]] = None,
) -> list[VisualAssetRecord]:
    """Lists every accepted visual asset's metadata JSON under this
    local storage deployment's root prefix, downloads and parses each
    candidate, and keeps only the ones matching every given filter.
    Sorted by key so repeated runs enumerate visuals in the same
    order."""
    bucket = storage.config.bucket
    prefix = storage.config.root_prefix

    candidate_keys = [
        key for key in storage.list_objects(prefix, bucket=bucket)
        if _looks_like_visual_asset_key(key)
    ]
    logger.info(
        "Scanning %d candidate metadata object(s) under %s/%s",
        len(candidate_keys), bucket, prefix,
    )

    records: list[VisualAssetRecord] = []
    for key in candidate_keys:
        record = _load_visual_asset(storage, key, bucket=bucket)
        if record is None:
            continue
        if not _matches_any(record.subject, subjects):
            continue
        if not _matches_any(record.chapter, chapters):
            continue
        if not _page_matches(record.page_number, pages):
            continue
        records.append(record)

    records.sort(key=lambda r: r.key)

    already_enriched = sum(1 for r in records if not r.needs_enrichment)
    if already_enriched:
        logger.debug(
            "%d of %d matched visual(s) already have educational metadata "
            "(use --force to re-enrich them).",
            already_enriched, len(records),
        )

    return records


# ============================================================
# SPRINT 15.2 — DISCOVER ACCEPTED VISUALS
#
# discover_visual_assets() above finds every accepted visual matching
# the given subject/chapter/page filters and hands back its parsed
# metadata (VisualAssetRecord) — but "matches the filters" isn't the
# same as "ready to enrich". A visual is only actually enrichable when
# both halves of its <stem>.png / <stem>.json pair exist (the JSON
# half is already guaranteed by discover_visual_assets — anything
# without a parseable, asset_type == "visual_asset" JSON never becomes
# a record in the first place) and it isn't being skipped as already
# enriched. This step narrows that list down to exactly those visuals,
# and repackages each one as a VisualAsset: the image_path/
# metadata_path pair Sprint 15.3's processing loop actually needs,
# rather than the full record.
# ============================================================

@dataclass(frozen=True)
class VisualAsset:
    """One accepted visual queued for enrichment — Sprint 15.2's
    output, and the unit of work Sprint 15.3's processing loop
    iterates over.

    image_path / metadata_path are local storage object keys, not
    ad-hoc filesystem paths: this pipeline's only input is what
    ingest_textbook_images.py already uploaded (see this file's
    header), so there is no separate page_<NNN>/figure_x.png to walk —
    the equivalent structure lives inside LocalImageStorage's own
    bucket directory instead. Both
    keys sit in the same page_<NNN>/ prefix with the same basename —
    metadata_path is exactly discover_visual_assets()'s
    VisualAssetRecord.key, and image_path is that record's own
    storage.object_key, confirmed to exist before this object is ever
    created (see discover_accepted_visuals below)."""
    image_path: str
    metadata_path: str
    bucket: str
    record: VisualAssetRecord


def _resolve_image_key(record: VisualAssetRecord) -> Optional[str]:
    """Pulls the image's own local storage key off the metadata Sprint
    14.5 already wrote (storage.object_key — see
    _build_visual_asset_metadata in ingest_textbook_images.py), rather
    than guessing it from metadata_path's basename. A visual with no
    object_key recorded means the image half of the pair was never
    written down at all, distinct from (and checked before) the image
    key being recorded but the object itself missing from local
    storage."""
    storage_info = record.data.get("storage")
    if not isinstance(storage_info, dict):
        return None
    object_key = storage_info.get("object_key")
    return object_key or None


def discover_accepted_visuals(
    storage: LocalImageStorage,
    config: EnrichmentConfig,
) -> list[VisualAsset]:
    """Sprint 15.2 entry point. Runs discover_visual_assets() to get
    every accepted visual matching config's subject/chapter/page
    filters, then, for each:

        1. Skips it if it already has educational metadata and
           config.force is not set (the one place --force changes
           what discovery returns, rather than just what gets logged).
        2. Skips it if its metadata never recorded an image object_key
           (missing JSON *content*, not a missing JSON *object* — the
           object itself parsed fine, it just never named its image).
        3. Skips it if that object_key doesn't actually exist in local
           storage (missing image).

    Every visual that survives all three becomes one VisualAsset.
    Order follows discover_visual_assets()'s (sorted by metadata key),
    so repeated runs process visuals in the same order."""
    records = discover_visual_assets(
        storage,
        subjects=config.subjects,
        chapters=config.chapters,
        pages=config.pages,
    )

    assets: list[VisualAsset] = []
    for record in records:
        if not record.needs_enrichment and not config.force:
            logger.debug(
                "Skipping already-enriched visual metadata_path=%s "
                "(use --force to re-enrich it).",
                record.key,
            )
            continue

        image_key = _resolve_image_key(record)
        if not image_key:
            logger.warning(
                "Skipping visual metadata_path=%s — its metadata has no "
                "storage.object_key recorded, so there is no image to enrich.",
                record.key,
            )
            continue

        if not storage.exists(image_key, bucket=record.bucket):
            logger.warning(
                "Skipping visual metadata_path=%s — its image object "
                "image_path=%s is missing from bucket=%s.",
                record.key, image_key, record.bucket,
            )
            continue

        assets.append(
            VisualAsset(
                image_path=image_key,
                metadata_path=record.key,
                bucket=record.bucket,
                record=record,
            )
        )

    skipped = len(records) - len(assets)
    if skipped:
        logger.info(
            "Discovered %d accepted visual(s) ready for enrichment "
            "(%d matched but skipped — already enriched, or missing image).",
            len(assets), skipped,
        )

    return assets


# ============================================================
# SPRINT 15.3 — METADATA LOADING
#
# Turns each VisualAsset's already-downloaded, already-parsed raw dict
# (asset.record.data — see discover_accepted_visuals above; no second
# local storage read happens here) into a validated, typed VisualMetadata
# object mirroring the schema _build_visual_asset_metadata in
# ingest_textbook_images.py writes: subject/chapter/page/storage/ocr/
# visual. A visual missing a field enrichment cannot proceed without
# is rejected here rather than surfacing as a confusing failure two
# stages later inside Qwen analysis or the metadata write-back.
#
# "education"/"retrieval"/"visual_analysis"/"assessment" are not
# modeled as fields on VisualMetadata — this stage doesn't read or
# generate any of them — but the full original dict is kept on
# `.raw` so Sprint 15.4+ can fill those sections in and write the
# same object back without reconstructing the schema from scratch.
# ============================================================

class VisualMetadataError(ValueError):
    """Raised by load_visual_metadata when a visual's metadata JSON is
    missing (or has the wrong type for) a field this pipeline cannot
    enrich without. Caught per-asset by load_visual_metadata_batch so
    one malformed visual never stops the rest of the run — same
    resilience posture as _load_visual_asset in Sprint 15.1."""


@dataclass(frozen=True)
class PageInfo:
    """Mirrors the "page" object in the schema — see
    _build_visual_asset_metadata's docstring in
    ingest_textbook_images.py for why "textbook" and "pdf" are
    currently always the same value."""
    textbook: Optional[int]
    pdf: Optional[int]


@dataclass(frozen=True)
class StorageInfo:
    """Mirrors the "storage" object. object_key is guaranteed
    non-empty by validation below (and, by the time this object
    exists, already confirmed to exist in local storage — see
    discover_accepted_visuals)."""
    bucket: Optional[str]
    object_key: str


@dataclass(frozen=True)
class OcrInfo:
    """Mirrors the "ocr" object. Both fields are optional — a visual
    can have empty OCR text (e.g. a purely pictorial figure) without
    that being a validation failure."""
    text: Optional[str]
    summary: Optional[str]


@dataclass(frozen=True)
class VisualInfo:
    """Mirrors the "visual" object. `type` (photo/diagram/table/...)
    is the one field enrichment cannot proceed without; everything
    else here is optional descriptive context."""
    type: str
    subtype: Optional[str]
    figure_number: Optional[str]
    table_number: Optional[str]
    title: Optional[str]
    caption: Optional[str]


@dataclass(frozen=True)
class VisualMetadata:
    """One accepted visual's validated, structured metadata — Sprint
    15.3's output, and what Sprint 15.4's Qwen analysis / educational
    metadata generation reads its context from. `raw` is the complete
    original dict (asset.record.data) unmodified, kept so the
    "education"/"retrieval"/"visual_analysis"/"assessment" sections
    this stage never touches aren't lost between loading and the
    eventual write-back. `metadata_key`/`metadata_bucket` are this
    visual's *own* metadata JSON's local storage location (VisualAsset.
    metadata_path/bucket — distinct from storage.object_key, which is
    the *image's* location) — carried through so Sprint 15.9's
    write-back overwrites the exact object this was loaded from,
    never a new one."""
    id: str
    subject: str
    chapter: str
    page: PageInfo
    storage: StorageInfo
    ocr: OcrInfo
    visual: VisualInfo
    raw: dict
    metadata_key: str
    metadata_bucket: str


# Top-level keys a visual's metadata must have a truthy value for
# before this pipeline will attempt to enrich it. "ocr" is
# deliberately excluded — it's always structurally present (Sprint
# 14.5 writes it unconditionally) but its own fields may legitimately
# both be empty, so OcrInfo below has nothing to validate.
_REQUIRED_TOP_LEVEL_FIELDS = ("id", "subject", "chapter", "page", "storage", "visual")


def _coerce_page_number(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def load_visual_metadata(asset: VisualAsset) -> VisualMetadata:
    """Validates and structures asset.record.data. Raises
    VisualMetadataError — naming every problem found, not just the
    first — if the payload can't be trusted enough to enrich.
    Read-only: does not write anything back to local storage, and does
    not look at "education"/"retrieval"/"visual_analysis"/"assessment"
    (that's Sprint 15.4+)."""
    data = asset.record.data
    errors: list[str] = []

    for field_name in _REQUIRED_TOP_LEVEL_FIELDS:
        if not data.get(field_name):
            errors.append(f"missing required field {field_name!r}")

    page = data.get("page")
    if not isinstance(page, dict) or (
        page.get("pdf") is None and page.get("textbook") is None
    ):
        errors.append('"page" must include a "pdf" or "textbook" page number')

    storage_info = data.get("storage")
    if not isinstance(storage_info, dict) or not storage_info.get("object_key"):
        errors.append('"storage.object_key" is required')

    visual_info = data.get("visual")
    if not isinstance(visual_info, dict) or not visual_info.get("type"):
        errors.append('"visual.type" is required')

    if errors:
        raise VisualMetadataError(
            f"{asset.metadata_path}: " + "; ".join(errors)
        )

    ocr_info = data.get("ocr") if isinstance(data.get("ocr"), dict) else {}

    return VisualMetadata(
        id=str(data["id"]),
        subject=str(data["subject"]),
        chapter=str(data["chapter"]),
        page=PageInfo(
            textbook=_coerce_page_number(page.get("textbook")),
            pdf=_coerce_page_number(page.get("pdf")),
        ),
        storage=StorageInfo(
            bucket=storage_info.get("bucket") or asset.bucket,
            object_key=storage_info["object_key"],
        ),
        ocr=OcrInfo(
            text=ocr_info.get("text"),
            summary=ocr_info.get("summary"),
        ),
        visual=VisualInfo(
            type=str(visual_info["type"]),
            subtype=visual_info.get("subtype"),
            figure_number=visual_info.get("figure_number"),
            table_number=visual_info.get("table_number"),
            title=visual_info.get("title"),
            caption=visual_info.get("caption"),
        ),
        raw=data,
        metadata_key=asset.metadata_path,
        metadata_bucket=asset.bucket,
    )


def load_visual_metadata_batch(assets: list[VisualAsset]) -> list[VisualMetadata]:
    """Runs load_visual_metadata over every asset, logging and
    skipping any that fail validation instead of raising — one
    malformed visual's metadata must not stop the rest of the batch
    from being enriched. Order follows `assets`."""
    total = len(assets)
    loaded: list[VisualMetadata] = []
    for i, asset in enumerate(assets, start=1):
        logger.info("[%d/%d] Loading metadata for %s", i, total, asset.metadata_path)
        try:
            loaded.append(load_visual_metadata(asset))
        except VisualMetadataError as exc:
            logger.warning("Skipping visual with invalid metadata: %s", exc)
    return loaded


# ============================================================
# SPRINT 15.4 — LOCAL STORAGE IMAGE RETRIEVAL
#
# Sprint 15.3 handed back one validated VisualMetadata per visual,
# with metadata.storage.{bucket,object_key} naming exactly where that
# visual's own image lives in local storage. This step's only job is
# to turn that into an actual image: download the object's bytes,
# decode them into a PIL.Image, and confirm the result is a real,
# openable image before it's handed to Sprint 15.5's Qwen analysis. No
# educational analysis happens here — this is retrieval and validation
# only.
# ============================================================

class ImageRetrievalError(ValueError):
    """Raised by download_visual_image when a visual's image object
    can't be turned into a usable PIL.Image — missing from local
    storage, empty bytes, or bytes PIL can't decode as an image.
    Caught per-visual by download_visual_image_batch so one bad image
    never stops the rest of the run — same resilience posture as
    Sprint 15.1's _load_visual_asset and Sprint 15.3's
    load_visual_metadata_batch."""


@dataclass(frozen=True)
class EnrichmentVisual:
    """One visual with its image actually in hand — Sprint 15.4's
    output, and the unit of work Sprint 15.5's Qwen Vision analysis
    reads from. `image` is a decoded, validated PIL.Image; the rest
    of this pipeline works only with that, never with raw bytes or
    local storage again."""
    image: Image.Image
    metadata: VisualMetadata


def download_visual_image(storage: LocalImageStorage, metadata: VisualMetadata) -> EnrichmentVisual:
    """Downloads metadata.storage.object_key from
    metadata.storage.bucket and decodes it into a PIL.Image
    (bytes -> BytesIO -> PIL.Image.open()). Raises
    ImageRetrievalError — never any other exception — for anything
    that keeps this visual from becoming a usable EnrichmentVisual:
    the object is missing, its bytes are empty, PIL can't open them
    as an image, or the decoded image has zero width/height."""
    bucket = metadata.storage.bucket
    object_key = metadata.storage.object_key

    try:
        raw = storage.download_object(object_key, bucket=bucket)
    except Exception as exc:
        raise ImageRetrievalError(
            f"{object_key}: failed to download from bucket={bucket!r} ({exc})"
        ) from exc

    if not raw:
        raise ImageRetrievalError(
            f"{object_key}: downloaded object is empty (0 bytes)"
        )

    try:
        image = Image.open(io.BytesIO(raw))
        image.load()  # force full decode now, not lazily inside Qwen later
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageRetrievalError(
            f"{object_key}: bytes could not be decoded as an image ({exc})"
        ) from exc

    width, height = image.size
    if width <= 0 or height <= 0:
        raise ImageRetrievalError(
            f"{object_key}: decoded image has invalid dimensions ({width}x{height})"
        )

    return EnrichmentVisual(image=image, metadata=metadata)


def download_visual_image_batch(
    storage: LocalImageStorage, metadata_list: list[VisualMetadata]
) -> list[EnrichmentVisual]:
    """Runs download_visual_image over every VisualMetadata, logging
    and skipping any that fail instead of raising — one bad image
    download must never stop the rest of the batch from being
    enriched. Order follows `metadata_list`."""
    total = len(metadata_list)
    visuals: list[EnrichmentVisual] = []
    for i, metadata in enumerate(metadata_list, start=1):
        logger.info(
            "[%d/%d] Downloading image for %s", i, total, metadata.storage.object_key,
        )
        try:
            visuals.append(download_visual_image(storage, metadata))
        except ImageRetrievalError as exc:
            logger.warning("Skipping visual — could not retrieve its image: %s", exc)
    return visuals


# ============================================================
# SPRINT 15.5 — EDUCATIONAL PROMPT BUILDER
#
# Sprint 15.4 handed back one EnrichmentVisual per visual: an actual
# PIL.Image plus its validated VisualMetadata. This step's only job is
# to turn that pair into the multimodal prompt Sprint 15.6's Qwen call
# will send — a prompt that makes Qwen behave like an experienced
# Class 9 textbook teacher grounding every claim in what it can
# actually see (or was told), never a free-associating captioner. No
# call to Qwen happens here, and nothing is parsed or written back —
# this is prompt construction only.
# ============================================================

@dataclass(frozen=True)
class PromptPackage:
    """One visual's image, paired with the finished multimodal prompt
    built for it — Sprint 15.5's output, and exactly what Sprint
    15.6's Qwen Vision call sends (image attached, prompt as the
    accompanying text). `image` is the same PIL.Image Sprint 15.4
    already downloaded and decoded; nothing about it is touched here."""
    image: Image.Image
    prompt: str


# The JSON shape Qwen must reply with, mapped straight onto the four
# sections Sprint 14.5 left empty on every visual asset's metadata
# ("education" / "visual_analysis" / "retrieval" / "assessment" — see
# _build_visual_asset_metadata in ingest_textbook_images.py). Spelled
# out verbatim in the prompt itself (below) so Qwen is never left to
# guess field names, and so generate_educational_metadata's caller has
# a fixed contract to validate against later (Sprint 15.7+ — this
# sprint returns the raw parsed reply as-is, unvalidated).
_RESPONSE_JSON_SCHEMA = """{
  "education": {
    "grounded_description": "objective, grounded description of what this visual shows, tying it to the subject/chapter/reference context — no invented labels or figure numbers",
    "student_explanation": "2-4 sentence plain-language explanation of what this visual teaches, written for a Class 9 student",
    "teaches": ["scientific or mathematical concept this visual actually teaches", "..."],
    "curriculum_topics": ["curriculum topic or syllabus heading this visual belongs under", "..."],
    "learning_objectives": ["what a student should be able to do after studying this visual", "..."]
  },
  "retrieval": {
    "retrieval_keywords": ["term a student or teacher might search for", "..."],
    "student_search_examples": ["example search query a student might actually type to find this visual", "..."],
    "answerable_queries": ["a question a student could ask that this visual, on its own, answers", "..."],
    "useful_for_questions": ["a type or topic of question this visual would be useful evidence for", "..."]
  },
  "visual_analysis": {
    "visible_entities": ["labeled part, axis, symbol, object, or component actually visible in the image", "..."],
    "concept_relationships": ["how two visible elements or concepts relate to each other, grounded in what's shown", "..."],
    "visual_role": "primary illustration | supporting diagram | worked example | reference figure | data table | other",
    "pedagogical_value": "why this visual is useful for teaching/learning the concept(s) above",
    "grounding_confidence": "high | medium | low — how confident you are that every field above is grounded in the image/CONTEXT and nothing was guessed"
  },
  "assessment": {
    "misconceptions": ["a misconception a student might have that this visual could correct or reinforce if misread", "..."],
    "practice_questions": [
      {"question": "a question this visual could be used to assess", "answer": "grounded answer", "difficulty": "easy | medium | hard"}
    ],
    "difficulty": "easy | medium | hard — overall difficulty of the concept(s) this visual teaches"
  }
}"""


def _reference_number(visual: VisualInfo) -> Optional[str]:
    """The single human-facing label for this visual — "Figure 4.3" or
    "Table 6.1" — from whichever of figure_number/table_number is set.
    VisualInfo guarantees at most one of the two is populated (see
    _split_figure_table_number in ingest_textbook_images.py), so there
    is nothing to reconcile here."""
    return visual.figure_number or visual.table_number


def _context_line(label: str, value: Optional[str]) -> str:
    """Renders one context field as a single line, using an explicit
    "Not provided" rather than silently omitting the line — Qwen is
    instructed below to treat that phrase as "no information", never
    as license to invent a value."""
    return f"{label}: {value.strip() if isinstance(value, str) and value.strip() else 'Not provided'}"


def build_prompt_context(metadata: VisualMetadata) -> str:
    """Assembles the grounding context block — subject, chapter,
    caption, OCR text, visual type, and reference number — from an
    already-validated VisualMetadata. Every value here came from
    ingestion's own record of this visual (Sprint 14.5/14.6), never
    inferred or guessed by this pipeline."""
    page_number = metadata.page.pdf if metadata.page.pdf is not None else metadata.page.textbook

    lines = [
        _context_line("Subject", metadata.subject),
        _context_line("Chapter", metadata.chapter),
        _context_line("Page", str(page_number) if page_number is not None else None),
        _context_line("Visual type", metadata.visual.type),
        _context_line("Visual subtype", metadata.visual.subtype),
        _context_line("Reference number", _reference_number(metadata.visual)),
        _context_line("Title", metadata.visual.title),
        _context_line("Caption", metadata.visual.caption),
        _context_line("OCR text extracted from the image", metadata.ocr.text),
    ]
    return "\n".join(lines)


def build_enrichment_prompt(visual: EnrichmentVisual) -> str:
    """Builds the full instruction text Sprint 15.6 will send alongside
    visual.image. Casts Qwen as an experienced Class 9 textbook
    teacher, requires every claim to be grounded in either the visible
    image or the supplied context (never invented), and forces a
    single raw JSON object matching _RESPONSE_JSON_SCHEMA as the
    entire reply."""
    context = build_prompt_context(visual.metadata)

    return f"""You are an experienced Class 9 science/mathematics textbook teacher looking at one visual (image, diagram, photo, table, or graph) taken from a textbook chapter. You are not an image captioning model — your job is to explain what this visual teaches, not merely describe what is drawn.

CONTEXT (already known and confirmed — treat as ground truth, not as something to re-derive or contradict):
{context}

WHAT TO DO
1. Understand the educational purpose: work out what concept, process, structure, or relationship this visual exists to teach within its subject and chapter.
2. Identify the specific scientific or mathematical concept(s) it illustrates.
3. Look only at what is actually visible in the image plus the CONTEXT above. Do not hallucinate labels, values, colors, species, formulas, or details that are not genuinely visible or stated in the CONTEXT.
4. If something is unclear, illegible, or not shown, say so (e.g. "not visible in the image") instead of guessing or inventing it.
5. Explain every concept in plain language a Class 9 student could understand — no unexplained jargon, no assumption of knowledge beyond that level.
6. Base "visible_entities" strictly on what can actually be seen in the image itself, and base "concept_relationships"/"grounding_confidence" strictly on those visible entities plus the CONTEXT — never on outside knowledge of the topic.

WHAT NOT TO DO
- Do not invent facts, labels, numbers, or context not visible in the image or given above.
- Do not describe the image as a generic photograph/graphic ("an image of...") — teach from it.
- Do not include any text outside the JSON object below: no markdown, no headings, no bullet points, no prose commentary, no explanations before or after the JSON.

OUTPUT FORMAT
Reply with exactly one raw JSON object matching this schema — no markdown code fences, no surrounding text:
{_RESPONSE_JSON_SCHEMA}

If a field genuinely cannot be grounded in the image or the CONTEXT above, use an empty string ("") or empty list ([]) for it rather than inventing content. Reply now with only the JSON object."""


def build_prompt_package(visual: EnrichmentVisual) -> PromptPackage:
    """Sprint 15.5 entry point for a single visual: pairs its image
    (untouched, exactly as Sprint 15.4 downloaded and decoded it) with
    the finished prompt built for it."""
    return PromptPackage(image=visual.image, prompt=build_enrichment_prompt(visual))


def build_prompt_package_batch(visuals: list[EnrichmentVisual]) -> list[PromptPackage]:
    """Runs build_prompt_package over every EnrichmentVisual. Prompt
    construction is pure string formatting over already-validated
    data — nothing here can fail per-visual the way download or
    metadata validation can, so, unlike those earlier batch helpers,
    this one never needs to skip an entry. Order follows `visuals`."""
    return [build_prompt_package(visual) for visual in visuals]


# ============================================================
# SPRINT 15.6 — EDUCATIONAL METADATA GENERATION
#
# Sprint 15.5 handed back one PromptPackage per visual: the same
# PIL.Image Sprint 15.4 downloaded, paired with the grounded,
# schema-carrying prompt built for it. This step's only job is to
# actually send that pair to Qwen Vision and parse whatever comes
# back into a plain dict — the "core AI stage" this whole pipeline
# exists for. Nothing here renames, defaults, reshapes, or validates
# a single field of that dict against _RESPONSE_JSON_SCHEMA; it is
# returned exactly as Qwen produced it. Deciding whether it's good
# enough to write back into a visual's metadata JSON / Qdrant payload
# is Sprint 15.7+.
# ============================================================

class QwenVisionBackend(Protocol):
    """The raw call this stage wraps — Ollama's /api/chat with an
    image attached, or a fake in tests. Returns the model's raw text
    reply; generate_educational_metadata below is the only thing that
    ever parses it. Mirrors QwenVisionBackend in
    ingest_textbook_images.py exactly (same shape, same contract) so
    both pipelines talk to Qwen the same way — this stage does not
    import that one, since this file must never import anything from
    ingest_textbook_images.py (see this file's header), so the
    protocol/backend are re-declared here rather than shared."""
    def __call__(self, image: Image.Image, prompt: str) -> str: ...


class OllamaQwenBackend:
    """Default QwenVisionBackend. Talks to the same Ollama instance
    (config.ollama_url) and vision model (config.vision_model) this
    pipeline already initialized a VisionRuntime for at startup
    (init_vision_runtime) — that runtime, if given, contributes its
    request_options() (e.g. {"num_gpu": 0} for CPU mode) into the
    request body's "options" field. `requests` is imported lazily,
    inside __call__, so importing this module never requires it to
    already be installed — tests inject a fake QwenVisionBackend
    instead."""

    def __init__(
        self,
        *,
        base_url: str = OLLAMA_URL,
        model: str = VISION_MODEL,
        timeout: float = 600.0,
        runtime: Optional[VisionRuntime] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        # Falls back to reading VISION_RUNTIME from the environment if
        # no runtime is injected, so this backend is never left
        # running in an undefined mode.
        self.runtime: VisionRuntime = runtime or get_vision_runtime()

    def __call__(self, image: Image.Image, prompt: str) -> str:
        try:
            import requests
        except ImportError as exc:
            raise RuntimeError(
                "requests is not installed (`pip install requests`). "
                "Either install it, or inject a backend= for testing."
            ) from exc

        import base64

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

        logger.debug(
            "Qwen request: base_url=%s model=%s timeout=%s options=%s",
            self.base_url, self.model, self.timeout, self.runtime.request_options(),
        )

        response = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                        "images": [encoded],
                    }
                ],
                "format": "json",
                "stream": False,
                "options": self.runtime.request_options(),
            },
            timeout=self.timeout,
        )
        response.raise_for_status()

        return response.json().get("message", {}).get("content", "")


class EducationGenerationError(ValueError):
    """Raised by generate_educational_metadata when one visual's
    educational metadata can't be produced — the call to Qwen itself
    failed (network/HTTP error), or its reply wasn't valid, parseable
    JSON. Caught per-visual by generate_educational_metadata_batch so
    one bad Qwen call never stops the rest of the batch from being
    enriched — same resilience posture as every earlier stage in this
    file."""


def _strip_json_fences(text: str) -> str:
    """Defensive only: the prompt explicitly forbids markdown fences
    around the reply and "format": "json" asks Ollama to constrain
    generation to JSON, but models still occasionally wrap a reply in
    ```json ... ``` anyway. Strips a single leading/trailing fence if
    present; leaves anything else untouched for json.loads to accept
    or reject on its own."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def generate_educational_metadata(
    package: PromptPackage,
    *,
    backend: Optional[QwenVisionBackend] = None,
    runtime: Optional[VisionRuntime] = None,
) -> dict:
    """Sprint 15.6's core call: sends package.image + package.prompt to
    Qwen Vision (via `backend`, an OllamaQwenBackend by default) and
    parses its reply as JSON. Returns the raw parsed JSON object
    exactly as Qwen returned it — no field is renamed, defaulted,
    reshaped, or checked against _RESPONSE_JSON_SCHEMA here; that
    validation belongs to whatever later writes this back into a
    visual's metadata (Sprint 15.7+). Raises EducationGenerationError
    — never any other exception — if the call to Qwen fails, or its
    reply can't be parsed as a JSON object."""
    backend = backend or OllamaQwenBackend(runtime=runtime)

    try:
        raw_reply = backend(package.image, package.prompt)
    except Exception as exc:
        raise EducationGenerationError(f"Qwen Vision call failed: {exc}") from exc

    if not raw_reply or not raw_reply.strip():
        raise EducationGenerationError("Qwen Vision returned an empty reply")

    cleaned = _strip_json_fences(raw_reply)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise EducationGenerationError(
            f"Qwen Vision reply was not valid JSON ({exc}); "
            f"raw reply: {raw_reply[:500]!r}"
        ) from exc

    if not isinstance(data, dict):
        raise EducationGenerationError(
            f"Qwen Vision reply parsed to {type(data).__name__}, expected a JSON object"
        )

    return data


@dataclass(frozen=True)
class EnrichedVisual:
    """One visual paired with the raw educational-metadata JSON Qwen
    generated for it — Sprint 15.6's output. `visual` is the same
    EnrichmentVisual Sprint 15.4 produced (image + VisualMetadata),
    untouched; `education_data` is exactly what
    generate_educational_metadata returned for it, matching
    _RESPONSE_JSON_SCHEMA's "education"/"retrieval"/"visual_analysis"/
    "assessment" keys but not yet validated field-by-field. Writing
    this back into the visual's own metadata JSON and updating its
    Qdrant payload are Sprint 15.7+."""
    visual: EnrichmentVisual
    education_data: dict


def generate_educational_metadata_batch(
    visuals: list[EnrichmentVisual],
    *,
    backend: Optional[QwenVisionBackend] = None,
    runtime: Optional[VisionRuntime] = None,
    on_progress: Optional[Callable[[int, int], None]] = None,
) -> list[EnrichedVisual]:
    """Runs Sprint 15.5's build_prompt_package and this sprint's
    generate_educational_metadata over every EnrichmentVisual, logging
    and skipping any visual whose Qwen call or JSON parse fails —
    one bad reply must never stop the rest of the batch from being
    enriched. A single backend is resolved once up front (so every
    visual in the batch reuses the same Ollama/runtime configuration
    rather than re-resolving it per call) unless one is injected.
    Order follows `visuals`.

    on_progress(i, total), when given, fires after EVERY visual
    (success or skipped) — this is the only per-item hook in an
    otherwise opaque whole-batch call, added so a caller reporting
    interim status (image_enrichment_tasks.py's Celery task) can show
    real "analyzing image i of N" progress instead of one static stage
    message for the entire batch's duration, which — for a real chapter
    with 20-40 visuals — silently looked indistinguishable from a hang
    to anyone watching (confirmed hitting exactly this)."""
    backend = backend or OllamaQwenBackend(runtime=runtime)

    total = len(visuals)
    enriched: list[EnrichedVisual] = []
    for i, visual in enumerate(visuals, start=1):
        object_key = visual.metadata.storage.object_key
        logger.info("[%d/%d] Analyzing %s with Qwen Vision", i, total, object_key)
        package = build_prompt_package(visual)
        try:
            data = generate_educational_metadata(package, backend=backend)
        except EducationGenerationError as exc:
            logger.warning(
                "Skipping visual object_key=%s — Qwen educational metadata "
                "generation failed: %s",
                object_key, exc,
            )
        else:
            enriched.append(EnrichedVisual(visual=visual, education_data=data))
        finally:
            if on_progress is not None:
                on_progress(i, total)

    return enriched


# ============================================================
# SPRINT 15.7 — RESPONSE NORMALIZATION
#
# Sprint 15.6 handed back one EnrichedVisual per visual: its
# EnrichmentVisual (image + VisualMetadata) paired with
# education_data — the raw dict Qwen replied with, exactly as parsed,
# never renamed/defaulted/reshaped/validated. LLMs are inconsistent
# about how they fill that dict in even when the prompt spells out
# _RESPONSE_JSON_SCHEMA field-by-field: a list field might come back
# as a comma-separated string, a missing field might come back as
# null instead of being omitted, a confidence might come back as
# "high" instead of a number, and a reply might carry a stray field
# nobody asked for. This stage's only job is to remove that
# inconsistency — never to judge, score, or reject a visual on the
# strength of its content — by converting education_data into
# NormalizedMetadata: a single stable internal schema every later
# stage (Sprint 15.8's metadata write-back and Qdrant payload update)
# can rely on without re-checking types itself.
#
# Normalization never raises and never skips a visual: every field
# gets its section's documented default when Qwen's reply didn't
# supply something usable, so a NormalizedMetadata is produced for
# every EnrichedVisual it's given, one-for-one.
# ============================================================

# ------------------------
# Scalar/collection cleaners
# ------------------------

# Markdown Qwen sometimes wraps text fields in even though the prompt
# forbids it (bold/italic emphasis, inline code, headings, bullet
# markers, and [text](url) links) — stripped down to their plain-text
# content rather than left in place, since these are meant to become
# plain strings inside a JSON metadata field, not rendered markdown.
_MARKDOWN_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\*\*(.+?)\*\*"), r"\1"),        # **bold**
    (re.compile(r"__(.+?)__"), r"\1"),             # __bold__
    (re.compile(r"\*(.+?)\*"), r"\1"),             # *italic*
    (re.compile(r"(?<!\w)_(.+?)_(?!\w)"), r"\1"),  # _italic_
    (re.compile(r"`{1,3}([^`]+?)`{1,3}"), r"\1"),  # `code` / ```code```
    (re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE), ""),   # # Heading
    (re.compile(r"^\s{0,3}[-*+]\s+", re.MULTILINE), ""),    # - bullet
    (re.compile(r"\[(.+?)\]\((?:.+?)\)"), r"\1"),  # [text](url)
]


def _strip_markdown(text: str) -> str:
    """Removes markdown formatting characters while keeping their
    underlying text content. Best-effort and order-sensitive (bold
    before italic, etc.) rather than a full markdown parser — this
    only needs to handle the handful of things a model might wrap
    plain metadata text in, not arbitrary documents."""
    for pattern, replacement in _MARKDOWN_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def _normalize_string(value: Any) -> Optional[str]:
    """Trims whitespace, strips markdown, and collapses internal
    runs of spaces/tabs — the one string cleaner every text field in
    this schema goes through. Non-strings are coerced with str() (a
    number Qwen returned unquoted should still normalize, not vanish);
    None and anything that cleans down to an empty/whitespace-only
    string both return None, so callers can tell "no usable text"
    from "usable text" with a single check rather than special-casing
    the empty string."""
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    cleaned = _strip_markdown(value)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = cleaned.strip()
    return cleaned or None


def _normalize_required_string(value: Any, *, default: str = "") -> str:
    """Same cleaning as _normalize_string, but for fields this schema
    always carries a (possibly empty) string for — grounded_
    description, student_explanation, pedagogical_value — so a
    missing/unusable value becomes `default` (empty string) rather
    than None."""
    return _normalize_string(value) or default


def _normalize_string_list(value: Any) -> list[str]:
    """Converts anything Qwen might have put in a list field into a
    clean list[str]: None becomes [] (never null survives into
    NormalizedMetadata), a bare comma-separated string is split into
    its items, and a real list has every item run through
    _normalize_string with non-string/empty items dropped. Duplicates
    are removed case-insensitively, keeping the first (and therefore
    best-formatted) occurrence, since a repeated keyword or topic
    adds nothing the second time."""
    if value is None:
        items: list[Any] = []
    elif isinstance(value, str):
        items = value.split(",") if "," in value else [value]
    elif isinstance(value, (list, tuple)):
        items = list(value)
    else:
        # A single stray non-list/non-string value (e.g. a number) is
        # still one usable item rather than being discarded outright.
        items = [value]

    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items:
        normalized = _normalize_string(item)
        if normalized is None:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(normalized)
    return cleaned


def _normalize_number(
    value: Any,
    *,
    default: float,
    minimum: Optional[float] = None,
    maximum: Optional[float] = None,
) -> float:
    """Converts a float, int, or numeric/percentage string ("0.91",
    "91%") into a float, falling back to `default` for anything else
    (None, an empty string, unparseable text, a bool). Clamps the
    result into [minimum, maximum] when given — the only place in
    this file a value from Qwen is forced into a numeric range rather
    than just cleaned."""
    number = default
    if isinstance(value, bool):
        number = default
    elif isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        text = value.strip()
        is_percentage = text.endswith("%")
        if is_percentage:
            text = text[:-1].strip()
        try:
            number = float(text)
        except ValueError:
            number = default
        else:
            if is_percentage:
                number /= 100.0

    if minimum is not None:
        number = max(minimum, number)
    if maximum is not None:
        number = min(maximum, number)
    return number


# grounding_confidence is documented in _RESPONSE_JSON_SCHEMA as
# "high | medium | low", but Qwen (like most models asked for a
# confidence) sometimes replies with a number or percentage instead
# of one of those words. Both are accepted here and normalized down
# to the same [0.0, 1.0] float, so downstream consumers (e.g. a
# future retrieval-ranking or QA-gating step) always get a number,
# never a mix of words and numbers.
_CONFIDENCE_WORDS = {"high": 0.9, "medium": 0.6, "low": 0.3}
_DEFAULT_CONFIDENCE = 0.5


def _normalize_confidence(value: Any) -> float:
    """Normalizes grounding_confidence to a float clamped into
    [0.0, 1.0]. Recognizes the "high"/"medium"/"low" words Qwen was
    actually prompted for (mapped to fixed representative scores);
    anything else falls through to _normalize_number, so a numeric or
    percentage reply is still accepted. An unrecognized or missing
    value becomes _DEFAULT_CONFIDENCE — a deliberately uninformative
    midpoint, not a claim that grounding was actually verified."""
    if isinstance(value, str):
        word = value.strip().casefold()
        if word in _CONFIDENCE_WORDS:
            return _CONFIDENCE_WORDS[word]
    return _normalize_number(value, default=_DEFAULT_CONFIDENCE, minimum=0.0, maximum=1.0)


_ALLOWED_DIFFICULTIES = ("easy", "medium", "hard")
_DEFAULT_DIFFICULTY = "medium"


def _normalize_difficulty(value: Any) -> str:
    """Normalizes an "easy"/"medium"/"hard" difficulty field
    (assessment.difficulty, and each practice_questions[].difficulty)
    case-insensitively; anything not one of those three words falls
    back to _DEFAULT_DIFFICULTY rather than carrying through
    whatever free text Qwen actually wrote."""
    text = _normalize_string(value)
    if text and text.casefold() in _ALLOWED_DIFFICULTIES:
        return text.casefold()
    return _DEFAULT_DIFFICULTY


_ALLOWED_VISUAL_ROLES = (
    "primary illustration",
    "supporting diagram",
    "worked example",
    "reference figure",
    "data table",
    "other",
)
_DEFAULT_VISUAL_ROLE = "other"


def _normalize_visual_role(value: Any) -> str:
    """Normalizes visual_analysis.visual_role against the fixed set
    of roles _RESPONSE_JSON_SCHEMA documents, case-insensitively;
    anything Qwen invented that isn't one of them (a typo, a
    synonym, an explanatory sentence) falls back to
    _DEFAULT_VISUAL_ROLE rather than polluting this field with
    free text."""
    text = _normalize_string(value)
    if text and text.casefold() in _ALLOWED_VISUAL_ROLES:
        return text.casefold()
    return _DEFAULT_VISUAL_ROLE


# ------------------------
# NormalizedMetadata — the stable internal schema
# ------------------------

@dataclass(frozen=True)
class NormalizedEducation:
    """Normalized "education" section — mirrors
    _RESPONSE_JSON_SCHEMA's "education" object field-for-field."""
    grounded_description: str
    student_explanation: str
    teaches: list[str]
    curriculum_topics: list[str]
    learning_objectives: list[str]


@dataclass(frozen=True)
class NormalizedRetrieval:
    """Normalized "retrieval" section — mirrors
    _RESPONSE_JSON_SCHEMA's "retrieval" object field-for-field."""
    retrieval_keywords: list[str]
    student_search_examples: list[str]
    answerable_queries: list[str]
    useful_for_questions: list[str]


@dataclass(frozen=True)
class NormalizedVisualAnalysis:
    """Normalized "visual_analysis" section — mirrors
    _RESPONSE_JSON_SCHEMA's "visual_analysis" object field-for-field,
    except grounding_confidence is a float in [0.0, 1.0] rather than
    the raw "high"/"medium"/"low" string (see _normalize_confidence)."""
    visible_entities: list[str]
    concept_relationships: list[str]
    visual_role: str
    pedagogical_value: str
    grounding_confidence: float


@dataclass(frozen=True)
class NormalizedPracticeQuestion:
    """Normalized entry of assessment.practice_questions — mirrors
    _RESPONSE_JSON_SCHEMA's practice_questions[] object field-for-
    field."""
    question: str
    answer: str
    difficulty: str


@dataclass(frozen=True)
class NormalizedAssessment:
    """Normalized "assessment" section — mirrors
    _RESPONSE_JSON_SCHEMA's "assessment" object field-for-field."""
    misconceptions: list[str]
    practice_questions: list[NormalizedPracticeQuestion]
    difficulty: str


@dataclass(frozen=True)
class NormalizedMetadata:
    """Sprint 15.7's stable internal schema — the normalized
    counterpart of EnrichedVisual.education_data's raw dict, with one
    field per _RESPONSE_JSON_SCHEMA section. Every field is always
    present and always the type its name implies (never None, never
    a stray type Qwen happened to return); a section Qwen omitted
    entirely still produces one of these with every field at its
    documented default. This is what Sprint 15.8's metadata write-
    back and Qdrant payload update will read from instead of
    education_data."""
    education: NormalizedEducation
    retrieval: NormalizedRetrieval
    visual_analysis: NormalizedVisualAnalysis
    assessment: NormalizedAssessment


def _normalize_education(section: Any) -> NormalizedEducation:
    section = section if isinstance(section, dict) else {}
    return NormalizedEducation(
        grounded_description=_normalize_required_string(section.get("grounded_description")),
        student_explanation=_normalize_required_string(section.get("student_explanation")),
        teaches=_normalize_string_list(section.get("teaches")),
        curriculum_topics=_normalize_string_list(section.get("curriculum_topics")),
        learning_objectives=_normalize_string_list(section.get("learning_objectives")),
    )


def _normalize_retrieval(section: Any) -> NormalizedRetrieval:
    section = section if isinstance(section, dict) else {}
    return NormalizedRetrieval(
        retrieval_keywords=_normalize_string_list(section.get("retrieval_keywords")),
        student_search_examples=_normalize_string_list(section.get("student_search_examples")),
        answerable_queries=_normalize_string_list(section.get("answerable_queries")),
        useful_for_questions=_normalize_string_list(section.get("useful_for_questions")),
    )


def _normalize_visual_analysis(section: Any) -> NormalizedVisualAnalysis:
    section = section if isinstance(section, dict) else {}
    return NormalizedVisualAnalysis(
        visible_entities=_normalize_string_list(section.get("visible_entities")),
        concept_relationships=_normalize_string_list(section.get("concept_relationships")),
        visual_role=_normalize_visual_role(section.get("visual_role")),
        pedagogical_value=_normalize_required_string(section.get("pedagogical_value")),
        grounding_confidence=_normalize_confidence(section.get("grounding_confidence")),
    )


def _normalize_practice_questions(value: Any) -> list[NormalizedPracticeQuestion]:
    """Normalizes assessment.practice_questions. Only dict entries
    carrying at least a usable question and answer become a
    NormalizedPracticeQuestion — a malformed entry (not a dict, or
    missing the one thing that makes a practice question useful) is
    dropped rather than kept as a half-empty placeholder, since unlike
    a missing string/array field there is no sensible default for
    "what is this question actually asking". Duplicate questions
    (case-insensitive) are removed, keeping the first occurrence."""
    if not isinstance(value, list):
        return []

    questions: list[NormalizedPracticeQuestion] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        question = _normalize_string(item.get("question"))
        answer = _normalize_string(item.get("answer"))
        if question is None or answer is None:
            continue
        key = question.casefold()
        if key in seen:
            continue
        seen.add(key)
        questions.append(
            NormalizedPracticeQuestion(
                question=question,
                answer=answer,
                difficulty=_normalize_difficulty(item.get("difficulty")),
            )
        )
    return questions


def _normalize_assessment(section: Any) -> NormalizedAssessment:
    section = section if isinstance(section, dict) else {}
    return NormalizedAssessment(
        misconceptions=_normalize_string_list(section.get("misconceptions")),
        practice_questions=_normalize_practice_questions(section.get("practice_questions")),
        difficulty=_normalize_difficulty(section.get("difficulty")),
    )


def normalize_educational_metadata(education_data: dict) -> NormalizedMetadata:
    """Sprint 15.7 entry point: converts one visual's raw
    education_data (EnrichedVisual.education_data, exactly as Sprint
    15.6's generate_educational_metadata returned it) into
    NormalizedMetadata. Every _RESPONSE_JSON_SCHEMA section is read
    with .get() rather than unpacked wholesale, so any top-level key
    Qwen invented outside "education"/"retrieval"/"visual_analysis"/
    "assessment" is silently ignored; a non-dict value for a section
    (or education_data itself not being a dict) is treated the same
    as that section being entirely missing. Never raises — a visual
    with a completely unusable reply still gets a NormalizedMetadata
    back, just one made entirely of defaults."""
    data = education_data if isinstance(education_data, dict) else {}
    return NormalizedMetadata(
        education=_normalize_education(data.get("education")),
        retrieval=_normalize_retrieval(data.get("retrieval")),
        visual_analysis=_normalize_visual_analysis(data.get("visual_analysis")),
        assessment=_normalize_assessment(data.get("assessment")),
    )


@dataclass(frozen=True)
class NormalizedVisual:
    """One visual paired with its NormalizedMetadata — Sprint 15.7's
    output, and the unit of work Sprint 15.8's metadata write-back /
    Qdrant payload update will read from. `visual` is the same
    EnrichmentVisual Sprint 15.4 produced (image + VisualMetadata),
    untouched."""
    visual: EnrichmentVisual
    metadata: NormalizedMetadata


def normalize_enriched_visual(enriched: EnrichedVisual) -> NormalizedVisual:
    """Runs normalize_educational_metadata over one EnrichedVisual's
    education_data and pairs the result with its (untouched)
    EnrichmentVisual."""
    return NormalizedVisual(
        visual=enriched.visual,
        metadata=normalize_educational_metadata(enriched.education_data),
    )


def normalize_enriched_visual_batch(enriched_visuals: list[EnrichedVisual]) -> list[NormalizedVisual]:
    """Runs normalize_enriched_visual over every EnrichedVisual.
    Normalization cannot fail the way earlier batch stages could
    (download, metadata validation, the Qwen call itself) — every
    input produces exactly one output — so, like Sprint 15.5's
    build_prompt_package_batch, nothing here is skipped or logged as
    a failure. Order follows `enriched_visuals`."""
    return [normalize_enriched_visual(enriched) for enriched in enriched_visuals]


# ============================================================
# SPRINT 15.8 — GROUNDING VALIDATION
#
# Sprint 15.7 handed back one NormalizedVisual per enriched visual: a
# stable, type-safe NormalizedMetadata guaranteed to have every field
# present in its documented type. That guarantee is about *shape*,
# not *truth* — normalization never checks whether Qwen's reply is
# actually grounded in the image and the OCR/caption text ingestion
# already captured for it. That's this stage's only job: decide
# whether a visual's generated metadata is reliable enough to be
# useful to a student, never to rewrite, improve, or re-prompt for
# it. A visual that fails validation is not retried here (that's a
# future regeneration sprint) — it is simply paired with a
# ValidationResult naming every rule it failed, for whatever
# downstream stage (Sprint 15.9's metadata write-back) decides what
# to do with rejected visuals.
#
# Every check below is a heuristic, word/keyword-level check, not a
# real NLP or fact-checking model — this stage has no access to
# either. Each one is scoped to catch exactly the failure mode Sprint
# 15.8 calls out by name (an empty field, a confidence too low, a
# concrete OCR/description conflict, a caption the explanation
# ignores entirely, an entity nothing here grounds), not every
# possible way generated metadata could be subtly wrong.
# ============================================================

_MIN_TEACHING_CONCEPTS = 1


# ------------------------
# Sprint 16 — visual-type-aware validation
#
# The single place every rule below asks "what evidence exists for
# this visual, and which validation policy applies to its type?"
# Sprint 16.1 answers the first question (ValidationContext /
# _build_validation_context — every deterministic field, gathered
# once); Sprint 16.2 answers the second (ValidatorProfile /
# _validator_profile_for — one specialized policy per visual.type,
# replacing Sprint 16's single text_grounded/diagrammatic split).
# ------------------------


# ============================================================
# SPRINT 16.1 — VALIDATION CONTEXT BUILDER
#
# Sprint 15.8 (and Sprint 16) judged a visual against whatever subset
# of fields each individual check happened to reach for — the
# hallucination check read OCR text/summary/caption/title/type/
# subtype; the caption check read only caption/title. Two problems
# with that: every check re-implemented its own "gather the evidence"
# logic, and neither used every deterministic field this pipeline
# actually has on hand (subject, chapter, and the figure/table
# reference number were never consulted at all). Sprint 16.1 fixes
# both: one function builds one ValidationContext per visual, and
# every check below reads from it instead of re-deriving its own
# subset of VisualMetadata's fields.
# ============================================================

@dataclass(frozen=True)
class ValidationContext:
    """Every deterministic field Sprint 16.1 considers admissible
    evidence for judging a visual's generated metadata — nothing
    Qwen produced, only what ingestion/OCR/the textbook itself
    already established. `grounding_text` folds all of it into the
    one blob of text the hallucination check (and, for a
    caption-consistency check that opts in — see ValidatorProfile.
    include_ocr_in_caption_check — the caption check too) treats as
    "things already known about this visual." Adding a field here
    immediately widens the evidence every such check considers;
    there is no separate copy of this list anywhere else."""
    ocr_text: Optional[str]
    ocr_summary: Optional[str]
    caption: Optional[str]
    title: Optional[str]
    subject: Optional[str]
    chapter: Optional[str]
    visual_type: Optional[str]
    visual_subtype: Optional[str]
    reference_number: Optional[str]

    @property
    def grounding_text(self) -> str:
        return " ".join(filter(None, (
            self.ocr_text, self.ocr_summary, self.caption, self.title,
            self.subject, self.chapter, self.visual_type, self.visual_subtype,
            self.reference_number,
        )))


def _build_validation_context(visual_metadata: VisualMetadata) -> ValidationContext:
    """Sprint 16.1's single point of evidence-gathering: reads
    exactly the fields VisualMetadata already has (no new fields, no
    new local storage/Qdrant reads — Sprint 16.1 is validation-stage-only)
    into one ValidationContext. `reference_number` is whichever of
    figure_number / table_number this visual actually has (a visual
    has at most one of the two — see VisualInfo)."""
    visual_info = visual_metadata.visual
    return ValidationContext(
        ocr_text=visual_metadata.ocr.text,
        ocr_summary=visual_metadata.ocr.summary,
        caption=visual_info.caption,
        title=visual_info.title,
        subject=visual_metadata.subject,
        chapter=visual_metadata.chapter,
        visual_type=visual_info.type,
        visual_subtype=visual_info.subtype,
        reference_number=visual_info.figure_number or visual_info.table_number,
    )


# ============================================================
# SPRINT 16.2 — VISUAL-TYPE-AWARE VALIDATION (specialized validators)
#
# Sprint 16 introduced one relaxation (a diagram vocabulary) behind
# one binary split (text_grounded vs diagrammatic). Sprint 16.2
# replaces that with one ValidatorProfile per visual.type family —
# Diagram, Graph, Table, Photograph, exactly as named in this
# sprint's brief — each a plain, inspectable bundle of "how strict is
# the confidence bar" and "which visible entities get a pass without
# needing corroborating evidence." Nothing here is a class hierarchy
# or per-type branching in the checks themselves: every check still
# runs the same code for every visual, parameterized by whichever
# profile _validator_profile_for resolves — Objective 5's
# "deterministic and explainable" means the policy for any visual is
# always exactly one named profile, inspectable in one place, never
# scattered per-rule conditionals.
# ============================================================

@dataclass(frozen=True)
class ValidatorProfile:
    """One visual-type-specialized validation policy.

    `name` — the profile's identity for logging/explainability
    ("diagram" / "graph" / "table" / "photograph").

    `threshold_family` — "strict" applies GROUNDING_CONFIDENCE_
    THRESHOLD; "relaxed" applies GROUNDING_CONFIDENCE_THRESHOLD_
    DIAGRAMMATIC (Sprint 16's confidence relaxation, kept as-is and
    now selected per-profile instead of per-binary-category). A
    threshold_family, not a literal float, so both remain driven by
    the existing --min-confidence / --min-confidence-diagrammatic
    CLI/env knobs threaded through validate_normalized_visual_batch —
    Sprint 16.2 does not add new CLI surface.

    `allowed_entity_vocabulary` — visible_entities built from these
    words never need OCR/caption/context corroboration for this
    profile. Empty means "every entity needs evidence" — the
    Photograph and Table policies this sprint calls out by name.

    `include_ocr_in_caption_check` — whether the caption-consistency
    check (see _check_caption_consistency) may also agree via OCR
    text, not just caption/title. True for Diagram/Graph/Table (OCR
    is frequently the *only* text a diagram's axis labels or a
    table's headers/values produce); False for Photograph, which
    stays judged against caption/title exactly as Sprint 15.8 always
    did — the strictest policy gets no additional path to a pass."""
    name: str
    threshold_family: str
    allowed_entity_vocabulary: frozenset[str]
    include_ocr_in_caption_check: bool


# Diagram Validator — Sprint 16.2's named allow-list verbatim: point,
# line, ray, segment, angle, triangle, rectangle, square, circle,
# coordinate, axis, origin, grid, vertex — plus the plural/compound
# surface forms Qwen actually writes (_significant_words does no
# stemming, so "vertices"/"axes"/"gridlines" need their own entries).
_DIAGRAM_ENTITY_VOCABULARY = frozenset({
    "point", "points",
    "line", "lines",
    "ray", "rays",
    "segment", "segments",
    "angle", "angles",
    "triangle", "triangles",
    "rectangle", "rectangles",
    "square", "squares",
    "circle", "circles",
    "coordinate", "coordinates",
    "axis", "axes",
    "origin",
    "grid", "grids", "gridline", "gridlines",
    "vertex", "vertices",
})

# Graph Validator — Sprint 16.2's named allow-list verbatim: x-axis,
# y-axis, origin, plotted points, curve, bar, scale, trend (plus
# surface-form variants). "bar"/"scale" are short enough that
# _significant_words' own length filter already spares them from
# ever being flagged (see that function) — kept here anyway so the
# vocabulary documents Sprint 16.2's brief exactly and stays correct
# if that filter's threshold ever changes.
_GRAPH_ENTITY_VOCABULARY = frozenset({
    "axis", "axes",
    "origin",
    "plotted", "point", "points",
    "curve", "curves",
    "bar", "bars",
    "scale", "scales",
    "trend", "trends",
})

# Table Validator — no free-pass vocabulary. Sprint 16.2: "Validate
# primarily against OCR, table structure, headers, values." A table's
# headers/values *are* its OCR text — there is no separate structured
# field for them in this schema — so "primarily against OCR" is
# already what ValidationContext.grounding_text gives this profile
# (OCR text/summary are its biggest, most reliable component); an
# empty vocabulary means every entity still needs that OCR-derived
# support, same posture as Photograph, just with OCR doing more of
# the corroborating work in practice.
_TABLE_ENTITY_VOCABULARY: frozenset[str] = frozenset()

# Photograph Validator — Sprint 16.2: "Remain the strictest validator.
# Every detected entity should still require evidence." No
# vocabulary, no OCR bonus on the caption check, strict confidence.
_PHOTOGRAPH_ENTITY_VOCABULARY: frozenset[str] = frozenset()


# ============================================================
# SPRINT 16.8 — ValidationConfig / configurable validator profiles
#
# Sprint 16.2 built _DIAGRAM_VALIDATOR/_GRAPH_VALIDATOR/_TABLE_
# VALIDATOR/_PHOTOGRAPH_VALIDATOR as fixed module constants — correct
# for that sprint, but it means ALLOW_DIAGRAM_INFERENCE/ALLOW_GRAPH_
# INFERENCE/STRICT_PHOTO_VALIDATION (16.8's brief) would have nowhere
# to take effect. _build_validator_profiles below replaces the four
# constants with a function of one ValidationConfig, so every run's
# actual profiles reflect that run's configuration; _DEFAULT_
# VALIDATOR_PROFILES (built from ValidationConfig()'s defaults) keeps
# every caller that doesn't pass a config working exactly as before.
# ============================================================

@dataclass(frozen=True)
class ValidationConfig:
    """Every validation-stage knob Sprint 16 (16.1-16.8) exposes,
    gathered in one place — this stage's counterpart to
    EnrichmentConfig, which covers the whole pipeline run.
    EnrichmentConfig.to_validation_config() is the one place a run's
    CLI/env configuration becomes one of these; every default below
    mirrors this file's module-level GROUNDING_*/ALLOW_*/STRICT_*/
    ENABLE_* constants, so constructing ValidationConfig() with no
    arguments reproduces this run's environment exactly."""
    confidence_threshold: float = GROUNDING_CONFIDENCE_THRESHOLD
    confidence_threshold_diagrammatic: float = GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC
    min_score: float = GROUNDING_MIN_SCORE
    allow_diagram_inference: bool = ALLOW_DIAGRAM_INFERENCE
    allow_graph_inference: bool = ALLOW_GRAPH_INFERENCE
    strict_photo_validation: bool = STRICT_PHOTO_VALIDATION
    enable_entity_whitelist: bool = ENABLE_ENTITY_WHITELIST


def _build_validator_profiles(config: ValidationConfig) -> dict[str, ValidatorProfile]:
    """Builds the visual.type -> ValidatorProfile map for one
    ValidationConfig. Mirrors Sprint 16.2's four named validators and
    its type->profile mapping exactly, except:

    - Diagram's allowed_entity_vocabulary is _DIAGRAM_ENTITY_
      VOCABULARY when config.allow_diagram_inference is True (the
      default — Sprint 16.2's original behavior), or empty when
      False (ALLOW_DIAGRAM_INFERENCE=false reverts Diagram to
      Photograph-strength strictness, per Sprint 16.8's brief).
    - Graph's allowed_entity_vocabulary responds the same way to
      config.allow_graph_inference.
    - Photograph's threshold_family/include_ocr_in_caption_check stay
      "strict"/False when config.strict_photo_validation is True (the
      default — Sprint 16.2's original behavior, "remain the
      strictest validator"), or relax to Diagram/Graph's "relaxed"/
      True when False.

    Table is untouched by any 16.8 knob — Sprint 16.2 gave it no
    allow-list of its own to toggle, and 16.8 names no photo-only-
    style relaxation for it."""
    diagram_vocabulary = _DIAGRAM_ENTITY_VOCABULARY if config.allow_diagram_inference else frozenset()
    graph_vocabulary = _GRAPH_ENTITY_VOCABULARY if config.allow_graph_inference else frozenset()
    photo_threshold_family = "strict" if config.strict_photo_validation else "relaxed"
    photo_include_ocr = not config.strict_photo_validation

    diagram_validator = ValidatorProfile(
        name="diagram",
        threshold_family="relaxed",
        allowed_entity_vocabulary=diagram_vocabulary,
        include_ocr_in_caption_check=True,
    )
    graph_validator = ValidatorProfile(
        name="graph",
        threshold_family="relaxed",
        allowed_entity_vocabulary=graph_vocabulary,
        include_ocr_in_caption_check=True,
    )
    table_validator = ValidatorProfile(
        name="table",
        threshold_family="strict",
        allowed_entity_vocabulary=_TABLE_ENTITY_VOCABULARY,
        include_ocr_in_caption_check=True,
    )
    photograph_validator = ValidatorProfile(
        name="photograph",
        threshold_family=photo_threshold_family,
        allowed_entity_vocabulary=_PHOTOGRAPH_ENTITY_VOCABULARY,
        include_ocr_in_caption_check=photo_include_ocr,
    )

    # visual.type -> ValidatorProfile — see Sprint 16.2's original
    # mapping rationale (photo/activity -> Photograph; table ->
    # Table; graph -> Graph; diagram and every pictorial/unrecognized
    # type -> Diagram), unchanged by 16.8.
    return {
        "photo": photograph_validator,
        "activity": photograph_validator,
        "table": table_validator,
        "graph": graph_validator,
        "diagram": diagram_validator,
        "illustration": diagram_validator,
        "map": diagram_validator,
        "flowchart": diagram_validator,
        "mixed_region": diagram_validator,
    }


# Built once from this run's environment defaults — every caller that
# doesn't pass an explicit ValidationConfig (existing code, tests)
# keeps behaving exactly as Sprint 16.2-16.7 always did.
_DEFAULT_VALIDATOR_PROFILES: dict[str, ValidatorProfile] = _build_validator_profiles(ValidationConfig())
_DEFAULT_DIAGRAM_VALIDATOR = _DEFAULT_VALIDATOR_PROFILES["diagram"]


def _validator_profile_for(
    visual_type: Optional[str],
    profiles: Optional[dict[str, ValidatorProfile]] = None,
) -> ValidatorProfile:
    """Resolves a visual.type to its ValidatorProfile within
    `profiles` (Sprint 16.8: this run's configured profiles, from
    _build_validator_profiles; defaults to _DEFAULT_VALIDATOR_
    PROFILES for backward-compatible callers). An unrecognized or
    missing type resolves to the Diagram Validator — see
    _build_validator_profiles' docstring for why that's the safer
    default than silently applying Photograph's full strictness to a
    type Sprint 16.2 never saw."""
    profiles = profiles if profiles is not None else _DEFAULT_VALIDATOR_PROFILES
    normalized_type = (visual_type or "").strip().casefold()
    return profiles.get(normalized_type, profiles.get("diagram", _DEFAULT_DIAGRAM_VALIDATOR))


def _resolve_confidence_threshold(
    profile: ValidatorProfile,
    *,
    confidence_threshold: float,
    confidence_threshold_diagrammatic: float,
) -> float:
    """Maps a profile's threshold_family to the actual configured
    value for this run — the one place "relaxed" vs "strict" becomes
    a number, so both the Diagram and Graph Validators automatically
    track --min-confidence-diagrammatic (and Table/Photograph track
    --min-confidence) without either being hardcoded here."""
    if profile.threshold_family == "relaxed":
        return confidence_threshold_diagrammatic
    return confidence_threshold


# ============================================================
# SPRINT 16.3 — EDUCATIONAL ENTITY WHITELIST
#
# _check_hallucinated_entities (below) can only ever ask "does this
# entity share a word with something already known about this visual
# (OCR/caption/title/...) or with this visual-type's own allow-list
# (ValidatorProfile.allowed_entity_vocabulary)?" That is deliberately
# narrow — Diagram's vocabulary is geometry, Graph's is plotting — so
# a perfectly ordinary educational entity that happens to belong to a
# *different* subject (a "cell" or "magnet" Qwen correctly sees in a
# science diagram whose type resolved to the generic Diagram
# Validator, a "polygon" a Graph visual's own vocabulary doesn't
# name) was still flagged as a possible hallucination purely because
# it wasn't the right kind of shape or plot word for its profile.
#
# Sprint 16.3 fixes that with one controlled vocabulary of ordinary
# classroom/textbook entities, organized by subject area exactly as
# this sprint's brief lists them, and — unlike ValidatorProfile's
# per-type vocabularies — applied to *every* visual regardless of its
# resolved profile. An entity on this list "contributes positively
# during validation rather than triggering rejection": it is treated
# as grounded the same way a context-corroborated or profile-
# vocabulary entity is, in both the hallucination check
# (_check_hallucinated_entities) and the weighted "educational entity
# consistency" score component Sprint 16.4 adds below. It never
# *replaces* context/profile grounding, only widens it — a truly
# invented, non-educational object (Sprint 16.5's "dog", "tree",
# "airplane", "clock") is still flagged, since none of those belong
# to any classroom subject this pipeline teaches.
# ============================================================

_EDUCATIONAL_ENTITY_WHITELIST: dict[str, frozenset[str]] = {
    "geometry": frozenset({
        "point", "points",
        "line", "lines",
        "triangle", "triangles",
        "angle", "angles",
        "circle", "circles",
    }),
    "graphs": frozenset({
        "axis", "axes",
        "scale", "scales",
        "curve", "curves",
    }),
    "science": frozenset({
        "beaker", "beakers",
        "plant", "plants",
        "cell", "cells",
        "magnet", "magnets",
    }),
    "mathematics": frozenset({
        "coordinate", "coordinates",
        "origin",
        "polygon", "polygons",
    }),
}

# Flattened for the O(1) membership check _is_grounded actually needs;
# _EDUCATIONAL_ENTITY_WHITELIST above stays the source of truth (and
# the categorized shape Sprint 16.3's brief specifies) for anything
# that wants to report *which* subject area an entity belongs to —
# see _classify_entity_support below.
_EDUCATIONAL_ENTITY_VOCABULARY: frozenset[str] = frozenset().union(
    *_EDUCATIONAL_ENTITY_WHITELIST.values()
)


def _educational_entity_category(word: str) -> Optional[str]:
    """Returns the whitelist category (\"geometry\" / \"graphs\" /
    \"science\" / \"mathematics\") a single significant word belongs
    to, or None if it isn't on the whitelist at all. Used only for
    explainability (Sprint 16.5's reasons text); grounding itself only
    needs the flattened set above."""
    for category, words in _EDUCATIONAL_ENTITY_WHITELIST.items():
        if word in words:
            return category
    return None


@dataclass(frozen=True)
class ValidationResult:
    """Sprint 15.8's verdict on one visual's NormalizedMetadata:
    reliable enough to keep, or not. `reasons` names every rule that
    didn't score full marks — not just the first — the same "collect
    everything, then report" posture VisualMetadataError uses in
    Sprint 15.3. Never raises: a visual that fails validation is still
    described by one of these, never an exception.

    Sprint 16.4 replaces the original "accepted iff every rule
    passed" logic with a weighted score: `component_scores` names
    every scored rule's earned points (see _SCORE_WEIGHTS), `score`
    is their sum out of 100, and `accepted` is True iff `score >=
    _VALIDATION_SCORE_THRESHOLD` *and* every required-field rule
    (description / student explanation / at least one teaching
    concept) passed outright — those three stay a hard floor rather
    than scored points, since metadata with no description isn't
    salvageable by scoring well elsewhere (see validate_normalized_
    visual). This is what "one unsupported entity" no longer being
    able to sink an otherwise-solid visual actually means: a single
    docked component subtracts its own weight, not the whole
    result."""
    accepted: bool
    reasons: tuple[str, ...] = ()
    score: float = 100.0
    component_scores: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class ValidationReport:
    """Sprint 16.7 — Detailed Validation Report.

    Previously a rejected visual only ever produced a single log line
    ("Rejected") — enough to know *that* a visual was dropped, nothing
    about *why* beyond whatever happened to be in that line, and
    nothing machine-readable for tuning _SCORE_WEIGHTS/thresholds
    across a run. ValidationReport is the structured counterpart: one
    per visual, built from its own ValidationResult
    (build_validation_report), carrying every scored component named
    individually rather than folded into ValidationResult.
    component_scores' internal keys.

    This is a *diagnostics* artifact only — see this sprint's brief:
    "used for logging and future tuning but not stored in Qdrant."
    Nothing here is written into a visual's metadata JSON
    (build_updated_metadata / _ENRICHMENT_SECTIONS untouched) or its
    Qdrant payload (build_qdrant_payload_update untouched); it only
    ever reaches a log line (validate_normalized_visual_batch) or,
    when --validation-report-path/VALIDATION_REPORT_PATH is set, a
    JSONL file on disk (write_validation_reports_jsonl) — both purely
    for a human or a future tuning pass to read, never for this
    pipeline itself to read back.

    The six *_score fields mirror _SCORE_WEIGHTS' six components
    one-for-one (ocr_consistency -> ocr_score, caption_consistency ->
    caption_score, visual_type_consistency -> visual_score,
    educational_entity_consistency -> entity_score,
    metadata_completeness -> completeness_score, grounding_confidence
    -> confidence_score) so `overall_score` (== ValidationResult.score)
    is always exactly their sum. `warnings` carries every reason
    ValidationResult.reasons named — including, for an *accepted*
    visual, components that lost points without losing enough to fail
    (e.g. one educational-inference entity docking a couple of points
    off `entity_score`) — since those are exactly the near-misses
    future tuning most wants visibility into."""
    object_key: Optional[str]
    visual_type: Optional[str]
    validator_profile: str
    accepted: bool
    overall_score: float
    ocr_score: float
    caption_score: float
    visual_score: float
    entity_score: float
    completeness_score: float
    confidence_score: float
    warnings: tuple[str, ...] = ()

    def to_dict(self) -> dict:
        """The plain JSON-serializable shape this sprint's brief
        specifies (accepted/overall_score/ocr_score/caption_score/
        visual_score/entity_score/confidence_score/warnings), plus
        completeness_score (the sixth scored component the brief's
        example simply didn't enumerate) — every point _SCORE_WEIGHTS
        awards is represented, none silently dropped."""
        return {
            "accepted": self.accepted,
            "overall_score": self.overall_score,
            "ocr_score": self.ocr_score,
            "caption_score": self.caption_score,
            "visual_score": self.visual_score,
            "entity_score": self.entity_score,
            "completeness_score": self.completeness_score,
            "confidence_score": self.confidence_score,
            "warnings": list(self.warnings),
        }


# ------------------------
# Required-field rules — description / explanation / concepts / confidence
# ------------------------

def _validate_required_field(value: str, *, field_name: str) -> Optional[str]:
    """Shared check behind the grounded_description and
    student_explanation rules: both must be non-empty once
    normalized. Sprint 15.7 already trims whitespace and strips
    markdown, so an empty string here really does mean "Qwen never
    supplied this," not "supplied it oddly formatted." Returns a
    reason string on failure, None on success."""
    if not value or not value.strip():
        return f"{field_name} is missing or empty"
    return None


def _validate_teaching_concepts(teaches: list[str]) -> Optional[str]:
    """education.teaches must name at least one teaching concept —
    metadata that doesn't say what the visual teaches isn't
    educationally useful, regardless of how well-written the rest of
    it is."""
    if len(teaches) < _MIN_TEACHING_CONCEPTS:
        return "no teaching concepts were generated (education.teaches is empty)"
    return None


def _validate_confidence(confidence: float, *, threshold: float) -> Optional[str]:
    """visual_analysis.grounding_confidence must exceed `threshold`.
    Confidence is already clamped into [0.0, 1.0] by Sprint 15.7's
    _normalize_confidence, so this is a plain numeric comparison —
    the "high"/"medium"/"low"/percentage handling all happened
    upstream. Sprint 16: this function itself is unchanged — which
    threshold to pass in (the main GROUNDING_CONFIDENCE_THRESHOLD or
    the relaxed GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC) is
    decided once, by visual-type category, in validate_normalized_
    visual below."""
    if confidence <= threshold:
        return (
            f"grounding confidence {confidence:.2f} does not exceed the "
            f"{threshold:.2f} threshold"
        )
    return None


# ------------------------
# Shared word-level helpers — used by both the OCR-consistency and
# hallucination checks below, since neither has access to a real NLP
# model.
# ------------------------

_STOPWORDS = frozenset({
    "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for",
    "with", "is", "are", "was", "were", "be", "been", "being", "this",
    "that", "these", "those", "it", "its", "as", "by", "from", "into",
    "onto", "about", "which", "who", "whom", "their", "there", "here",
    "has", "have", "had", "will", "can", "could", "would", "should",
    "may", "might", "shows", "shown", "showing", "figure", "diagram",
    "image", "illustrates", "depicts", "each", "also", "other", "some",
})


def _significant_words(text: Optional[str]) -> set[str]:
    """Lowercases, strips punctuation, and keeps words likely to
    carry actual meaning (length > 3, not in _STOPWORDS) — the coarse
    "content word" heuristic every check below is built on."""
    if not text:
        return set()
    words = re.findall(r"[a-zA-Z]+", text.casefold())
    return {word for word in words if len(word) > 3 and word not in _STOPWORDS}


# ------------------------
# OCR consistency — Qwen's description must not contradict a concrete
# term OCR actually read off the page (e.g. OCR says "Triangle" and
# the generated description says "Circle" instead).
# ------------------------

# Each entry pairs a canonical term with every surface form of it this
# check should treat as "the same claim." Two texts conflict when one
# names a canonical term from this table and the other names a
# *different* one, with no term shared between them. Deliberately
# small and shape-focused — the textbooks this pipeline processes are
# heavy on geometric diagrams — not meant to be exhaustive.
_CONFLICTING_TERM_FAMILIES: tuple[tuple[str, frozenset[str]], ...] = (
    ("triangle", frozenset({"triangle", "triangular", "triangles"})),
    ("circle", frozenset({"circle", "circular", "circles"})),
    ("square", frozenset({"square", "squares"})),
    ("rectangle", frozenset({"rectangle", "rectangular", "rectangles"})),
    ("pentagon", frozenset({"pentagon", "pentagonal"})),
    ("hexagon", frozenset({"hexagon", "hexagonal"})),
    ("oval", frozenset({"oval", "ellipse", "elliptical"})),
    ("cube", frozenset({"cube", "cubic"})),
    ("sphere", frozenset({"sphere", "spherical"})),
    ("cylinder", frozenset({"cylinder", "cylindrical"})),
    ("cone", frozenset({"cone", "conical"})),
    ("parallelogram", frozenset({"parallelogram"})),
    ("trapezoid", frozenset({"trapezoid", "trapezium"})),
)


def _term_families_in_text(text: str) -> set[str]:
    """Returns the canonical name of every _CONFLICTING_TERM_FAMILIES
    entry that has at least one of its surface forms present in
    `text` (case-insensitive, whole-word)."""
    if not text:
        return set()
    lowered = text.casefold()
    found: set[str] = set()
    for canonical, forms in _CONFLICTING_TERM_FAMILIES:
        if any(re.search(rf"\b{re.escape(term)}\b", lowered) for term in forms):
            found.add(canonical)
    return found


def _check_ocr_consistency(ocr: OcrInfo, education: NormalizedEducation) -> Optional[str]:
    """Flags the case Sprint 15.8 calls out by name: OCR read one
    concrete term off the page and the generated description/
    explanation asserts a different, conflicting one. Only fires when
    both sides actually name something concrete and the two sets are
    completely disjoint — a visual with no OCR text, or generated
    text that simply doesn't mention any of these terms, is never
    penalized (absence of a claim is not a contradiction of one)."""
    ocr_text = " ".join(filter(None, (ocr.text, ocr.summary)))
    generated_text = " ".join(filter(None, (
        education.grounded_description, education.student_explanation,
    )))

    ocr_terms = _term_families_in_text(ocr_text)
    generated_terms = _term_families_in_text(generated_text)

    if ocr_terms and generated_terms and ocr_terms.isdisjoint(generated_terms):
        return (
            f"OCR text names {sorted(ocr_terms)} but the generated "
            f"description names {sorted(generated_terms)} instead"
        )
    return None


# ------------------------
# Caption consistency — the generated explanation should agree with
# the visual's own caption/title, when one exists.
# ------------------------

def _check_caption_consistency(
    context: ValidationContext,
    education: NormalizedEducation,
    *,
    profile: ValidatorProfile,
) -> Optional[str]:
    """'Agree' is judged the same coarse way as the OCR check: do the
    caption/title (and, when `profile.include_ocr_in_caption_check`
    is True, this visual's own OCR text — see below) and the
    generated explanation share at least one meaningful word? A
    visual with no caption/title (common — many figures have none) is
    never penalized here; there is nothing to agree or disagree with.

    Sprint 16.1/16.2: `context` is the full ValidationContext (every
    deterministic field, not just caption/title), but this check
    deliberately only ever draws its own signal from caption/title
    plus — for profiles that opt in — OCR text/summary. Folding in
    subject/chapter/type here as well would let *any* explanation on
    the same subject trivially "agree," which defeats the point of a
    caption-specific consistency check; that broader evidence is
    exactly what _check_hallucinated_entities below uses instead.
    OCR is folded in per-profile (Diagram/Graph/Table — a graph's
    only OCR text is often its axis labels/numbers, and a table's OCR
    *is* its headers/values, both of which the generated explanation
    frequently does legitimately reference even when the caption
    itself is terse or absent) but never for Photograph, which stays
    judged against caption/title alone, exactly as Sprint 15.8
    always did."""
    caption_words = (
        _significant_words(context.caption) | _significant_words(context.title)
    )

    if profile.include_ocr_in_caption_check:
        caption_words = (
            caption_words
            | _significant_words(context.ocr_text)
            | _significant_words(context.ocr_summary)
        )

    if not caption_words:
        return None

    generated_words = (
        _significant_words(education.grounded_description)
        | _significant_words(education.student_explanation)
    )
    if not generated_words:
        # An empty description is already caught by the required-
        # field rule above; nothing further to say about consistency.
        return None

    if caption_words.isdisjoint(generated_words):
        label = context.caption or context.title
        return (
            "generated explanation shares no meaningful words with the "
            f"visual's caption/title ({label!r})"
        )
    return None


# ------------------------
# Visual type consistency — does the generated content actually look
# like the declared visual.type family, or could it just as easily
# have been written for any type at all? (Sprint 16.4 scoring
# component; feeds validate_normalized_visual's weighted score below,
# same as every other check in this file.)
# ------------------------

def _check_visual_type_consistency(
    visual_analysis: NormalizedVisualAnalysis,
    education: NormalizedEducation,
    *,
    profile: ValidatorProfile,
) -> Optional[str]:
    """For the Diagram and Graph Validators — the two profiles that
    carry a distinctive, non-empty allowed_entity_vocabulary — checks
    that the generated visible_entities/description actually contain
    at least one term from that visual-type family's own vocabulary.
    A "diagram" whose entities and description never mention a single
    point/line/angle/triangle/... word is generated content that
    could describe almost anything; that is a weaker signal than an
    outright contradiction, which is why this is a scored component
    (Sprint 16.4) rather than an outright rejection on its own.

    The Table and Photograph Validators carry no such vocabulary —
    there is no fixed set of "table words" or "photograph words" to
    check content against — so this always passes for them; their
    type-appropriateness is already covered by the OCR- and caption-
    consistency checks instead."""
    if not profile.allowed_entity_vocabulary:
        return None

    generated_words = (
        _significant_words(" ".join(visual_analysis.visible_entities))
        | _significant_words(education.grounded_description)
        | _significant_words(education.student_explanation)
    )
    if generated_words.isdisjoint(profile.allowed_entity_vocabulary):
        return (
            f"generated content shows no {profile.name}-typical terms "
            f"(expected at least one word from the {profile.name} "
            "vocabulary in the visible entities or description)"
        )
    return None


# ============================================================
# SPRINT 16.6 — EDUCATIONAL CONSISTENCY CHECKS
#
# _check_visual_type_consistency above asks "does the generated
# content look like this visual's own type family?" Sprint 16.6 asks
# a related but different question: "do the concepts this visual is
# generated to *teach* (education.teaches / education.
# curriculum_topics) actually belong to this visual's declared
# subject, chapter, and curriculum, or has Qwen generated a concept
# from an entirely different discipline?" A Mathematics visual whose
# generated concept is "Distance Formula" is consistent with its own
# subject even if nothing in OCR/caption spells out that exact
# phrase (this sprint's own worked PASS example); one whose generated
# concept is "Photosynthesis" is not (the worked FAIL example) — that
# is a biology concept surfacing on a Mathematics visual, a much
# stronger signal of a bad generation than "no evidence either way."
# ============================================================

# Seed curriculum vocabulary per subject family — deliberately not
# exhaustive (there is no way to enumerate every concept a textbook
# might teach), just enough common concept words per family to catch
# the clear-cut, cross-discipline case this sprint's brief names by
# example. Extend per-family as new subjects/textbooks are onboarded;
# nothing else in this file needs to change to pick up additions here.
_SUBJECT_CONCEPT_VOCABULARY: dict[str, frozenset[str]] = {
    "mathematics": frozenset({
        "distance", "formula", "formulas", "coordinate", "coordinates",
        "geometry", "geometric", "algebra", "algebraic", "equation",
        "equations", "trigonometry", "calculus", "polygon", "polygons",
        "angle", "angles", "triangle", "triangles", "circle", "circles",
        "axis", "axes", "origin", "slope", "graph", "graphs", "function",
        "functions", "variable", "variables", "fraction", "fractions",
        "ratio", "ratios", "percentage", "percentages", "probability",
        "statistics", "theorem", "proof", "vertex", "vertices", "area",
        "perimeter", "volume",
    }),
    "science": frozenset({
        "photosynthesis", "cell", "cells", "plant", "plants", "magnet",
        "magnets", "magnetic", "energy", "force", "forces", "ecosystem",
        "ecosystems", "organism", "organisms", "ecology", "chemical",
        "chemistry", "reaction", "reactions", "biology", "physics",
        "atom", "atoms", "molecule", "molecules", "gravity", "motion",
        "electricity", "evaporation", "respiration", "nutrition",
        "digestion", "habitat", "species", "nucleus", "tissue",
    }),
    "social_studies": frozenset({
        "revolution", "war", "civilization", "empire", "monarchy",
        "independence", "colonization", "dynasty", "government",
        "constitution", "democracy", "continent", "climate", "terrain",
        "latitude", "longitude", "population", "economy", "trade",
        "culture", "migration",
    }),
    "language_arts": frozenset({
        "grammar", "noun", "verb", "adjective", "sentence", "paragraph",
        "metaphor", "simile", "narrative", "protagonist", "theme",
        "vocabulary", "syllable", "poem", "poetry", "literature",
    }),
    "computer_science": frozenset({
        "algorithm", "algorithms", "variable", "variables", "loop",
        "loops", "function", "functions", "array", "arrays", "syntax",
        "compiler", "binary", "database", "software", "hardware",
    }),
}

# Free-text subject strings (VisualMetadata.subject, as written in
# whatever textbook this run processes) -> the _SUBJECT_CONCEPT_
# VOCABULARY family they belong to. Matched case-insensitively as
# either an exact match or a substring of the declared subject, so
# "Physics" / "Biology" / "Chemistry" (a textbook's actual subject
# field, not a top-level family) all resolve to "science".
_SUBJECT_FAMILY_ALIASES: dict[str, str] = {
    "mathematics": "mathematics", "math": "mathematics", "maths": "mathematics",
    "science": "science", "biology": "science", "chemistry": "science",
    "physics": "science",
    "social studies": "social_studies", "history": "social_studies",
    "geography": "social_studies", "civics": "social_studies",
    "language arts": "language_arts", "english": "language_arts",
    "literature": "language_arts",
    "computer science": "computer_science", "computing": "computer_science",
    "programming": "computer_science",
}


def _resolve_subject_family(subject: Optional[str]) -> Optional[str]:
    """Resolves a free-text VisualMetadata.subject to a
    _SUBJECT_CONCEPT_VOCABULARY family, or None if it doesn't match
    any known alias — an unrecognized subject is never treated as a
    conflict source, only as "no subject-vocabulary evidence either
    way" (see _check_educational_consistency)."""
    if not subject:
        return None
    normalized = subject.strip().casefold()
    if normalized in _SUBJECT_FAMILY_ALIASES:
        return _SUBJECT_FAMILY_ALIASES[normalized]
    for alias, family in _SUBJECT_FAMILY_ALIASES.items():
        if alias in normalized:
            return family
    return None


def _check_educational_consistency(
    context: ValidationContext,
    education: NormalizedEducation,
) -> Optional[str]:
    """Flags generated teaching concepts (education.teaches +
    education.curriculum_topics — what this sprint's examples call
    "Generated concept") that conflict with this visual's own
    declared subject. A concept is consistent when:

    - it shares a meaningful word with this visual's own
      ValidationContext (subject/chapter/caption/title/visual type —
      the worked PASS example's "Distance Formula" against chapter
      "Coordinate Geometry" would already pass here if the words
      matched directly), or
    - the declared subject resolves to a known family
      (_resolve_subject_family) and the concept shares a word with
      that family's own _SUBJECT_CONCEPT_VOCABULARY (the worked PASS
      example: "Distance Formula" against the Mathematics family's
      vocabulary, which names "distance"/"formula" directly), or
    - the declared subject doesn't resolve to any known family at
      all, or the concept itself has no significant words — nothing
      to check against, so never treated as a conflict.

    It conflicts — and only then is it flagged — when none of the
    above hold *and* the concept's words match a *different* known
    family's vocabulary (the worked FAIL example: "Photosynthesis" on
    a Mathematics visual matches the Science family, not Mathematics).
    A concept unrecognized by every family is left alone — Sprint
    16.6, like every other check in this file, only flags an outright
    contradiction, never mere unfamiliarity."""
    concepts = list(education.teaches) + list(education.curriculum_topics)
    if not concepts:
        return None

    context_words = _significant_words(context.grounding_text)
    declared_family = _resolve_subject_family(context.subject)
    declared_vocabulary = (
        _SUBJECT_CONCEPT_VOCABULARY.get(declared_family, frozenset())
        if declared_family else frozenset()
    )

    conflicts: list[tuple[str, str]] = []
    for concept in concepts:
        concept_words = _significant_words(concept)
        if not concept_words:
            continue
        if not concept_words.isdisjoint(context_words):
            continue
        if not concept_words.isdisjoint(declared_vocabulary):
            continue
        if not declared_family:
            continue
        for other_family, other_vocabulary in _SUBJECT_CONCEPT_VOCABULARY.items():
            if other_family == declared_family:
                continue
            if not concept_words.isdisjoint(other_vocabulary):
                conflicts.append((concept, other_family))
                break

    if conflicts:
        subject_label = context.subject or "the declared subject"
        return (
            f"{len(conflicts)} generated concept(s) conflict with "
            f"{subject_label!r}: "
            + ", ".join(f"{concept!r} matches {family}" for concept, family in conflicts)
        )
    return None


# ------------------------
# Hallucination detection — invisible objects, imaginary labels, and
# other claims nothing in this visual's own grounding context
# supports.
# ------------------------

# Below this many characters of combined OCR/caption/title/type text,
# there is too little grounding context to meaningfully judge any
# visible_entity against it — a visual with almost no OCR/caption
# text is never penalized for entities it introduces, since there is
# nothing here to contradict them (Qwen legitimately sees things no
# OCR pass or caption ever mentioned).
_MIN_GROUNDING_CONTEXT_CHARS = 15


# ============================================================
# SPRINT 16.5 — IMPROVED HALLUCINATION DETECTION
#
# _is_grounded (used by both _check_hallucinated_entities and Sprint
# 16.4's educational-entity-consistency score component) already
# collapses "why is this entity okay?" into a boolean. Sprint 16.5
# names the underlying distinction explicitly instead of leaving it
# implicit: an entity nothing in this visual's own grounding context
# mentions is not automatically a hallucination — it may be a
# reasonable *educational inference* (a coordinate axis, a grid, a
# triangle — ordinary classroom vocabulary a diagram legitimately
# contains even when OCR/caption never spelled it out) rather than a
# genuinely *invented object* with no place in this pipeline's
# subject matter at all (a dog, a tree, an airplane, a clock).
#
# _classify_entity_support below is that distinction made explicit:
# every entity resolves to exactly one of three labels, and only
# "unsupported" ever contributes to a rejection or a docked score —
# "context_grounded" and "educational_inference" both count as
# support, exactly like Sprint 16.3 specifies ("contribute positively
# ... rather than triggering rejection").
# ============================================================

def _classify_entity_support(
    entity: str,
    *,
    context_words: set[str],
    profile: ValidatorProfile,
    enable_entity_whitelist: bool = True,
) -> str:
    """Classifies one visible_entity's evidentiary support as one of:

    - "context_grounded" — shares a meaningful word with this
      visual's own ValidationContext (OCR/caption/title/subject/
      chapter/type/reference number). The strongest kind of support:
      something already known about *this specific visual*
      corroborates it.
    - "educational_inference" — not corroborated by context, but the
      entity itself is ordinary controlled classroom vocabulary: on
      this visual-type's own ValidatorProfile.allowed_entity_
      vocabulary (Sprint 16.2) or — when `enable_entity_whitelist` is
      True (Sprint 16.8's ENABLE_ENTITY_WHITELIST, default) — on
      Sprint 16.3's cross-subject _EDUCATIONAL_ENTITY_VOCABULARY
      (geometry/graphs/science/mathematics). Acceptable — Sprint
      16.5's worked example ("Coordinate axis", "Grid", "Triangle")
      is exactly this case — but weaker than context_grounded, since
      nothing about *this* visual specifically confirms it.
    - "unsupported" — neither corroborated by context nor part of any
      applicable controlled educational vocabulary: Sprint 16.5's
      "Dog", "Tree", "Airplane", "Clock" — objects with no place in
      this pipeline's subject matter. The only label that counts
      against a visual.

    An entity with no significant words of its own (too short/all
    stopwords) is treated as context_grounded — there is nothing
    meaningful in it to be unsupported about."""
    entity_words = _significant_words(entity)
    if not entity_words:
        return "context_grounded"
    if not entity_words.isdisjoint(context_words):
        return "context_grounded"
    if not entity_words.isdisjoint(profile.allowed_entity_vocabulary):
        return "educational_inference"
    if enable_entity_whitelist and not entity_words.isdisjoint(_EDUCATIONAL_ENTITY_VOCABULARY):
        return "educational_inference"
    return "unsupported"


def _check_hallucinated_entities(
    context: ValidationContext,
    visual_analysis: NormalizedVisualAnalysis,
    *,
    profile: ValidatorProfile,
    enable_entity_whitelist: bool = True,
) -> Optional[str]:
    """Flags visible_entities Qwen claims to see that share no
    meaningful word with this visual's own grounding context. This
    can never prove an entity is truly invisible or imaginary — it
    only means nothing already known about this visual corroborates
    it — so it is deliberately conservative: it only fires once there
    is enough grounding context to check against in the first place.

    Sprint 16.1: `context.grounding_text` is every deterministic field
    Sprint 16.1 added evidence for (OCR text/summary, caption, title,
    subject, chapter, visual type/subtype, and the figure/table
    reference number) — Objective 1's "use every available
    deterministic field before deciding metadata is unsupported"
    applies here, to every visual type, before any vocabulary
    exemption below is even considered.

    Sprint 16.2: on top of that wider context, an entity is also
    treated as grounded when it is itself one of the visible
    primitives in `profile.allowed_entity_vocabulary` — content that
    is routinely genuinely visible for that visual-type family with
    nothing in OCR/caption ever mentioning it (the Diagram and Graph
    Validators' allow-lists), which is exactly the false-rejection
    mode Sprint 16/16.2 exist to fix. The Table and Photograph
    Validators carry an empty vocabulary, so this reduces to
    "corroborated by context or rejected" for them — Photograph
    remains the strictest policy exactly as specified, and Table's
    corroboration is carried almost entirely by its OCR text (a
    table's headers/values), per its own brief.

    Sprint 16.3/16.5: an entity is also grounded when it falls on
    Sprint 16.3's cross-subject educational whitelist, regardless of
    profile — see _classify_entity_support, which this delegates to.
    Sprint 16.8: `enable_entity_whitelist` (ENABLE_ENTITY_WHITELIST)
    turns that cross-subject allowance off when False, reverting to
    "context or this profile's own vocabulary only." Only entities
    that classify as "unsupported" under whichever policy is active
    are ever flagged; this narrows, never disables, the check."""
    grounding_text = context.grounding_text
    if len(grounding_text) < _MIN_GROUNDING_CONTEXT_CHARS:
        return None

    context_words = _significant_words(grounding_text)
    if not context_words:
        return None

    ungrounded = [
        entity for entity in visual_analysis.visible_entities
        if _classify_entity_support(
            entity, context_words=context_words, profile=profile,
            enable_entity_whitelist=enable_entity_whitelist,
        ) == "unsupported"
    ]
    if ungrounded:
        return (
            f"{len(ungrounded)} visible entity(ies) have no support in this "
            "visual's grounding context and are not recognized educational "
            "vocabulary (possible hallucination): "
            + ", ".join(repr(entity) for entity in ungrounded)
        )
    return None


# ============================================================
# SPRINT 16.4 — CONFIDENCE-BASED VALIDATION (weighted scoring)
#
# Every check above still returns exactly the same thing it always
# did: None on success, a reason string on failure. Sprint 16.4 does
# not change what any individual rule decides — it changes how those
# decisions turn into an accept/reject verdict. Sprint 15.8/16 treated
# every rule as an equal, all-or-nothing veto: one docked rule (one
# unsupported entity out of a dozen, one weak caption match) rejected
# the whole visual regardless of how solid everything else was.
#
# Sprint 16.4 instead assigns each rule a point weight — this
# pipeline's own judgment of how much that rule actually says about
# whether the metadata is trustworthy — and accepts a visual once its
# *earned total* clears a threshold, rather than requiring a perfect
# score. A single unsupported entity now costs at most
# _SCORE_WEIGHTS["educational_entity_consistency"] points (scaled by
# how much of the entity list it actually is — see
# _score_educational_entity_consistency), not the whole result.
#
# The three required-field rules (non-empty description/explanation,
# at least one teaching concept) are deliberately *not* part of this
# score — see ValidationResult's docstring for why they remain a hard
# floor instead of purchasable points.
# ============================================================

# Point weight of each scored component. Must sum to 100 — see
# `assert sum(...)` immediately below, which fails fast (at import
# time) if that invariant is ever broken by an edit here.
_SCORE_WEIGHTS: dict[str, float] = {
    "ocr_consistency": 30.0,
    "caption_consistency": 20.0,
    "visual_type_consistency": 20.0,
    "educational_entity_consistency": 15.0,
    "metadata_completeness": 10.0,
    "grounding_confidence": 5.0,
}
assert abs(sum(_SCORE_WEIGHTS.values()) - 100.0) < 1e-9, "_SCORE_WEIGHTS must total 100"

# A visual is accepted once its earned score meets this fraction of
# the 100-point total. 70 is this sprint's named acceptance threshold.
_VALIDATION_SCORE_THRESHOLD = 70.0

# education/retrieval fields _score_metadata_completeness rewards
# beyond the three hard-floor required fields — richer metadata (more
# curriculum context, more retrieval surface) earns fuller credit,
# but a visual missing all of them still isn't rejected outright by
# this component alone; it only loses this component's own 10 points.
_COMPLETENESS_BONUS_FIELD_COUNT = 4


def _score_ocr_consistency(ocr: OcrInfo, education: NormalizedEducation) -> tuple[float, Optional[str]]:
    """30 points: full credit unless _check_ocr_consistency finds an
    outright contradiction (OCR says one concrete shape, the
    generated text says a different one) — the strongest possible
    signal something is wrong, so it stays the heaviest-weighted and
    still binary (there is no partial version of "contradicts the
    page")."""
    reason = _check_ocr_consistency(ocr, education)
    return (0.0, reason) if reason else (_SCORE_WEIGHTS["ocr_consistency"], None)


def _score_caption_consistency(
    context: ValidationContext, education: NormalizedEducation, *, profile: ValidatorProfile
) -> tuple[float, Optional[str]]:
    """20 points: full credit unless the generated explanation shares
    no meaningful word with the visual's own caption/title (plus OCR,
    for profiles that opt in — see ValidatorProfile.include_ocr_in_
    caption_check). Binary, like the underlying check: "agrees with
    zero words of its own caption" isn't a matter of degree."""
    reason = _check_caption_consistency(context, education, profile=profile)
    return (0.0, reason) if reason else (_SCORE_WEIGHTS["caption_consistency"], None)


def _score_visual_type_consistency(
    visual_analysis: NormalizedVisualAnalysis,
    education: NormalizedEducation,
    *,
    profile: ValidatorProfile,
) -> tuple[float, Optional[str]]:
    """20 points: full credit unless _check_visual_type_consistency
    finds the generated content contains none of this visual-type
    family's own vocabulary (always full credit for Table/
    Photograph, which carry no such vocabulary to check against)."""
    reason = _check_visual_type_consistency(visual_analysis, education, profile=profile)
    return (0.0, reason) if reason else (_SCORE_WEIGHTS["visual_type_consistency"], None)


def _score_educational_entity_consistency(
    context: ValidationContext,
    visual_analysis: NormalizedVisualAnalysis,
    *,
    profile: ValidatorProfile,
    enable_entity_whitelist: bool = True,
) -> tuple[float, Optional[str]]:
    """15 points, earned *proportionally*: unlike every other scored
    component this one is never all-or-nothing, because it is exactly
    the component Sprint 16.4's brief calls out by name — "prevents
    rejection because of one unsupported entity." A visual with ten
    visible_entities and one genuinely unsupported one earns 9/10 of
    this component's 15 points (13.5), not zero.

    Classification is Sprint 16.5's _classify_entity_support:
    "context_grounded" and "educational_inference" (Sprint 16.3's
    whitelist) both count as full support; only "unsupported" costs
    anything. A visual with no visible_entities at all, or too little
    grounding context to judge against (_MIN_GROUNDING_CONTEXT_CHARS
    — the same floor _check_hallucinated_entities itself uses),
    earns full credit — there is nothing to penalize."""
    weight = _SCORE_WEIGHTS["educational_entity_consistency"]
    entities = visual_analysis.visible_entities
    if not entities:
        return (weight, None)

    grounding_text = context.grounding_text
    if len(grounding_text) < _MIN_GROUNDING_CONTEXT_CHARS:
        return (weight, None)
    context_words = _significant_words(grounding_text)
    if not context_words:
        return (weight, None)

    unsupported = [
        entity for entity in entities
        if _classify_entity_support(
            entity, context_words=context_words, profile=profile,
            enable_entity_whitelist=enable_entity_whitelist,
        ) == "unsupported"
    ]
    if not unsupported:
        return (weight, None)

    supported_fraction = 1.0 - (len(unsupported) / len(entities))
    earned = round(weight * supported_fraction, 2)
    reason = (
        f"{len(unsupported)}/{len(entities)} visible entity(ies) are neither "
        "context-grounded nor recognized educational vocabulary: "
        + ", ".join(repr(entity) for entity in unsupported)
    )
    return (earned, reason)


def _score_metadata_completeness(education: NormalizedEducation, retrieval: NormalizedRetrieval) -> tuple[float, Optional[str]]:
    """10 points, earned proportionally across four optional
    richness fields (curriculum_topics, learning_objectives,
    retrieval_keywords, useful_for_questions) — not the three
    required fields, which are ValidationResult's hard floor and
    always present by the time this component is even reached (see
    validate_normalized_visual). This component rewards *how much*
    educationally-useful metadata a visual has beyond the bare
    minimum, rather than gating on it."""
    weight = _SCORE_WEIGHTS["metadata_completeness"]
    present = sum((
        bool(education.curriculum_topics),
        bool(education.learning_objectives),
        bool(retrieval.retrieval_keywords),
        bool(retrieval.useful_for_questions),
    ))
    if present == _COMPLETENESS_BONUS_FIELD_COUNT:
        return (weight, None)
    earned = round(weight * (present / _COMPLETENESS_BONUS_FIELD_COUNT), 2)
    return (
        earned,
        f"only {present}/{_COMPLETENESS_BONUS_FIELD_COUNT} optional metadata "
        "richness fields (curriculum_topics, learning_objectives, "
        "retrieval_keywords, useful_for_questions) are populated",
    )


def _score_grounding_confidence(confidence: float, *, threshold: float) -> tuple[float, Optional[str]]:
    """5 points: full credit if grounding_confidence clears the
    visual's applicable threshold (Sprint 16's relaxed/strict
    threshold_family, resolved the same way it always was), same
    binary pass/fail as _validate_confidence — this component is
    deliberately the lightest-weighted precisely because a single
    numeric self-report from Qwen is the weakest signal here."""
    reason = _validate_confidence(confidence, threshold=threshold)
    return (0.0, reason) if reason else (_SCORE_WEIGHTS["grounding_confidence"], None)


def _score_normalized_visual(
    visual: NormalizedVisual,
    *,
    context: ValidationContext,
    profile: ValidatorProfile,
    applicable_confidence_threshold: float,
    enable_entity_whitelist: bool = True,
) -> tuple[float, dict[str, float], list[str]]:
    """Runs every Sprint 16.4 scored component and returns (total
    score out of 100, per-component earned points, reasons for every
    component that didn't earn full marks). Pure aggregation — no
    accept/reject decision here; validate_normalized_visual makes
    that call by combining this with the hard-floor required-field
    rules."""
    education = visual.metadata.education
    retrieval = visual.metadata.retrieval
    visual_analysis = visual.metadata.visual_analysis
    visual_metadata = visual.visual.metadata

    scored = {
        "ocr_consistency": _score_ocr_consistency(visual_metadata.ocr, education),
        "caption_consistency": _score_caption_consistency(context, education, profile=profile),
        "visual_type_consistency": _score_visual_type_consistency(
            visual_analysis, education, profile=profile
        ),
        "educational_entity_consistency": _score_educational_entity_consistency(
            context, visual_analysis, profile=profile,
            enable_entity_whitelist=enable_entity_whitelist,
        ),
        "metadata_completeness": _score_metadata_completeness(education, retrieval),
        "grounding_confidence": _score_grounding_confidence(
            visual_analysis.grounding_confidence, threshold=applicable_confidence_threshold
        ),
    }

    component_scores = {name: earned for name, (earned, _reason) in scored.items()}
    reasons = [reason for _earned, reason in scored.values() if reason is not None]
    total = round(sum(component_scores.values()), 2)
    return total, component_scores, reasons


# ------------------------
# Entry points
# ------------------------

def validate_normalized_visual(
    visual: NormalizedVisual,
    *,
    confidence_threshold: float = GROUNDING_CONFIDENCE_THRESHOLD,
    confidence_threshold_diagrammatic: float = GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC,
    validation_config: Optional[ValidationConfig] = None,
) -> ValidationResult:
    """Sprint 15.8 entry point for a single visual: runs every
    grounding rule above against `visual.metadata` (and the
    VisualMetadata it was generated from, via `visual.visual.
    metadata`) and returns one ValidationResult. Never raises.

    Sprint 16.1: builds one ValidationContext for the visual
    (_build_validation_context) — every deterministic field, gathered
    once — and threads it into the caption-consistency and
    hallucination checks instead of each re-deriving its own subset
    of fields.

    Sprint 16.2: resolves the visual's own ValidatorProfile
    (_validator_profile_for, by visual.type) once and threads it into
    the confidence, caption-consistency, and hallucination checks —
    the one place a visual's type changes how it's judged.

    Sprint 16.4: replaces the old "every rule is a veto" logic with a
    weighted score (_score_normalized_visual — OCR consistency 30,
    caption consistency 20, visual type consistency 20, educational
    entity consistency 15, metadata completeness 10, grounding
    confidence 5, out of 100) accepted at >= the configured minimum
    score (see below). The three required-field rules (non-empty
    description/explanation, at least one teaching concept) stay a
    hard floor outside the score — see ValidationResult's docstring —
    since no amount of scoring elsewhere should rescue metadata with
    no description at all. `accepted` is True only when both the hard
    floor holds and the score clears the threshold; `reasons` reports
    every hard-floor failure and every component that didn't earn
    full marks, `score`/`component_scores` report the scoring
    verdict in full regardless of whether it was accepted.

    Sprint 16.8: `validation_config`, when given, is this run's single
    source of truth for every tunable validation knob — the
    acceptance threshold (config.min_score, replacing the hardcoded
    _VALIDATION_SCORE_THRESHOLD), which visual-type profiles are in
    effect (config.allow_diagram_inference / allow_graph_inference /
    strict_photo_validation, via _build_validator_profiles — replacing
    the fixed _DEFAULT_VALIDATOR_PROFILES), and whether the cross-
    subject educational whitelist is consulted at all
    (config.enable_entity_whitelist). `confidence_threshold` /
    `confidence_threshold_diagrammatic` are still honored when no
    `validation_config` is passed, for backward compatibility with
    existing callers that only ever tuned those two; passing a
    `validation_config` makes it the authority for confidence too, so
    a single object always describes exactly what a run was judged
    against."""
    education = visual.metadata.education
    visual_metadata = visual.visual.metadata

    if validation_config is None:
        validation_config = ValidationConfig(
            confidence_threshold=confidence_threshold,
            confidence_threshold_diagrammatic=confidence_threshold_diagrammatic,
        )

    profiles = _build_validator_profiles(validation_config)
    context = _build_validation_context(visual_metadata)
    profile = _validator_profile_for(visual_metadata.visual.type, profiles)
    applicable_confidence_threshold = _resolve_confidence_threshold(
        profile,
        confidence_threshold=validation_config.confidence_threshold,
        confidence_threshold_diagrammatic=validation_config.confidence_threshold_diagrammatic,
    )

    hard_floor_reasons: list[str] = [
        reason for reason in (
            _validate_required_field(education.grounded_description, field_name="description"),
            _validate_required_field(education.student_explanation, field_name="student explanation"),
            _validate_teaching_concepts(education.teaches),
        )
        if reason is not None
    ]

    score, component_scores, score_reasons = _score_normalized_visual(
        visual,
        context=context,
        profile=profile,
        applicable_confidence_threshold=applicable_confidence_threshold,
        enable_entity_whitelist=validation_config.enable_entity_whitelist,
    )

    accepted = not hard_floor_reasons and score >= validation_config.min_score
    reasons = tuple(hard_floor_reasons + score_reasons)

    return ValidationResult(
        accepted=accepted, reasons=reasons, score=score, component_scores=component_scores
    )


def validate_normalized_visual_batch(
    visuals: list[NormalizedVisual],
    *,
    confidence_threshold: float = GROUNDING_CONFIDENCE_THRESHOLD,
    confidence_threshold_diagrammatic: float = GROUNDING_CONFIDENCE_THRESHOLD_DIAGRAMMATIC,
    validation_config: Optional[ValidationConfig] = None,
) -> list[tuple[NormalizedVisual, ValidationResult]]:
    """Runs validate_normalized_visual over every NormalizedVisual.
    Validation cannot fail the way earlier batch stages could (every
    input produces exactly one ValidationResult), so — like Sprint
    15.7's normalize_enriched_visual_batch — nothing here is skipped
    or dropped: a rejected visual is paired with its ValidationResult,
    not discarded, so downstream stages can decide what to do with
    it. Every rejection is logged as a warning naming its reasons and
    (Sprint 16.2) the ValidatorProfile it was judged against, for
    Objective 5's "keep validation deterministic and explainable."
    Order follows `visuals`.

    Sprint 16.7: alongside the human-readable accept/reject log line,
    every visual also gets one structured diagnostics line (see
    ValidationReport / build_validation_report) — the machine-readable
    counterpart used for future tuning, not just this run's console
    output.

    Sprint 16.8: `validation_config`, when given, is resolved into
    this run's actual ValidatorProfile map (_build_validator_profiles)
    once, up front, and passed to every validate_normalized_visual
    call — so a single ValidationConfig governs both the accept/
    reject decision and what this function logs about it."""
    results: list[tuple[NormalizedVisual, ValidationResult]] = []
    total = len(visuals)
    profiles = _build_validator_profiles(validation_config) if validation_config is not None else None
    for i, visual in enumerate(visuals, start=1):
        object_key = visual.visual.metadata.storage.object_key
        profile = _validator_profile_for(visual.visual.metadata.visual.type, profiles)
        logger.info(
            "[%d/%d] Validating grounding for %s (validator=%s)",
            i, total, object_key, profile.name,
        )
        result = validate_normalized_visual(
            visual,
            confidence_threshold=confidence_threshold,
            confidence_threshold_diagrammatic=confidence_threshold_diagrammatic,
            validation_config=validation_config,
        )
        if not result.accepted:
            logger.warning(
                "Grounding validation rejected %s (validator=%s, score=%.2f/100): %s",
                object_key,
                profile.name,
                result.score,
                "; ".join(result.reasons),
            )
        else:
            logger.debug(
                "Grounding validation accepted %s (validator=%s, score=%.2f/100)",
                object_key, profile.name, result.score,
            )
        report = build_validation_report(visual, result, profile=profile)
        logger.info(
            "Validation diagnostics for %s: %s",
            object_key, json.dumps(report.to_dict(), sort_keys=True),
        )
        results.append((visual, result))
    return results


# ============================================================
# SPRINT 16.7 — DETAILED VALIDATION REPORT
#
# validate_normalized_visual_batch above already logs one human-
# readable line per visual ("accepted"/"rejected", a score, and a
# semicolon-joined reasons string). That's enough to read in a
# terminal, but nothing about it is structured: a rejected visual's
# "why" only ever existed as one opaque string, unusable for anything
# beyond a person reading that exact log line — not comparable across
# a run, not diffable between two runs with different thresholds, not
# something a future tuning pass could load and aggregate.
#
# build_validation_report turns a visual's already-computed
# ValidationResult into a ValidationReport: the same score, the same
# per-component breakdown, the same reasons — reshaped into named
# fields and a stable JSON shape (ValidationReport.to_dict) instead of
# a dict keyed by this file's internal component names. It never
# re-runs any check or changes any verdict; it is a pure, lossless
# view over a ValidationResult that already exists by the time it's
# called.
# ============================================================

def build_validation_report(
    visual: NormalizedVisual,
    result: ValidationResult,
    *,
    profile: Optional[ValidatorProfile] = None,
) -> ValidationReport:
    """Builds one visual's ValidationReport from the ValidationResult
    validate_normalized_visual already computed for it. `profile`, if
    not supplied, is re-resolved from the visual's own type via
    _validator_profile_for (the module-default profiles) purely for
    the report's own `validator_profile` label — it plays no part in
    scoring, which already happened inside `result`.

    Each named *_score field reads its own component out of
    `result.component_scores` by the same key _SCORE_WEIGHTS uses
    (see _score_normalized_visual) — missing entirely only if that
    component never ran, which validate_normalized_visual never
    leaves partially populated, so `.get(..., 0.0)` here is a
    defensive default, not an expected path."""
    visual_metadata = visual.visual.metadata
    if profile is None:
        profile = _validator_profile_for(visual_metadata.visual.type)
    components = result.component_scores
    return ValidationReport(
        object_key=visual_metadata.storage.object_key,
        visual_type=visual_metadata.visual.type,
        validator_profile=profile.name,
        accepted=result.accepted,
        overall_score=result.score,
        ocr_score=components.get("ocr_consistency", 0.0),
        caption_score=components.get("caption_consistency", 0.0),
        visual_score=components.get("visual_type_consistency", 0.0),
        entity_score=components.get("educational_entity_consistency", 0.0),
        completeness_score=components.get("metadata_completeness", 0.0),
        confidence_score=components.get("grounding_confidence", 0.0),
        warnings=result.reasons,
    )


def build_validation_report_batch(
    results: list[tuple[NormalizedVisual, ValidationResult]],
    *,
    profiles: Optional[dict[str, ValidatorProfile]] = None,
) -> list[ValidationReport]:
    """Runs build_validation_report over every (NormalizedVisual,
    ValidationResult) pair validate_normalized_visual_batch produced.
    `profiles`, if supplied (Sprint 16.8: this run's configured
    profiles, from _build_validator_profiles), is used to resolve each
    visual's own ValidatorProfile the same way that run's actual
    validation did, so a report's `validator_profile` label always
    matches the policy the visual was really judged against. Never
    fails — a ValidationReport always exists for every ValidationResult
    it's given. Order follows `results`."""
    return [
        build_validation_report(
            visual, result,
            profile=_validator_profile_for(visual.visual.metadata.visual.type, profiles),
        )
        for visual, result in results
    ]


def write_validation_reports_jsonl(reports: list[ValidationReport], path: str) -> int:
    """Appends one JSON object per line to `path` (created if it
    doesn't exist yet), one line per ValidationReport — the "future
    tuning" half of this sprint's brief: a durable, machine-readable
    record of every visual's validation diagnostics for a run,
    independent of whatever this run's own log level happened to be
    set to. Each line is ValidationReport.to_dict() plus the three
    identifying fields (object_key/visual_type/validator_profile) the
    brief's own dict shape doesn't carry, so a line is still traceable
    back to a specific visual without needing that run's logs at all.

    Appends rather than overwrites, so repeated runs against the same
    path accumulate history instead of erasing it. Never raises: a
    failure to write is logged and this returns 0, exactly like every
    other per-batch I/O stage in this file never lets one failure stop
    the pipeline. Returns the number of lines actually written."""
    if not reports:
        return 0
    try:
        with open(path, "a", encoding="utf-8") as handle:
            for report in reports:
                line = dict(report.to_dict())
                line["object_key"] = report.object_key
                line["visual_type"] = report.visual_type
                line["validator_profile"] = report.validator_profile
                handle.write(json.dumps(line, sort_keys=True))
                handle.write("\n")
    except OSError as exc:
        logger.warning("Failed to write validation reports to %s: %s", path, exc)
        return 0
    logger.info("Wrote %d validation diagnostics line(s) to %s", len(reports), path)
    return len(reports)


# ============================================================
# SPRINT 15.9 — METADATA UPDATE
#
# Sprint 15.8 handed back every visual paired with a ValidationResult:
# reliable enough to persist, or not. This stage's only job is to
# turn each *accepted* visual's NormalizedMetadata into the exact
# same metadata JSON object it was loaded from, with only the four
# sections this pipeline owns replaced. Ingestion's own fields
# (id/page/subject/chapter/ocr/storage/visual/caption/asset_type/...)
# are never touched, never reshaped, never re-validated — they are
# carried through unread, the same posture Sprint 15.3's
# VisualMetadata.raw has used since it was first introduced. No new
# local storage object is ever created; this always overwrites the one
# object_key a visual's metadata already lives at.
# ============================================================

# The only top-level keys this pipeline is allowed to write. Anything
# else in a visual's raw metadata dict — however this pipeline is
# extended in the future — must never be added to this tuple without
# also updating the Sprint 15.9 docstring above, since this is the
# one place "never overwrite ingestion metadata" is actually enforced.
_ENRICHMENT_SECTIONS = ("education", "retrieval", "visual_analysis", "assessment")


def _practice_question_to_dict(question: NormalizedPracticeQuestion) -> dict:
    return {
        "question": question.question,
        "answer": question.answer,
        "difficulty": question.difficulty,
    }


def normalized_metadata_to_dict(metadata: NormalizedMetadata) -> dict:
    """Converts one visual's NormalizedMetadata back into the plain
    JSON-serializable shape its metadata file's "education" /
    "retrieval" / "visual_analysis" / "assessment" keys must hold —
    the exact inverse of Sprint 15.7's normalize_educational_metadata,
    field-for-field against _RESPONSE_JSON_SCHEMA. Every value here
    already went through Sprint 15.7's normalization (trimmed,
    deduplicated, clamped, defaulted), so nothing further is cleaned
    or validated at this point — this is serialization only."""
    return {
        "education": {
            "grounded_description": metadata.education.grounded_description,
            "student_explanation": metadata.education.student_explanation,
            "teaches": list(metadata.education.teaches),
            "curriculum_topics": list(metadata.education.curriculum_topics),
            "learning_objectives": list(metadata.education.learning_objectives),
        },
        "retrieval": {
            "retrieval_keywords": list(metadata.retrieval.retrieval_keywords),
            "student_search_examples": list(metadata.retrieval.student_search_examples),
            "answerable_queries": list(metadata.retrieval.answerable_queries),
            "useful_for_questions": list(metadata.retrieval.useful_for_questions),
        },
        "visual_analysis": {
            "visible_entities": list(metadata.visual_analysis.visible_entities),
            "concept_relationships": list(metadata.visual_analysis.concept_relationships),
            "visual_role": metadata.visual_analysis.visual_role,
            "pedagogical_value": metadata.visual_analysis.pedagogical_value,
            "grounding_confidence": metadata.visual_analysis.grounding_confidence,
        },
        "assessment": {
            "misconceptions": list(metadata.assessment.misconceptions),
            "practice_questions": [
                _practice_question_to_dict(question)
                for question in metadata.assessment.practice_questions
            ],
            "difficulty": metadata.assessment.difficulty,
        },
    }


def build_updated_metadata(
    visual_metadata: VisualMetadata, normalized: NormalizedMetadata
) -> dict:
    """Builds the exact dict Sprint 15.9 writes back for one visual:
    a shallow copy of its original raw metadata (visual_metadata.raw
    — never mutated in place, so the VisualMetadata this came from
    stays valid if something else in this run still reads it) with
    only _ENRICHMENT_SECTIONS overwritten from `normalized`. Every
    ingestion field this pipeline never modeled as a VisualMetadata
    attribute — "asset_type", anything ingestion adds in the future —
    survives untouched because it was never removed from the copy to
    begin with."""
    updated = dict(visual_metadata.raw)
    updated.update(normalized_metadata_to_dict(normalized))
    return updated


class MetadataWriteError(RuntimeError):
    """Raised by write_visual_metadata when a visual's updated
    metadata JSON cannot be written back to local storage. Caught
    per-visual by write_visual_metadata_batch so one failed upload
    never stops the rest of the batch from being persisted — same
    resilience posture as every earlier stage in this file."""

def write_visual_metadata(storage: LocalImageStorage, visual: NormalizedVisual) -> None:
    """
    Overwrite the existing metadata JSON in local storage with the enriched metadata.
    """
    visual_metadata = visual.visual.metadata
    object_key = visual_metadata.metadata_key
    bucket = visual_metadata.metadata_bucket

    updated = build_updated_metadata(
        visual_metadata,
        visual.metadata,
    )

    try:
        storage.upload_json(
            object_key,
            updated,
            bucket=bucket,
        )
    except Exception as exc:
        raise MetadataWriteError(
            f"{object_key}: failed to write updated metadata to bucket={bucket!r} ({exc})"
        ) from exc

    logger.info(
        "Updated metadata for %s (bucket=%s)",
        object_key,
        bucket,
    )
def write_visual_metadata_batch(
    storage: LocalImageStorage,
    results: list[tuple[NormalizedVisual, ValidationResult]],
) -> list[NormalizedVisual]:
    """Runs write_visual_metadata over every visual Sprint 15.8 marked
    accepted=True. A visual Sprint 15.8 rejected is skipped and logged
    rather than written — this pipeline never persists metadata it
    has itself flagged as educationally unreliable. A visual whose
    write itself fails is also skipped and logged, never allowed to
    raise out of the batch. Order follows `results`. Returns exactly
    the visuals actually written."""
    total = len(results)
    written: list[NormalizedVisual] = []
    for i, (visual, validation) in enumerate(results, start=1):
        object_key = visual.visual.metadata.storage.object_key
        if not validation.accepted:
            logger.info(
                "[%d/%d] Skipping metadata write for %s — rejected by grounding "
                "validation: %s",
                i, total, object_key, "; ".join(validation.reasons),
            )
            continue
        logger.info("[%d/%d] Writing metadata for %s", i, total, object_key)
        try:
            write_visual_metadata(storage, visual)
        except MetadataWriteError as exc:
            logger.warning("Failed to write metadata for %s: %s", object_key, exc)
            continue
        written.append(visual)
    return written


# ============================================================
# SPRINT 15.10 — QDRANT PAYLOAD UPDATE
#
# Sprint 15.9 rewrote each accepted visual's own metadata JSON in
# local storage. This stage's only job is to bring that same visual's
# *existing* Qdrant point's payload up to date with it. The point
# itself — its vector, its id, every payload key ingestion's Qdrant
# Upload stage already wrote — was created exactly once, by
# ingestion; nothing here re-embeds, upserts, or otherwise creates a
# point. Only visuals Sprint 15.9 actually wrote to local storage are
# considered — a visual whose metadata write was skipped or failed is
# never touched here either, so the metadata JSON and the Qdrant
# payload can't drift apart.
# ============================================================

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _qdrant_point_id(visual_id: str) -> str:
    """Reproduces ingest_textbook_images.py's _qdrant_point_id
    exactly (uuid5 over the same NAMESPACE_URL/id pair). Ingestion's
    EmbeddingRecord.id is metadata["id"] — the same "id" field
    VisualMetadata.id carries here — so this always resolves to the
    exact point ingestion already created for this visual, never a
    new one."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, visual_id))


def _pass2_text_block(header: str, items: list[str]) -> list[str]:
    """Mirrors ingest_textbook_images.py's _search_text_block: one
    "Header:" line followed by each non-empty item on its own line,
    or nothing at all if there's nothing to list."""
    items = [str(item).strip() for item in items if str(item).strip()]
    if not items:
        return []
    return [f"{header}:", *items]


def _pass2_text_line(header: str, value: Optional[str]) -> list[str]:
    """Mirrors ingest_textbook_images.py's _search_text_line: one
    "Header: value" line, or nothing at all if the value is missing
    (None, "", or blank after stripping)."""
    value = (value or "").strip()
    if not value:
        return []
    return [f"{header}: {value}"]


# ============================================================
# SPRINT 15.11 — PASS-2 SEARCH REPRESENTATION
#
# build_pass2_retrieval_text is what students actually search
# against. It combines two things that live in two different
# objects — ingestion's own context for this visual (subject,
# chapter, visual type, caption, OCR summary — VisualMetadata,
# never regenerated, only reused) and everything Sprint 15.6's Qwen
# pass generated about it (grounded description, student
# explanation, taught concepts, curriculum topics, learning
# objectives, retrieval keywords, student search examples,
# answerable queries, visual role, pedagogical value —
# NormalizedMetadata) — into one clean, labeled text block. Every
# block is optional: a visual missing a given field (no caption, no
# OCR, a Qwen section that normalized to empty) simply omits that
# block rather than padding the text with an empty header.
# ============================================================

def build_pass2_retrieval_text(
    visual_metadata: VisualMetadata, metadata: NormalizedMetadata
) -> str:
    """Sprint 15.11's educational search representation: the
    retrieval document students actually search against, built from
    ingestion's own subject/chapter/visual-type/caption/OCR context
    (visual_metadata) plus every field Sprint 15.6's Qwen pass
    generated (metadata — the education/retrieval/visual_analysis
    sections). Stored under its own "pass2_retrieval_text" payload
    key — alongside, never over, ingestion's "search_text" — so a
    search backend can query either pass independently.

    Structure (blank-line separated, header-labeled blocks, mirroring
    ingest_textbook_images.py's _build_structured_search_text):
        Subject
        Chapter
        Visual Type
        Caption
        OCR Summary
        Grounded Description
        Student Explanation
        Concepts Taught
        Curriculum Topics
        Learning Objectives
        Retrieval Keywords
        Student Search Examples
        Answerable Queries
        Visual Role
        Pedagogical Value
    Any block whose source value is empty is omitted, never
    padded in as an empty header.
    """
    visual_info = visual_metadata.visual

    blocks: list[list[str]] = [b for b in (
        _pass2_text_line("Subject", visual_metadata.subject),
        _pass2_text_line("Chapter", visual_metadata.chapter),
        _pass2_text_line("Visual Type", (visual_info.type or "").title() or None),
        _pass2_text_line("Caption", visual_info.caption),
        _pass2_text_line("OCR Summary", visual_metadata.ocr.summary),
    ) if b]

    if metadata.education.grounded_description:
        blocks.append(["Grounded Description:", metadata.education.grounded_description])
    if metadata.education.student_explanation:
        blocks.append(["Student Explanation:", metadata.education.student_explanation])

    for header, items in (
        ("Concepts Taught", metadata.education.teaches),
        ("Curriculum Topics", metadata.education.curriculum_topics),
        ("Learning Objectives", metadata.education.learning_objectives),
        ("Retrieval Keywords", metadata.retrieval.retrieval_keywords),
        ("Student Search Examples", metadata.retrieval.student_search_examples),
        ("Answerable Queries", metadata.retrieval.answerable_queries),
    ):
        block = _pass2_text_block(header, items)
        if block:
            blocks.append(block)

    if metadata.visual_analysis.visual_role:
        blocks.append(["Visual Role:", metadata.visual_analysis.visual_role])
    if metadata.visual_analysis.pedagogical_value:
        blocks.append(["Pedagogical Value:", metadata.visual_analysis.pedagogical_value])

    return "\n\n".join("\n".join(block) for block in blocks)


@dataclass(frozen=True)
class Pass2SearchVisual:
    """One visual Sprint 15.9 wrote to local storage, paired with the Sprint
    15.11 search text built for it — Sprint 15.12's explicit "Generate
    Pass-2 Search Representation" pipeline stage, sitting between the
    metadata write-back and the Qdrant payload update so the text is
    built exactly once and simply carried into the payload update
    rather than recomputed there."""
    visual: NormalizedVisual
    pass2_text: str


def build_pass2_search_representation(visual: NormalizedVisual) -> Pass2SearchVisual:
    """Sprint 15.12 entry point for a single visual: runs
    build_pass2_retrieval_text over its VisualMetadata + NormalizedMetadata
    and pairs the result with the visual it came from. Pure text
    formatting over already-validated, already-normalized data — like
    Sprint 15.5's build_prompt_package, this cannot fail per-visual."""
    text = build_pass2_retrieval_text(visual.visual.metadata, visual.metadata)
    return Pass2SearchVisual(visual=visual, pass2_text=text)


def build_pass2_search_representation_batch(
    visuals: list[NormalizedVisual],
) -> list[Pass2SearchVisual]:
    """Runs build_pass2_search_representation over every visual Sprint
    15.9 actually wrote to local storage. Cannot fail the way earlier batch
    stages could (every input produces exactly one Pass2SearchVisual),
    so — like build_prompt_package_batch and
    normalize_enriched_visual_batch — nothing here is skipped or
    logged as a failure. Order follows `visuals`."""
    total = len(visuals)
    results: list[Pass2SearchVisual] = []
    for i, visual in enumerate(visuals, start=1):
        object_key = visual.visual.metadata.storage.object_key
        result = build_pass2_search_representation(visual)
        logger.info(
            "[%d/%d] Built pass-2 search representation for %s (%d chars)",
            i, total, object_key, len(result.pass2_text),
        )
        results.append(result)
    return results


def build_qdrant_payload_update(
    visual: NormalizedVisual,
    pass2_text: str,
    *,
    pipeline_version: str = PIPELINE_VERSION,
    enrichment_timestamp: Optional[str] = None,
) -> dict:
    """Builds the partial payload Sprint 15.10 sends to Qdrant's
    set_payload — only the keys this pipeline owns. set_payload
    merges by top-level key, so leaving "metadata"/"image"/
    "search_text"/"storage_key"/"public_url" out of this dict (rather
    than rebuilding and resending them) is exactly what preserves the
    existing payload ingestion wrote. "education_metadata" mirrors
    Sprint 15.9's normalized_metadata_to_dict verbatim (the same four
    sections just written to the metadata JSON); grounding_confidence
    is additionally promoted to its own top-level key so it can be
    filtered on directly without reaching into the nested object.
    `pass2_text` is taken as already built — Sprint 15.12's explicit
    Generate Pass-2 Search Representation stage
    (build_pass2_search_representation_batch) builds it once, upstream
    of this call, rather than this function recomputing it."""
    metadata = visual.metadata
    return {
        "education_metadata": normalized_metadata_to_dict(metadata),
        "pass2_retrieval_text": pass2_text,
        "enrichment_timestamp": enrichment_timestamp or _utc_now_iso(),
        "pipeline_version": pipeline_version,
        "grounding_confidence": metadata.visual_analysis.grounding_confidence,
    }


class QdrantPayloadUpdateError(RuntimeError):
    """Raised when a visual's existing Qdrant point can't be located
    or its payload can't be updated. Caught per-visual by
    update_qdrant_payload_batch so one failure never stops the rest
    of the batch — same resilience posture as MetadataWriteError."""


def locate_qdrant_point(client: Any, collection: str, visual_id: str) -> Optional[str]:
    """Sprint 15.10's "locate the visual record" responsibility:
    derives visual_id's deterministic Qdrant point id and confirms a
    point with that id already exists in `collection`, returning None
    (never inventing a point id for a point that isn't there) if it
    doesn't — so callers never call set_payload their way into
    creating a point that should have come from ingestion's Qdrant
    Upload stage instead."""
    point_id = _qdrant_point_id(visual_id)
    try:
        records = client.retrieve(
            collection_name=collection, ids=[point_id], with_payload=False, with_vectors=False,
        )
    except Exception as exc:
        raise QdrantPayloadUpdateError(
            f"{visual_id}: failed to look up Qdrant point {point_id!r} ({exc})"
        ) from exc

    return point_id if records else None


def update_qdrant_payload(
    client: Any,
    collection: str,
    item: Pass2SearchVisual,
    *,
    pipeline_version: str = PIPELINE_VERSION,
    enrichment_timestamp: Optional[str] = None,
) -> bool:
    """Sprint 15.10 entry point for a single visual: locates its
    existing Qdrant point (never creates one) and updates only that
    point's payload via set_payload, which merges by key — leaving
    every other payload field, the point's vector, and its id
    untouched, and never inserting or duplicating a point. Returns
    False if no matching point exists yet (that visual was never
    uploaded by ingestion — this pipeline does not create Qdrant
    points, only updates them); raises QdrantPayloadUpdateError, never
    any other exception, on an actual lookup/update failure. Takes a
    Pass2SearchVisual (Sprint 15.12's explicit search-representation
    stage output) rather than a bare NormalizedVisual, so the payload
    it builds carries that stage's already-built pass2_text instead
    of recomputing it."""
    visual = item.visual
    visual_id = visual.visual.metadata.id
    point_id = locate_qdrant_point(client, collection, visual_id)
    if point_id is None:
        logger.warning(
            "No existing Qdrant point for visual id=%s — skipping payload update "
            "(run ingestion's Qdrant Upload stage first).",
            visual_id,
        )
        return False

    update = build_qdrant_payload_update(
        visual, item.pass2_text,
        pipeline_version=pipeline_version,
        enrichment_timestamp=enrichment_timestamp,
    )

    try:
        client.set_payload(collection_name=collection, payload=update, points=[point_id])
    except Exception as exc:
        raise QdrantPayloadUpdateError(
            f"{visual_id}: failed to update Qdrant payload for point {point_id!r} ({exc})"
        ) from exc

    logger.info("Updated Qdrant payload for visual id=%s (point=%s)", visual_id, point_id)
    return True


def update_qdrant_payload_batch(
    client: Optional[Any],
    collection: str,
    items: list[Pass2SearchVisual],
    *,
    pipeline_version: str = PIPELINE_VERSION,
) -> list[NormalizedVisual]:
    """Runs update_qdrant_payload over every Pass2SearchVisual Sprint
    15.12's search-representation stage built — same resilience
    posture as write_visual_metadata_batch: one visual's failed
    lookup/update is logged and skipped, never allowed to crash the
    batch. `client` is None whenever Qdrant was unreachable at startup
    (init_qdrant_client's best-effort init), in which case every
    visual is skipped with a single warning rather than one per
    visual. One shared enrichment_timestamp is used for the whole
    run, so every payload this call updates carries the same
    timestamp. Order follows `items`. Returns exactly the
    NormalizedVisuals actually updated."""
    if client is None:
        if items:
            logger.warning(
                "Qdrant is unavailable — skipping payload update for %d visual(s).",
                len(items),
            )
        return []

    enrichment_timestamp = _utc_now_iso()
    total = len(items)
    updated: list[NormalizedVisual] = []
    for i, item in enumerate(items, start=1):
        visual_id = item.visual.visual.metadata.id
        logger.info("[%d/%d] Updating Qdrant payload for visual id=%s", i, total, visual_id)
        try:
            did_update = update_qdrant_payload(
                client, collection, item,
                pipeline_version=pipeline_version, enrichment_timestamp=enrichment_timestamp,
            )
        except QdrantPayloadUpdateError as exc:
            logger.warning("Failed to update Qdrant payload for visual id=%s: %s", visual_id, exc)
            continue
        if did_update:
            updated.append(item.visual)
    return updated


# --------------------------------------------------------
# Console Output
# --------------------------------------------------------

def _line(label: str, value: Any) -> str:
    return f"{label.ljust(7)} : {value}"


# ============================================================
# SPRINT 15.12 — SUMMARY STATISTICS
#
# Every earlier stage already returns (or logs) its own count. This
# stage's only job is to turn those raw per-stage counts into the
# four headline numbers a person watching this pipeline actually
# wants: how many visuals were processed, how many came out fully
# enriched, how many were intentionally skipped (not unreliable
# enough to fail, just not trustworthy enough to keep), and how many
# were dropped by an actual error. Nothing here re-queries local
# storage or Qdrant — it only counts lists main() already collected.
# ============================================================

@dataclass(frozen=True)
class PipelineStats:
    """Sprint 15.12's end-of-run summary.
        processed — every visual this run considered (discovered by
            Sprint 15.2, already past --force filtering)
        enriched  — visuals that made it all the way through Qwen
            generation, normalization, grounding validation, and a
            successful metadata JSON write to local storage
        skipped   — visuals Sprint 15.8's grounding validation
            rejected as not educationally reliable enough to persist
            (an intentional skip, not an error)
        failed    — visuals dropped by a hard error at an earlier
            stage: invalid metadata, an unretrievable image, a failed
            Qwen call/parse, or a failed metadata write
    Qdrant payload updates are reported separately
    (qdrant_updated/qdrant_skipped) since a fully enriched visual can
    still have no existing Qdrant point to update (it was never
    uploaded by ingestion) — that is not an enrichment failure."""
    processed: int
    enriched: int
    skipped: int
    failed: int
    qdrant_updated: int
    qdrant_skipped: int


def compute_pipeline_stats(
    *,
    found: int,
    loaded: int,
    downloaded: int,
    generated: int,
    validated: int,
    accepted: int,
    written: int,
    qdrant_updated: int,
) -> PipelineStats:
    """Sprint 15.12 entry point: turns the raw per-stage counts main()
    already collected into PipelineStats. `hard_failures` sums every
    stage boundary where a visual can be dropped by an actual error
    (invalid metadata, an unretrievable image, a failed Qwen call, a
    failed metadata write) — grounding-validation rejections are
    counted separately as `skipped` since that's this pipeline
    deciding a visual isn't reliable enough, not a stage failing."""
    hard_failures = (
        (found - loaded)
        + (loaded - downloaded)
        + (downloaded - generated)
        + (accepted - written)
    )
    grounding_skips = validated - accepted
    return PipelineStats(
        processed=found,
        enriched=written,
        skipped=grounding_skips,
        failed=hard_failures,
        qdrant_updated=qdrant_updated,
        qdrant_skipped=written - qdrant_updated,
    )


def print_header(
    config: EnrichmentConfig,
    *,
    found: int,
    loaded: Optional[int] = None,
    downloaded: Optional[int] = None,
    prompted: Optional[int] = None,
    enriched: Optional[int] = None,
    normalized: Optional[int] = None,
    validated: Optional[int] = None,
    accepted: Optional[int] = None,
    written: Optional[int] = None,
    pass2_built: Optional[int] = None,
    qdrant_updated: Optional[int] = None,
    validation_reports: Optional[int] = None,
) -> None:
    print("=" * 41)
    print("Educational Visual Enrichment")
    print("=" * 41)
    print()
    print(_line("Subject", ", ".join(config.subjects) if config.subjects else "All"))
    print(_line("Chapter", ", ".join(config.chapters) if config.chapters else "All"))
    if config.pages:
        print(_line("Page", ", ".join(str(p) for p in config.pages)))
    print(_line("Model", config.vision_model))
    print(_line("MinConf", config.confidence_threshold))
    print(_line("MinConf (diagrammatic)", config.confidence_threshold_diagrammatic))
    print(_line("MinScore", config.grounding_min_score))
    print(_line("Allow Diagram Inference", config.allow_diagram_inference))
    print(_line("Allow Graph Inference", config.allow_graph_inference))
    print(_line("Strict Photo Validation", config.strict_photo_validation))
    print(_line("Entity Whitelist", config.enable_entity_whitelist))
    print(_line("Force", config.force))
    print(_line("Dry Run", config.dry_run))
    print()
    print(f"Found {found} accepted visuals")
    if loaded is not None:
        print(f"Loaded {loaded} with valid metadata")
    if downloaded is not None:
        print(f"Downloaded {downloaded} image(s) from local storage")
    if prompted is not None:
        print(f"Built {prompted} educational prompt(s) for Qwen Vision")
    if enriched is not None:
        print(f"Generated educational metadata for {enriched} visual(s) via Qwen Vision")
    if normalized is not None:
        print(f"Normalized educational metadata for {normalized} visual(s)")
    if validated is not None:
        print(f"Ran grounding validation on {validated} visual(s)")
    if accepted is not None:
        print(f"Accepted {accepted} visual(s) as educationally reliable")
    if written is not None:
        print(f"Updated metadata JSON for {written} visual(s) in local storage")
    if pass2_built is not None:
        print(f"Built pass-2 search representation for {pass2_built} visual(s)")
    if qdrant_updated is not None:
        print(f"Updated Qdrant payload for {qdrant_updated} visual(s)")
    if validation_reports is not None:
        report_target = config.validation_report_path or "logs only"
        print(f"Built {validation_reports} validation diagnostics report(s) ({report_target})")

    # Sprint 15.12 — Summary: only printed for a real (non-dry-run)
    # pass all the way through the pipeline, since every count it
    # needs only exists once every stage has actually run.
    if (
        loaded is not None and downloaded is not None and enriched is not None
        and validated is not None and accepted is not None and written is not None
        and qdrant_updated is not None
    ):
        stats = compute_pipeline_stats(
            found=found, loaded=loaded, downloaded=downloaded, generated=enriched,
            validated=validated, accepted=accepted, written=written,
            qdrant_updated=qdrant_updated,
        )
        print()
        print("-" * 41)
        print("Summary")
        print("-" * 41)
        print(_line("Processed", stats.processed))
        print(_line("Enriched", stats.enriched))
        print(_line("Skipped", stats.skipped))
        print(_line("Failed", stats.failed))
        print(_line("Qdrant", f"{stats.qdrant_updated} updated, {stats.qdrant_skipped} skipped"))


# --------------------------------------------------------
# Runtime Entry Point
# --------------------------------------------------------

def main(argv: Optional[list[str]] = None) -> None:
    args = parse_args(argv)
    init_logging(args.log_level)
    config = build_config(args)

    # Sprint 15.1 — Part: fail fast on local storage (this pipeline's
    # only required dependency), then best-effort-initialize Qdrant and
    # the Qwen vision runtime so Sprint 15.2's processing loop has both
    # ready to inject — neither is queried or written to yet.
    storage = init_storage(config)

    # -----------------------------
    # TEMPORARY DEBUG
    # -----------------------------
    permissions = storage.verify_permissions()
    print(storage.permissions_report(permissions))
    qdrant_client = init_qdrant_client(config)
    vision_runtime = init_vision_runtime(config)
    # Sprint 15.12 — built explicitly here (rather than left to
    # generate_educational_metadata_batch's own default) so --model /
    # config.vision_model actually reaches the Qwen Vision call this
    # run makes, instead of silently falling back to the VISION_MODEL
    # environment default.
    vision_backend = OllamaQwenBackend(
        base_url=config.ollama_url, model=config.vision_model, runtime=vision_runtime,
    )

    assets = discover_accepted_visuals(storage, config)
    metadata_list = load_visual_metadata_batch(assets)

    # Sprint 15.4 — Local Storage Image Retrieval: --dry-run means "list what
    # would be enriched without downloading images" (see
    # build_arg_parser above), so the actual download only runs for a
    # real pass.
    if config.dry_run:
        for metadata in metadata_list:
            logger.info(
                "[DRY RUN] %s — page %s, %s/%s, subject=%s, chapter=%s",
                metadata.storage.object_key,
                metadata.page.pdf if metadata.page.pdf is not None else metadata.page.textbook,
                metadata.visual.type, metadata.visual.subtype,
                metadata.subject, metadata.chapter,
            )
        print_header(config, found=len(assets), loaded=len(metadata_list))
        return

    visuals = download_visual_image_batch(storage, metadata_list)

    enriched = generate_educational_metadata_batch(visuals, backend=vision_backend)

    normalized = normalize_enriched_visual_batch(enriched)

    # Sprint 15.8 — Grounding Validation: decides whether each visual's
    # NormalizedMetadata is educationally reliable, not just well-typed.
    # Nothing is dropped here — every visual comes back paired with its
    # ValidationResult — so Sprint 15.9 below decides what to do with
    # rejected ones.
    #
    # Sprint 16.8 — validation_config is this run's single source of
    # truth for every tunable validation knob (min-score, diagram/
    # graph inference toggles, photo strictness, entity whitelist),
    # built once from this run's CLI/env EnrichmentConfig so a single
    # object governs both the accept/reject decision and (Sprint 16.7,
    # below) what gets reported about it.
    validation_config = config.to_validation_config()
    validation_results = validate_normalized_visual_batch(
        normalized, validation_config=validation_config,
    )
    accepted_count = sum(1 for _, result in validation_results if result.accepted)

    # Sprint 16.7 — Detailed Validation Report: structured, per-visual
    # diagnostics (accepted, overall score, every scored component,
    # warnings) for logging and future tuning. Used for logging and
    # future tuning only — never written into a visual's metadata JSON
    # or its Qdrant payload (see Sprint 15.9/15.10 below, both
    # untouched by this). validate_normalized_visual_batch already
    # logged one line per visual; --validation-report-path/
    # VALIDATION_REPORT_PATH additionally persists the same
    # diagnostics as JSONL for anything beyond this run's own logs.
    validation_reports = build_validation_report_batch(
        validation_results, profiles=_build_validator_profiles(validation_config),
    )
    if config.validation_report_path:
        write_validation_reports_jsonl(validation_reports, config.validation_report_path)

    # Sprint 15.9 — Metadata Update: overwrites each accepted visual's own
    # metadata JSON in local storage with its validated NormalizedMetadata — only
    # the "education"/"retrieval"/"visual_analysis"/"assessment" sections
    # change, every ingestion field survives untouched. Rejected visuals
    # are never written.
    written = write_visual_metadata_batch(storage, validation_results)

    # Sprint 15.12 — Generate Pass-2 Search Representation: builds the
    # Sprint 15.11 search text once, up front, for exactly the visuals
    # Sprint 15.9 just wrote — the Qdrant update below only ever
    # carries that already-built text, never recomputes it.
    pass2_visuals = build_pass2_search_representation_batch(written)

    # Sprint 15.10 — Qdrant Payload Update: brings each written
    # visual's *existing* Qdrant point's payload in line with the
    # metadata JSON just written — never a new point, never a new
    # embedding. Only visuals write_visual_metadata_batch actually
    # wrote (and Sprint 15.12 built search text for) are considered,
    # so the two stores never disagree.
    qdrant_updated = update_qdrant_payload_batch(
        qdrant_client, config.collection_name, pass2_visuals,
    )

    print_header(
        config,
        found=len(assets),
        loaded=len(metadata_list),
        downloaded=len(visuals),
        enriched=len(enriched),
        normalized=len(normalized),
        validated=len(validation_results),
        accepted=accepted_count,
        written=len(written),
        pass2_built=len(pass2_visuals),
        qdrant_updated=len(qdrant_updated),
        validation_reports=len(validation_reports),
    )


if __name__ == "__main__":
    main()


__all__ = [
    "EnrichmentConfig",
    "build_arg_parser",
    "parse_args",
    "build_config",
    "init_logging",
    "init_storage",
    "init_qdrant_client",
    "init_vision_runtime",
    "VisualAssetRecord",
    "discover_visual_assets",
    "VisualAsset",
    "discover_accepted_visuals",
    "VisualMetadataError",
    "PageInfo",
    "StorageInfo",
    "OcrInfo",
    "VisualInfo",
    "VisualMetadata",
    "load_visual_metadata",
    "load_visual_metadata_batch",
    "ImageRetrievalError",
    "EnrichmentVisual",
    "download_visual_image",
    "download_visual_image_batch",
    "PromptPackage",
    "build_prompt_context",
    "build_enrichment_prompt",
    "build_prompt_package",
    "build_prompt_package_batch",
    "QwenVisionBackend",
    "OllamaQwenBackend",
    "EducationGenerationError",
    "generate_educational_metadata",
    "EnrichedVisual",
    "generate_educational_metadata_batch",
    "NormalizedEducation",
    "NormalizedRetrieval",
    "NormalizedVisualAnalysis",
    "NormalizedPracticeQuestion",
    "NormalizedAssessment",
    "NormalizedMetadata",
    "normalize_educational_metadata",
    "NormalizedVisual",
    "normalize_enriched_visual",
    "normalize_enriched_visual_batch",
    "ValidationResult",
    "validate_normalized_visual",
    "validate_normalized_visual_batch",
    "_EDUCATIONAL_ENTITY_WHITELIST",
    "_EDUCATIONAL_ENTITY_VOCABULARY",
    "_SCORE_WEIGHTS",
    "_VALIDATION_SCORE_THRESHOLD",
    "ValidatorProfile",
    "ValidationConfig",
    "ValidationReport",
    "build_validation_report",
    "build_validation_report_batch",
    "write_validation_reports_jsonl",
    "GROUNDING_MIN_SCORE",
    "ALLOW_DIAGRAM_INFERENCE",
    "ALLOW_GRAPH_INFERENCE",
    "STRICT_PHOTO_VALIDATION",
    "ENABLE_ENTITY_WHITELIST",
    "VALIDATION_REPORT_PATH",
    "normalized_metadata_to_dict",
    "build_updated_metadata",
    "MetadataWriteError",
    "write_visual_metadata",
    "write_visual_metadata_batch",
    "PIPELINE_VERSION",
    "build_pass2_retrieval_text",
    "Pass2SearchVisual",
    "build_pass2_search_representation",
    "build_pass2_search_representation_batch",
    "build_qdrant_payload_update",
    "QdrantPayloadUpdateError",
    "locate_qdrant_point",
    "update_qdrant_payload",
    "update_qdrant_payload_batch",
    "PipelineStats",
    "compute_pipeline_stats",
    "print_header",
    "main",
]