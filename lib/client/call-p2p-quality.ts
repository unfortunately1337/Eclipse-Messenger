export type P2PNetworkSample = { rtt: number; loss: number; availableBitrate?: number };
export type P2PQuality = "high" | "medium" | "low";
export function p2pQuality(sample: P2PNetworkSample): P2PQuality {
  if (sample.rtt > .65 || sample.loss > .08 || (sample.availableBitrate !== undefined && sample.availableBitrate < 650_000)) return "low";
  if (sample.rtt > .25 || sample.loss > .025 || (sample.availableBitrate !== undefined && sample.availableBitrate < 2_000_000)) return "medium";
  return "high";
}
export function p2pEncoding(quality: P2PQuality, screen: boolean, simultaneous = false) {
  if (screen) return {
    high: { maxBitrate: 6_000_000, maxFramerate: 45, scaleResolutionDownBy: 1 },
    medium: { maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
    low: { maxBitrate: 800_000, maxFramerate: 12, scaleResolutionDownBy: 1.5 },
  }[quality];
  const profile = {
    high: { maxBitrate: 2_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
    medium: { maxBitrate: 1_200_000, maxFramerate: 24, scaleResolutionDownBy: 1.5 },
    low: { maxBitrate: 350_000, maxFramerate: 18, scaleResolutionDownBy: 2.5 },
  }[quality];
  return simultaneous ? { ...profile, maxBitrate: Math.round(profile.maxBitrate * .7) } : profile;
}
