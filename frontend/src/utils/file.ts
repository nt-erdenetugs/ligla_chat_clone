import { API_PREFIXES } from '~/common/constants';
import { getLocale } from '~/lib/apollo-client';

import { fetchApi } from './api';
import { getSession } from './auth';
import { convertToBackendPagination } from './pagination';

export interface ExtendFile extends File {
  preview?: string;
  path?: string;
  lastModifiedDate?: string;
}

export type FetchResponse = Record<string, string> & {
  success: boolean;
};

export function fileTypeByUrl(fileUrl = '') {
  return (fileUrl && fileUrl.split('.').pop()) || '';
}

export function fileNameByUrl(fileUrl: string) {
  return fileUrl.split('/').pop();
}

export function fileData(file: ExtendFile | string) {
  // Url
  if (typeof file === 'string') {
    return {
      key: file,
      preview: file,
      name: fileNameByUrl(file),
      type: fileTypeByUrl(file),
    };
  }

  // File
  return {
    key: file.preview,
    name: file.name,
    size: file.size,
    path: file.path,
    type: file.type,
    preview: file.preview,
    lastModified: file.lastModified,
    lastModifiedDate: file.lastModifiedDate,
  };
}

export const getUploadUrl = (path: string) => {
  return `${import.meta.env.VITE_BACKEND_URL}/${API_PREFIXES.HTTP}/files/${path}`;
};

export const triggerBlobDownload = (data: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(data);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  window.URL.revokeObjectURL(url);
};

export const getFilenameFromHeaders = (response: Response) => {
  const headerFilename = response.headers.get('x-file-name');
  if (headerFilename) return decodeURIComponent(headerFilename);

  const contentDisposition = response.headers.get('Content-Disposition');
  if (!contentDisposition) return null;

  const match = contentDisposition.match(/filename\*?=["']?(?:UTF-8'')?([^"';\n]*)["']?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

export const downloadOperatorsQRs = async (
  paginationParams: { per: number; page: number },
  t?: (key: string) => string,
) => {
  const response = await fetchApi(
    'operator/qr-codes/download',
    {
      method: 'GET',
    },
    paginationParams && convertToBackendPagination(paginationParams),
  );

  const defaultFileName = 'operators_QRs.zip';
  const fileName = getFilenameFromHeaders(response) ?? defaultFileName;

  if (!response.ok) {
    if (!t) throw new Error('Failed to download file');

    if (response.status === 400) {
      throw new Error(t('qrDownload.noActiveOperators'));
    }
    throw new Error(t('qrDownload.failed'));
  }

  const data = await response.blob();

  triggerBlobDownload(data, fileName);
};

export const uploadFile = (url: string, file: File, userId?: string): Promise<FetchResponse> => {
  const accessToken = getSession();
  const formData = new FormData();
  formData.append('file', file);

  if (userId) {
    formData.append('userId', userId);
  }

  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Accept-Language': getLocale() },
    body: formData,
  }).then((result) => result.json() as unknown as FetchResponse);
};
