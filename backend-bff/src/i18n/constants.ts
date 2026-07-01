enum LOCALES {
  ja = 'ja',
  en = 'en',
}

const fileI18n = {
  ja: {
    invalidFile: '無効なファイル形式です。有効な画像ファイルをアップロードしてください。',
    fileTooLarge:
      'アップロードしようとしているファイルのサイズが上限を超えています。ファイルサイズを小さくして、もう一度お試しください。',
  },
  en: {
    invalidFile: 'Invalid file type. Please upload a valid image file.',
    fileTooLarge: 'The file you are trying to upload is too large. Reduce its size and try again',
  },
};

export { LOCALES, fileI18n };
