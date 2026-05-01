import { useAppStore, type ToolsFlags } from '@/src/store/appStore';

export interface ToolsFeatureFlags extends ToolsFlags {
  anyAvailable: boolean;
}

export function useToolsFeatureFlags(): ToolsFeatureFlags {
  const toolsFlags = useAppStore((state) => state.toolsFlags);
  const anyAvailable =
    toolsFlags.goalPlanner ||
    toolsFlags.pastSipCheck ||
    toolsFlags.compareFunds ||
    toolsFlags.directVsRegular;

  return { ...toolsFlags, anyAvailable };
}
