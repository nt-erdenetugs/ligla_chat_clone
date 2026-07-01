import { useState } from 'react';

type ReturnType = {
  value: boolean;
  onTrue: () => void;
  onFalse: () => void;
  onToggle: () => void;
};

export function useBoolean(defaultValue?: boolean): ReturnType {
  const [value, setValue] = useState(!!defaultValue);

  const onTrue = () => {
    setValue(true);
  };

  const onFalse = () => {
    setValue(false);
  };

  const onToggle = () => {
    setValue((prev) => !prev);
  };

  return {
    value,
    onTrue,
    onFalse,
    onToggle,
  };
}
