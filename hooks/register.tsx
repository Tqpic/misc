import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene.js'

// Deep-space violet: ink-dark surfaces tinted toward the nebula, starlight text.
const { theme, problems } = makeColors({
  label: 'Pixel Cosmos',
  only: 'dark',
  roles: {
    accent: '#c062f0', // magenta galaxy arms
    danger: '#ff5a78', // red giant
    success: '#45e6c4', // teal cross-stars
    warning: '#ffb04a', // warm spiral
    pro: '#5ad1ff', // comet tail
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0d0a1c',
        'surface-1': '#141029',
        'surface-2': '#1a1533',
        'surface-3': '#1f1939',
        'text-primary': '#f3ecff',
        'text-secondary': '#cfc3ea',
        'text-muted': '#a898cc',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'cosmos', glass: { blur: 10, tint: '#0d0a1c', opacity: 0.55 } },
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    // Terminals never draw themes, so stay quiet here; /pixel-cosmos reports the state.
    await $.theme.set(LOOK)

    await $.command.register({
      name: 'pixel-cosmos',
      description: 'Re-apply the Pixel Cosmos theme and say whether this app draws it',
    })

    return next(e)
  })

  on('command.run', { command: 'pixel-cosmos' }, async $ => {
    const set = await $.theme.set(LOOK)

    return {
      text: set.isDrawn
        ? 'Pixel Cosmos applied: an app that draws themes is attached. If you still see the plain look, update the Claude desktop app and restart it.'
        : `Pixel Cosmos is not drawn here: ${set.reason}`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={SCENE}
        alt="Pixel-art deep space: a magenta spiral galaxy, a warm orange galaxy, drifting blue nebulae, twinkling stars and passing comets above a violet cloud bank"
        isInteractive
      />
    )
  })
}
