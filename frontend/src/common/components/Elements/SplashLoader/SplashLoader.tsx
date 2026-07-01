import { useState, useEffect } from 'react';

import Box, { type BoxProps } from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';

import LOGO from '~/assets/images/liglaLogo.svg';

export const SplashLoader = ({ sx, ...other }: BoxProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Box
      sx={{
        right: 0,
        width: 1,
        bottom: 0,
        height: 1,
        zIndex: 9998,
        display: 'flex',
        position: 'fixed',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        ...sx,
      }}
      {...other}
    >
      <>
        <motion.div
          animate={{
            scale: [1, 0.9, 0.9, 1, 1],
            opacity: [1, 0.48, 0.48, 1, 1],
          }}
          transition={{
            duration: 2,
            ease: 'easeInOut',
            repeatDelay: 1,
            repeat: Infinity,
          }}
        >
          <img src={LOGO} width='100px' height='100px' alt='logo' />
        </motion.div>

        <Box
          component={motion.div}
          animate={{
            scale: [1.6, 1, 1, 1.6, 1.6],
            rotate: [270, 0, 0, 270, 270],
            opacity: [0.25, 1, 1, 1, 0.25],
            borderRadius: ['25%', '25%', '50%', '50%', '25%'],
          }}
          transition={{ ease: 'linear', duration: 3.2, repeat: Infinity }}
          sx={{
            width: 140,
            height: 140,
            position: 'absolute',
            border: (theme) => `solid 3px ${alpha(theme.palette.primary.dark, 0.24)}`,
          }}
        />

        <Box
          component={motion.div}
          animate={{
            scale: [1, 1.2, 1.2, 1, 1],
            rotate: [0, 270, 270, 0, 0],
            opacity: [1, 0.25, 0.25, 0.25, 1],
            borderRadius: ['25%', '25%', '50%', '50%', '25%'],
          }}
          transition={{
            ease: 'linear',
            duration: 3.2,
            repeat: Infinity,
          }}
          sx={{
            width: 160,
            height: 160,
            position: 'absolute',
            border: (theme) => `solid 8px ${alpha(theme.palette.primary.dark, 0.24)}`,
          }}
        />
      </>
    </Box>
  );
};
