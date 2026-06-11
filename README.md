# @styleflow.app/cli

[![npm](https://img.shields.io/npm/v/@styleflow.app/cli.svg)](https://www.npmjs.com/package/@styleflow.app/cli)
[![license](https://img.shields.io/npm/l/@styleflow.app/cli.svg)](./LICENSE)

Local-first compiler and React runtime bridge for StyleFlow Figma token artifacts.
It turns a Figma token export into a single `styleflow.css` plus Tailwind theme
variables, generated TypeScript unions and a build report.

> Requires **Node.js >= 20**. Homepage: [styleflow.app](https://styleflow.app)

## Install

```bash
# Run without installing
npx @styleflow.app/cli build

# Or add it to a project
npm install -D @styleflow.app/cli
```

## Commands

```bash
npx @styleflow.app/cli init
npx @styleflow.app/cli validate
npx @styleflow.app/cli build
npx @styleflow.app/cli watch
```

`styleflow build` reads `styleflow.config.ts` and `tokens/styleflow.tokens.json`, then writes CSS runtime output, Tailwind theme variables, generated TypeScript unions and a build report to `.styleflow/`.

For local exploration of an export with known WCAG contrast failures, pass `--allow-contrast-warnings` to `validate`, `build`, or `watch`. Contrast issues are reported as warnings; `build` and `watch` include them in `report.json`. Schema errors, missing tokens, unresolved aliases and unsupported values remain blocking errors.

Use `build: { type: "dev", content: ["./src"] }` for the complete runtime contract. For distributable CSS, run with `STYLEFLOW_BUILD_TYPE=production` in the shell or a project `.env` file. Production scans each configured content directory, emits selectors found in `Ui` props or `data-*` attributes, and follows only their token alias dependencies into `tokens.css`. Dynamic prop usage retains the full affected axis. `styleflow watch` observes production content directories in addition to config, `.env` and token input.

## Exports

- `@styleflow.app/cli/config`: `defineStyleFlowConfig`.
- `@styleflow.app/cli/contracts`: structural runtime constants.
- `@styleflow.app/cli/format`: versioned `StyleflowTokensFile` types and parser.
- `@styleflow.app/cli/ui`: typed React `Ui` primitive.

Development output uses the complete `public-contract` runtime and may trigger the CSS budget warning in `report.json`; production output is pruned to detected usage.

## License

[MIT](./LICENSE) © StyleFlow
