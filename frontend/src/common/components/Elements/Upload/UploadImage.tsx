import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { type FileRejection, useDropzone } from 'react-dropzone';

import { type UploadProps } from '~/common/types';
import { StatusChip } from '~/modules/Users';

import RejectionFiles from './ErrorsRejectionFiles';

export default function UploadImage({
  error,
  file,
  disabled,
  helperText,
  sx,
  userStatus,
  children,
  ...other
}: UploadProps) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections: _fileRejections,
  } = useDropzone({
    multiple: false,
    disabled,
    accept: {
      'image/*': [],
    },
    ...other,
  });

  const hasFile = !!file;

  const hasError = isDragReject || !!error;

  const imgUrl = typeof file === 'string' ? file : file?.preview;

  // Note: avoid `readonly and cannot be assigned to the mutable type` error
  const fileRejections = _fileRejections as FileRejection[];

  const renderPreview = hasFile && (
    <img
      alt='avatar'
      src={imgUrl}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  );

  const renderPlaceholder = (
    <Stack
      alignItems='center'
      justifyContent='center'
      spacing={1}
      className='upload-placeholder'
      sx={{
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        zIndex: 9,
        borderRadius: '50%',
        position: 'absolute',
        color: 'text.disabled',
        bgcolor: (theme) => alpha(theme.palette.grey[500], 0.08),
        transition: (theme) =>
          theme.transitions.create(['opacity'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:hover': {
          opacity: 0.72,
        },
        ...(hasError && {
          color: 'error.main',
          bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
        }),
        ...(hasFile && {
          zIndex: 9,
          opacity: 0,
          color: 'common.white',
          bgcolor: (theme) => alpha(theme.palette.grey[900], 0.64),
        }),
      }}
    >
      <AddAPhotoIcon />

      <Typography variant='caption'>{file ? 'Update photo' : 'Upload photo'}</Typography>
    </Stack>
  );

  const renderContent = (
    <Box
      sx={{
        width: 1,
        height: 1,
        overflow: 'hidden',
        borderRadius: '50%',
        position: 'relative',
      }}
    >
      {renderPreview}
      {renderPlaceholder}
    </Box>
  );

  const renderUploadArea = () => (
    <Box
      {...getRootProps()}
      sx={{
        p: 1,
        m: 'auto',
        width: { xs: 144, sm: 200, lg: 144 },
        height: { xs: 144, sm: 200, lg: 144 },
        cursor: 'pointer',
        overflow: 'hidden',
        borderRadius: '50%',
        border: (theme) => `1px dashed ${alpha(theme.palette.grey[500], 0.2)}`,
        ...(isDragActive && {
          opacity: 0.72,
        }),
        ...(disabled && {
          opacity: 0.48,
          pointerEvents: 'none',
        }),
        ...(hasError && {
          borderColor: 'error.main',
        }),
        ...(hasFile && {
          ...(hasError && {
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
          }),
          '&:hover .upload-placeholder': {
            opacity: 1,
          },
        }),
        ...sx,
      }}
    >
      <input {...getInputProps()} />

      {renderContent}
    </Box>
  );

  const renderStatusChip = () =>
    userStatus && (
      <Box
        sx={{
          position: 'absolute',
          right: '-1rem',
          bottom: 0,
          p: '2px',
          background: '#fff',
          borderRadius: '1rem',
        }}
      >
        <StatusChip status={userStatus} />
      </Box>
    );

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginX: '3rem',
        }}
      >
        <Box>
          <Box position='relative'>
            {renderUploadArea()}
            {renderStatusChip()}
          </Box>
          {helperText && helperText}
        </Box>
        {children}
      </Box>

      <RejectionFiles fileRejections={fileRejections} />
    </>
  );
}
