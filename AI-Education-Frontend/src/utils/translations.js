// Centralized Translations Dictionary for EduAI
//
// Source of truth is src/locales/<code>.json — one real JSON file per
// language (Sidebar/Topbar/etc. all read the same file, so there's only
// ever one translation to keep correct, not two drifting copies). This
// module just assembles them into the shape existing consumers already
// expect. Previously Topbar.jsx kept its own separate, hand-maintained
// copy of a subset of these translations — it had drifted badly (Kannada
// script mixed into the Marathi block, Thai/Hindi characters mixed into
// the Gujarati/Bengali blocks), which is exactly the kind of divergence a
// single JSON-per-language source is meant to make impossible.
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';

// Matches languages.code exactly — the real backend table
// GET /api/metadata/languages serves, which drives the Topbar's language
// dropdown. Earlier this session this dict also carried Bengali/Tamil/
// Telugu/Kannada/Marathi/Gujarati translations that predated checking
// against that table; none of them corresponded to a real row, so a
// student could never actually select them — removed rather than kept
// as unreachable dead weight.
export const translationsDict = { en, hi, fr, de, ja, zh };
