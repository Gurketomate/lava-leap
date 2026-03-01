import { GRAVITY, JUMP_FORCE, BOOST_FORCE, MOVE_SPEED } from './constants';

const REACHABILITY_FACTOR = 0.75; // 75% safety margin

export interface ReachabilityLimits {
  maxJumpHeight: number;
  airtime: number;
  maxHorizontalDist: number;
  safeVerticalDist: number;
  safeHorizontalDist: number;
}

export function computeReachability(jumpBonus: number = 0): ReachabilityLimits {
  const v = JUMP_FORCE * (1 + jumpBonus);
  const g = GRAVITY;

  // h = v² / (2g)
  const maxJumpHeight = (v * v) / (2 * g);

  // t = 2v / g  (total airtime from jump to same height)
  const airtime = (2 * v) / g;

  // horizontal distance = speed * airtime
  const maxHorizontalDist = MOVE_SPEED * airtime;

  return {
    maxJumpHeight,
    airtime,
    maxHorizontalDist,
    safeVerticalDist: maxJumpHeight * REACHABILITY_FACTOR,
    safeHorizontalDist: maxHorizontalDist * REACHABILITY_FACTOR,
  };
}

/**
 * Validate that a platform at (targetX, targetY) is reachable from (sourceX, sourceY).
 * Returns true if reachable.
 */
export function isPlatformReachable(
  sourceX: number,
  sourceWidth: number,
  sourceY: number,
  targetX: number,
  targetWidth: number,
  targetY: number,
  limits: ReachabilityLimits,
): boolean {
  const verticalDist = sourceY - targetY; // positive = target is above
  if (verticalDist <= 0) return true; // target is below, always reachable

  if (verticalDist > limits.safeVerticalDist) return false;

  // Horizontal distance (edge-to-edge, considering platform widths)
  const sourceLeft = sourceX;
  const sourceRight = sourceX + sourceWidth;
  const targetLeft = targetX;
  const targetRight = targetX + targetWidth;

  let horizontalDist = 0;
  if (targetRight < sourceLeft) {
    horizontalDist = sourceLeft - targetRight;
  } else if (targetLeft > sourceRight) {
    horizontalDist = targetLeft - sourceRight;
  }
  // else overlapping horizontally → 0

  if (horizontalDist > limits.safeHorizontalDist) return false;

  // Combined check: prevent large horizontal + large vertical simultaneously
  const verticalRatio = verticalDist / limits.safeVerticalDist;
  const horizontalRatio = horizontalDist / limits.safeHorizontalDist;
  if (verticalRatio > 0.7 && horizontalRatio > 0.7) return false;

  return true;
}
