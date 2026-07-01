import { FileType } from '~/generated/graphql/types';

// prettier-ignore
const docExtensions = new Set(['pdf', 'doc', 'docx','odt','fodt', 'xls', 'xlsx','ods','fods', 'ppt', 'pptx', 'odp', 'fodp']);

// prettier-ignore
const audioExtensions = new Set(['mp3','wav','flac','aac','ogg','wma','m4a','aiff','au','ra','amr','opus','3gp','aac','ac3','eac3','ec3','mka','mp2','mpa','oga','spx','tta','weba']);

// prettier-ignore
const imageExtensions = new Set(['jpg','jpeg','png','gif','bmp','tiff','tif','webp','svg','ico','psd','ai','eps','raw','cr2','nef','arw','dng','orf','rw2','pef','srw','x3f','heic','heif']);

// prettier-ignore
const videoExtensions = new Set(['mp4','mkv','mov','wmv','flv','webm','m4v','3gp','3g2','asf','rm','rmvb','vob','ogv','drc','gif','gifv','mng','avi','qt','yuv','amv','mpg','mpeg','m2v','svi','mxf']);

// prettier-ignore
const zipExtensions = new Set(['zip']);

export const getFileType = (filename: string): FileType | null => {
  if (!filename) return null;

  const extension = filename.split('.').pop()?.toLowerCase();

  if (!extension) return null;

  if (docExtensions.has(extension)) return FileType.Document;
  if (audioExtensions.has(extension)) return FileType.Audio;
  if (imageExtensions.has(extension)) return FileType.Image;
  if (videoExtensions.has(extension)) return FileType.Video;
  if (zipExtensions.has(extension)) return FileType.Archive;

  console.warn('Unrecognized file type', extension);
  // File MIME/type validation is already enforced on both frontend and backend.
  // If the extension is unrecognized at this stage, default to "archive"
  // instead of throwing, since this step is only used for high-level categorization.
  return FileType.Archive;
};
