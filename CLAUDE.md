<!-- ccsquad:start mode=passive -->
## ccsquad coordination

**On session start:** call `list_instances` and `read_messages` to catch up on squad activity.

**During the session — offer to broadcast after any of these:**
- Shipping or landing code
- Finishing a plan or architecture decision
- Establishing a convention (error handling, naming, DB schema, API shape)
- Finding a bug root cause
- Creating a shared utility

After completing any of the above, ask the user: "Want me to broadcast this to the squad? (y/n)"
If yes, call `broadcast` with a concise summary of what was decided or built.

**Always:** answer squad questions when asked (`read_messages`, `answer`).
<!-- ccsquad:end -->
