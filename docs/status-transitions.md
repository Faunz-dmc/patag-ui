# Report transitions

| Actor | Action | From | To / side effect |
|---|---|---|---|
| Citizen | submit | new | Submitted; create history and scoped notifications |
| Admin | review | Submitted | Under Review |
| Admin | verify | Submitted / Under Review | Verified |
| Admin | reject | Submitted / Under Review | Rejected; reason required |
| Admin | duplicate | Submitted / Under Review | Duplicate; valid other original report required |
| Admin | flag / forward | any | retain status; record follow-up or agency label |
| Admin | assign | Verified | Assigned; active team required |
| Owning maintenance team | start | Assigned | In Progress |
| Owning maintenance team | progress | In Progress | retain status; append progress update |
| Owning maintenance team | complete | In Progress | retain status; completion Awaiting Verification; notes + after photo required |
| Admin | return | pending completion | In Progress; completion Additional Work Requested; reason required |
| Admin | resolve | In Progress + Awaiting Verification | Resolved; completion Verified; notify citizen |
| Owning citizen | feedback | Resolved | once-only rating/text; retain status |

Suggestions are not confirmed duplicates. New submissions are not verified. Maintenance cannot resolve. Awaiting Verification is not a canonical report status. Histories in the local JSON service are useful demo evidence, not immutable production audit records. Seed histories are intentionally abbreviated fictional snapshots; new actions append full transitions.

## Supabase admin implementation, 27 October 2026

The real backend uses these same eight statuses. Maintenance events require the current assigned team; actor identity/scope comes from protected profiles. History, audit and recipient notifications commit with the report mutation. Duplicate decisions are serialized and require an authorized same-municipality original that is neither Rejected nor Duplicate. A referenced original cannot be rejected or marked Duplicate, preserving existing duplicate references. Completion evidence is private and must belong to the submitting uploader. Hosted acceptance remains pending; see [verification](backend-verification/README.md).
