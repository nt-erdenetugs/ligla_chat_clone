import { truncate } from '~/utils';

const newLineRegex = /(\n)/g;

type NewLineProps = {
  text: string;
  maxRow?: number;
  maxLength?: number;
};

export const NewLine = ({ text, maxRow, maxLength }: NewLineProps) => {
  return (
    <>
      {truncate(text, maxLength)
        .split(newLineRegex)
        .slice(0, maxRow && maxRow * 2 - 1)
        .map((s, index) => {
          return newLineRegex.test(s) ? <br key={index} /> : s;
        })}
    </>
  );
};
