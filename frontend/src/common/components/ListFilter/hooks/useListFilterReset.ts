export type URLSearchParamsInitLike = string | Array<[string, string]> | Record<string, string>;

export interface SetURLSearchParams {
  (
    nextInit: URLSearchParamsInitLike | ((previous: URLSearchParams) => URLSearchParamsInitLike),
    navigate?: boolean | { replace?: boolean; state?: unknown },
  ): void;
}

const clearFiltersAndSearchFromUrl = (setSearchParams?: SetURLSearchParams): void => {
  const deletePrefixes = (params: URLSearchParams) => {
    for (const key of Array.from(params.keys())) {
      if (key.startsWith('filters') || key.startsWith('search')) params.delete(key);
    }
  };

  if (typeof setSearchParams === 'function') {
    try {
      setSearchParams((previous: URLSearchParams) => {
        const next = new URLSearchParams(previous?.toString?.() ?? '');
        deletePrefixes(next);
        return next.toString();
      });
    } catch (err) {
      console.error('clearFiltersAndSearchFromUrl: setSearchParams failed', err);
    }
    return;
  }

  if (typeof window === 'undefined' || !window.location) return;

  const params = new URLSearchParams(window.location.search || '');
  deletePrefixes(params);
  const paramsToString = params.toString();
  try {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (paramsToString ? `?${paramsToString}` : ''),
    );
  } catch (err) {
    console.error('clearFiltersAndSearchFromUrl: history.replaceState failed', err);
  }
};

export const handleFormReset = (options?: {
  reset?: () => void;
  onResetRef?: { current?: (() => void) | undefined };
  handleClose?: () => void;
  setFilter?: (filters?: Record<string, unknown>) => void;
  setSearchParams?: SetURLSearchParams;
  syncToUrl?: boolean;
}): void => {
  try {
    if (options && typeof options.reset === 'function') options.reset();
    if (options && options.onResetRef && typeof options.onResetRef.current === 'function')
      options.onResetRef.current();
    if (options && typeof options.setFilter === 'function') options.setFilter({});

    if (options?.syncToUrl !== false) clearFiltersAndSearchFromUrl(options?.setSearchParams);

    if (options && typeof options.handleClose === 'function') options.handleClose();
  } catch (err) {
    console.error('handleFormReset failed', err);
  }
};
