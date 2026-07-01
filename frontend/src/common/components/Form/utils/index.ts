import { type OptionProps, type OptionValueType } from '~/common/components';

export const formatOptions = <Value>(options: readonly OptionProps<Value>[]) => {
  return options.map((option) => {
    if (Array.isArray(option)) {
      return { label: String(option[0]), value: option[1] };
    } else if (typeof option === 'object') {
      return option as OptionValueType<Value>;
    } else {
      return { label: String(option), value: option };
    }
  });
};
