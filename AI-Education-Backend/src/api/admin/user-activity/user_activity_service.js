import { Op, QueryTypes } from "sequelize";
import sequelize from "../../../config/database.js";
import User from "../../user/user_schema.js";
import Role from "../../roles/role_schema.js";
import { EducationStudentProfile } from "../../student-profile/student_profile_schema.js";
import { EducationAcademicBoard, EducationAcademicClass } from "../../academic/academic_schema.js";
import { createEducationError } from "../../education_errors.js";

// A gap this long between two of a user's requests is treated as the end
// of one visit and the start of a new one — the same convention GA4/
// Mixpanel-style product analytics use by default. There's no client
// heartbeat/tab-visibility signal here (audit_logs is populated purely
// from real API calls the existing request-logging middleware already
// captures for every endpoint platform-wide — nothing new to instrument),
// so "time spent" is inherently an estimate: the true time between a
// visit's first and last request, not literal tab-open time. Good enough
// to answer "when/how much are people actually using this," explicitly
// labeled as an estimate in every response shape below rather than
// presented as exact.
const SESSION_GAP_MINUTES = 30;
// A single-request "session" would otherwise show 0 duration even though
// the user was clearly on that page for some real amount of time —
// floored to a plausible minimum dwell per session instead.
const MIN_SESSION_SECONDS = 30;
const ONLINE_WITHIN_MINUTES = 5;

// Curated, human-readable labels for the action/entity pairs users
// actually generate (from a real audit_logs sample — see the original
// "list what students are doing" investigation this was generalized
// from). Anything not in this map still renders (title-cased from the
// raw action) rather than being dropped, so a new action added later
// never shows as blank.
const ACTION_LABELS = {
  "LOGIN_USER": "Logged in",
  "LOGIN_AUTH": "Logged in",
  "LOGOUT_USER": "Logged out",
  "READ_CURRICULUM": "Browsed a chapter",
  "UPDATE_CURRICULUM": "Updated chapter progress",
  "CREATE_QUIZ": "Started a quiz",
  "READ_QUIZ": "Viewed quiz results",
  "CREATE_FLASHCARD": "Generated flashcards",
  "READ_FLASHCARD": "Studied flashcards",
  "CREATE_MINDMAP": "Generated a mind map",
  "READ_AI": "Read an AI Tutor conversation",
  "CREATE_AI": "Chatted with the AI Tutor",
  "READ_PROGRES": "Checked progress",
  "READ_STUDENT": "Viewed student profile",
  "READ_PROFILE": "Viewed profile",
  "READ_ACADEMIC": "Browsed subjects",
  "READ_HELP": "Visited Help Center",
  "READ_MY": "Viewed personal content",
  "READ_SCHOOL": "Looked up school",
  "READ_STUDY": "Viewed study plan",
  "CREATE_INFOGRAPHIC": "Generated an infographic",
  "CREATE_PREFERENCE": "Saved preferences",
  "READ_SUBSCRIPTION": "Checked subscription/usage",
};

const humanizeAction = (action, entity) => {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const verb = { CREATE: "Created", READ: "Viewed", UPDATE: "Updated", DELETE: "Deleted", LOGIN: "Logged in via", LOGOUT: "Logged out of" }[
    action.split("_")[0]
  ];
  return verb ? `${verb} ${entity}` : action;
};

// Education-specific enrichment (school/board/class/learning_mode) is
// looked up separately by user_id rather than joined into the primary
// User query — not every tracked user has a student profile at all
// (teachers, parents, staff), so this has to be an optional lookup,
// not a required join.
const attachStudentEnrichment = async (userIds) => {
  if (userIds.length === 0) return {};
  const profiles = await EducationStudentProfile.findAll({
    where: { user_id: { [Op.in]: userIds } },
    include: [
      { model: EducationAcademicBoard, as: "board", attributes: ["name"] },
      { model: EducationAcademicClass, as: "class", attributes: ["name"] },
    ],
  });
  const byUserId = {};
  for (const p of profiles) {
    byUserId[p.user_id] = {
      student_profile_id: p.student_profile_id,
      school_name: p.school_name || null,
      board_name: p.board?.name || null,
      class_name: p.class?.name || null,
      learning_mode: p.learning_mode || null,
    };
  }
  return byUserId;
};

// Single-tenant app: roles are global, not org-scoped assignments — a
// user's current role is just User.role_id, joined straight to Role.
const fetchCurrentRoles = async (userIds) => {
  if (userIds.length === 0) return {};
  const users = await User.findAll({
    where: { user_id: { [Op.in]: userIds } },
    include: [{ model: Role, as: "userRole", attributes: ["role_id", "role_name"], required: false }],
    attributes: ["user_id"],
  });
  const byUserId = {};
  for (const u of users) {
    byUserId[u.user_id] = u.userRole?.role_name || null;
  }
  return byUserId;
};

/**
 * One row per user with real activity, aggregated over the last `days`
 * — session count, estimated active time, and last-seen, computed via a
 * gap-based session query (see SESSION_GAP_MINUTES above) directly over
 * audit_logs rather than any new tracking table. Users with zero
 * audit_logs rows in the window are still included (so the roster
 * doesn't just silently drop quiet users) with null activity fields.
 *
 * Generic across every role — not student-specific. Single-tenant app:
 * always shows every user, there is no org to scope by.
 */
export const listUserActivityService = async ({
  search,
  page = 1,
  limit = 20,
  sortBy = "last_active_at",
  sortOrder = "desc",
  days = 7,
}) => {
  const offset = (page - 1) * limit;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const userWhere = {};
  if (search) {
    userWhere[Op.or] = [
      { first_name: { [Op.iLike]: `%${search}%` } },
      { last_name: { [Op.iLike]: `%${search}%` } },
      { account_email: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows: users } = await User.findAndCountAll({
    where: userWhere,
    attributes: ["user_id", "first_name", "last_name", "account_email", "last_login"],
    limit,
    offset,
    // Stable pagination order independent of the activity aggregation
    // below — activity-based sort (last_active_at/active_seconds) is
    // applied client-side-ish here via a second in-memory sort of just
    // this page's rows, since it depends on aggregating audit_logs which
    // can't cheaply drive a paginated ORDER BY without a much heavier
    // query. Good enough at admin-console scale (tens of pages, not
    // millions of users).
    order: [["first_name", "ASC"]],
  });

  const userIds = users.map((u) => u.user_id);
  const [activityByUser, studentEnrichmentByUser, roleByUserId] = await Promise.all([
    userIds.length > 0 ? computeSessionAggregates(userIds, since) : {},
    attachStudentEnrichment(userIds),
    fetchCurrentRoles(userIds),
  ]);

  let items = users.map((u) => {
    const activity = activityByUser[u.user_id] || null;
    const enrichment = studentEnrichmentByUser[u.user_id] || null;
    return {
      user_id: u.user_id,
      name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.account_email,
      email: u.account_email,
      role_name: roleByUserId[u.user_id] || null,
      // Present only for users who also have a student profile — null
      // for teachers/parents/staff/etc, the frontend just omits these.
      student_profile_id: enrichment?.student_profile_id || null,
      school_name: enrichment?.school_name || null,
      board_name: enrichment?.board_name || null,
      class_name: enrichment?.class_name || null,
      learning_mode: enrichment?.learning_mode || null,
      last_login: u.last_login,
      last_active_at: activity?.last_active_at || u.last_login || null,
      is_online: activity?.last_active_at
        ? Date.now() - new Date(activity.last_active_at).getTime() < ONLINE_WITHIN_MINUTES * 60 * 1000
        : false,
      sessions_count: activity?.sessions_count || 0,
      active_seconds: activity?.active_seconds || 0,
      action_count: activity?.action_count || 0,
    };
  });

  if (sortBy === "name") {
    items = items.sort((a, b) => (sortOrder === "asc" ? 1 : -1) * a.name.localeCompare(b.name));
  } else if (sortBy === "last_active_at" || sortBy === "active_seconds" || sortBy === "sessions_count" || sortBy === "action_count") {
    items = items.sort((a, b) => {
      const av = a[sortBy] ? (sortBy === "last_active_at" ? new Date(a[sortBy]).getTime() : a[sortBy]) : -1;
      const bv = b[sortBy] ? (sortBy === "last_active_at" ? new Date(b[sortBy]).getTime() : b[sortBy]) : -1;
      return sortOrder === "asc" ? av - bv : bv - av;
    });
  }

  return {
    items,
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
    limit,
    window_days: days,
    session_gap_minutes: SESSION_GAP_MINUTES,
  };
};

/**
 * Gap-based session detection (see SESSION_GAP_MINUTES) over audit_logs,
 * batched for many users in one query via a window-function CTE rather
 * than one query per user. Returns a plain object keyed by user_id — a
 * user with zero rows in the window just doesn't appear in it (callers
 * treat that as "no activity").
 */
const computeSessionAggregates = async (userIds, since) => {
  const rows = await sequelize.query(
    `
    WITH user_logs AS (
      SELECT performed_by AS user_id, created_at
      FROM audit_logs
      WHERE performed_by IN (:userIds) AND created_at >= :since
    ),
    gapped AS (
      SELECT user_id, created_at,
        LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at) AS prev_at
      FROM user_logs
    ),
    sessioned AS (
      SELECT user_id, created_at,
        SUM(CASE WHEN prev_at IS NULL OR created_at - prev_at > INTERVAL '${SESSION_GAP_MINUTES} minutes' THEN 1 ELSE 0 END)
          OVER (PARTITION BY user_id ORDER BY created_at) AS session_num
      FROM gapped
    ),
    sessions AS (
      SELECT user_id, session_num,
        MIN(created_at) AS session_start, MAX(created_at) AS session_end, COUNT(*) AS actions
      FROM sessioned
      GROUP BY user_id, session_num
    )
    SELECT user_id,
      COUNT(*) AS sessions_count,
      SUM(GREATEST(EXTRACT(EPOCH FROM (session_end - session_start)), ${MIN_SESSION_SECONDS})) AS active_seconds,
      SUM(actions) AS action_count,
      MAX(session_end) AS last_active_at
    FROM sessions
    GROUP BY user_id
    `,
    { replacements: { userIds, since }, type: QueryTypes.SELECT }
  );

  const byUser = {};
  for (const row of rows) {
    byUser[row.user_id] = {
      sessions_count: Number(row.sessions_count),
      active_seconds: Math.round(Number(row.active_seconds)),
      action_count: Number(row.action_count),
      last_active_at: row.last_active_at,
    };
  }
  return byUser;
};

/**
 * Full detail view for one user: header, the same summary/sessions
 * aggregation as the list (single-user), a day-by-day active-time
 * breakdown for a simple trend chart, and the raw chronological
 * activity feed (humanized) grouped into those same sessions for the
 * timeline UI. Keyed by user_id, not a role-specific profile id — works
 * for any user regardless of whether they have a student profile.
 */
export const getUserActivityDetailService = async (userId, { days = 30 } = {}) => {
  const user = await User.findOne({
    where: { user_id: userId },
    attributes: ["user_id", "first_name", "last_name", "account_email", "last_login"],
  });
  if (!user) throw createEducationError("User not found", 404, "USER_NOT_FOUND");

  const [enrichmentByUser, roleByUserId] = await Promise.all([
    attachStudentEnrichment([userId]),
    fetchCurrentRoles([userId]),
  ]);
  const enrichment = enrichmentByUser[userId] || null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [summary, dailyRows, logRows] = await Promise.all([
    computeSessionAggregates([userId], since),
    sequelize.query(
      `
      WITH user_logs AS (
        SELECT created_at FROM audit_logs WHERE performed_by = :userId AND created_at >= :since
      ),
      gapped AS (
        SELECT created_at, LAG(created_at) OVER (ORDER BY created_at) AS prev_at FROM user_logs
      ),
      sessioned AS (
        SELECT created_at,
          SUM(CASE WHEN prev_at IS NULL OR created_at - prev_at > INTERVAL '${SESSION_GAP_MINUTES} minutes' THEN 1 ELSE 0 END)
            OVER (ORDER BY created_at) AS session_num
        FROM gapped
      ),
      sessions AS (
        SELECT session_num, MIN(created_at) AS session_start, MAX(created_at) AS session_end
        FROM sessioned GROUP BY session_num
      )
      SELECT session_start::date AS day,
        SUM(GREATEST(EXTRACT(EPOCH FROM (session_end - session_start)), ${MIN_SESSION_SECONDS})) AS active_seconds,
        COUNT(*) AS sessions_count
      FROM sessions
      GROUP BY session_start::date
      ORDER BY day ASC
      `,
      { replacements: { userId, since }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
      SELECT audit_id, action, entity, entity_id, created_at
      FROM audit_logs
      WHERE performed_by = :userId AND created_at >= :since
      ORDER BY created_at DESC
      LIMIT 500
      `,
      { replacements: { userId, since }, type: QueryTypes.SELECT }
    ),
  ]);

  // Re-derive the same session boundaries client-side (over the already
  // small LIMIT 500 result) just to group the raw feed for display — a
  // second SQL round-trip for this alone isn't worth it at this scale.
  const sessions = [];
  let current = null;
  for (const log of [...logRows].reverse()) {
    const t = new Date(log.created_at).getTime();
    if (!current || t - current.lastT > SESSION_GAP_MINUTES * 60 * 1000) {
      current = { start: log.created_at, end: log.created_at, lastT: t, entries: [] };
      sessions.push(current);
    }
    current.end = log.created_at;
    current.lastT = t;
    current.entries.push({
      audit_id: log.audit_id,
      action: log.action,
      entity: log.entity,
      entity_id: log.entity_id,
      created_at: log.created_at,
      label: humanizeAction(log.action, log.entity),
    });
  }
  sessions.reverse();
  for (const s of sessions) {
    s.entries.reverse();
    s.duration_seconds = Math.max(
      Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000),
      MIN_SESSION_SECONDS
    );
    delete s.lastT;
  }

  const agg = summary[userId] || { sessions_count: 0, active_seconds: 0, action_count: 0, last_active_at: null };

  return {
    user: {
      user_id: user.user_id,
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.account_email,
      email: user.account_email,
      role_name: roleByUserId[userId] || null,
      student_profile_id: enrichment?.student_profile_id || null,
      school_name: enrichment?.school_name || null,
      board_name: enrichment?.board_name || null,
      class_name: enrichment?.class_name || null,
      learning_mode: enrichment?.learning_mode || null,
      last_login: user.last_login,
    },
    summary: {
      ...agg,
      is_online: agg.last_active_at ? Date.now() - new Date(agg.last_active_at).getTime() < ONLINE_WITHIN_MINUTES * 60 * 1000 : false,
      window_days: days,
    },
    daily_breakdown: dailyRows.map((r) => ({
      date: r.day,
      active_seconds: Math.round(Number(r.active_seconds)),
      sessions_count: Number(r.sessions_count),
    })),
    sessions,
    session_gap_minutes: SESSION_GAP_MINUTES,
  };
};
