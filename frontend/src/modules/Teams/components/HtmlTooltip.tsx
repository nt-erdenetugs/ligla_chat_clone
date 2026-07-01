import { useState } from 'react';

import { styled } from '@mui/material/styles';
import Tooltip, { type TooltipProps, tooltipClasses } from '@mui/material/Tooltip';

const _HtmlTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(12),
    border: '1px solid #dadde9',
  },
}));

export const HtmlTooltip = ({ title, ...props }: TooltipProps) => {
  const [tooltipIsOpen, setTooltipIsOpen] = useState(false);
  return (
    <_HtmlTooltip
      open={tooltipIsOpen}
      onOpen={() => {
        // if title is falsy then don't open tooltip
        return title && setTooltipIsOpen(true);
      }}
      onClose={() => setTooltipIsOpen(false)}
      title={
        <div
          role='button'
          tabIndex={0}
          onClick={() => setTooltipIsOpen(false)}
          onKeyDown={() => {
            setTooltipIsOpen(false);
          }}
        >
          {title}
        </div>
      }
      {...props}
    />
  );
};
