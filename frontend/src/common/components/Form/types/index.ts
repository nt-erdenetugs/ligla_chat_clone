export type OptionValueType<Value> = {
  label: string;
  value: Value;
};

export type OptionProps<Value> = OptionValueType<Value> | [string, Value] | Value;
