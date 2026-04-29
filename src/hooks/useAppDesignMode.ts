import { useAppStore, type AppDesignMode } from '@/src/store/appStore';

export function useAppDesignMode(): {
  appDesignMode: AppDesignMode;
  setAppDesignMode: (mode: AppDesignMode) => void;
  isClearLens: boolean;
} {
  const appDesignMode = useAppStore((state) => state.appDesignMode);
  const setAppDesignMode = useAppStore((state) => state.setAppDesignMode);

  return {
    appDesignMode,
    setAppDesignMode,
    isClearLens: appDesignMode === 'clearLens',
  };
}
