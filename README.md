# Uniswap V4 HookPulse Subgraph

HookPulse tracks live Uniswap v4 hook deployments and activity. The mapping populates pool-level and hook-level metrics so you can discover custom pools, monitor hook adoption, and analyze hook behavior directly from the subgraph.

## Features

- `hookIdRaw` field on each pool retains the raw hook address for reliable lookups.
- Aggregated hook stats (`totalSwapsProcessed`, `totalLiquidityModifications`, `totalDonations`, `lastActivityAt`).
- Per-pool counters (`hookSwapsCount`, `txCount`, `volumeToken0/1`).
- Swap, ModifyLiquidity, and Donate entities linked to their hooks.

## Quick Start

```bash
npm install
npm run codegen
npm run build
```

Deploy via the Graph CLI:

```bash
graph auth <STUDIO_KEY>
graph deploy uniswap-v-4-hookpulse
```

## Useful Queries

### Top Hooks
```graphql
{
  hooks(orderBy: totalSwapsProcessed, orderDirection: desc) {
    id
    poolCount
    totalSwapsProcessed
    totalLiquidityModifications
    totalDonations
    lastActivityAt
  }
}
```

### Pools with Hooks
```graphql
{
  pools(where: { hookIdRaw_not: "0x0000000000000000000000000000000000000000" }) {
    id
    hookIdRaw
    token0 { id symbol }
    token1 { id symbol }
    txCount
    hookSwapsCount
  }
}
```

## Resources
- HookPulse Subgraph (Studio): https://thegraph.com/studio/subgraph/uniswap-v-4-hookpulse
- Curated hook list: https://github.com/fewwwww/awesome-uniswap-hooks — an in-depth collection of hook projects, tooling, and security research you can use to discover new hook deployments and feed those addresses into HookPulse queries.
