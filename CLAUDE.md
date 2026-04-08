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

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
