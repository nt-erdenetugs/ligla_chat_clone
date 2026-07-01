import * as QRCode from 'qrcode';

export const generateQRCodeToBuffer = async (url: string) => {
  const dataUrl = await QRCode.toDataURL(url);
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(base64Data, 'base64');

  return qrBuffer;
};
