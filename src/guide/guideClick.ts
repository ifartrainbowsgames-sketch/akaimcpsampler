import { useStore } from '../state/store';
import { getGuideTopic } from './topics';

/**
 * Run action AND show guide tip if guide mode is on.
 * Guide no longer blocks the action — it shows alongside it so you can
 * learn while you play.
 */
export function guideClick(topicId: string, action?: () => void): boolean {
  const { guideMode, showGuide } = useStore.getState();
  // Always perform the action first.
  action?.();
  // Show guide tip in parallel if guide mode is on.
  if (guideMode && getGuideTopic(topicId)) {
    showGuide(topicId);
    return true;
  }
  return false;
}
