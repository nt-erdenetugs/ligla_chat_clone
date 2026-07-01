import { Stack } from '@mui/material';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { ErrorCode, type FileRejection } from 'react-dropzone';

import { useTranslation } from '~/locales/hooks';
import { formatBytes } from '~/utils';
import { fileData } from '~/utils/file';

type Props = {
  fileRejections: FileRejection[];
};

export default function RejectionFiles({ fileRejections }: Props) {
  const { t_errors, t } = useTranslation();
  if (!fileRejections.length) {
    return null;
  }

  const renderErrorMessage = (code: ErrorCode | string, message: string) => {
    if (code === ErrorCode.FileInvalidType) {
      return t_errors('upload.fileInvalid');
    }
    if (code === ErrorCode.FileTooLarge) {
      return t_errors('upload.fileTooLarge');
    }

    return message;
  };

  return (
    <Paper
      variant='outlined'
      sx={{
        py: 1,
        px: 2,
        textAlign: 'left',
        borderStyle: 'dashed',
        borderColor: 'error.main',
        bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
      }}
    >
      {fileRejections.map(({ file, errors }) => {
        const { name, size } = fileData(file);

        return (
          <Box key={name} sx={{ my: 1 }}>
            <Typography variant='subtitle2' noWrap>
              {t('upload.fileDetail', {
                name,
                size: formatBytes(size),
              })}
            </Typography>

            <Stack>
              {errors.map(({ code, message }) => (
                <Box key={code} component='span' sx={{ typography: 'caption' }}>
                  - {renderErrorMessage(code, message)}
                </Box>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Paper>
  );
}
