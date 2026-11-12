// CurveForge -> Meteora Dynamic Bonding Curve
// Turns the designer state into real DBC config parameters and a real
// `createConfig` transaction using the official Meteora SDK.
import { PublicKey } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import {
  ActivationType, BaseFeeMode, CollectFeeMode, DammV2DynamicFeeMode,
  DynamicBondingCurveClient, MigratedCollectFeeMode, MigrationFeeOption,
  MigrationOption, TokenAuthorityOption, TokenDecimal, TokenType,
  buildCurveWithCustomSqrtPrices, createSqrtPrices,
} from '@meteora-ag/dynamic-bonding-curve-sdk';

export const USDC_MINTS = {
  mainnet: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  devnet: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
};

// Tokens left out of the curve to absorb integer rounding at migration.
export const LEFTOVER_TOKENS = 1000;

export function quoteDecimals(quoteToken) {
  return quoteToken === 'USDC' ? 6 : 9;
}

export function quoteMintFor(quoteToken, network) {
  return quoteToken === 'USDC' ? USDC_MINTS[network] : NATIVE_MINT;
}

// The inputs handed to the SDK curve builder. `prices` has segments + 1
// ascending entries, `weights` has one entry per segment.
export function curveBuildInput(state, prices, weights) {
  const baseDecimal = state.tokenDecimals <= 6 ? TokenDecimal.SIX : TokenDecimal.NINE;
  const quoteDecimal = quoteDecimals(state.quoteToken);
  const duration = Math.max(1, Math.round(state.feeDuration));
  return {
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: baseDecimal,
      tokenQuoteDecimal: quoteDecimal,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: state.totalSupply,
      leftover: LEFTOVER_TOKENS,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: state.feeMode === 'exponential'
          ? BaseFeeMode.FeeSchedulerExponential
          : BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: Math.round(state.startingFee * 100),
          endingFeeBps: Math.round(state.endingFee * 100),
          numberOfPeriod: duration,
          totalDuration: duration,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.Customizable,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Enabled,
        poolFeeBps: state.dammFee,
      },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: state.lockedLiquidity,
      creatorLiquidityPercentage: 100 - state.lockedLiquidity,
      creatorPermanentLockedLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0,
      totalVestingDuration: 0, cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    sqrtPrices: createSqrtPrices(prices, baseDecimal, quoteDecimal),
    liquidityWeights: weights,
  };
}

// Real on-chain config parameters. Throws with a readable message when the
// design cannot be expressed as a DBC config.
export function buildDbcConfig(state, prices, weights) {
  if (!(state.startPrice > 0) || !(state.endPrice > state.startPrice)) {
    throw new Error('End price must be higher than start price');
  }
  return buildCurveWithCustomSqrtPrices(curveBuildInput(state, prices, weights));
}

// The quote amount the pool must raise before it migrates. With explicit
// segment prices this is fixed by the curve, not chosen freely.
export function onChainThreshold(config, quoteToken) {
  return Number(config.migrationQuoteThreshold.toString()) / 10 ** quoteDecimals(quoteToken);
}

// Unsigned `createConfig2` transaction for the DBC program.
export async function buildCreateConfigTx({ connection, network, state, prices, weights, payer, config }) {
  const params = buildDbcConfig(state, prices, weights);
  const client = new DynamicBondingCurveClient(connection, 'confirmed');
  const tx = await client.partner.createConfig2({
    config,
    feeClaimer: payer,
    leftoverReceiver: payer,
    payer,
    quoteMint: quoteMintFor(state.quoteToken, network),
    ...params,
    transferFeeParameters: null,
  });
  return { tx, params };
}
