import type { MeowKitBridge } from '../meowkit';
import { ensureMeowKitBridge } from '../bridge/ensureMeowKitBridge';

export function useMeowKitBridge(): MeowKitBridge {
  return ensureMeowKitBridge();
}
