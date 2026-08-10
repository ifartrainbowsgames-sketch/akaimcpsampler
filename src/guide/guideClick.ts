import { useStore } from '../state/store';
import { getGuideTopic } from './topics';

/** Run action, or show guide topic when guide mode is on. Returns true if guide was shown. */
export function guideClick(topicId: string, action?: () => void): boolean {
  const { guideMode, showGuide } = useStore.getState();
  if (guideMode && getGuideTopic(topicId)) {
    showGuide(topicId);
    return true;
  }
  action?.();
  return false;
}
