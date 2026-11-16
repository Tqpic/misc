# Pixel Cosmos

A fine pixel-art deep-space theme for the Claude desktop and mobile apps. An animated backdrop (a magenta spiral galaxy, a warm orange spiral, distant banded galaxies, drifting blue nebulae, twinkling and pulsing cross-stars, comets with dashed tails and a violet cloud bank) sits behind the chat. A dark violet color theme with starlight text goes with it. On phones the galaxies move into the tall view, and the scene holds still when reduced motion is on.

The terminal and editors don't draw themes, so it shows only in the desktop and mobile apps.

## Install

At the prompt of a terminal session:

```
/plugin install pixel-cosmos --marketplace Tqpic/misc
```

From a shell:

```bash
claude plugin install pixel-cosmos --marketplace Tqpic/misc
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `Tqpic/misc`, then Add plugin.

## Changing the scene

`hooks/scene.ts` is generated. Edit `tools/gen-scene.mjs`, then from the repository root run:

```bash
node tools/gen-scene.mjs .
```

The colors are set in `hooks/register.tsx`.
