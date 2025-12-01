import {
  Initialize as InitializeEvent,
  Swap as SwapEvent,
  ModifyLiquidity as ModifyLiquidityEvent,
  Donate as DonateEvent,
} from "../generated/PoolManager/PoolManager";
import {
  Hook,
  HookPermissions,
  Pool,
  Token,
  Transaction,
  Swap,
  ModifyLiquidity,
  Donate,
} from "../generated/schema";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

const ZERO_BI = BigInt.zero();
const ONE_BI = BigInt.fromI32(1);
const NEG_ONE_BI = BigInt.fromI32(-1);

function abs(value: BigInt): BigInt {
  if (value.lt(ZERO_BI)) {
    return value.times(NEG_ONE_BI);
  }
  return value;
}

function getOrCreateToken(address: Address): Token {
  let token = Token.load(address);
  if (token == null) {
    token = new Token(address);
    token.symbol = "";
    token.name = "";
    token.decimals = BigInt.fromI32(18);
    token.totalValueLockedUSD = ZERO_BI;
    token.volumeUSD = ZERO_BI;
    token.feesUSD = ZERO_BI;
    token.txCount = ZERO_BI;
    token.save();
  }
  return token as Token;
}

function getOrCreateHook(address: Address, timestamp: BigInt): Hook {
  let hook = Hook.load(address);
  if (hook == null) {
    hook = new Hook(address);
    hook.poolCount = ZERO_BI;
    hook.permissions = address;
    hook.hookType = null;
    hook.totalSwapsProcessed = ZERO_BI;
    hook.totalLiquidityModifications = ZERO_BI;
    hook.totalDonations = ZERO_BI;
    hook.totalVolumeUSD = ZERO_BI;
    hook.totalFeesCollected = ZERO_BI;
    hook.createdAt = timestamp;
    hook.firstPoolCreatedAt = timestamp;
    hook.lastActivityAt = timestamp;
    hook.save();
    getOrCreateHookPermissions(address, hook);
  }
  return hook as Hook;
}

function getOrCreateHookPermissions(address: Address, hook: Hook | null = null): HookPermissions {
  let perms = HookPermissions.load(address);
  if (perms == null) {
    perms = new HookPermissions(address);
    let hookRef = address as Bytes;
    if (hook != null) {
      hookRef = hook.id;
    }
    perms.hook = hookRef;
    perms.beforeInitialize = false;
    perms.afterInitialize = false;
    perms.beforeAddLiquidity = false;
    perms.afterAddLiquidity = false;
    perms.beforeRemoveLiquidity = false;
    perms.afterRemoveLiquidity = false;
    perms.beforeSwap = false;
    perms.afterSwap = false;
    perms.beforeDonate = false;
    perms.afterDonate = false;
    perms.save();
  }
  return perms as HookPermissions;
}

function getOrCreateTransaction(event: ethereum.Event): Transaction {
  const id = event.transaction.hash;
  let tx = Transaction.load(id);
  if (tx == null) {
    tx = new Transaction(id);
  }
  tx.blockNumber = event.block.number;
  tx.timestamp = event.block.timestamp;
  tx.gasPrice = event.transaction.gasPrice;
  tx.gasUsed = ZERO_BI;
  tx.save();
  return tx as Transaction;
}

function updateHookActivity(hookId: Bytes, timestamp: BigInt, updateField: string): void {
  const hook = Hook.load(hookId);
  if (hook == null) {
    return;
  }
  if (updateField == "swap") {
    hook.totalSwapsProcessed = hook.totalSwapsProcessed.plus(ONE_BI);
  } else if (updateField == "liquidity") {
    hook.totalLiquidityModifications = hook.totalLiquidityModifications.plus(ONE_BI);
  } else if (updateField == "donate") {
    hook.totalDonations = hook.totalDonations.plus(ONE_BI);
  }
  hook.lastActivityAt = timestamp;
  hook.save();
}

export function handleInitialize(event: InitializeEvent): void {
  const poolId = event.params.id;
  let pool = Pool.load(poolId);
  if (pool == null) {
    pool = new Pool(poolId);
  }

  pool.poolId = poolId;
  pool.currency0 = event.params.currency0;
  pool.currency1 = event.params.currency1;
  pool.fee = BigInt.fromI32(event.params.fee);
  pool.tickSpacing = BigInt.fromI32(event.params.tickSpacing);
  pool.sqrtPriceX96 = event.params.sqrtPriceX96;
  pool.tick = BigInt.fromI32(event.params.tick);
  pool.liquidity = ZERO_BI;
  pool.totalValueLockedUSD = ZERO_BI;
  pool.totalValueLockedToken0 = ZERO_BI;
  pool.totalValueLockedToken1 = ZERO_BI;
  pool.volumeUSD = ZERO_BI;
  pool.volumeToken0 = ZERO_BI;
  pool.volumeToken1 = ZERO_BI;
  pool.feesUSD = ZERO_BI;
  pool.feesToken0 = ZERO_BI;
  pool.feesToken1 = ZERO_BI;
  pool.txCount = ZERO_BI;
  pool.hookSwapsCount = ZERO_BI;
  pool.hookLiquidityModificationsCount = ZERO_BI;
  pool.hookDonationsCount = ZERO_BI;
  pool.hookVolumeUSD = ZERO_BI;
  pool.hookFeesUSD = ZERO_BI;
  pool.createdAt = event.block.timestamp;
  pool.createdAtBlock = event.block.number;
  pool.createdAtTransaction = event.transaction.hash;

  const token0 = getOrCreateToken(event.params.currency0);
  const token1 = getOrCreateToken(event.params.currency1);
  pool.token0 = token0.id;
  pool.token1 = token1.id;

  const hookAddress = event.params.hooks;
  pool.hookIdRaw = hookAddress;
  if (!hookAddress.equals(Address.zero())) {
    const hook = getOrCreateHook(hookAddress, event.block.timestamp);
    hook.poolCount = hook.poolCount.plus(ONE_BI);
    hook.lastActivityAt = event.block.timestamp;
    hook.save();
    pool.hook = hook.id;
    getOrCreateHookPermissions(hookAddress, hook);
  } else {
    pool.hook = null;
  }

  pool.save();
}

export function handleSwap(event: SwapEvent): void {
  const pool = Pool.load(event.params.id);
  if (pool == null) {
    return;
  }

  const tx = getOrCreateTransaction(event);
  const token0 = getOrCreateToken(Address.fromBytes(pool.currency0));
  const token1 = getOrCreateToken(Address.fromBytes(pool.currency1));

  const swapId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const swap = new Swap(swapId);
  swap.transaction = tx.id;
  swap.pool = pool.id;
  swap.token0 = token0.id;
  swap.token1 = token1.id;
  swap.hook = pool.hook;
  swap.amount0 = event.params.amount0;
  swap.amount1 = event.params.amount1;
  swap.amountUSD = ZERO_BI;
  swap.sqrtPriceX96 = event.params.sqrtPriceX96;
  swap.tick = BigInt.fromI32(event.params.tick);
  swap.timestamp = event.block.timestamp;
  swap.blockNumber = event.block.number;
  swap.save();

  pool.txCount = pool.txCount.plus(ONE_BI);
  pool.hookSwapsCount = pool.hookSwapsCount.plus(ONE_BI);
  pool.volumeToken0 = pool.volumeToken0.plus(abs(event.params.amount0));
  pool.volumeToken1 = pool.volumeToken1.plus(abs(event.params.amount1));
  pool.save();

  token0.txCount = token0.txCount.plus(ONE_BI);
  token0.save();
  token1.txCount = token1.txCount.plus(ONE_BI);
  token1.save();

  const hookIdRaw = pool.hookIdRaw;
  if (hookIdRaw && !hookIdRaw.equals(Address.zero())) {
    updateHookActivity(hookIdRaw, event.block.timestamp, "swap");
  }
}

export function handleModifyLiquidity(event: ModifyLiquidityEvent): void {
  const pool = Pool.load(event.params.id);
  if (pool == null) {
    return;
  }

  const tx = getOrCreateTransaction(event);
  const token0 = getOrCreateToken(Address.fromBytes(pool.currency0));
  const token1 = getOrCreateToken(Address.fromBytes(pool.currency1));

  const entityId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const modify = new ModifyLiquidity(entityId);
  modify.transaction = tx.id;
  modify.pool = pool.id;
  modify.token0 = token0.id;
  modify.token1 = token1.id;
  modify.hook = pool.hook;
  modify.delta = event.params.liquidityDelta;
  modify.tickLower = BigInt.fromI32(event.params.tickLower);
  modify.tickUpper = BigInt.fromI32(event.params.tickUpper);
  modify.timestamp = event.block.timestamp;
  modify.blockNumber = event.block.number;
  modify.salt = event.params.salt;
  modify.save();

  pool.hookLiquidityModificationsCount = pool.hookLiquidityModificationsCount.plus(ONE_BI);
  pool.save();

  const hookIdRaw = pool.hookIdRaw;
  if (hookIdRaw && !hookIdRaw.equals(Address.zero())) {
    updateHookActivity(hookIdRaw, event.block.timestamp, "liquidity");
  }
}

export function handleDonate(event: DonateEvent): void {
  const pool = Pool.load(event.params.id);
  if (pool == null) {
    return;
  }

  const tx = getOrCreateTransaction(event);
  const token0 = getOrCreateToken(Address.fromBytes(pool.currency0));
  const token1 = getOrCreateToken(Address.fromBytes(pool.currency1));

  const entityId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const donate = new Donate(entityId);
  donate.transaction = tx.id;
  donate.pool = pool.id;
  donate.token0 = token0.id;
  donate.token1 = token1.id;
  donate.hook = pool.hook;
  donate.amount0 = event.params.amount0;
  donate.amount1 = event.params.amount1;
  donate.amountUSD = ZERO_BI;
  donate.timestamp = event.block.timestamp;
  donate.blockNumber = event.block.number;
  donate.save();

  pool.hookDonationsCount = pool.hookDonationsCount.plus(ONE_BI);
  pool.save();

  const hookIdRaw = pool.hookIdRaw;
  if (hookIdRaw && !hookIdRaw.equals(Address.zero())) {
    updateHookActivity(hookIdRaw, event.block.timestamp, "donate");
  }
}