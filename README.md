# Design Memory

[![CI](https://github.com/derinbarutcu17/DesignMemory/actions/workflows/ci.yml/badge.svg)](https://github.com/derinbarutcu17/DesignMemory/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/derinbarutcu17/DesignMemory)](https://github.com/derinbarutcu17/DesignMemory/releases)
[![license](https://img.shields.io/github/license/derinbarutcu17/DesignMemory)](LICENSE)

**Your AI assistant writes the interface. Design Memory makes sure it still looks like your product.**

![An assistant introduces a slightly off color, the gate blocks it, names the fix, and the team records one approved exception](docs/graphics/loop.gif)

An assistant adds a new color to a screen. It is close to your blue, but it is not your blue. Design Memory stops the change, points at the exact line, and suggests the color you actually use. If your team decides the new color is right, it records that decision with a reason, and nobody argues about it twice.

## The problem, in one minute

AI assistants now write most of the code behind modern apps, including everything customers see. They are fast, and they are confident. The trouble is that every small choice is made in isolation:

- a color that is almost your brand color
- a spacing value that is almost on your scale
- a button that quietly ignores a rule you agreed on months ago

No single change looks wrong. A hundred of them turn a recognizable product into something slightly generic. A style guide cannot stop this, because documents do not fail. Checks fail.

## What Design Memory is

Two simple things working together.

**A gate.** You describe your design rules once, where they already live: your file of named design values and a short markdown contract for your components. Design Memory reads them and then checks every change before it lands, whether that change comes from a person or from an assistant. New drift is stopped with the exact line and the exact fix. Anything that already existed is recorded once, so it never blocks the team's real work.

**A memory.** Real products have real exceptions. A partner logo must use its own colors. One dense table needs a slightly tighter number size. Instead of silencing a warning, Design Memory records the decision: who approved it, why, and when it expires. Now the gate knows, and so does your AI assistant. That second part is what compounds, because assistants that start by reading your rules and your decisions make far fewer mistakes before a human ever looks.

## How it works, step by step

1. **Your design truth.** A file of named values, for example "primary blue" or "space 3", plus a short component contract in markdown.
2. **One command learns it.** Design Memory takes a snapshot of those rules and stores it with the project.
3. **Every change is judged against it**, and only the lines that actually changed are considered. Old mess is not today's problem.
4. **New drift is blocked with the fix named.** Not "something looks off", but "use this value instead", with the exact file and line.
5. **Approved exceptions become memory.** One command records a deviation with a reason and an optional expiry. It stops blocking, and every future assistant can see why.
6. **Exceptions age with your system.** When a value changes, any decision that depended on it expires by itself. Nothing hides in a wiki.

![The loop: ask first, write, check, fix, remember](docs/graphics/loop.png)

## Why teams choose it

**It speaks to your AI assistant directly.** Through MCP, an open standard for connecting assistants to tools, Design Memory can hand your rules and decisions to the assistant before it writes, and check the result after. It works with Claude, Cursor, Copilot, Codex, and anything else that speaks the standard.

**The guardrail itself is not AI.** The same change always gets the same answer. There is no second model to trust, no slow or costly check, and nothing leaves your machine.

**It fits an existing codebase.** You adopt it once and it accepts the past as it is. It only guards what happens next, which is what a busy team actually needs.

**It leaves a trail.** Every decision carries a reason, an author, an expiry date, and links to the values it depends on. Six months later, "why is this like this" has an answer.

## See it in the demo

The repo ships a realistic product surface, a procurement dashboard, with its own design system, an accepted history, and recorded decisions. The walkthrough tells a full story in five minutes: an assistant introduces a slightly off color, the gate stops it, the assistant asks for the right value, fixes it, and one exception gets recorded end to end.

- `docs/demo/live-demo-script.md` for the walkthrough
- `docs/video/design-memory-motion-30fps.mp4` for the 60-second film

## Install in a minute

```bash
npm install -g --allow-remote=root https://github.com/derinbarutcu17/DesignMemory/releases/download/v0.4.0/derinb-design-memory-0.4.0.tgz
design-memory init
design-memory sync-reference
design-memory audit
```

Install, teach it your design rules, check your current changes. The technical reference covers every other option, including installing without npm, the GitHub check, and registering it with each assistant.

## Who this is for

Teams of two to fifty shipping a real product with AI assistants in the loop. It pays off fastest when more than one person writes interface code and nobody has time to review every commit by hand.

It is not for you if you want a general code linter, visual screenshot testing, or if your interface is not built with React and Tailwind today. The technical reference lists the exact limits.

## FAQ

**Do I need to be technical to see the value?** No. If you can read a style guide, you can read its reports. Setup is three commands for whoever owns the codebase.

**Does anything leave my machine?** No. It runs locally and in your continuous integration. No account, no cloud, no telemetry.

**Will it bury the team in old problems?** No. The first snapshot accepts history as it is. Only new or returning problems stop work.

**What is MCP?** An open standard that lets AI assistants use outside tools, like a universal plug. Design Memory uses it to give your assistant the rules and decisions before it writes.

**What happens when we change our design system?** Decisions that depended on the old values expire themselves, and the new rules apply from the next check.

## Documentation map

| Document | What it covers |
| --- | --- |
| This README | Plain-English overview |
| [TECHNICAL.md](TECHNICAL.md) | Full reference: architecture, MCP tools, rules, installs, quality gates |
| [AGENTS.md](AGENTS.md) | Guide for AI agents working in this repo |
| [docs/demo/live-demo-script.md](docs/demo/live-demo-script.md) | Five-minute live walkthrough |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## License

MIT
