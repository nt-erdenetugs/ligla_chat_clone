import { type ListFilterFormItem, parseFiltersFromUrl } from '~/common/components/ListFilter/util';

export const parseFilters = ({
  filter,
  defaultSearchItemName,
  enqueueSnackbar,
  t_toasts,
}: {
  filter?: string;
  defaultSearchItemName: string;
  enqueueSnackbar: (message: string, variant?: { variant: string }) => void;
  t_toasts: (s: string) => string;
}) => {
  if (!filter) return [] as ListFilterFormItem[];
  return parseFiltersFromUrl(filter, defaultSearchItemName, () =>
    enqueueSnackbar(t_toasts('filter.error.applyFailed'), { variant: 'error' }),
  );
};

export default { parseFilters };
